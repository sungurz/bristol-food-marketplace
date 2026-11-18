import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CamundaApiError, createCamundaClient } from './camunda-stock-worker.js';
import { createStockSource } from './stock-source.js';
import { createFileStore } from './order-store.js';
import { createMarketplaceOrder, createProducerOrder, OrderCreationError } from './order-creation.js';

export const ORDER_JOB_TYPES = ['create-marketplace-order', 'create-producer-order'];

const FETCH_VARIABLES = {
  'create-marketplace-order': [
    'checkoutId', 'customerId', 'checkoutDecision', 'basket',
    'stockValidation', 'fulfilmentValidation', 'fulfilmentSelections', 'orderQuote',
  ],
  'create-producer-order': ['orderId', 'producer'],
};

/**
 * Handle a job using trusted stock data and durable order storage.
 * Invalid confirmed data raises a Camunda incident; temporary errors use retries.
 */
export async function processOrderJob(job, {
  client, store, loadProducts, jobType = job?.type,
  now, newOrderId, newProducerOrderId,
}) {
  if (!job?.jobKey) throw new Error('Activated order job has no job key.');
  const path = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let variables;

  try {
    if (jobType === 'create-marketplace-order') {
      // Product prices come from the worker's configured source, never from BPMN variables.
      const products = await loadProducts();
      variables = await createMarketplaceOrder(
        { ...job.variables, products },
        { store, ...(now ? { now } : {}), ...(newOrderId ? { newOrderId } : {}) },
      );
    } else if (jobType === 'create-producer-order') {
      variables = await createProducerOrder(job.variables, {
        store, ...(newProducerOrderId ? { newProducerOrderId } : {}),
      });
    } else {
      throw new Error('Unsupported order job type.');
    }
  } catch (error) {
    const invalidInput = error instanceof OrderCreationError;
    const retries = invalidInput ? 0 : Math.max(0, (Number.isInteger(job.retries) ? job.retries : 1) - 1);
    const errorMessage = invalidInput
      ? `${error.code}: ${error.message}`
      : 'Order creation temporarily failed. Check the trusted catalogue and order store.';
    await client.post(`${path}/failure`, {
      retries,
      errorMessage,
      ...(retries ? { retryBackOff: 2000 } : {}),
    });
    return { status: 'failed', retries, errorCode: invalidInput ? error.code : undefined };
  }

  // If completion fails after the order was saved, Camunda can retry safely.
  await client.post(`${path}/completion`, { variables });
  return { status: 'completed', variables };
}

export async function runOrderWorker({
  client, store, loadProducts, signal, log = console.log,
  jobTimeoutMs = 60000, activationTimeoutMs = 5000, pollMs = 500, maxBackoffMs = 10000,
}) {
  let backoff = pollMs;
  log('Waiting for checkout order-creation jobs.');
  while (!signal?.aborted) {
    try {
      let processed = false;
      for (const type of ORDER_JOB_TYPES) {
        const response = await client.post('/jobs/activation', {
          type,
          worker: 'brfn-order-worker',
          timeout: jobTimeoutMs,
          requestTimeout: activationTimeoutMs,
          maxJobsToActivate: 1,
          fetchVariable: FETCH_VARIABLES[type],
        }, signal);
        if (!Array.isArray(response?.jobs)) throw new Error('Camunda activation response has no jobs list.');

        for (const job of response.jobs) {
          const outcome = await processOrderJob(job, { client, store, loadProducts, jobType: type });
          log(`Order job ${job.jobKey} (${type}): ${outcome.status}.`);
          processed = true;
        }
      }
      backoff = pollMs;
      if (processed) continue;
    } catch (error) {
      if (signal?.aborted) break;
      if (error instanceof CamundaApiError && [404, 409].includes(error.status)) {
        log('Order job is no longer active; waiting for another job.');
      } else {
        log('Order worker request failed; Camunda can retry an unacknowledged job after its lease expires.');
      }
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
    try {
      await delay(backoff, undefined, { signal });
    } catch (error) {
      if (!signal?.aborted) throw error;
    }
  }
  log('Order worker stopped.');
}

export function readOrderWorkerConfig(env = process.env) {
  const integer = (key, fallback) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} must be a positive whole number.`);
    return value;
  };
  if (env.STOCK_FILE && env.STOCK_URL) throw new Error('Set STOCK_FILE or STOCK_URL, not both.');
  const requestTimeoutMs = integer('CAMUNDA_REQUEST_TIMEOUT_MS', 10000);
  const sourceTimeoutMs = integer('STOCK_TIMEOUT_MS', 5000);
  const jobTimeoutMs = integer('ORDER_JOB_TIMEOUT_MS', 60000);
  const activationTimeoutMs = integer('CAMUNDA_ACTIVATION_TIMEOUT_MS', 5000);
  if (activationTimeoutMs >= requestTimeoutMs || sourceTimeoutMs + 2 * requestTimeoutMs >= jobTimeoutMs) {
    throw new Error('Camunda request and stock timeouts must fit inside the order-job lease.');
  }
  return {
    client: {
      url: env.CAMUNDA_REST_URL || 'http://localhost:8080/v2',
      token: env.CAMUNDA_TOKEN,
      timeoutMs: requestTimeoutMs,
    },
    source: {
      file: env.STOCK_URL ? undefined : resolve(env.STOCK_FILE || 'examples/stock-catalogue.json'),
      url: env.STOCK_URL,
      token: env.STOCK_TOKEN,
      timeoutMs: sourceTimeoutMs,
    },
    // Default is next to the repository, not inside Git-tracked source.
    orderDirectory: resolve(env.ORDER_STORE_DIR || '../brfn-order-data'),
    jobTimeoutMs,
    activationTimeoutMs,
    pollMs: integer('ORDER_POLL_MS', 500),
  };
}

async function main() {
  const config = readOrderWorkerConfig();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runOrderWorker({
      ...config,
      client: createCamundaClient(config.client),
      loadProducts: createStockSource(config.source),
      store: createFileStore({ directory: config.orderDirectory }),
      signal: controller.signal,
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Order worker could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
