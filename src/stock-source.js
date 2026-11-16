import { readFile } from 'node:fs/promises';
import { validateStockData } from './stock-validation.js';

export class StockSourceError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'StockSourceError';
  }
}

// The path or endpoint is server configuration, never a process/Form variable.
export function createStockSource({ file, url, token, timeoutMs = 5000 }) {
  if (Boolean(file) === Boolean(url)) throw new Error('Configure exactly one stock file or URL.');
  if (url && !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error('The stock endpoint must use HTTP or HTTPS.');
  }
  return async function loadProducts() {
    let products;
    try {
      if (url) {
        const response = await fetch(url, {
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Stock endpoint returned HTTP ${response.status}.`);
        products = await response.json();
      } else {
        products = JSON.parse(await readFile(file, { encoding: 'utf8', signal: AbortSignal.timeout(timeoutMs) }));
      }
    } catch (cause) {
      throw new StockSourceError('Stock data could not be loaded.', { cause });
    }
    if (validateStockData(products).length) {
      throw new StockSourceError('Stock data has invalid or duplicate records.');
    }
    return products;
  };
}
