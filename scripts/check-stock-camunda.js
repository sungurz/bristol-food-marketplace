// Disposable engine test fixture, not the group's assessed BPMN model.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCamundaClient, runStockWorker } from '../src/camunda-stock-worker.js';
import { createStockSource } from '../src/stock-source.js';

const url = (process.env.CAMUNDA_REST_URL || 'http://localhost:8080/v2').replace(/\/+$/, '');
const token = process.env.CAMUNDA_TOKEN;
const headers = token ? { Authorization: `Bearer ${token}` } : {};
const client = createCamundaClient({ url, token, timeoutMs: 30000 });
const processId = `stock_worker_test_${Date.now()}`;

// The job type, result condition and error code match Checkout diagram.bpmn.
// Branch markers make the engine's actual gateway/boundary routing observable.
const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
 xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="urn:brfn:stock-worker-test">
 <bpmn:error id="stockUnavailable" errorCode="STOCK_CHECK_UNAVAILABLE"/>
 <bpmn:process id="${processId}" isExecutable="true">
  <bpmn:documentation>Automated stock-worker test only. Not an assessed model or customer interface.</bpmn:documentation>
  <bpmn:startEvent id="start"/>
  <bpmn:serviceTask id="checkStock">
   <bpmn:extensionElements><zeebe:taskDefinition type="validate-stock" retries="3"/></bpmn:extensionElements>
  </bpmn:serviceTask>
  <bpmn:boundaryEvent id="unavailable" attachedToRef="checkStock">
   <bpmn:errorEventDefinition errorRef="stockUnavailable"/>
  </bpmn:boundaryEvent>
  <bpmn:exclusiveGateway id="valid" default="rejected"/>
  ${['allowed', 'amend', 'recovery'].map((route) => `<bpmn:scriptTask id="${route}">
   <bpmn:extensionElements><zeebe:script expression="=&quot;${route}&quot;" resultVariable="stockSmokeRoute"/></bpmn:extensionElements>
  </bpmn:scriptTask>`).join('\n')}
  <bpmn:endEvent id="end"/>
  <bpmn:sequenceFlow id="begin" sourceRef="start" targetRef="checkStock"/>
  <bpmn:sequenceFlow id="checked" sourceRef="checkStock" targetRef="valid"/>
  <bpmn:sequenceFlow id="accepted" sourceRef="valid" targetRef="allowed">
   <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= stockValidation.canCheckout = true</bpmn:conditionExpression>
  </bpmn:sequenceFlow>
  <bpmn:sequenceFlow id="rejected" sourceRef="valid" targetRef="amend"/>
  <bpmn:sequenceFlow id="failed" sourceRef="unavailable" targetRef="recovery"/>
  ${['allowed', 'amend', 'recovery'].map((route) => `<bpmn:sequenceFlow id="end_${route}" sourceRef="${route}" targetRef="end"/>`).join('\n')}
 </bpmn:process>
</bpmn:definitions>`;

const products = [
  { producerId: 'farm-a', productId: 'apples', availableQuantity: 3, isAvailable: true },
  { producerId: 'farm-b', productId: 'bread', availableQuantity: 4, isAvailable: true },
];
const basket = (apples = 2) => ({ items: [
  { producerId: 'farm-a', productId: 'apples', quantity: apples },
  { producerId: 'farm-b', productId: 'bread', quantity: 1 },
] });

async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'brfn-stock-engine-'));
  const file = join(folder, 'catalogue.json');
  const controller = new AbortController();
  let worker;
  try {
    const form = new FormData();
    form.append('resources', new Blob([fixture], { type: 'text/xml' }), 'stock-worker-test.bpmn');
    const deployment = await fetch(`${url}/deployments`, {
      method: 'POST', headers, body: form, signal: AbortSignal.timeout(30000),
    });
    if (!deployment.ok) throw new Error(`Test deployment failed: HTTP ${deployment.status}: ${await deployment.text()}`);
    const deployed = await deployment.json();
    console.log(`Deployed test fixture ${processId}; deployment ${deployed.deploymentKey}.`);
    await writeFile(file, JSON.stringify(products));
    worker = runStockWorker({ client: createCamundaClient({ url, token }),
      loadProducts: createStockSource({ file }), signal: controller.signal, pollMs: 50 });

    const check = async (name, inputBasket, route, code) => {
      const result = await client.post('/process-instances', {
        processDefinitionId: processId, variables: {
          basket: inputBasket,
          // An earlier success and forged stock must not override a new check.
          stockValidation: { canCheckout: true, errors: [] },
          products: products.map((product) => ({ ...product, availableQuantity: 999 })),
        },
        awaitCompletion: true, requestTimeout: 20000,
        fetchVariables: ['stockValidation', 'stockSmokeRoute'],
      });
      assert.equal(result.variables.stockSmokeRoute, route, name);
      assert.equal(result.variables.stockValidation.canCheckout, route === 'allowed', name);
      if (code) assert.equal(result.variables.stockValidation.errors[0].code, code, name);
      console.log(`PASS ${name}: instance ${result.processInstanceKey}; route ${route}.`);
    };

    await check('valid multi-producer basket', basket(), 'allowed');
    await check('short stock blocks despite forged process stock', basket(4), 'amend', 'INSUFFICIENT_STOCK');
    await check('amended quantity passes a fresh check', basket(3), 'allowed');
    await writeFile(file, JSON.stringify([{ ...products[0], availableQuantity: 1 }, products[1]]));
    await check('stock changed since previous check', basket(3), 'amend', 'INSUFFICIENT_STOCK');
    await writeFile(file, JSON.stringify([{ ...products[0], isAvailable: false }, products[1]]));
    await check('unavailable product', basket(), 'amend', 'PRODUCT_UNAVAILABLE');
    await writeFile(file, '{ invalid');
    await check('invalid stock data catches boundary error', basket(), 'recovery', 'STOCK_CHECK_UNAVAILABLE');
    await rm(file);
    await check('stock source outage catches boundary error', basket(), 'recovery', 'STOCK_CHECK_UNAVAILABLE');
    await writeFile(file, JSON.stringify(products));
    await check('restored source passes a new check', basket(), 'allowed');
    console.log('All 8 real-engine stock checks passed. Full checkout Forms/order/payment integration is not exercised by this fixture.');
  } finally {
    controller.abort();
    if (worker) await worker;
    await rm(folder, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
