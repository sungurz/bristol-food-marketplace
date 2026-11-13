export function simulatePayment({ orderId, paymentAttemptId, amountInPence }) {
  if (typeof orderId !== 'string' || !orderId.trim()) {
    throw new TypeError('orderId must be a non-empty string.');
  }
  if (typeof paymentAttemptId !== 'string' || !paymentAttemptId.trim()) {
    throw new TypeError('paymentAttemptId must be a non-empty string.');
  }
  if (!Number.isSafeInteger(amountInPence) || amountInPence <= 0) {
    throw new TypeError('amountInPence must be a positive whole number.');
  }

  return {
    paymentStatus: 'succeeded',
    paymentReference: `SIM-${paymentAttemptId}`,
    paymentProvider: 'simulated',
  };
}
