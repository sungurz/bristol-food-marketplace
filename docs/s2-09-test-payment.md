# S2-09 initial test payment

The Camunda service task **Submit simulated payment** sends a job of type
`simulate-payment` to the Node.js worker. The worker validates the order ID,
payment attempt ID and amount in pence, then completes the job with a simulated
status and reference. Camunda records the result as process variables.

## Run the demo

1. Start a local Camunda 8 Run instance. Check that
   `http://localhost:8080/v2/topology` responds. Open the `s2-09-test-payment`
   BPMN in Camunda Desktop Modeler and select the local Camunda connection.
2. From the repository root, start the worker using Node.js 22 or later.

   ```sh
   node src/camunda-payment-worker.mjs
   ```

   The worker uses `http://localhost:8080/v2` by default. Set
   `CAMUNDA_REST_URL` to the local REST API base URL if it runs on another port.
3. In Modeler, start a process instance with the following variables. Choose
   a new `paymentAttemptId` if you want the run to have a distinct reference.

   ```json
   {
     "orderId": "DEMO-001",
     "paymentAttemptId": "ATTEMPT-003",
     "amountInPence": 2500
   }
   ```

4. Open the instance in Operate and check that it reached **Test payment
   recorded**. In **Variables**, check that the status is `succeeded`, the
   provider is `simulated`, and the reference is `SIM-ATTEMPT-003` for
   the input above.

## Demo evidence

The completed instance `2251799813688147` ran version 1 of
`s2-09-test-payment` for order `DEMO-001`. It recorded a successful
simulated payment of 2500 pence with reference `SIM-ATTEMPT-003`.
[Operate screenshot](evidence/s2-09-payment-success.png)

## Contribution record

Gokdeniz Tasli drew the BPMN in Camunda Modeler and ran the demo in his
local Camunda environment. Codex assisted with the JavaScript simulator,
worker and setup notes. [Issue #35](https://github.com/sungurz/bristol-food-marketplace/issues/35)
