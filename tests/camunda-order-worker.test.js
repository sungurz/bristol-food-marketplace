import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryStore } from '../src/order-creation.js';
import { createFileStore } from '../src/order-store.js';
import {
  ORDER_JOB_TYPES, processOrderJob, readOrderWorkerConfig, runOrderWorker,
} from '../src/camunda-order-worker.js';

const products = JSON.parse(await readFile(new URL('../examples/stock-catalogue.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-16T10:00:00Z');

function checkout(overrides = {}) {
  return {
    checkoutId: 'CHK-1001',
    customerId: 'CUS-205',
    checkoutDecision: 'confirm',
    stockValidation: { canCheckout: true, errors: [] },
    fulfilmentValidation: { isValid: true, errors: [] },
    basket: { items: [
      { producerId: 'farm-a', productId: 'apples', quantity: 2 },
      { producerId: 'farm-b', productId: 'bread', quantity: 1 },
    ] },
    fulfilmentSelections: [
      { producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: '2026-11-19T10:00:00Z' },
      { producerId: 'farm-b', fulfilmentMethod: 'collection', scheduledFor: '2026-11-19T14:00:00Z' },
    ],
    orderQuote: {
      currency: 'GBP',
      items: [
        { producerId: 'farm-a', productId: 'apples', quantity: 2, unitPriceInPence: 600, lineTotalInPence: 1200 },
        { producerId: 'farm-b', productId: 'bread', quantity: 1, unitPriceInPence: 400, lineTotalInPence: 400 },
      ],
      totalInPence: 1600,
    },
    ...overrides,
  };
}

function fakeClient() {
  const posts = [];
  return {
    posts,
    async post(path, body) {
      posts.push({ path, body });
      return undefined;
    },
  };
}

test('marketplace job uses trusted product prices and completes with agreed variables', async () => {
  const client = fakeClient();
  const fakeUntrustedProducts = products.map((p) => ({ ...p, unitPriceInPence: 1 }));
  const result = await processOrderJob({
    jobKey: '101', type: 'create-marketplace-order', retries: 3,
    variables: { ...checkout(), products: fakeUntrustedProducts },
  }, {
    client, store: createMemoryStore(), loadProducts: async () => products,
    now: () => NOW, newOrderId: () => 'ORD-1001',
  });

  assert.equal(result.status, 'completed');
  assert.deepEqual(client.posts, [{
    path: '/jobs/101/completion',
    body: { variables: {
      orderId: 'ORD-1001',
      orderStatus: 'awaiting_payment',
      orderCreatedAt: NOW.toISOString(),
      amountInPence: 1600,
    } },
  }]);
});

test('producer job returns local producerOrder for BPMN multi-instance collection', async () => {
  const client = fakeClient();
  const store = createMemoryStore();
  const parent = await processOrderJob({
    jobKey: '101', type: 'create-marketplace-order', retries: 3, variables: checkout(),
  }, { client, store, loadProducts: async () => products, now: () => NOW, newOrderId: () => 'ORD-1001' });

  const result = await processOrderJob({
    jobKey: '102', type: 'create-producer-order', retries: 3,
    variables: { orderId: parent.variables.orderId, producer: { producerId: 'farm-b' } },
  }, {
    client, store, loadProducts: async () => { throw new Error('Not used by producer orders.'); },
    newProducerOrderId: () => 'PO-1001-B',
  });
  assert.equal(result.status, 'completed');
  assert.deepEqual(client.posts[1], {
    path: '/jobs/102/completion',
    body: { variables: { producerOrder: {
      producerOrderId: 'PO-1001-B',
      orderId: 'ORD-1001',
      producerId: 'farm-b',
      producerOrderStatus: 'awaiting_payment',
      fulfilmentMethod: 'collection',
      scheduledFor: '2026-11-19T14:00:00Z',
      items: [{ productId: 'bread', quantity: 1, unitPriceInPence: 400, lineTotalInPence: 400 }],
      producerSubtotalInPence: 400,
    } } },
  });
});

test('an invalid confirmation fails the job without retrying invalid data', async () => {
  const client = fakeClient();
  const result = await processOrderJob({
    jobKey: '103', type: 'create-marketplace-order', retries: 3,
    variables: checkout({ checkoutDecision: 'amend' }),
  }, { client, store: createMemoryStore(), loadProducts: async () => products });
  assert.deepEqual(result, { status: 'failed', retries: 0, errorCode: 'CHECKOUT_NOT_CONFIRMED' });
  assert.equal(client.posts[0].path, '/jobs/103/failure');
  assert.equal(client.posts[0].body.retries, 0);
  assert.match(client.posts[0].body.errorMessage, /CHECKOUT_NOT_CONFIRMED/);
});

test('a temporary trusted-source failure decrements Camunda retries', async () => {
  const client = fakeClient();
  const result = await processOrderJob({
    jobKey: '104', type: 'create-marketplace-order', retries: 3, variables: checkout(),
  }, {
    client, store: createMemoryStore(), loadProducts: async () => { throw new Error('source offline'); },
  });
  assert.deepEqual(result, { status: 'failed', retries: 2, errorCode: undefined });
  assert.deepEqual(client.posts, [{
    path: '/jobs/104/failure',
    body: {
      retries: 2,
      errorMessage: 'Order creation temporarily failed. Check the trusted catalogue and order store.',
      retryBackOff: 2000,
    },
  }]);
});

test('a Camunda completion error can be retried without duplicating a saved order', async () => {
  const store = createMemoryStore();
  let failCompletionOnce = true;
  const client = {
    posts: [],
    async post(path, body) {
      this.posts.push({ path, body });
      if (path.endsWith('/completion') && failCompletionOnce) {
        failCompletionOnce = false;
        throw new Error('completion response lost');
      }
    },
  };
  const job = { jobKey: '105', type: 'create-marketplace-order', retries: 3, variables: checkout() };
  await assert.rejects(processOrderJob(job, {
    client, store, loadProducts: async () => products, now: () => NOW, newOrderId: () => 'ORD-1001',
  }), /completion response lost/);
  const retried = await processOrderJob(job, {
    client, store, loadProducts: async () => products, now: () => NOW, newOrderId: () => 'ORD-unwanted',
  });
  assert.equal(retried.variables.orderId, 'ORD-1001');
  assert.equal(client.posts.filter((p) => p.path.endsWith('/failure')).length, 0);
});

test('Camunda order jobs use the same persistent order after worker restart', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brfn-camunda-order-test-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const job = { jobKey: '106', type: 'create-marketplace-order', retries: 3, variables: checkout() };
  const first = await processOrderJob(job, {
    client: fakeClient(), store: createFileStore({ directory }),
    loadProducts: async () => products, now: () => NOW, newOrderId: () => 'ORD-1001',
  });
  const retried = await processOrderJob(job, {
    client: fakeClient(), store: createFileStore({ directory }),
    loadProducts: async () => products, now: () => NOW, newOrderId: () => 'ORD-unwanted',
  });
  assert.equal(first.variables.orderId, 'ORD-1001');
  assert.deepEqual(retried.variables, first.variables);
});

test('worker polls both BPMN job types and requests only their expected variables', async () => {
  const controller = new AbortController();
  const requests = [];
  const client = {
    async post(path, body) {
      assert.equal(path, '/jobs/activation');
      requests.push(body);
      if (requests.length === 2) controller.abort();
      return { jobs: [] };
    },
  };
  await runOrderWorker({
    client, store: createMemoryStore(), loadProducts: async () => products,
    signal: controller.signal, log: () => {}, pollMs: 1,
  });
  assert.deepEqual(requests.map((request) => request.type), ORDER_JOB_TYPES);
  assert.ok(requests[0].fetchVariable.includes('checkoutId'));
  assert.deepEqual(requests[1].fetchVariable, ['orderId', 'producer']);
});

test('worker configuration keeps store data outside the repository by default', () => {
  const config = readOrderWorkerConfig({});
  assert.ok(config.orderDirectory.endsWith('/brfn-order-data'));
  assert.ok(config.source.file.endsWith('/examples/stock-catalogue.json'));
  assert.throws(() => readOrderWorkerConfig({ STOCK_FILE: 'a.json', STOCK_URL: 'https://example.com' }),
    /not both/);
});
