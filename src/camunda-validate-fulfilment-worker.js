import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { CamundaApiError, createCamundaClient } from './camunda-stock-worker.js';

// Worker for the checkout service task "4. Check the choices and 48-hour preparation time".
// It reads the customer's choices from the fulfilment Form and the trusted producer options
// written by prepare-fulfilment, then returns fulfilmentValidation { isValid, errors }.
// The gateway "Are the choices and times OK?" continues to the review Form when isValid is true,
// otherwise it sends the customer back to the fulfilment Form, which shows each error message.

export const VALIDATE_FULFILMENT_JOB_TYPE = 'validate-fulfilment';
export const MIN_LEAD_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;
const METHODS = new Set(['delivery', 'collection']);
const METHOD_NAMES = { delivery: 'Delivery', collection: 'Collection' };
// The fulfilment Form saves UTC times such as 2026-11-20T10:00Z (seconds are optional).
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** A real calendar time with an explicit timezone (JavaScript would turn 30 February into 2 March). */
function readTime(value) {
  if (typeof value !== 'string') return null;
  if (!ISO_TIME.test(value)) return null;
  const [y, m, d, hh, mm] = value.slice(0, 16).split(/[-T:]/).map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth || hh > 23 || mm > 59) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const showTime = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** Missing or broken trusted data is a process problem, not a customer mistake. */
export class FulfilmentValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FulfilmentValidationError';
    this.code = code;
  }
}

function contractError(code, message) {
  throw new FulfilmentValidationError(code, message);
}

/**
 * Check every producer's choice: one choice per producer, a method that producer offers,
 * and a time at least 48 hours after `now` (the server's clock).
 */
export function validateFulfilmentVariables({ fulfilmentSelections, fulfilmentOptions } = {}, { now = Date.now() } = {}) {
  if (!Array.isArray(fulfilmentOptions) || fulfilmentOptions.length === 0) {
    contractError('FULFILMENT_OPTIONS_MISSING', 'Trusted fulfilment options are missing. Run prepare-fulfilment first.');
  }
  if (!Array.isArray(fulfilmentSelections)) {
    contractError('SELECTIONS_MISSING', 'The fulfilment Form did not provide a fulfilmentSelections list.');
  }

  const methodsByProducer = new Map();
  for (const option of fulfilmentOptions) {
    if (!isRecord(option) || !isId(option.producerId) || !Array.isArray(option.supportedMethods)
        || option.supportedMethods.length === 0 || option.supportedMethods.some((m) => !METHODS.has(m))
        || methodsByProducer.has(option.producerId)) {
      contractError('INVALID_FULFILMENT_OPTIONS', 'Trusted fulfilment options are invalid.');
    }
    methodsByProducer.set(option.producerId, option.supportedMethods);
  }

  const errors = [];
  const add = (code, producerId, message) => errors.push({ code, producerId, message });
  const earliest = now + MIN_LEAD_HOURS * HOUR_MS;
  const seen = new Set();

  for (const selection of fulfilmentSelections) {
    const producerId = isRecord(selection) && isId(selection.producerId) ? selection.producerId : null;
    if (!producerId || !methodsByProducer.has(producerId)) {
      add('UNKNOWN_PRODUCER', producerId, 'This producer is not in your order. Go back and check your basket.');
      continue;
    }
    if (seen.has(producerId)) {
      add('DUPLICATE_SELECTION', producerId, 'This producer has more than one choice. Keep only one.');
      continue;
    }
    seen.add(producerId);

    const offered = methodsByProducer.get(producerId);
    const { fulfilmentMethod: method, scheduledFor } = selection;
    if (!METHODS.has(method)) {
      add('METHOD_REQUIRED', producerId, 'Choose delivery or collection.');
    } else if (!offered.includes(method)) {
      const options = offered.map((m) => METHOD_NAMES[m].toLowerCase()).join(' or ');
      add('METHOD_NOT_OFFERED', producerId, `${METHOD_NAMES[method]} is not offered by this producer. Choose ${options}.`);
    }

    if (scheduledFor === null || scheduledFor === undefined || scheduledFor === '') {
      add('TIME_REQUIRED', producerId, 'Choose a date and time.');
    } else if (readTime(scheduledFor) === null) {
      add('INVALID_TIME', producerId, 'The date and time could not be read. Choose it again.');
    } else if (readTime(scheduledFor) < earliest) {
      add('LEAD_TIME_TOO_SHORT', producerId,
        `Producers need at least ${MIN_LEAD_HOURS} hours to prepare. Choose ${showTime(earliest)} or later.`);
    }
  }

  for (const producerId of methodsByProducer.keys()) {
    if (!seen.has(producerId) && !errors.some((e) => e.producerId === producerId)) {
      add('SELECTION_MISSING', producerId, 'Choose delivery or collection and a time for this producer.');
    }
  }

  return { fulfilmentValidation: { isValid: errors.length === 0, errors } };
}

/** Customer mistakes complete the job with isValid false; broken trusted data raises an incident. */
export async function processValidateFulfilmentJob(job, { client, now = Date.now }) {
  if (!job?.jobKey) throw new Error('Activated fulfilment validation job has no key.');
  const path = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let variables;
  try {
    variables = validateFulfilmentVariables(job.variables, { now: now() });
  } catch (error) {
    if (!(error instanceof FulfilmentValidationError)) throw error;
    await client.post(`${path}/failure`, { retries: 0, errorMessage: `${error.code}: ${error.message}` });
    return { status: 'failed', errorCode: error.code };
  }
  await client.post(`${path}/completion`, { variables });
  return { status: variables.fulfilmentValidation.isValid ? 'valid' : 'rejected', variables };
}

export async function runValidateFulfilmentWorker({ client, signal, log = console.log, now = Date.now,
  jobTimeoutMs = 30000, activationTimeoutMs = 5000, pollMs = 500, maxBackoffMs = 10000 }) {
  let backoff = pollMs;
  log(`Waiting for ${VALIDATE_FULFILMENT_JOB_TYPE} jobs.`);
  while (!signal?.aborted) {
    try {
      const response = await client.post('/jobs/activation', {
        type: VALIDATE_FULFILMENT_JOB_TYPE,
        worker: 'brfn-fulfilment-validation-worker',
        timeout: jobTimeoutMs,
        requestTimeout: activationTimeoutMs,
        maxJobsToActivate: 1,
        fetchVariable: ['fulfilmentSelections', 'fulfilmentOptions'],
      }, signal);
      if (!Array.isArray(response?.jobs)) throw new Error('Camunda activation response has no jobs list.');
      for (const job of response.jobs) {
        const outcome = await processValidateFulfilmentJob(job, { client, now });
        log(`Fulfilment validation job ${job.jobKey}: ${outcome.status}.`);
      }
      backoff = pollMs;
      if (response.jobs.length) continue;
    } catch (error) {
      if (signal?.aborted) break;
      if (error instanceof CamundaApiError && [404, 409].includes(error.status)) {
        log('Fulfilment validation job is no longer active; waiting for another job.');
      } else {
        log('Fulfilment validation worker request failed; Camunda can retry an unacknowledged job when its lease expires.');
      }
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
    try { await delay(backoff, undefined, { signal }); } catch (error) {
      if (!signal?.aborted) throw error;
    }
  }
  log('Fulfilment validation worker stopped.');
}

export function readValidateFulfilmentConfig(env = process.env) {
  const integer = (name, fallback) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive whole number.`);
    return value;
  };
  const requestTimeoutMs = integer('CAMUNDA_REQUEST_TIMEOUT_MS', 10000);
  const activationTimeoutMs = integer('CAMUNDA_ACTIVATION_TIMEOUT_MS', 5000);
  if (activationTimeoutMs >= requestTimeoutMs) {
    throw new Error('CAMUNDA_ACTIVATION_TIMEOUT_MS must be shorter than CAMUNDA_REQUEST_TIMEOUT_MS.');
  }
  return {
    client: { url: env.CAMUNDA_REST_URL || 'http://localhost:8080/v2', token: env.CAMUNDA_TOKEN, timeoutMs: requestTimeoutMs },
    activationTimeoutMs,
    pollMs: integer('FULFILMENT_VALIDATION_POLL_MS', 500),
  };
}

async function main() {
  const config = readValidateFulfilmentConfig();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runValidateFulfilmentWorker({
      client: createCamundaClient(config.client),
      activationTimeoutMs: config.activationTimeoutMs,
      pollMs: config.pollMs,
      signal: controller.signal,
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Fulfilment validation worker could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
