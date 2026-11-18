import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { CamundaApiError, createCamundaClient } from './camunda-stock-worker.js';
import { createStockSource } from './stock-source.js';

export const PREPARE_FULFILMENT_JOB_TYPE = 'prepare-fulfilment';
const METHODS = new Set(['delivery', 'collection']);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const productKey = (producerId, productId) => JSON.stringify([producerId, productId]);

export class FulfilmentPreparationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FulfilmentPreparationError';
    this.code = code;
  }
}

function invalid(code, message) {
  throw new FulfilmentPreparationError(code, message);
}

/** Read only from the worker's trusted configuration, not process variables. */
export function createProducerOptionsSource({ file }) {
  if (!isId(file)) throw new Error('Configure a trusted producer options file.');
  return async () => JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Build the inputs required by the existing Camunda fulfilment Form and order workers.
 * Each invocation replaces stale selections and recalculates every quoted item.
 */
export function prepareFulfilmentVariables({ basket, stockValidation, products, producerOptions } = {}) {
  if (stockValidation?.canCheckout !== true) {
    invalid('STOCK_NOT_VALIDATED', 'Fulfilment can only be prepared after stock validation passes.');
  }
  if (!isRecord(basket) || !Array.isArray(basket.items) || basket.items.length === 0) {
    invalid('INVALID_BASKET', 'The current basket must have at least one item.');
  }
  if (!Array.isArray(products)) invalid('INVALID_CATALOGUE', 'The trusted product catalogue is missing.');
  if (!Array.isArray(producerOptions)) invalid('INVALID_PRODUCER_OPTIONS', 'Trusted producer options are missing.');

  const catalogue = new Map();
  for (const product of products) {
    if (!isRecord(product) || !isId(product.producerId) || !isId(product.productId)) {
      invalid('INVALID_CATALOGUE', 'A trusted product record has invalid identifiers.');
    }
    const key = productKey(product.producerId, product.productId);
    if (catalogue.has(key)) invalid('INVALID_CATALOGUE', 'The trusted catalogue contains duplicate products.');
    catalogue.set(key, product);
  }

  const methodsByProducer = new Map();
  for (const option of producerOptions) {
    if (!isRecord(option) || !isId(option.producerId) || !Array.isArray(option.supportedMethods)
        || option.supportedMethods.length === 0 || option.supportedMethods.some((value) => !METHODS.has(value))
        || new Set(option.supportedMethods).size !== option.supportedMethods.length
        || methodsByProducer.has(option.producerId)) {
      invalid('INVALID_PRODUCER_OPTIONS', 'Trusted producer methods must be unique and contain delivery, collection, or both.');
    }
    methodsByProducer.set(option.producerId, [...option.supportedMethods]);
  }

  // Combine repeated products before calculating prices and per-producer items.
  const basketLines = new Map();
  for (const item of basket.items) {
    if (!isRecord(item) || !isId(item.producerId) || !isId(item.productId)
        || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      invalid('INVALID_BASKET_ITEM', 'Basket items need valid producer/product IDs and positive whole-number quantities.');
    }
    const key = productKey(item.producerId, item.productId);
    const quantity = (basketLines.get(key)?.quantity ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) invalid('AMOUNT_TOO_LARGE', 'Combined basket quantity is too large.');
    basketLines.set(key, { producerId: item.producerId, productId: item.productId, quantity });
  }

  const producerItems = new Map();
  const quoteItems = [];
  let totalInPence = 0;
  for (const [key, line] of basketLines) {
    const product = catalogue.get(key);
    if (!product) invalid('PRODUCT_NOT_FOUND', 'A basket item is missing from the trusted catalogue.');
    if (!Number.isSafeInteger(product.unitPriceInPence) || product.unitPriceInPence < 0) {
      invalid('PRICE_UNAVAILABLE', 'A basket item has no valid trusted price.');
    }
    const lineTotalInPence = line.quantity * product.unitPriceInPence;
    if (!Number.isSafeInteger(lineTotalInPence)) invalid('AMOUNT_TOO_LARGE', 'A priced basket line is too large.');
    totalInPence += lineTotalInPence;
    if (!Number.isSafeInteger(totalInPence)) invalid('AMOUNT_TOO_LARGE', 'The order quote is too large.');

    quoteItems.push({ ...line, unitPriceInPence: product.unitPriceInPence, lineTotalInPence });
    if (!producerItems.has(line.producerId)) producerItems.set(line.producerId, []);
    producerItems.get(line.producerId).push({ productId: line.productId, quantity: line.quantity });
  }

  const producers = [];
  const fulfilmentOptions = [];
  const fulfilmentSelections = [];
  for (const [producerId, items] of producerItems) {
    const supportedMethods = methodsByProducer.get(producerId);
    if (!supportedMethods) {
      invalid('PRODUCER_OPTIONS_MISSING', `No trusted fulfilment options exist for producer ${producerId}.`);
    }
    producers.push({ producerId, items, supportedMethods: [...supportedMethods] });
    fulfilmentOptions.push({ producerId, supportedMethods: [...supportedMethods] });
    fulfilmentSelections.push({ producerId, fulfilmentMethod: null, scheduledFor: null });
  }

  return {
    producers,
    fulfilmentOptions,
    fulfilmentSelections,
    orderQuote: { currency: 'GBP', items: quoteItems, totalInPence },
  };
}

/** Report permanent contract problems as incidents; allow retries for temporary source failures. */
export async function processPrepareFulfilmentJob(job, { client, loadProducts, loadOptions }) {
  if (!job?.jobKey) throw new Error('Activated fulfilment preparation job has no key.');
  const path = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let variables;
  try {
    const [products, producerOptions] = await Promise.all([loadProducts(), loadOptions()]);
    variables = prepareFulfilmentVariables({ ...job.variables, products, producerOptions });
  } catch (error) {
    const permanent = error instanceof FulfilmentPreparationError;
    const retries = permanent ? 0 : Math.max(0, (Number.isInteger(job.retries) ? job.retries : 1) - 1);
    await client.post(`${path}/failure`, {
      retries,
      errorMessage: permanent ? `${error.code}: ${error.message}` : 'Trusted catalogue or producer options could not be loaded.',
      ...(retries ? { retryBackOff: 2000 } : {}),
    });
    return { status: 'failed', retries, errorCode: permanent ? error.code : undefined };
  }

  await client.post(`${path}/completion`, { variables });
  return { status: 'completed', variables };
}

export async function runPrepareFulfilmentWorker({ client, loadProducts, loadOptions, signal, log = console.log,
  jobTimeoutMs = 60000, activationTimeoutMs = 5000, pollMs = 500, maxBackoffMs = 10000 }) {
  let backoff = pollMs;
  log('Waiting for prepare-fulfilment jobs.');
  while (!signal?.aborted) {
    try {
      const response = await client.post('/jobs/activation', {
        type: PREPARE_FULFILMENT_JOB_TYPE,
        worker: 'brfn-fulfilment-worker',
        timeout: jobTimeoutMs,
        requestTimeout: activationTimeoutMs,
        maxJobsToActivate: 1,
        fetchVariable: ['basket', 'stockValidation'],
      }, signal);
      if (!Array.isArray(response?.jobs)) throw new Error('Camunda activation response has no jobs list.');
      for (const job of response.jobs) {
        const outcome = await processPrepareFulfilmentJob(job, { client, loadProducts, loadOptions });
        log(`Fulfilment job ${job.jobKey}: ${outcome.status}.`);
      }
      backoff = pollMs;
      if (response.jobs.length) continue;
    } catch (error) {
      if (signal?.aborted) break;
      if (error instanceof CamundaApiError && [404, 409].includes(error.status)) {
        log('Fulfilment job is no longer active; waiting for another job.');
      } else {
        log('Fulfilment worker request failed; Camunda can retry an unacknowledged job when its lease expires.');
      }
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
    try { await delay(backoff, undefined, { signal }); } catch (error) {
      if (!signal?.aborted) throw error;
    }
  }
  log('Fulfilment worker stopped.');
}

export function readPrepareFulfilmentConfig(env = process.env) {
  const integer = (name, fallback) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive whole number.`);
    return value;
  };
  if (env.STOCK_FILE && env.STOCK_URL) throw new Error('Set STOCK_FILE or STOCK_URL, not both.');
  const requestTimeoutMs = integer('CAMUNDA_REQUEST_TIMEOUT_MS', 10000);
  const stockTimeoutMs = integer('STOCK_TIMEOUT_MS', 5000);
  const jobTimeoutMs = integer('FULFILMENT_JOB_TIMEOUT_MS', 60000);
  const activationTimeoutMs = integer('CAMUNDA_ACTIVATION_TIMEOUT_MS', 5000);
  if (activationTimeoutMs >= requestTimeoutMs || stockTimeoutMs + 2 * requestTimeoutMs >= jobTimeoutMs) {
    throw new Error('Camunda request and source timeouts must fit inside the fulfilment-job lease.');
  }
  return {
    client: { url: env.CAMUNDA_REST_URL || 'http://localhost:8080/v2', token: env.CAMUNDA_TOKEN, timeoutMs: requestTimeoutMs },
    source: {
      file: env.STOCK_URL ? undefined : resolve(env.STOCK_FILE || 'examples/stock-catalogue.json'),
      url: env.STOCK_URL, token: env.STOCK_TOKEN, timeoutMs: stockTimeoutMs,
    },
    producerOptionsFile: resolve(env.FULFILMENT_OPTIONS_FILE || 'examples/producer-fulfilment-options.json'),
    jobTimeoutMs, activationTimeoutMs, pollMs: integer('FULFILMENT_POLL_MS', 500),
  };
}

async function main() {
  const config = readPrepareFulfilmentConfig();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runPrepareFulfilmentWorker({
      ...config,
      client: createCamundaClient(config.client),
      loadProducts: createStockSource(config.source),
      loadOptions: createProducerOptionsSource({ file: config.producerOptionsFile }),
      signal: controller.signal,
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Fulfilment worker could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
