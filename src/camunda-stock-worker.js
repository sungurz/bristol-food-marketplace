import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBasket } from './stock-validation.js';
import { createStockSource } from './stock-source.js';

export const STOCK_JOB_TYPE = 'validate-stock';
export const STOCK_ERROR_CODE = 'STOCK_CHECK_UNAVAILABLE';

export class CamundaApiError extends Error {
  constructor(status, path) {
    super(`Camunda returned HTTP ${status} for ${path}.`);
    this.status = status;
  }
}

export function createCamundaClient({ url, token, timeoutMs = 10000 }) {
  const base = new URL(url);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
      || base.search || base.hash) throw new Error('Use a Camunda HTTP(S) base URL without credentials, query or fragment.');
  const baseUrl = base.href.replace(/\/+$/, '');
  const request = async (method, path, body, signal) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: 'error',
    });
    if (!response.ok) throw new CamundaApiError(response.status, path);
    return response.status === 204 ? undefined : response.json();
  };
  return {
    post: (path, body, signal) => request('POST', path, body, signal),
    put: (path, body) => request('PUT', path, body),
  };
}

export async function processStockJob(job, { client, loadProducts }) {
  const path = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let products;
  try {
    products = await loadProducts();
  } catch {
    const stockValidation = {
      canCheckout: false,
      errors: [{ code: STOCK_ERROR_CODE, message: 'Stock could not be checked. Try again or cancel checkout.' }],
    };
    // Error payloads stay local to the catch event unless it has output mappings.
    // Clear any previous success at process scope before triggering recovery.
    if (!job.processInstanceKey) throw new Error('Activated stock job has no process instance key.');
    await client.put(`/element-instances/${encodeURIComponent(job.processInstanceKey)}/variables`, {
      variables: { stockValidation }, local: true,
    });
    await client.post(`${path}/error`, {
      errorCode: STOCK_ERROR_CODE,
      errorMessage: 'The trusted stock source is unavailable or invalid.',
      variables: { stockValidation },
    });
    return 'recovery';
  }
  const stockValidation = validateBasket(job.variables?.basket, products);
  await client.post(`${path}/completion`, { variables: { stockValidation } });
  return stockValidation.canCheckout ? 'allowed' : 'amend';
}

export async function runStockWorker({ client, loadProducts, signal, log = console.log,
  jobTimeoutMs = 60000, activationTimeoutMs = 5000, pollMs = 500, maxBackoffMs = 10000 }) {
  let backoff = pollMs;
  log(`Waiting for ${STOCK_JOB_TYPE} jobs.`);
  while (!signal?.aborted) {
    try {
      const response = await client.post('/jobs/activation', {
        type: STOCK_JOB_TYPE,
        worker: 'brfn-stock-worker',
        timeout: jobTimeoutMs,
        requestTimeout: activationTimeoutMs,
        maxJobsToActivate: 1,
        fetchVariable: ['basket'],
      }, signal);
      if (!Array.isArray(response?.jobs)) throw new Error('Camunda activation response has no jobs list.');
      for (const job of response.jobs) {
        // Finish an activated job before stopping; source and API calls have bounded timeouts.
        const outcome = await processStockJob(job, { client, loadProducts });
        log(`Stock job ${job.jobKey}: ${outcome}.`);
      }
      backoff = pollMs;
      if (response.jobs.length) continue;
    } catch (error) {
      if (signal?.aborted) break;
      if (error instanceof CamundaApiError && [404, 409].includes(error.status)) {
        log('Stock job is no longer active; waiting for another job.');
      } else {
        const status = error instanceof CamundaApiError ? ` (HTTP ${error.status})` : '';
        log(`Camunda request failed${status}; retrying with a delay. Any unacknowledged job is retried after its lease expires.`);
      }
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
    try { await delay(backoff, undefined, { signal }); } catch (error) {
      if (!signal?.aborted) throw error;
    }
  }
  log('Stock worker stopped.');
}

export function readStockWorkerConfig(env = process.env) {
  const integer = (key, fallback) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} must be a positive whole number.`);
    return value;
  };
  if (env.STOCK_FILE && env.STOCK_URL) throw new Error('Set STOCK_FILE or STOCK_URL, not both.');
  const requestTimeoutMs = integer('CAMUNDA_REQUEST_TIMEOUT_MS', 10000);
  const sourceTimeoutMs = integer('STOCK_TIMEOUT_MS', 5000);
  const jobTimeoutMs = integer('STOCK_JOB_TIMEOUT_MS', 60000);
  const activationTimeoutMs = integer('CAMUNDA_ACTIVATION_TIMEOUT_MS', 5000);
  if (activationTimeoutMs >= requestTimeoutMs || sourceTimeoutMs + 2 * requestTimeoutMs >= jobTimeoutMs) {
    throw new Error('Activation must fit the HTTP timeout, and stock loading plus completion must fit the job lease.');
  }
  return {
    client: { url: env.CAMUNDA_REST_URL || 'http://localhost:8080/v2', token: env.CAMUNDA_TOKEN, timeoutMs: requestTimeoutMs },
    source: {
      file: env.STOCK_URL ? undefined : resolve(env.STOCK_FILE || 'examples/stock-catalogue.json'),
      url: env.STOCK_URL, token: env.STOCK_TOKEN, timeoutMs: sourceTimeoutMs,
    },
    jobTimeoutMs, activationTimeoutMs, pollMs: integer('STOCK_POLL_MS', 500),
  };
}

async function main() {
  const config = readStockWorkerConfig();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runStockWorker({ ...config, client: createCamundaClient(config.client),
      loadProducts: createStockSource(config.source), signal: controller.signal });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Stock worker could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
