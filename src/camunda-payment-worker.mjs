import { setTimeout as delay } from 'node:timers/promises';
import { simulatePayment } from './simulate-payment.mjs';

const apiUrl = (process.env.CAMUNDA_REST_URL || 'http://localhost:8080/v2')
  .replace(/\/+$/, '');
const jobType = 'simulate-payment';

async function post(path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Camunda returned HTTP ${response.status} for POST ${path}.`);
  }
  return response.status === 204 ? undefined : response.json();
}

async function processPaymentJob(job) {
  const jobPath = `/jobs/${encodeURIComponent(job.jobKey)}`;
  let variables;
  try {
    variables = simulatePayment(job.variables);
  } catch (error) {
    // Retrying with the same invalid inputs cannot succeed.
    await post(`${jobPath}/failure`, { retries: 0, errorMessage: error.message });
    console.error(`Payment job ${job.jobKey} rejected: ${error.message}`);
    return;
  }

  await post(`${jobPath}/completion`, { variables });
  console.log(`Payment job ${job.jobKey} completed: ${variables.paymentReference}`);
}

async function runWorker() {
  console.log(`Waiting for ${jobType} jobs at ${apiUrl}`);
  while (true) {
    const { jobs } = await post('/jobs/activation', {
      type: jobType,
      worker: 's2-09-payment-worker',
      timeout: 30_000,
      requestTimeout: 5_000,
      maxJobsToActivate: 1,
      fetchVariable: ['orderId', 'paymentAttemptId', 'amountInPence'],
    });
    if (jobs.length === 0) {
      await delay(500);
      continue;
    }
    await processPaymentJob(jobs[0]);
  }
}

runWorker().catch((error) => {
  console.error(`Payment worker stopped: ${error.cause?.message ?? error.message}`);
  process.exitCode = 1;
});
