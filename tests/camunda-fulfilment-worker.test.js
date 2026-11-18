import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PREPARE_FULFILMENT_JOB_TYPE, FulfilmentPreparationError,
  prepareFulfilmentVariables, createProducerOptionsSource, processPrepareFulfilmentJob,
  readPrepareFulfilmentConfig, runPrepareFulfilmentWorker,
} from '../src/camunda-fulfilment-worker.js';

const products = [
  { producerId: 'farm-a', productId: 'apples', availableQuantity: 3, isAvailable: true, unitPriceInPence: 600 },
  { producerId: 'farm-b', productId: 'bread', availableQuantity: 4, isAvailable: true, unitPriceInPence: 400 },
];
const producerOptions = [
  { producerId: 'farm-a', supportedMethods: ['delivery', 'collection'] },
  { producerId: 'farm-b', supportedMethods: ['collection'] },
];
const basket = { items: [
  { producerId: 'farm-a', productId: 'apples', quantity: 2 },
  { producerId: 'farm-b', productId: 'bread', quantity: 1 },
] };
const input = (overrides = {}) => ({
  basket, stockValidation: { canCheckout: true, errors: [] }, products, producerOptions, ...overrides,
});

test('prepares two Form rows, producer order-loop entries and the 1600p trusted quote', () => {
  const result = prepareFulfilmentVariables(input());
  assert.deepEqual(result.fulfilmentSelections, [
    { producerId: 'farm-a', fulfilmentMethod: null, scheduledFor: null },
    { producerId: 'farm-b', fulfilmentMethod: null, scheduledFor: null },
  ]);
  assert.deepEqual(result.fulfilmentOptions, producerOptions);
  assert.deepEqual(result.producers, [
    { producerId: 'farm-a', items: [{ productId: 'apples', quantity: 2 }], supportedMethods: ['delivery', 'collection'] },
    { producerId: 'farm-b', items: [{ productId: 'bread', quantity: 1 }], supportedMethods: ['collection'] },
  ]);
  assert.deepEqual(result.orderQuote, {
    currency: 'GBP',
    items: [
      { producerId: 'farm-a', productId: 'apples', quantity: 2, unitPriceInPence: 600, lineTotalInPence: 1200 },
      { producerId: 'farm-b', productId: 'bread', quantity: 1, unitPriceInPence: 400, lineTotalInPence: 400 },
    ],
    totalInPence: 1600,
  });
});

test('amended basket removes old producers, choices and quote lines', () => {
  const earlier = prepareFulfilmentVariables(input());
  earlier.fulfilmentSelections[0].fulfilmentMethod = 'delivery';
  const amended = prepareFulfilmentVariables(input({
    basket: { items: [{ producerId: 'farm-b', productId: 'bread', quantity: 2 }] },
    fulfilmentSelections: earlier.fulfilmentSelections,
    orderQuote: earlier.orderQuote,
  }));
  assert.deepEqual(amended.fulfilmentSelections, [
    { producerId: 'farm-b', fulfilmentMethod: null, scheduledFor: null },
  ]);
  assert.deepEqual(amended.fulfilmentOptions, [producerOptions[1]]);
  assert.equal(amended.orderQuote.totalInPence, 800);
  assert.equal(amended.orderQuote.items.length, 1);
  assert.equal(amended.producers.length, 1);
});

test('combines repeated basket lines using only the catalogue price', () => {
  const result = prepareFulfilmentVariables(input({
    basket: { items: [
      { producerId: 'farm-a', productId: 'apples', quantity: 1, unitPriceInPence: 1 },
      { producerId: 'farm-a', productId: 'apples', quantity: 2, unitPriceInPence: 1 },
    ] },
  }));
  assert.deepEqual(result.orderQuote.items, [
    { producerId: 'farm-a', productId: 'apples', quantity: 3, unitPriceInPence: 600, lineTotalInPence: 1800 },
  ]);
  assert.equal(result.orderQuote.totalInPence, 1800);
  assert.equal(result.producers.length, 1);
});

test('rejects missing prices, missing producer options and unsupported source values', () => {
  const failure = (overrides, code) => {
    assert.throws(() => prepareFulfilmentVariables(input(overrides)), (error) =>
      error instanceof FulfilmentPreparationError && error.code === code);
  };
  failure({ products: [{ ...products[0] }, { ...products[1], unitPriceInPence: undefined }] }, 'PRICE_UNAVAILABLE');
  failure({ producerOptions: [producerOptions[0]] }, 'PRODUCER_OPTIONS_MISSING');
  failure({ producerOptions: [producerOptions[0], { producerId: 'farm-b', supportedMethods: ['drone'] }] }, 'INVALID_PRODUCER_OPTIONS');
  failure({ producerOptions: [...producerOptions, producerOptions[0]] }, 'INVALID_PRODUCER_OPTIONS');
  failure({ products: [...products, products[0]] }, 'INVALID_CATALOGUE');
});

test('rejects invalid quantities, huge totals, missing products and stock not approved', () => {
  const failure = (overrides, code) => {
    assert.throws(() => prepareFulfilmentVariables(input(overrides)), (error) => error.code === code);
  };
  failure({ basket: { items: [{ producerId: 'farm-a', productId: 'apples', quantity: 0 }] } }, 'INVALID_BASKET_ITEM');
  failure({ basket: { items: [{ producerId: 'farm-a', productId: 'apples', quantity: 2 },
    { producerId: 'farm-a', productId: 'apples', quantity: 9007199254740991 }] } }, 'AMOUNT_TOO_LARGE');
  failure({ basket: { items: [{ producerId: 'farm-a', productId: 'missing', quantity: 1 }] } }, 'PRODUCT_NOT_FOUND');
  failure({ stockValidation: { canCheckout: false, errors: [] } }, 'STOCK_NOT_VALIDATED');
});

test('loads trusted producer configuration from a file', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'brfn-producer-options-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'options.json');
  await writeFile(file, JSON.stringify(producerOptions));
  const loadOptions = createProducerOptionsSource({ file });
  assert.deepEqual(await loadOptions(), producerOptions);
});

test('completes the Camunda preparation job with four contracted variables', async () => {
  const calls = [];
  const client = { async post(path, body) { calls.push({ path, body }); } };
  const outcome = await processPrepareFulfilmentJob({ jobKey: '77', variables: input() }, {
    client, loadProducts: async () => products, loadOptions: async () => producerOptions,
  });
  assert.equal(outcome.status, 'completed');
  assert.equal(calls[0].path, '/jobs/77/completion');
  assert.deepEqual(Object.keys(calls[0].body.variables).sort(),
    ['producers', 'fulfilmentOptions', 'fulfilmentSelections', 'orderQuote'].sort());
  assert.equal(calls[0].body.variables.orderQuote.totalInPence, 1600);
});

test('bad trusted inputs create an incident without completing the task', async () => {
  const calls = [];
  const outcome = await processPrepareFulfilmentJob({ jobKey: '78', retries: 3, variables: input() }, {
    client: { async post(path, body) { calls.push({ path, body }); } },
    loadProducts: async () => products,
    loadOptions: async () => [{ producerId: 'farm-a', supportedMethods: ['collection'] }],
  });
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.errorCode, 'PRODUCER_OPTIONS_MISSING');
  assert.equal(calls[0].path, '/jobs/78/failure');
  assert.equal(calls[0].body.retries, 0);
});

test('temporary source failures use Camunda retries', async () => {
  const calls = [];
  const outcome = await processPrepareFulfilmentJob({ jobKey: '79', retries: 3, variables: input() }, {
    client: { async post(path, body) { calls.push({ path, body }); } },
    loadProducts: async () => { throw new Error('offline'); },
    loadOptions: async () => producerOptions,
  });
  assert.equal(outcome.status, 'failed');
  assert.equal(calls[0].body.retries, 2);
  assert.equal(calls[0].body.retryBackOff, 2000);
});

test('worker activates the BPMN prepare-fulfilment job type', async () => {
  const calls = [];
  const controller = new AbortController();
  const client = { async post(path, body) {
    calls.push({ path, body });
    controller.abort();
    return { jobs: [] };
  } };
  await runPrepareFulfilmentWorker({ client, loadProducts: async () => products,
    loadOptions: async () => producerOptions, signal: controller.signal, log: () => {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.type, PREPARE_FULFILMENT_JOB_TYPE);
  assert.deepEqual(calls[0].body.fetchVariable, ['basket', 'stockValidation']);
});

test('configuration uses the project sample files by default', () => {
  const config = readPrepareFulfilmentConfig({});
  assert.equal(config.client.url, 'http://localhost:8080/v2');
  assert.match(config.producerOptionsFile, /examples\/producer-fulfilment-options\.json$/);
  assert.match(config.source.file, /examples\/stock-catalogue\.json$/);
});
