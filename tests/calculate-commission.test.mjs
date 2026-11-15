import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCommission } from '../src/calculate-commission.mjs';

const farmA = Object.freeze({
  producerOrderId: 'PO-1001-A',
  orderId: 'ORD-1001',
  producerId: 'farm-a',
  fulfilmentMethod: 'delivery',
  producerSubtotalInPence: 1200,
});
const farmB = Object.freeze({
  producerOrderId: 'PO-1001-B',
  orderId: 'ORD-1001',
  producerId: 'farm-b',
  fulfilmentMethod: 'collection',
  producerSubtotalInPence: 400,
});

test('calculates commission and payout for one producer', () => {
  assert.deepEqual(calculateCommission([farmA]), {
    producerOrders: [{ ...farmA, commissionInPence: 60, producerPayoutInPence: 1140 }],
    commissionTotalInPence: 60,
  });
});

test('reconciles the shared two-producer example and preserves order details', () => {
  const input = Object.freeze([farmA, farmB]);
  const result = calculateCommission(input);

  assert.deepEqual(result, {
    producerOrders: [
      { ...farmA, commissionInPence: 60, producerPayoutInPence: 1140 },
      { ...farmB, commissionInPence: 20, producerPayoutInPence: 380 },
    ],
    commissionTotalInPence: 80,
  });

  const totalPayoutInPence = result.producerOrders.reduce(
    (sum, order) => sum + order.producerPayoutInPence, 0
  );
  assert.equal(totalPayoutInPence + result.commissionTotalInPence, 1600);
  assert.deepEqual(calculateCommission(result.producerOrders), result);
});

test('rounds half a penny up for each producer before adding commissions', () => {
  const result = calculateCommission([
    { ...farmA, producerSubtotalInPence: 1010 },
    { ...farmB, producerSubtotalInPence: 1010 },
  ]);

  assert.deepEqual(
    result.producerOrders.map(order => [order.commissionInPence, order.producerPayoutInPence]),
    [[51, 959], [51, 959]]
  );
  assert.equal(result.commissionTotalInPence, 102);
});

test('rounds below half a penny down and handles a zero subtotal', () => {
  const result = calculateCommission([
    { ...farmA, producerSubtotalInPence: 9 },
    { ...farmB, producerSubtotalInPence: 0 },
  ]);

  assert.deepEqual(
    result.producerOrders.map(order => [order.commissionInPence, order.producerPayoutInPence]),
    [[0, 9], [0, 0]]
  );
  assert.equal(result.commissionTotalInPence, 0);
});

test('rejects an empty or malformed producer list', () => {
  assert.throws(() => calculateCommission([]), /non-empty array/);
  assert.throws(() => calculateCommission({}), /non-empty array/);
  assert.throws(() => calculateCommission([null]), /must be an object/);
});

test('rejects blank or duplicate producer IDs', () => {
  assert.throws(() => calculateCommission([{ ...farmA, producerId: ' ' }]), /producerId/);
  assert.throws(() => calculateCommission([farmA, farmA]), /more than one order/);
});

test('rejects amounts that cannot be represented as whole pence', () => {
  for (const subtotal of [-1, 4.5, '1200', undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => calculateCommission([{ ...farmA, producerSubtotalInPence: subtotal }]),
      /non-negative safe integer/
    );
  }
});

test('rejects a combined subtotal outside the safe integer range', () => {
  const largeOrder = { ...farmA, producerSubtotalInPence: Number.MAX_SAFE_INTEGER };
  assert.throws(() => calculateCommission([largeOrder, farmB]), RangeError);
});
