export function calculateCommission(producerOrders) {
  if (!Array.isArray(producerOrders) || producerOrders.length === 0) {
    throw new TypeError('producerOrders must be a non-empty array.');
  }

  const producerIds = new Set();
  const calculatedOrders = [];
  let orderSubtotalInPence = 0;
  let commissionTotalInPence = 0;

  for (const producerOrder of producerOrders) {
    if (!producerOrder || typeof producerOrder !== 'object' || Array.isArray(producerOrder)) {
      throw new TypeError('Each producer order must be an object.');
    }

    const { producerId, producerSubtotalInPence } = producerOrder;
    if (typeof producerId !== 'string' || !producerId.trim()) {
      throw new TypeError('producerId must be a non-empty string.');
    }
    if (producerIds.has(producerId)) {
      throw new TypeError(`producerOrders contains more than one order for ${producerId}.`);
    }
    if (!Number.isSafeInteger(producerSubtotalInPence) || producerSubtotalInPence < 0) {
      throw new TypeError('producerSubtotalInPence must be a non-negative safe integer.');
    }

    producerIds.add(producerId);
    orderSubtotalInPence += producerSubtotalInPence;
    // Five percent is one twentieth. Round each producer's share half up.
    const commissionInPence = Math.round(producerSubtotalInPence / 20);
    commissionTotalInPence += commissionInPence;
    calculatedOrders.push({
      ...producerOrder,
      commissionInPence,
      producerPayoutInPence: producerSubtotalInPence - commissionInPence,
    });
  }

  if (!Number.isSafeInteger(orderSubtotalInPence)) {
    throw new RangeError('The order subtotal exceeds the supported range in pence.');
  }

  return { producerOrders: calculatedOrders, commissionTotalInPence };
}
