import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALIDATE_FULFILMENT_JOB_TYPE, FulfilmentValidationError, validateFulfilmentVariables,
  processValidateFulfilmentJob, runValidateFulfilmentWorker, readValidateFulfilmentConfig,
} from '../src/camunda-validate-fulfilment-worker.js';

// Fixed "server clock" so the tests do not depend on today's date.
const NOW = Date.parse('2026-11-18T10:00:00Z');
const hoursFromNow = (h) => new Date(NOW + h * 3600000).toISOString().slice(0, 16) + 'Z'; // Form format, no seconds

const fulfilmentOptions = [
  { producerId: 'farm-a', supportedMethods: ['delivery', 'collection'] },
  { producerId: 'farm-b', supportedMethods: ['collection'] },
];
const choice = (producerId, fulfilmentMethod, hours) => ({ producerId, fulfilmentMethod, scheduledFor: hoursFromNow(hours) });
const check = (fulfilmentSelections, options = fulfilmentOptions) =>
  validateFulfilmentVariables({ fulfilmentSelections, fulfilmentOptions: options }, { now: NOW }).fulfilmentValidation;

test('demo 1: a time 24 hours away is rejected with an understandable message', () => {
  const result = check([choice('farm-a', 'delivery', 24), choice('farm-b', 'collection', 72)]);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, 'LEAD_TIME_TOO_SHORT');
  assert.equal(result.errors[0].producerId, 'farm-a');
  assert.match(result.errors[0].message, /at least 48 hours/);
  assert.match(result.errors[0].message, /2026-11-20 10:00 UTC or later/);
});

test('demo 2: times 72 hours away are accepted, so checkout continues to review', () => {
  const result = check([choice('farm-a', 'delivery', 72), choice('farm-b', 'collection', 72)]);
  assert.deepEqual(result, { isValid: true, errors: [] });
});

test('demo 3: delivery is rejected for a producer that only offers collection', () => {
  const result = check([choice('farm-a', 'delivery', 72), choice('farm-b', 'delivery', 72)]);
  assert.equal(result.isValid, false);
  assert.deepEqual(result.errors.map((e) => [e.code, e.producerId]), [['METHOD_NOT_OFFERED', 'farm-b']]);
  assert.match(result.errors[0].message, /Delivery is not offered by this producer\. Choose collection\./);
});

test('exactly 48 hours is accepted; one minute less is rejected', () => {
  assert.equal(check([choice('farm-a', 'collection', 48), choice('farm-b', 'collection', 48)]).isValid, true);
  const almost = new Date(NOW + 48 * 3600000 - 60000).toISOString();
  const result = check([{ producerId: 'farm-a', fulfilmentMethod: 'collection', scheduledFor: almost },
    choice('farm-b', 'collection', 72)]);
  assert.equal(result.errors[0].code, 'LEAD_TIME_TOO_SHORT');
});

test('accepts the Form time format with or without seconds and with an offset', () => {
  for (const scheduledFor of ['2026-11-21T10:00Z', '2026-11-21T10:00:00Z', '2026-11-21T10:00:00.000Z', '2026-11-21T11:00+01:00']) {
    const result = check([{ producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor }, choice('farm-b', 'collection', 72)]);
    assert.equal(result.isValid, true, scheduledFor);
  }
});

test('missing or unreadable choices are explained per producer', () => {
  const result = check([
    { producerId: 'farm-a', fulfilmentMethod: null, scheduledFor: null },
    { producerId: 'farm-b', fulfilmentMethod: 'collection', scheduledFor: '21/11/2026 10:00' },
  ]);
  assert.deepEqual(result.errors.map((e) => [e.code, e.producerId]), [
    ['METHOD_REQUIRED', 'farm-a'], ['TIME_REQUIRED', 'farm-a'], ['INVALID_TIME', 'farm-b'],
  ]);
  for (const time of ['2026-11-21T10:00', '2026-02-30T10:00Z']) {
    const r = check([{ producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: time }, choice('farm-b', 'collection', 72)]);
    assert.equal(r.errors[0].code, 'INVALID_TIME', time);
  }
});

test('every producer needs exactly one choice, and only producers in the order are allowed', () => {
  assert.deepEqual(check([choice('farm-a', 'delivery', 72)]).errors.map((e) => [e.code, e.producerId]),
    [['SELECTION_MISSING', 'farm-b']]);
  assert.deepEqual(check([choice('farm-a', 'delivery', 72), choice('farm-a', 'collection', 72), choice('farm-b', 'collection', 72)])
    .errors.map((e) => e.code), ['DUPLICATE_SELECTION']);
  assert.deepEqual(check([choice('farm-a', 'delivery', 72), choice('farm-b', 'collection', 72), choice('farm-x', 'collection', 72)])
    .errors.map((e) => [e.code, e.producerId]), [['UNKNOWN_PRODUCER', 'farm-x']]);
});

test('missing or invalid trusted options are contract errors, not customer errors', () => {
  const run = (vars) => () => validateFulfilmentVariables(vars, { now: NOW });
  assert.throws(run({ fulfilmentSelections: [] }), (e) => e instanceof FulfilmentValidationError && e.code === 'FULFILMENT_OPTIONS_MISSING');
  assert.throws(run({ fulfilmentOptions }), (e) => e.code === 'SELECTIONS_MISSING');
  assert.throws(run({ fulfilmentSelections: [], fulfilmentOptions: [{ producerId: 'farm-a', supportedMethods: ['drone'] }] }),
    (e) => e.code === 'INVALID_FULFILMENT_OPTIONS');
});

function fakeClient(responses = []) {
  const calls = [];
  return {
    calls,
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/jobs/activation') return responses.shift() ?? { jobs: [] };
      return undefined;
    },
  };
}

test('worker completes the job with the result, using the server clock', async () => {
  const client = fakeClient();
  const job = { jobKey: '42', variables: { fulfilmentOptions,
    fulfilmentSelections: [choice('farm-a', 'delivery', 24), choice('farm-b', 'collection', 72)] } };
  const outcome = await processValidateFulfilmentJob(job, { client, now: () => NOW });
  assert.equal(outcome.status, 'rejected');
  assert.equal(client.calls[0].path, '/jobs/42/completion');
  assert.equal(client.calls[0].body.variables.fulfilmentValidation.isValid, false);
  assert.equal(client.calls[0].body.variables.fulfilmentValidation.errors[0].code, 'LEAD_TIME_TOO_SHORT');
});

test('worker raises an incident (no retries) when trusted options are missing', async () => {
  const client = fakeClient();
  const outcome = await processValidateFulfilmentJob({ jobKey: '7', variables: { fulfilmentSelections: [] } }, { client, now: () => NOW });
  assert.deepEqual(outcome, { status: 'failed', errorCode: 'FULFILMENT_OPTIONS_MISSING' });
  assert.equal(client.calls[0].path, '/jobs/7/failure');
  assert.equal(client.calls[0].body.retries, 0);
});

test('worker loop activates the right job type and fetches only the variables it needs', async () => {
  const controller = new AbortController();
  const job = { jobKey: '9', variables: { fulfilmentOptions,
    fulfilmentSelections: [choice('farm-a', 'delivery', 72), choice('farm-b', 'collection', 72)] } };
  const client = fakeClient([{ jobs: [job] }]);
  const logs = [];
  const log = (line) => { logs.push(line); if (line.includes(': valid.')) controller.abort(); };
  await runValidateFulfilmentWorker({ client, signal: controller.signal, log, now: () => NOW, pollMs: 1 });
  const activation = client.calls.find((c) => c.path === '/jobs/activation').body;
  assert.equal(activation.type, VALIDATE_FULFILMENT_JOB_TYPE);
  assert.deepEqual(activation.fetchVariable, ['fulfilmentSelections', 'fulfilmentOptions']);
  assert.ok(client.calls.some((c) => c.path === '/jobs/9/completion'));
  assert.ok(logs.includes('Fulfilment validation worker stopped.'));
});

test('configuration has safe defaults and rejects impossible timeouts', () => {
  const config = readValidateFulfilmentConfig({});
  assert.equal(config.client.url, 'http://localhost:8080/v2');
  assert.throws(() => readValidateFulfilmentConfig({ CAMUNDA_ACTIVATION_TIMEOUT_MS: '20000' }));
  assert.throws(() => readValidateFulfilmentConfig({ FULFILMENT_VALIDATION_POLL_MS: '0' }));
});
