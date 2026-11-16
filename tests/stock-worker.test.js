import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStockSource } from '../src/stock-source.js';
import { createCamundaClient, processStockJob, readStockWorkerConfig, runStockWorker } from '../src/camunda-stock-worker.js';

const product = { producerId: 'farm-a', productId: 'apples', availableQuantity: 3, isAvailable: true };
const basket = (quantity = 2) => ({ items: [{ producerId: 'farm-a', productId: 'apples', quantity }] });
const job = (quantity = 2) => ({ jobKey: '2251799813685281', processInstanceKey: '2251799813685270', variables: { basket: basket(quantity) } });

async function server(t, handle) {
  const requests = [];
  const http = createServer(async (req, res) => {
    try {
      let text = '';
      for await (const part of req) text += part;
      const request = { path: req.url, method: req.method, headers: req.headers,
        body: text ? JSON.parse(text) : undefined };
      requests.push(request);
      await handle(request, res);
    } catch (error) { res.writeHead(500).end(error.message); }
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(() => new Promise((resolve) => { http.close(resolve); http.closeAllConnections(); }));
  return { url: `http://127.0.0.1:${http.address().port}`, requests };
}

async function catalogue(t, contents = [product]) {
  const folder = await mkdtemp(join(tmpdir(), 'brfn-stock-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, 'products.json');
  await writeFile(file, JSON.stringify(contents));
  return { file, loadProducts: createStockSource({ file }) };
}

test('worker completes a valid basket using the exact REST job contract and bearer token', async (t) => {
  const api = await server(t, (_, res) => res.writeHead(204).end());
  const source = await catalogue(t);
  const outcome = await processStockJob(job(), {
    ...source, client: createCamundaClient({ url: `${api.url}/v2`, token: 'test-only' }),
  });
  assert.equal(outcome, 'allowed');
  assert.equal(api.requests[0].path, `/v2/jobs/${job().jobKey}/completion`);
  assert.equal(api.requests[0].headers.authorization, 'Bearer test-only');
  assert.deepEqual(api.requests[0].body, { variables: { stockValidation: { canCheckout: true, errors: [] } } });
});

test('short stock completes with a rejection rather than throwing a technical BPMN error', async (t) => {
  const api = await server(t, (_, res) => res.writeHead(204).end());
  const source = await catalogue(t);
  assert.equal(await processStockJob(job(4), { ...source, client: createCamundaClient({ url: api.url }) }), 'amend');
  assert.match(api.requests[0].path, /\/completion$/);
  assert.equal(api.requests[0].body.variables.stockValidation.canCheckout, false);
  assert.equal(api.requests[0].body.variables.stockValidation.errors[0].code, 'INSUFFICIENT_STOCK');
});

test('a customer products variable cannot override trusted stock', async (t) => {
  const api = await server(t, (_, res) => res.writeHead(204).end());
  const source = await catalogue(t);
  const input = job(4);
  input.variables.products = [{ ...product, availableQuantity: 999 }];
  assert.equal(await processStockJob(input, { ...source, client: createCamundaClient({ url: api.url }) }), 'amend');
});

test('every check reloads stock and a changed basket can pass after amendment', async (t) => {
  const api = await server(t, (_, res) => res.writeHead(204).end());
  const source = await catalogue(t);
  const dependencies = { ...source, client: createCamundaClient({ url: api.url }) };
  assert.equal(await processStockJob(job(4), dependencies), 'amend');
  assert.equal(await processStockJob(job(3), dependencies), 'allowed');
  await writeFile(source.file, JSON.stringify([{ ...product, availableQuantity: 1 }]));
  assert.equal(await processStockJob(job(3), dependencies), 'amend');
});

for (const [name, contents] of [
  ['invalid JSON', '{'], ['wrong structure', '{}'],
  ['invalid quantities', JSON.stringify([{ ...product, availableQuantity: -1 }])],
  ['duplicate records', JSON.stringify([product, product])],
]) {
  test(`${name} takes the stock recovery path and clears an earlier success`, async (t) => {
    const api = await server(t, (_, res) => res.writeHead(204).end());
    const source = await catalogue(t);
    await writeFile(source.file, contents);
    const input = job();
    input.variables.stockValidation = { canCheckout: true, errors: [] };
    assert.equal(await processStockJob(input, { ...source, client: createCamundaClient({ url: api.url }) }), 'recovery');
    assert.equal(api.requests[0].method, 'PUT');
    assert.equal(api.requests[0].path, `/element-instances/${input.processInstanceKey}/variables`);
    assert.equal(api.requests[0].body.local, true);
    assert.equal(api.requests[0].body.variables.stockValidation.canCheckout, false);
    const { path, body } = api.requests[1];
    assert.match(path, /\/error$/);
    assert.equal(body.errorCode, 'STOCK_CHECK_UNAVAILABLE');
    assert.equal(body.variables.stockValidation.canCheckout, false);
    assert.equal(body.variables.stockValidation.errors[0].code, 'STOCK_CHECK_UNAVAILABLE');
  });
}

test('a missing catalogue takes recovery even with a malformed basket', async (t) => {
  const api = await server(t, (_, res) => res.writeHead(204).end());
  const source = await catalogue(t);
  await rm(source.file);
  assert.equal(await processStockJob({ ...job(), variables: {} }, {
    ...source, client: createCamundaClient({ url: api.url }),
  }), 'recovery');
});

test('HTTP stock source reloads, authenticates and rejects an outage', async (t) => {
  let healthy = true;
  const stock = await server(t, (_, res) => {
    if (!healthy) return res.writeHead(503).end();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([product]));
  });
  const load = createStockSource({ url: `${stock.url}/products`, token: 'stock-test' });
  assert.deepEqual(await load(), [product]);
  healthy = false;
  await assert.rejects(load(), /could not be loaded/);
  assert.equal(stock.requests.length, 2);
  assert.equal(stock.requests[0].headers.authorization, 'Bearer stock-test');
  assert.equal(stock.requests[0].headers['cache-control'], 'no-cache');
});

test('HTTP stock source has a bounded timeout and does not follow redirects', async (t) => {
  const stock = await server(t, ({ path }, res) => {
    if (path === '/redirect') res.writeHead(302, { Location: '/products' }).end();
  });
  await assert.rejects(createStockSource({ url: `${stock.url}/hang`, timeoutMs: 30 })(), /could not be loaded/);
  await assert.rejects(createStockSource({ url: `${stock.url}/redirect` })(), /could not be loaded/);
  assert.equal(stock.requests.length, 2);
});

test('activation fetches only basket, recovers from 503 and stops after the active job', async (t) => {
  const controller = new AbortController();
  let activations = 0;
  const logs = [];
  const api = await server(t, ({ path, body }, res) => {
    if (path === '/v2/jobs/activation') {
      activations += 1;
      assert.equal(body.type, 'validate-stock');
      assert.deepEqual(body.fetchVariable, ['basket']);
      assert.equal(body.maxJobsToActivate, 1);
      if (activations === 1) return res.writeHead(503).end();
      return res.writeHead(200).end(JSON.stringify({ jobs: [job()] }));
    }
    controller.abort();
    res.writeHead(204).end();
  });
  const source = await catalogue(t);
  await runStockWorker({ ...source, client: createCamundaClient({ url: `${api.url}/v2` }),
    signal: controller.signal, pollMs: 1, log: (message) => logs.push(message) });
  assert.equal(activations, 2);
  assert.equal(api.requests.length, 3);
  assert.ok(logs.some((line) => line.includes('retrying')));
  assert.ok(logs.some((line) => line.includes('allowed')));
  assert.equal(logs.at(-1), 'Stock worker stopped.');
});

for (const status of [404, 409, 500]) {
  test(`completion HTTP ${status} is never mistaken for a stock-source error`, async (t) => {
    const api = await server(t, (_, res) => res.writeHead(status).end());
    const source = await catalogue(t);
    await assert.rejects(processStockJob(job(), { ...source, client: createCamundaClient({ url: api.url }) }),
      (error) => error.status === status);
    assert.equal(api.requests.length, 1);
    assert.match(api.requests[0].path, /completion$/);
  });
}

test('stopping aborts an outstanding activation request promptly', async (t) => {
  const controller = new AbortController();
  const api = await server(t, () => controller.abort());
  const source = await catalogue(t);
  await runStockWorker({ ...source, client: createCamundaClient({ url: api.url }),
    signal: controller.signal, log() {} });
  assert.equal(api.requests.length, 1);
});

test('configuration rejects conflicting sources, unsafe URLs and impossible time budgets', () => {
  assert.throws(() => readStockWorkerConfig({ STOCK_FILE: 'a', STOCK_URL: 'http://stock' }), /not both/);
  for (const value of ['-1', '0', '1.2', 'oops', '']) {
    assert.throws(() => readStockWorkerConfig({ STOCK_POLL_MS: value }), /whole number/);
  }
  assert.throws(() => readStockWorkerConfig({ STOCK_JOB_TIMEOUT_MS: '1000' }), /lease/);
  assert.throws(() => readStockWorkerConfig({ CAMUNDA_REQUEST_TIMEOUT_MS: '5000' }), /Activation/);
  assert.throws(() => createCamundaClient({ url: 'file:///tmp' }), /HTTP/);
  assert.throws(() => createCamundaClient({ url: 'http://user:password@localhost/v2' }), /credentials/);
  assert.throws(() => createStockSource({ url: 'file:///tmp' }), /HTTP/);
  assert.throws(() => createStockSource({}), /exactly one/);
  assert.ok(readStockWorkerConfig({}).source.file.endsWith('stock-catalogue.json'));
});
