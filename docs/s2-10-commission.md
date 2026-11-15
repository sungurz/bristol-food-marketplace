# S2-10 commission calculation

`calculateCommission(producerOrders)` calculates BRFN’s 5% commission after a
successful payment. For each producer, it takes the existing subtotal in whole
pence, divides by 20 and rounds to the nearest penny, with half a penny rounding
up. It subtracts that commission from the subtotal to get the producer payout.
It returns new producer order objects with the two calculated fields and adds
the individual commissions into `commissionTotalInPence`. The original order
details are preserved in the returned objects. [Shared process data](https://github.com/sungurz/bristol-food-marketplace/blob/main/docs/shared-process-data/shared-process-data.md)

## Run the tests

From the folder that contains `src` and `tests`, run the following with Node.js.

```sh
node --test tests/calculate-commission.test.mjs
```

| Test case | Producer subtotals | BRFN commission | Producer payouts |
| --- | --- | --- | --- |
| Single producer | farm-a 1200p | 60p | farm-a 1140p |
| Two producers | farm-a 1200p and farm-b 400p | 80p | farm-a 1140p and farm-b 380p |
| Rounding | Two producers at 1010p each | 102p | 959p each |

The two-producer example comes from the team’s sample data. The single-producer
example uses its farm-a order on its own. The two-producer result reconciles
because 1140p + 380p + 80p = 1600p. The rounding example produces 51p per
producer because 5% of 1010p is 50.5p. [Team’s sample order](https://github.com/sungurz/bristol-food-marketplace/blob/main/docs/shared-process-data/order-success.json)

## Camunda integration

The calculator is ready for the worker that handles `b-commission`. That service
task follows **Record successful payment** in the operational BPMN. The worker
will pass in `producerOrders` and complete its job with the returned variables.
The current checks exercise the calculator in Node.js. The live Camunda run is
part of process integration. [Payment BPMN](https://github.com/sungurz/bristol-food-marketplace/blob/main/Diagrams/S2-04_Payment_and_Order_Confirmation_Operational.bpmn) · [Integration issue #37](https://github.com/sungurz/bristol-food-marketplace/issues/37)
