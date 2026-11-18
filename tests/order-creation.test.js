import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AWAITING_PAYMENT, OrderCreationError, createMarketplaceOrder, createMemoryStore, createProducerOrder,
} from '../src/order-creation.js';
import { calculateCommission } from '../src/calculate-commission.mjs';

const products = JSON.parse(await readFile(new URL('../examples/stock-catalogue.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-16T10:00:00Z');

const basketItems = [
  { producerId: 'farm-a', productId: 'apples', quantity: 2 },
  { producerId: 'farm-b', productId: 'bread', quantity: 1 },
];
const selections = [
  { producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: '2026-11-19T10:00:00Z' },
  { producerId: 'farm-b', fulfilmentMethod: 'collection', scheduledFor: '2026-11-19T14:00:00Z' },
];

// The quote prepare-fulfilment would show the customer for these items.
function quoteFor(items) {
  const quotedLines = new Map();
  for (const item of items) {
    const key = JSON.stringify([item.producerId, item.productId]);
    const unitPriceInPence = products.find((p) => (
      p.producerId === item.producerId && p.productId === item.productId
    ))?.unitPriceInPence ?? 0;
    const existing = quotedLines.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;
    quotedLines.set(key, {
      producerId: item.producerId,
      productId: item.productId,
      quantity,
      unitPriceInPence,
      lineTotalInPence: quantity * unitPriceInPence,
    });
  }
  const quoteItems = [...quotedLines.values()];
  return {
    currency: 'GBP',
    items: quoteItems,
    totalInPence: quoteItems.reduce((sum, item) => sum + item.lineTotalInPence, 0),
  };
}

function checkout(overrides = {}) {
  const items = overrides.basket?.items ?? basketItems;
  return {
    orderQuote: Array.isArray(items) ? quoteFor(items) : undefined,
    checkoutId: 'checkout-1',
    customerId: 'CUS-205',
    checkoutDecision: 'confirm',
    stockValidation: { canCheckout: true, errors: [] },
    fulfilmentValidation: { isValid: true, errors: [] },
    basket: { items: basketItems },
    fulfilmentSelections: selections,
    products,
    ...overrides,
  };
}

// Sequential IDs keep expectations readable; production uses random UUIDs.
function setup() {
  const store = createMemoryStore();
  let orders = 1000;
  let producerOrders = 0;
  return {
    store,
    order: { store, now: () => NOW, newOrderId: () => `ORD-${++orders}` },
    producerOrder: { store, newProducerOrderId: () => `PO-${++producerOrders}` },
  };
}

// Mirrors the Camunda model: one order, then one producer order per producer.
async function createAll(ctx, input = checkout()) {
  const order = await createMarketplaceOrder(input, ctx.order);
  const producerIds = [...new Set(input.basket.items.map((item) => item.producerId))];
  const producerOrders = [];
  for (const producerId of producerIds) {
    const { producerOrder } = await createProducerOrder({ orderId: order.orderId, producer: { producerId } }, ctx.producerOrder);
    producerOrders.push(producerOrder);
  }
  return { order, producerOrders };
}

const rejectsWith = (promise, code) => assert.rejects(promise, (error) => {
  assert.ok(error instanceof OrderCreationError);
  assert.equal(error.code, code);
  return true;
});

test('single-producer order is created awaiting payment with a trusted total', async () => {
  const ctx = setup();
  const { order, producerOrders } = await createAll(ctx, checkout({
    basket: { items: [basketItems[0]] },
    fulfilmentSelections: [selections[0]],
  }));

  assert.deepEqual(order, {
    orderId: 'ORD-1001',
    orderStatus: AWAITING_PAYMENT,
    orderCreatedAt: '2026-11-16T10:00:00.000Z',
    amountInPence: 1200,
  });
  assert.deepEqual(producerOrders, [{
    producerOrderId: 'PO-1',
    orderId: 'ORD-1001',
    producerId: 'farm-a',
    producerOrderStatus: AWAITING_PAYMENT,
    fulfilmentMethod: 'delivery',
    scheduledFor: '2026-11-19T10:00:00Z',
    items: [{ productId: 'apples', quantity: 2, unitPriceInPence: 600, lineTotalInPence: 1200 }],
    producerSubtotalInPence: 1200,
  }]);
});

test('multi-producer order matches the shared sample data', async () => {
  const { order, producerOrders } = await createAll(setup());

  assert.equal(order.amountInPence, 1600);
  assert.deepEqual(producerOrders.map((po) => [po.producerId, po.fulfilmentMethod, po.producerSubtotalInPence]), [
    ['farm-a', 'delivery', 1200],
    ['farm-b', 'collection', 400],
  ]);
  for (const po of producerOrders) {
    assert.equal(po.orderId, order.orderId);
    assert.equal(po.producerOrderStatus, AWAITING_PAYMENT);
  }
  assert.equal(new Set(producerOrders.map((po) => po.producerOrderId)).size, 2);
  const sum = producerOrders.reduce((total, po) => total + po.producerSubtotalInPence, 0);
  assert.equal(sum, order.amountInPence);
});

test('producer orders feed the existing commission calculation', async () => {
  const { producerOrders } = await createAll(setup());
  const result = calculateCommission(producerOrders);
  assert.equal(result.commissionTotalInPence, 80);
  assert.deepEqual(result.producerOrders.map((po) => po.producerPayoutInPence), [1140, 380]);
});

test('repeated basket lines are combined into one item', async () => {
  const ctx = setup();
  const { order, producerOrders } = await createAll(ctx, checkout({
    basket: { items: [...basketItems, { producerId: 'farm-a', productId: 'apples', quantity: 1 }] },
  }));
  assert.deepEqual(producerOrders[0].items, [
    { productId: 'apples', quantity: 3, unitPriceInPence: 600, lineTotalInPence: 1800 },
  ]);
  assert.equal(order.amountInPence, 2200);
});

test('prices come from the catalogue, not from the basket', async () => {
  const { order, producerOrders } = await createAll(setup(), checkout({
    basket: { items: basketItems.map((item) => ({ ...item, unitPriceInPence: 1 })) },
  }));
  assert.equal(order.amountInPence, 1600);
  assert.equal(producerOrders[0].items[0].unitPriceInPence, 600);
});

test('an order is refused if prices changed since the customer saw the quote', async () => {
  const ctx = setup();
  await rejectsWith(createMarketplaceOrder(checkout({
    orderQuote: { ...quoteFor(basketItems), totalInPence: 1500 },
  }), ctx.order), 'PRICE_CHANGED');
  await rejectsWith(createMarketplaceOrder(checkout({ orderQuote: undefined }), ctx.order), 'QUOTE_MISSING');
  assert.deepEqual(ctx.store.keys(), []);
});

test('an order is refused if quote lines differ despite an unchanged total', async () => {
  const ctx = setup();
  const quote = quoteFor(basketItems);
  quote.items[0].productId = 'different-product';
  await rejectsWith(createMarketplaceOrder(checkout({ orderQuote: quote }), ctx.order), 'PRICE_CHANGED');
  assert.deepEqual(ctx.store.keys(), []);
});

test('a retried order task returns the same order instead of a duplicate', async () => {
  const ctx = setup();
  const first = await createMarketplaceOrder(checkout(), ctx.order);
  const retry = await createMarketplaceOrder(checkout(), { ...ctx.order, now: () => new Date('2026-11-16T10:05:00Z') });

  assert.deepEqual(retry, first);
  const orders = ctx.store.keys().filter((key) => key.startsWith('checkout:'));
  assert.equal(orders.length, 1);
});

test('a retry rejects a changed basket instead of silently reusing the existing order', async () => {
  const ctx = setup();
  const first = await createMarketplaceOrder(checkout(), ctx.order);
  await rejectsWith(createMarketplaceOrder(checkout({ basket: { items: [basketItems[1]] } }), ctx.order), 'CHECKOUT_CONFLICT');
  assert.deepEqual(await createMarketplaceOrder(checkout(), ctx.order), first);
  assert.equal(ctx.store.keys().filter((key) => key.startsWith('checkout:')).length, 1);
});

test('a retry rejects changed fulfilment choices, customer or confirmed quote', async () => {
  const ctx = setup();
  const first = await createMarketplaceOrder(checkout(), ctx.order);
  const changedInputs = [
    checkout({ fulfilmentSelections: [{ ...selections[0], fulfilmentMethod: 'collection' }, selections[1]] }),
    checkout({ customerId: 'CUS-different' }),
    checkout({ orderQuote: { ...quoteFor(basketItems), totalInPence: 1500 } }),
  ];
  for (const changed of changedInputs) {
    await rejectsWith(createMarketplaceOrder(changed, ctx.order), 'CHECKOUT_CONFLICT');
  }
  assert.deepEqual(await createMarketplaceOrder(checkout(), ctx.order), first);
});

test('a retry accepts the same confirmed items and selections in a different order', async () => {
  const ctx = setup();
  const first = await createMarketplaceOrder(checkout(), ctx.order);
  const reorderedBasket = [...basketItems].reverse();
  const retry = await createMarketplaceOrder(checkout({
    basket: { items: reorderedBasket },
    fulfilmentSelections: [...selections].reverse(),
    orderQuote: quoteFor(reorderedBasket),
  }), ctx.order);
  assert.deepEqual(retry, first);
});

test('a retried producer-order task returns the same producer order', async () => {
  const ctx = setup();
  const { orderId } = await createMarketplaceOrder(checkout(), ctx.order);
  const input = { orderId, producer: { producerId: 'farm-a' } };
  const first = await createProducerOrder(input, ctx.producerOrder);
  const retry = await createProducerOrder(input, ctx.producerOrder);

  assert.deepEqual(retry, first);
  const saved = ctx.store.keys().filter((key) => key.startsWith('producer-order:'));
  assert.equal(saved.length, 1);
});

test('parallel producer-order tasks, including a duplicate, create one order per producer', async () => {
  const ctx = setup();
  const { orderId } = await createMarketplaceOrder(checkout(), ctx.order);
  const results = await Promise.all(['farm-a', 'farm-b', 'farm-a'].map((producerId) => (
    createProducerOrder({ orderId, producer: { producerId } }, ctx.producerOrder)
  )));
  assert.equal(results[0].producerOrder.producerOrderId, results[2].producerOrder.producerOrderId);
  assert.notEqual(results[0].producerOrder.producerOrderId, results[1].producerOrder.producerOrderId);
});

test('parallel runs of the same order task create one order', async () => {
  const ctx = setup();
  const [a, b] = await Promise.all([
    createMarketplaceOrder(checkout(), ctx.order),
    createMarketplaceOrder(checkout(), ctx.order),
  ]);
  assert.equal(a.orderId, b.orderId);
  const orders = ctx.store.keys().filter((key) => key.startsWith('checkout:'));
  assert.equal(orders.length, 1);
});

test('parallel conflicting confirmations do not both succeed', async () => {
  const ctx = setup();
  const changedBasket = [basketItems[0]];
  const results = await Promise.allSettled([
    createMarketplaceOrder(checkout(), ctx.order),
    createMarketplaceOrder(checkout({
      basket: { items: changedBasket },
      fulfilmentSelections: [selections[0]],
    }), ctx.order),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected.reason instanceof OrderCreationError);
  assert.equal(rejected.reason.code, 'CHECKOUT_CONFLICT');
  assert.equal(ctx.store.keys().filter((key) => key.startsWith('checkout:')).length, 1);
});

test('a retry repairs an order whose second save failed, so producer orders find their parent', async () => {
  const ctx = setup();
  const realSetIfAbsent = ctx.store.setIfAbsent;
  let failNextOrderLink = true;
  ctx.store.setIfAbsent = async (key, value) => {
    if (failNextOrderLink && key.startsWith('order:')) {
      failNextOrderLink = false;
      throw new Error('database unavailable');
    }
    return realSetIfAbsent(key, value);
  };

  await assert.rejects(createMarketplaceOrder(checkout(), ctx.order), /database unavailable/);
  const { orderId } = await createMarketplaceOrder(checkout(), ctx.order);
  const { producerOrder } = await createProducerOrder({ orderId, producer: { producerId: 'farm-a' } }, ctx.producerOrder);
  assert.equal(producerOrder.orderId, orderId);
});

test('different checkouts create different orders', async () => {
  const ctx = setup();
  const a = await createMarketplaceOrder(checkout({ checkoutId: 'checkout-1' }), ctx.order);
  const b = await createMarketplaceOrder(checkout({ checkoutId: 'checkout-2' }), ctx.order);
  assert.notEqual(a.orderId, b.orderId);
});

test('changing a returned order does not change the saved one', async () => {
  const ctx = setup();
  const { orderId } = await createMarketplaceOrder(checkout(), ctx.order);
  const input = { orderId, producer: { producerId: 'farm-a' } };
  const { producerOrder } = await createProducerOrder(input, ctx.producerOrder);
  producerOrder.items[0].quantity = 99;
  const again = await createProducerOrder(input, ctx.producerOrder);
  assert.equal(again.producerOrder.items[0].quantity, 2);
});

test('the default IDs are unique', async () => {
  const store = createMemoryStore();
  const a = await createMarketplaceOrder(checkout({ checkoutId: 'x' }), { store });
  const b = await createMarketplaceOrder(checkout({ checkoutId: 'y' }), { store });
  assert.match(a.orderId, /^ORD-/);
  assert.notEqual(a.orderId, b.orderId);
});

test('invalid input is rejected with a clear code and nothing is saved', async (t) => {
  const cases = [
    ['missing checkoutId', checkout({ checkoutId: '' }), 'INVALID_CHECKOUT'],
    ['missing customerId', checkout({ customerId: undefined }), 'INVALID_CUSTOMER'],
    ['empty basket', checkout({ basket: { items: [] } }), 'EMPTY_BASKET'],
    ['missing product data', checkout({ products: undefined }), 'INVALID_PRODUCT_DATA'],
    ['item without producer', checkout({ basket: { items: [{ productId: 'apples', quantity: 1 }] } }), 'INVALID_ITEM'],
    ['zero quantity', checkout({ basket: { items: [{ ...basketItems[0], quantity: 0 }] } }), 'INVALID_QUANTITY'],
    ['fractional quantity', checkout({ basket: { items: [{ ...basketItems[0], quantity: 1.5 }] } }), 'INVALID_QUANTITY'],
    ['unknown product', checkout({ basket: { items: [{ producerId: 'farm-a', productId: 'bread', quantity: 1 }] } }), 'PRODUCT_NOT_FOUND'],
    ['product without price', checkout({ products: products.map(({ unitPriceInPence, ...rest }) => rest) }), 'PRICE_UNAVAILABLE'],
    ['no choice for one producer', checkout({ fulfilmentSelections: [selections[0]] }), 'FULFILMENT_SELECTION_MISSING'],
    ['unknown method', checkout({ fulfilmentSelections: [{ ...selections[0], fulfilmentMethod: 'post' }, selections[1]] }), 'INVALID_FULFILMENT'],
    ['bad date', checkout({ fulfilmentSelections: [{ ...selections[0], scheduledFor: 'next week' }, selections[1]] }), 'INVALID_FULFILMENT'],
    ['stock check failed', checkout({ stockValidation: { canCheckout: false, errors: [] } }), 'STOCK_NOT_VALIDATED'],
    ['no stock check result', checkout({ stockValidation: undefined }), 'STOCK_NOT_VALIDATED'],
    ['fulfilment check failed', checkout({ fulfilmentValidation: { isValid: false, errors: [] } }), 'FULFILMENT_NOT_VALIDATED'],
    ['no fulfilment check result', checkout({ fulfilmentValidation: undefined }), 'FULFILMENT_NOT_VALIDATED'],
    ['checkout not confirmed', checkout({ checkoutDecision: 'amend' }), 'CHECKOUT_NOT_CONFIRMED'],
    ['no checkout decision', checkout({ checkoutDecision: undefined }), 'CHECKOUT_NOT_CONFIRMED'],
    ['date in the past', checkout({ fulfilmentSelections: [{ ...selections[0], scheduledFor: '2026-11-15T10:00:00Z' }, selections[1]] }), 'FULFILMENT_TIME_PASSED'],
    ['date exactly now', checkout({ fulfilmentSelections: [{ ...selections[0], scheduledFor: NOW.toISOString() }, selections[1]] }), 'FULFILMENT_TIME_PASSED'],
    ['duplicate catalogue record', checkout({ products: [...products, { ...products[0], unitPriceInPence: 1 }] }), 'INVALID_PRODUCT_DATA'],
    ['two choices for one producer', checkout({ fulfilmentSelections: [...selections, selections[0]] }), 'INVALID_FULFILMENT'],
  ];
  for (const [name, input, code] of cases) {
    await t.test(name, async () => {
      const ctx = setup();
      await rejectsWith(createMarketplaceOrder(input, ctx.order), code);
      assert.deepEqual(ctx.store.keys(), []);
    });
  }
});

test('producer orders need an existing order that includes the producer', async () => {
  const ctx = setup();
  const { orderId } = await createMarketplaceOrder(checkout({
    basket: { items: [basketItems[0]] },
    fulfilmentSelections: [selections[0]],
  }), ctx.order);

  await rejectsWith(createProducerOrder({ orderId: 'ORD-missing', producer: { producerId: 'farm-a' } }, ctx.producerOrder), 'ORDER_NOT_FOUND');
  await rejectsWith(createProducerOrder({ orderId, producer: { producerId: 'farm-b' } }, ctx.producerOrder), 'PRODUCER_NOT_IN_ORDER');
  await rejectsWith(createProducerOrder({ orderId, producer: {} }, ctx.producerOrder), 'INVALID_PRODUCER');
  await rejectsWith(createProducerOrder({ producer: { producerId: 'farm-a' } }, ctx.producerOrder), 'INVALID_ORDER');
});
