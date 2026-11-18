import { createHash, randomUUID } from 'node:crypto';


export const AWAITING_PAYMENT = 'awaiting_payment';
const FULFILMENT_METHODS = new Set(['delivery', 'collection']);

export class OrderCreationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderCreationError';
    this.code = code;
    this.details = details;
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const productKey = (producerId, productId) => JSON.stringify([producerId, productId]);
const fail = (code, message, details) => { throw new OrderCreationError(code, message, details); };
const copy = (value) => structuredClone(value);

const checkoutKey = (checkoutId) => `checkout:${checkoutId}`;
const orderKey = (orderId) => `order:${orderId}`;
const producerOrderKey = (orderId, producerId) => `producer-order:${JSON.stringify([orderId, producerId])}`;


function normalizedRows(rows, fields) {
  if (!Array.isArray(rows)) return null;
  return rows.map((row) => Object.fromEntries(fields.map((field) => [field, row?.[field]])))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function confirmationDigest({ customerId, basket, fulfilmentSelections, orderQuote }) {
  const confirmed = {
    customerId,
    basketItems: normalizedRows(basket?.items, ['producerId', 'productId', 'quantity']),
    fulfilmentSelections: normalizedRows(fulfilmentSelections, ['producerId', 'fulfilmentMethod', 'scheduledFor']),
    orderQuote: {
      currency: orderQuote?.currency,
      totalInPence: orderQuote?.totalInPence,
      items: normalizedRows(orderQuote?.items, [
        'producerId', 'productId', 'quantity', 'unitPriceInPence', 'lineTotalInPence',
      ]),
    },
  };
  return createHash('sha256').update(JSON.stringify(confirmed)).digest('hex');
}

function ensureMatchingCheckout(savedOrder, confirmedDigest, checkoutId) {
  if (savedOrder.confirmedDigest !== confirmedDigest) {
    fail('CHECKOUT_CONFLICT',
      'This checkout already created an order with different confirmed details. Start a new checkout.',
      { checkoutId });
  }
  return savedOrder;
}


export function createMemoryStore() {
  const records = new Map();
  return {
    async get(key) {
      return records.has(key) ? copy(records.get(key)) : undefined;
    },
   
    async setIfAbsent(key, value) {
      if (!records.has(key)) records.set(key, copy(value));
      return copy(records.get(key));
    },
    keys: () => [...records.keys()],
  };
}


function priceBasket(basket, products) {
  if (!isRecord(basket) || !Array.isArray(basket.items) || basket.items.length === 0) {
    fail('EMPTY_BASKET', 'The basket must contain at least one item.');
  }
  if (!Array.isArray(products)) fail('INVALID_PRODUCT_DATA', 'Trusted product data is missing.');

  const catalogue = new Map();
  for (const product of products) {
    if (isRecord(product) && isId(product.producerId) && isId(product.productId)) {
      const key = productKey(product.producerId, product.productId);
      // Two records for one product could carry different prices, so refuse to guess.
      if (catalogue.has(key)) {
        fail('INVALID_PRODUCT_DATA', 'The catalogue has more than one record for a product.', {
          producerId: product.producerId, productId: product.productId,
        });
      }
      catalogue.set(key, product);
    }
  }

  // Map keeps basket order, so producers and items appear in the order the customer added them.
  const lines = new Map();
  for (const [itemIndex, item] of basket.items.entries()) {
    if (!isRecord(item) || !isId(item.producerId) || !isId(item.productId)) {
      fail('INVALID_ITEM', 'Each basket item needs a producerId and productId.', { itemIndex });
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      fail('INVALID_QUANTITY', 'Each quantity must be a whole number above zero.', { itemIndex });
    }
    const key = productKey(item.producerId, item.productId);
    const line = lines.get(key);
    if (line) line.quantity += item.quantity;
    else lines.set(key, { producerId: item.producerId, productId: item.productId, quantity: item.quantity });
  }

  const producers = new Map();
  for (const [key, line] of lines) {
    const product = catalogue.get(key);
    const details = { producerId: line.producerId, productId: line.productId };
    if (!product) fail('PRODUCT_NOT_FOUND', 'A basket item is not in the product catalogue.', details);
    // Prices only ever come from the catalogue. Any price sent in the basket is ignored.
    if (!Number.isSafeInteger(product.unitPriceInPence) || product.unitPriceInPence < 0) {
      fail('PRICE_UNAVAILABLE', 'A basket item has no valid price in the catalogue.', details);
    }
    const lineTotalInPence = line.quantity * product.unitPriceInPence;
    if (!Number.isSafeInteger(lineTotalInPence)) fail('AMOUNT_TOO_LARGE', 'The order total is too large.', details);

    if (!producers.has(line.producerId)) producers.set(line.producerId, []);
    producers.get(line.producerId).push({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceInPence: product.unitPriceInPence,
      lineTotalInPence,
    });
  }
  return producers;
}

/** Each producer in the basket needs exactly one delivery or collection choice. */
function selectionsByProducer(fulfilmentSelections, producerIds, now) {
  if (!Array.isArray(fulfilmentSelections)) {
    fail('INVALID_FULFILMENT', 'fulfilmentSelections must be a list.');
  }
  const selections = new Map();
  for (const selection of fulfilmentSelections) {
    if (!isRecord(selection) || !isId(selection.producerId)) {
      fail('INVALID_FULFILMENT', 'Each fulfilment selection needs a producerId.');
    }
    const { producerId, fulfilmentMethod, scheduledFor } = selection;
    if (selections.has(producerId)) {
      fail('INVALID_FULFILMENT', 'A producer has more than one fulfilment selection.', { producerId });
    }
    if (!FULFILMENT_METHODS.has(fulfilmentMethod)) {
      fail('INVALID_FULFILMENT', 'fulfilmentMethod must be "delivery" or "collection".', { producerId });
    }
    if (typeof scheduledFor !== 'string' || Number.isNaN(Date.parse(scheduledFor))) {
      fail('INVALID_FULFILMENT', 'scheduledFor must be an ISO 8601 date-time.', { producerId });
    }
    // The 48-hour rule is checked by validate-fulfilment; this only stops dates that have already passed.
    if (Date.parse(scheduledFor) <= now.getTime()) {
      fail('FULFILMENT_TIME_PASSED', 'scheduledFor must be in the future.', { producerId });
    }
    selections.set(producerId, { fulfilmentMethod, scheduledFor });
  }
  for (const producerId of producerIds) {
    if (!selections.has(producerId)) {
      fail('FULFILMENT_SELECTION_MISSING', 'A producer in the basket has no delivery or collection choice.', { producerId });
    }
  }
  return selections;
}


export async function createMarketplaceOrder(input, { store, now = () => new Date(), newOrderId = () => `ORD-${randomUUID()}` } = {}) {
  const {
    checkoutId, customerId, checkoutDecision, stockValidation, fulfilmentValidation,
    basket, fulfilmentSelections, orderQuote, products,
  } = input ?? {};
  if (!isId(checkoutId)) fail('INVALID_CHECKOUT', 'checkoutId must be a non-empty string.');
  if (!isId(customerId)) fail('INVALID_CUSTOMER', 'customerId must be a non-empty string.');

  
  if (stockValidation?.canCheckout !== true) {
    fail('STOCK_NOT_VALIDATED', 'An order is only created after the stock check has passed.');
  }
  if (fulfilmentValidation?.isValid !== true) {
    fail('FULFILMENT_NOT_VALIDATED', 'An order is only created after the delivery and collection choices have passed their check.');
  }
  if (checkoutDecision !== 'confirm') {
    fail('CHECKOUT_NOT_CONFIRMED', 'An order is only created after the customer confirms checkout.');
  }

  const confirmedDigest = confirmationDigest({ customerId, basket, fulfilmentSelections, orderQuote });
  const existing = await store.get(checkoutKey(checkoutId));
  if (existing) return linkAndReturn(store, ensureMatchingCheckout(existing, confirmedDigest, checkoutId));

  const pricedItems = priceBasket(basket, products);
  const createdAt = now();
  const selections = selectionsByProducer(fulfilmentSelections, pricedItems.keys(), createdAt);

  const parts = [...pricedItems].map(([producerId, items]) => {
    const producerSubtotalInPence = items.reduce((sum, item) => sum + item.lineTotalInPence, 0);
    return [producerId, { ...selections.get(producerId), items, producerSubtotalInPence }];
  });
  const producerParts = Object.fromEntries(parts);
  const amountInPence = parts.reduce((sum, [, part]) => sum + part.producerSubtotalInPence, 0);
  if (!Number.isSafeInteger(amountInPence)) fail('AMOUNT_TOO_LARGE', 'The order total is too large.');

  if (!isRecord(orderQuote) || orderQuote.currency !== 'GBP'
      || !Array.isArray(orderQuote.items) || !Number.isSafeInteger(orderQuote.totalInPence)) {
    fail('QUOTE_MISSING', 'The trusted GBP order quote the customer confirmed is missing or incomplete.');
  }
  if (orderQuote.totalInPence !== amountInPence) {
    fail('PRICE_CHANGED', 'Prices changed after the customer saw the quote. Show the new quote before creating the order.', {
      quotedInPence: orderQuote.totalInPence, currentInPence: amountInPence,
    });
  }

  const trustedQuoteLines = new Map(parts.flatMap(([producerId, part]) => (
    part.items.map((item) => [productKey(producerId, item.productId), { producerId, ...item }])
  )));
  if (orderQuote.items.length !== trustedQuoteLines.size) {
    fail('PRICE_CHANGED', 'The quoted products no longer match the basket. Review the updated quote.');
  }
  const seenQuotedLines = new Set();
  for (const quotedItem of orderQuote.items) {
    const key = productKey(quotedItem?.producerId, quotedItem?.productId);
    const trustedItem = trustedQuoteLines.get(key);
    if (!isRecord(quotedItem) || seenQuotedLines.has(key) || !trustedItem
        || quotedItem.quantity !== trustedItem.quantity
        || quotedItem.unitPriceInPence !== trustedItem.unitPriceInPence
        || quotedItem.lineTotalInPence !== trustedItem.lineTotalInPence) {
      fail('PRICE_CHANGED', 'The quoted products, quantities or prices changed. Review the updated quote.');
    }
    seenQuotedLines.add(key);
  }

  const order = {
    orderId: newOrderId(),
    checkoutId,
    customerId,
    orderStatus: AWAITING_PAYMENT,
    orderCreatedAt: createdAt.toISOString(),
    amountInPence,
    // Compare this immutable confirmation on retries, including concurrent attempts.
    confirmedDigest,
    // Kept with the order so each producer order uses exactly the prices that make up amountInPence.
    producerParts,
  };
  // A concurrent run may win the insert. Reject its data if this confirmation differs.
  const savedOrder = await store.setIfAbsent(checkoutKey(checkoutId), order);
  return linkAndReturn(store, ensureMatchingCheckout(savedOrder, confirmedDigest, checkoutId));
}


async function linkAndReturn(store, order) {
  await store.setIfAbsent(orderKey(order.orderId), order.checkoutId);
  return toVariables(order);
}

const toVariables = ({ orderId, orderStatus, orderCreatedAt, amountInPence }) => (
  { orderId, orderStatus, orderCreatedAt, amountInPence }
);

/**
 * Task `create-producer-order`, run once per producer: create this producer's part of the
 * order, or return the one already created. `orderId` plus `producerId` is the duplicate key.
 */
export async function createProducerOrder(input, { store, newProducerOrderId = () => `PO-${randomUUID()}` } = {}) {
  const { orderId, producer } = input ?? {};
  if (!isId(orderId)) fail('INVALID_ORDER', 'orderId must be a non-empty string.');
  const producerId = producer?.producerId;
  if (!isId(producerId)) fail('INVALID_PRODUCER', 'producer.producerId must be a non-empty string.');

  const key = producerOrderKey(orderId, producerId);
  const existing = await store.get(key);
  if (existing) return { producerOrder: existing };

  const checkoutId = await store.get(orderKey(orderId));
  const order = checkoutId === undefined ? undefined : await store.get(checkoutKey(checkoutId));
  if (!order) fail('ORDER_NOT_FOUND', 'No order exists with this orderId.', { orderId });
  const part = Object.hasOwn(order.producerParts, producerId) ? order.producerParts[producerId] : undefined;
  if (!part) fail('PRODUCER_NOT_IN_ORDER', 'This producer has no items in the order.', { orderId, producerId });

  const producerOrder = {
    producerOrderId: newProducerOrderId(),
    orderId,
    producerId,
    producerOrderStatus: AWAITING_PAYMENT,
    fulfilmentMethod: part.fulfilmentMethod,
    scheduledFor: part.scheduledFor,
    items: part.items,
    producerSubtotalInPence: part.producerSubtotalInPence,
  };
  // If another run for this producer got there first, its producer order wins.
  return { producerOrder: await store.setIfAbsent(key, producerOrder) };
}
