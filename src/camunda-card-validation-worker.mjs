import { setTimeout as delay } from 'node:timers/promises';

const apiUrl = (process.env.CAMUNDA_REST_URL || 'http://localhost:8080/v2')
  .replace(/\/+$/, '');
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const testCardTokens = new Set(['test-card-valid', 'test-card-invalid']);

class CamundaRequestError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new CamundaRequestError(`Could not reach Camunda for POST ${path}: ${error.message}`, {
      retryable: true,
    });
  }

  if (!response.ok) {
    throw new CamundaRequestError(`HTTP ${response.status} for POST ${path}`, {
      status: response.status,
      retryable: transientStatuses.has(response.status),
    });
  }
  return response;
}

async function retryRequest(action, maxAttempts = Infinity) {
  let backoff = 500;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!error.retryable || attempt >= maxAttempts) throw error;
      console.warn(`${error.message}. Retrying in ${backoff} ms.`);
      await delay(backoff);
      backoff = Math.min(backoff * 2, 8_000);
    }
  }
}

class JobInputError extends Error {}

function requireId(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new JobInputError(`${name} must be a non-empty string.`);
  }
  return value;
}

async function publishMessage(jobKey, name, correlationKey, variables) {
  await retryRequest(() => post('/messages/publication', {
    name,
    correlationKey,
    messageId: `${name}-${jobKey}`,
    timeToLive: 300_000,
    variables,
  }), 3);
}

async function requestCardValidation(jobKey, { testCardToken }) {
  // A new submission has a new job key. Reactivation of the same job keeps this ID.
  const cardCheckId = `CHECK-${jobKey}`;
  const token = testCardTokens.has(testCardToken) ? testCardToken : null;
  await publishMessage(jobKey, 'CardValidationRequest', cardCheckId, {
    cardCheckId,
    testCardToken: token,
  });
  return { cardCheckId, cardValid: false };
}

function verifySandboxTestCard(_jobKey, { testCardToken }) {
  return { cardValid: testCardToken === 'test-card-valid' };
}

async function returnCardValidationResult(jobKey, { cardCheckId, cardValid }) {
  requireId(cardCheckId, 'cardCheckId');
  if (typeof cardValid !== 'boolean') {
    throw new JobInputError('The validation task must supply a Boolean cardValid.');
  }
  await publishMessage(jobKey, 'CardValidationResult', cardCheckId, { cardValid });
  return {};
}

async function notifyCustomerOfFailure(jobKey, { orderId }) {
  requireId(orderId, 'orderId');
  await publishMessage(jobKey, 'CardCheckFailed', orderId, { cardValid: false });
  return {};
}

const handlers = [
  { type: 'b-request-card-validation', fetchVariable: ['testCardToken'], handle: requestCardValidation },
  { type: 'validate-sandbox-test-card', fetchVariable: ['testCardToken'], handle: verifySandboxTestCard },
  { type: 'return-card-validation-result', fetchVariable: ['cardCheckId', 'cardValid'], handle: returnCardValidationResult },
  { type: 'b-notify-card-check-failed', fetchVariable: ['orderId'], handle: notifyCustomerOfFailure },
];

async function processJob(handler, job) {
  const jobPath = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let result;
  try {
    result = await handler.handle(job.jobKey, job.variables ?? {});
  } catch (error) {
    if (!(error instanceof JobInputError)) throw error;
    await retryRequest(() => post(`${jobPath}/failure`, {
      retries: 0,
      errorMessage: error.message,
    }), 3);
    console.error(`Job ${job.jobKey} rejected: ${error.message}`);
    return;
  }

  // Retry the acknowledgement independently of any publication in the handler.
  await retryRequest(() => post(`${jobPath}/completion`, { variables: result }), 3);
  console.log(`Completed ${handler.type} job ${job.jobKey}.`);
}

async function runWorker() {
  console.log(`Waiting for card validation jobs at ${apiUrl}`);
  while (true) {
    for (const handler of handlers) {
      const response = await retryRequest(() => post('/jobs/activation', {
        type: handler.type,
        fetchVariable: handler.fetchVariable,
        worker: 'sandbox-card-validation-worker',
        timeout: 90_000,
        requestTimeout: -1,
        maxJobsToActivate: 1,
      }));
      const { jobs } = await response.json();
      if (!jobs.length) continue;

      try {
        await processJob(handler, jobs[0]);
      } catch (error) {
        if (!error.retryable && error.status !== 404 && error.status !== 409) throw error;
        console.warn(`Job ${jobs[0].jobKey} could not finish: ${error.message}. Continuing to poll.`);
      }
    }
    await delay(500);
  }
}

runWorker().catch((error) => {
  console.error(`Card validation worker stopped: ${error.message}`);
  process.exitCode = 1;
});

