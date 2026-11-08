# Checkout and order preparation

Issue: [#29 / S2-03](https://github.com/sungurz/bristol-food-marketplace/issues/29).

- [Editable Camunda model](../Diagrams/Checkout%20diagram.bpmn)
- [Diagram image](../Diagrams/Checkout%20diagram.png)

Kaan reports that the group approved this diagram on 8 November 2026. This version records the operational model; it has not been deployed or demonstrated end to end.

## Reading the diagram

Customer actions are in the left lane and marketplace computer tasks in the right lane.

1. Check the basket's products and combined requested quantities against fresh, trusted stock data. A shortage or unavailable item requires a basket amendment and a fresh check.
2. Identify each producer and the supported delivery or collection choices.
3. Let the customer choose arrangements for each producer.
4. Validate those arrangements and the minimum 48-hour preparation time. Rejected arrangements return to the customer's choices.
5. Present the order for explicit confirmation. Changing the basket returns through stock validation; cancelling ends checkout before creating orders.
6. Create the overall order, then one linked order part per producer. The three vertical bars mean parallel repetition over the `producers` list. Wait for all parts before continuing. All orders are awaiting payment.
7. Send the prepared orders to the separate payment process. The final circle ends checkout preparation, rather than confirming successful payment.

The stock task's interrupting boundary error catches the explicitly reported `STOCK_CHECK_UNAVAILABLE` error and offers retry or cancellation. Ordinary insufficient stock uses the normal rejection route. Other worker failures use retries and visible incidents; they must not be treated as successful work.

The empty payment pool deliberately leaves the other process's internal work to [#30](https://github.com/sungurz/bristol-food-marketplace/issues/30). That process owns payment outcomes, commission, inventory updates and producer notifications. No stock is reserved or deducted by this checkout validation step.

## Connection settings and remaining work

| Task | Job type |
|---|---|
| Check items and stock amounts | `validate-stock` |
| Find producers and delivery/collection choices | `prepare-fulfilment` |
| Check arrangements and preparation time | `validate-fulfilment` |
| Create overall order | `create-marketplace-order` |
| Create each producer order | `create-producer-order` |
| Send orders to payment | `handoff-payment` |

These settings must match the team's registered workers. Adding a job type does not provide its implementation. The existing stock-validation component is published separately in [PR #42](https://github.com/sungurz/bristol-food-marketplace/pull/42); this model does not merge that pull request.

The four linked Form IDs are `brfn-checkout-stock-recovery`, `brfn-checkout-amend`, `brfn-checkout-fulfilment` and `brfn-checkout-review`. Their actual Form files are separate resources still to be supplied under [#33](https://github.com/sungurz/bristol-food-marketplace/issues/33). Restricted output mappings keep customer responses separate from authoritative stock, prices and order identifiers.

The producer-order task repeats over `producers` using local `producer`, receives the parent `orderId` and collects local `producerOrder` results into `producerOrders`. The preparation worker must supply a nonempty list of unique producers. Creation and handoff retries must not create duplicate orders or publications.

The team still needs to agree the shared data and states under [#31](https://github.com/sungurz/bristol-food-marketplace/issues/31), connect order creation under [#34](https://github.com/sungurz/bristol-food-marketplace/issues/34), integrate both processes under [#37](https://github.com/sungurz/bristol-food-marketplace/issues/37) and demonstrate the valid/rejected paths under [#38](https://github.com/sungurz/bristol-food-marketplace/issues/38). Concurrent stock changes and delays before payment need the agreed recheck or reservation policy.

## Validation

The saved model passed BPMN 2.0 XML schema, unique-ID/reference, incoming/outgoing link and sequence-flow scope checks. All outer process steps are reachable, and stock approval, valid arrangements and explicit confirmation are required before order creation. The payment endpoint requires completed order preparation and handoff. Job types, numeric retry settings, gateway conditions/defaults and producer repetition mappings were checked.

The same saved file was reopened in Camunda Modeler 5.52.0, targeting Camunda 8.10, with **0 errors and 0 warnings**. It also imports without warnings in bpmn-js. These are model checks, not evidence of a successful engine run or available Form/worker resources.

## Contribution and assistance record

Kaan drew the diagram's layout in Camunda. Codex assisted with reviewing and correcting process connections, decision conditions, task and Form settings, producer repetition settings and labels. The supplied Task 1 assessment brief, page 9, requires accurate contribution records and states that AI-generated models/diagrams are not permitted as assessed artefacts. This record describes the assistance used; group approval and GitHub publication do not establish assessment acceptance.
