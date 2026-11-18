import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileStore } from '../src/order-store.js';
import { createMarketplaceOrder, createProducerOrder, OrderCreationError } from '../src/order-creation.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const products = JSON.parse(await readFile(new URL('../examples/stock-catalogue.json', import.meta.url), 'utf8'));

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
    products,
    ...overrides,
  };
}

async function temporaryStore(t) {
  const directory = await mkdtemp(join(tmpdir(), 'brfn-order-store-test-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('a saved value remains available through a newly created store instance', async (t) => {
  const directory = await temporaryStore(t);
  const first = createFileStore({ directory });
  assert.equal(await first.get('checkout:CHK-1001'), undefined);
  await first.setIfAbsent('checkout:CHK-1001', { orderId: 'ORD-1001' });

  const restarted = createFileStore({ directory });
  const returned = await restarted.get('checkout:CHK-1001');
  assert.deepEqual(returned, { orderId: 'ORD-1001' });
  returned.orderId = 'changed';
  assert.deepEqual(await restarted.get('checkout:CHK-1001'), { orderId: 'ORD-1001' });
});

test('parallel store instances never overwrite a saved key', async (t) => {
  const directory = await temporaryStore(t);
  const stores = Array.from({ length: 12 }, () => createFileStore({ directory }));
  const results = await Promise.all(stores.map((store, i) => (
    store.setIfAbsent('checkout:CHK-1001', { orderId: `ORD-${i}` })
  )));
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal((await readdir(directory)).filter((name) => name.endsWith('.json')).length, 1);
});

test('an existing order and producer order survive recreating the store', async (t) => {
  const directory = await temporaryStore(t);
  const original = createFileStore({ directory });
  const args = { store: original, now: () => NOW, newOrderId: () => 'ORD-1001' };
  const first = await createMarketplaceOrder(checkout(), args);

  // A fresh store object simulates a restarted worker using the same directory.
  const restarted = createFileStore({ directory });
  const retry = await createMarketplaceOrder(checkout(), {
    store: restarted, now: () => new Date('2026-11-16T11:00:00Z'), newOrderId: () => 'ORD-unwanted',
  });
  assert.deepEqual(retry, first);

  const producer = { producerId: 'farm-a' };
  const { producerOrder } = await createProducerOrder({ orderId: first.orderId, producer }, {
    store: restarted, newProducerOrderId: () => 'PO-1001-A',
  });
  const again = await createProducerOrder({ orderId: first.orderId, producer }, {
    store: createFileStore({ directory }), newProducerOrderId: () => 'PO-unwanted',
  });
  assert.deepEqual(again.producerOrder, producerOrder);
});

test('a changed confirmation remains a conflict after the worker restarts', async (t) => {
  const directory = await temporaryStore(t);
  await createMarketplaceOrder(checkout(), {
    store: createFileStore({ directory }), now: () => NOW, newOrderId: () => 'ORD-1001',
  });
  const changed = checkout({
    basket: { items: [{ producerId: 'farm-a', productId: 'apples', quantity: 2 }] },
  });
  await assert.rejects(
    createMarketplaceOrder(changed, { store: createFileStore({ directory }), now: () => NOW }),
    (error) => error instanceof OrderCreationError && error.code === 'CHECKOUT_CONFLICT',
  );
  const original = await createMarketplaceOrder(checkout(), {
    store: createFileStore({ directory }), now: () => NOW,
  });
  assert.equal(original.orderId, 'ORD-1001');
});

test('parallel conflicting checkouts on the same data directory cannot both succeed', async (t) => {
  const directory = await temporaryStore(t);
  const reduced = checkout({
    basket: { items: [{ producerId: 'farm-a', productId: 'apples', quantity: 2 }] },
    fulfilmentSelections: [checkout().fulfilmentSelections[0]],
    orderQuote: {
      currency: 'GBP',
      items: [checkout().orderQuote.items[0]],
      totalInPence: 1200,
    },
  });
  const results = await Promise.allSettled([
    createMarketplaceOrder(checkout(), {
      store: createFileStore({ directory }), now: () => NOW, newOrderId: () => 'ORD-A',
    }),
    createMarketplaceOrder(reduced, {
      store: createFileStore({ directory }), now: () => NOW, newOrderId: () => 'ORD-B',
    }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const conflict = results.find((result) => result.status === 'rejected');
  assert.equal(conflict.reason.code, 'CHECKOUT_CONFLICT');
});
