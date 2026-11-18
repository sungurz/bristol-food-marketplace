import { setTimeout as delay } from 'node:timers/promises';

const apiUrl = (process.env.CAMUNDA_REST_URL || 'http://localhost:8080/v2')
  .replace(/\/+$/, '');
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const scenarios = new Set(['approve', 'decline', 'outage']);
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

async function submitPaymentDetails(job) {
  const jobPath = `/jobs/${encodeURIComponent(job.jobKey)}`;
  const { orderId, testCardToken, testScenario } = job.variables ?? {};
  let validationError;
  if (typeof orderId !== 'string' || !orderId.trim()) {
    validationError = 'Start the Customer process with a non-empty orderId.';
  } else if (!scenarios.has(testScenario)) {
    validationError = 'Choose Approve, Decline, or Simulate outage on the payment form.';
  }
  if (validationError) {
    await retryRequest(() => post(`${jobPath}/failure`, {
      retries: 0,
      errorMessage: validationError,
    }), 3);
    console.error(`Job ${job.jobKey} rejected: ${validationError}`);
    return;
  }

  // Keep the message ID stable if the same job is activated again.
  await retryRequest(() => post('/messages/publication', {
    name: 'PaymentDetails',
    correlationKey: orderId,
    messageId: `payment-details-${job.jobKey}`,
    timeToLive: 300_000,
    variables: {
      paymentMethod: 'sandbox',
      testCardToken: testCardTokens.has(testCardToken) ? testCardToken : null,
      testScenario,
    },
  }), 3);

  // Retry completion on its own so a temporary API error does not republish the message.
  await retryRequest(() => post(`${jobPath}/completion`, { variables: {} }), 3);
  console.log(`PaymentDetails sent for ${orderId}. Customer job completed.`);
}

async function runWorker() {
  console.log(`Waiting for c-submit jobs at ${apiUrl}`);
  while (true) {
    const response = await retryRequest(() => post('/jobs/activation', {
      type: 'c-submit',
      worker: 'customer-payment-details-worker',
      timeout: 90_000,
      requestTimeout: 5_000,
      maxJobsToActivate: 1,
      fetchVariable: ['orderId', 'testCardToken', 'testScenario'],
    }));
    const { jobs } = await response.json();
    if (!jobs.length) {
      await delay(500);
      continue;
    }

    try {
      await submitPaymentDetails(jobs[0]);
    } catch (error) {
      if (!error.retryable && error.status !== 404 && error.status !== 409) throw error;
      console.warn(`Job ${jobs[0].jobKey} could not finish: ${error.message}. Continuing to poll.`);
    }
  }
}

runWorker().catch((error) => {
  console.error(`Customer payment worker stopped: ${error.message}`);
  process.exitCode = 1;
});
