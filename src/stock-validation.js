const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const productKey = (producerId, productId) => JSON.stringify([producerId, productId]);
const result = (errors) => ({ canCheckout: errors.length === 0, errors });
const error = (code, message, details = {}) => ({ code, message, ...details });

/**
 * @param {{items: Array<{producerId: string, productId: string, quantity: number}>}} basket
 * @param {Array<{producerId: string, productId: string, name?: string,
 *   availableQuantity: number, isAvailable: boolean}>} products
 * @returns {{canCheckout: boolean, errors: Array<object>}}
 */
export function validateBasket(basket, products) {
  if (!isRecord(basket) || !Array.isArray(basket.items)) {
    return result([error('INVALID_BASKET', 'The basket must contain an items list.')]);
  }
  if (basket.items.length === 0) {
    return result([error('EMPTY_BASKET', 'Add at least one product before checkout.')]);
  }
  if (!Array.isArray(products)) {
    return result([error('INVALID_STOCK_DATA', 'Product data is missing. Refresh it before checking out.')]);
  }

  // Different producers may use the same product ID.
  const catalogue = new Map();
  const errors = [];
  for (const [productIndex, product] of products.entries()) {
    if (!isRecord(product) || !isId(product.productId) || !isId(product.producerId)
        || !Number.isSafeInteger(product.availableQuantity) || product.availableQuantity < 0
        || typeof product.isAvailable !== 'boolean') {
      errors.push(error('INVALID_STOCK_DATA', 'Product data is invalid. Refresh it before checking out.', { productIndex }));
      continue;
    }
    const key = productKey(product.producerId, product.productId);
    if (catalogue.has(key)) {
      errors.push(error('INVALID_STOCK_DATA', 'Duplicate stock records must be resolved before checkout.', {
        producerId: product.producerId, productId: product.productId,
      }));
    }
    catalogue.set(key, product);
  }
  if (errors.length > 0) return result(errors);

  // Repeated items must be checked using their combined quantity.
  const requested = new Map();
  for (const [itemIndex, item] of basket.items.entries()) {
    if (!isRecord(item) || !isId(item.productId) || !isId(item.producerId)) {
      errors.push(error('INVALID_ITEM', 'Each item needs a producer ID and product ID.', { itemIndex }));
      continue;
    }
    const details = { itemIndex, producerId: item.producerId, productId: item.productId };
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      errors.push(error('INVALID_QUANTITY', 'Choose a positive whole-number quantity.', details));
      continue;
    }
    const key = productKey(item.producerId, item.productId);
    const total = (requested.get(key)?.quantity ?? 0) + item.quantity;
    if (!Number.isSafeInteger(total)) {
      errors.push(error('INVALID_QUANTITY', 'The combined quantity is too large.', details));
      continue;
    }
    requested.set(key, { producerId: item.producerId, productId: item.productId, quantity: total });
  }

  for (const [key, item] of requested) {
    const product = catalogue.get(key);
    const details = {
      producerId: item.producerId, productId: item.productId, requestedQuantity: item.quantity,
    };
    if (!product) {
      errors.push(error('PRODUCT_NOT_FOUND', 'This product is not listed for this producer. Amend the basket.', details));
      continue;
    }
    const name = isId(product.name) ? product.name : product.productId;
    if (!product.isAvailable) {
      errors.push(error('PRODUCT_UNAVAILABLE', `${name} is currently unavailable. Amend the basket.`, details));
    } else if (item.quantity > product.availableQuantity) {
      errors.push(error('INSUFFICIENT_STOCK', `${name}: requested ${item.quantity}, but only ${product.availableQuantity} available. Amend the basket.`, {
        ...details, availableQuantity: product.availableQuantity,
      }));
    }
  }

  return result(errors);
}

export function validateStockVariables(variables) {
  return { stockValidation: validateBasket(variables?.basket, variables?.products) };
}
