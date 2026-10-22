# Understanding the producer strategic diagram

This guide explains [strategic-producer.bpmn](../diagrams/strategic-producer.bpmn), the producer-side business process model for GitHub issue #15. Open the BPMN file in Camunda Modeler. The main view shows the producer's responsibilities and exchanges with the marketplace. Open the small **+** on a subprocess to see its supporting business steps.

[View the exported overview](../diagrams/strategic-producer.png).

## What issue 15 asks for

Issue #15 asks to model the producer-side processes in Camunda Modeler in a separate file named `strategic-producer.bpmn`. It does not itself ask for a deployed application. The assessment brief distinguishes strategic modelling from detailed operational modelling and executable Camunda processes.

This model covers five independently triggered activities within **one local food producer**. The surrounding group explicitly identifies the single organisation. The separate process views represent different triggers and outcomes; they do not mean five different farms or five mandatory departments. Several activities may happen at the same time.

## How to read the symbols

| Symbol | Meaning |
|---|---|
| Thin circle | A trigger starts this process. An envelope means an incoming message. |
| Thick circle | This instance of the process has ended. |
| Rounded rectangle | A business activity. |
| Rectangle containing a small + | A subprocess whose supporting steps can be opened. |
| Diamond | A business decision; take the branch matching its outcome. |
| Solid arrow | The order of activities within that process. |
| Dashed arrow with an open circle at its source | An information message exchanged between participants. It does not represent a money transfer or an implemented API call. |
| Cylinder | A record set kept beyond one process instance. |
| Dotted arrow into an activity | The activity reads those records. |
| Dotted arrow out of an activity | The activity creates or updates those records. |
| Large process box | The scope of that independently triggered process. |
| Rounded dashed group frame | A visual grouping. Here it identifies the five producer process views as one organisation. |

## What the five processes do

1. **Product and stock information:** maintain products, prices, seasonal availability, stock, origin and food information; publish changes to the marketplace. Information includes harvest dates, certification status, allergens and best-before dates. Farm postcode/origin information supports the marketplace's food-mile calculations.
2. **Order fulfilment:** receive the producer share of an order; check stock and at least 48 hours of preparation lead time; accept and allocate stock or report an issue; prepare and hand over accepted orders; record fulfilment and update inventory.
3. **Accounts and settlements:** receive the weekly statement and payout status; compare them with completed producer sales; query discrepancies or failed/pending payments; retain reconciliation and accounting evidence. The marketplace calculates the 5% commission and instructs payouts. The payment provider returns transfer results.
4. **Food safety:** identify affected products/batches and orders; coordinate traceability and rapid communication with the marketplace; record the response and follow-up evidence. Recording a response does not automatically mean a safety incident is resolved.
5. **Community activity:** use product information to prepare a surplus discount offer or share seasonal recipes, storage guidance and farm stories through the marketplace.

## How the processes connect

Matching cylinder labels refer to the same underlying record set, even when shown in different process views. They are repeated references for readability, not separate copies of the data.

| Shared records | Created or updated by | Read by |
|---|---|---|
| Products, stock and batches | Product management; accepted and fulfilled orders | Order checks, safety tracing and community offers |
| Producer orders and fulfilment | Order fulfilment, including accepted, unavailable and fulfilled outcomes | Settlement reconciliation and safety tracing |
| Settlements and accounting evidence | Accounting reconciliation | Later statement comparisons and audit work |
| Safety response records | Food safety response | Follow-up and incident review |

The order records link product/batch identifiers, quantities and prices with acceptance, handover and fulfilment evidence. Settlement checks therefore use completed sales, while safety checks use affected product/batch and order references. Customer contact records are held by the marketplace; producers exchange the identifiers needed for coordinated tracing.

## The three order messages

- **Accepted:** sent after the order is accepted, stock is allocated and arrangements are confirmed.
- **Unavailable:** sent when stock or preparation timing is unsuitable. That branch ends without preparation or fulfilment.
- **Fulfilled:** sent after an accepted order has been handed over and the records updated.

The model does not send all three messages for every order. The subprocess decision and its branches show when each message applies.

## Requirements and proposed design choices

The case study explicitly requires product/inventory management, at least 48 hours of producer preparation lead time, multi-vendor order coordination, weekly settlements, automatic 5% commission, accounting audit trails, food traceability, surplus discounts and educational content.

The following details are proposed design choices for this model:

- Financial statements, payout status and query responses are delivered to producers through the marketplace.
- Accepted orders allocate stock; fulfilment converts that allocation to a completed sale. The same quantity must not be deducted from available stock twice.
- Processes reuse persistent product, order, accounting and safety records. The symbols describe business information needs; they do not prescribe a database product or create storage.

The exact stock-reservation algorithm, cancellation/refund rules, incident escalation procedures and service interfaces need definition during operational design. This model does not invent them as fixed requirements.

## Why Camunda shows executable notices

The processes are deliberately marked **not executable**. Camunda 8's deployment checker therefore lists **One Process must be Executable** for the producer participants. Those messages mean this file cannot be deployed as a running workflow in its current form. BPMN XML structure and deployment readiness are different checks.

Do not tick Executable solely to remove these notices. A running workflow needs implemented task types, user forms or other task interfaces, process variables, executable gateway conditions, message subscriptions/correlation, supporting services and exception handling. Record symbols alone do not create a database, and a message arrow alone does not send a notification.

For example, a running order process would create an instance when an order arrives, wait for a producer to complete a review task, select a branch using actual order data and coordinate implemented notifications. It would still rely on the producer to perform physical preparation and handover.

## Reviewing and presenting the file

Use **Window → Zoom to Fit Diagram** to see the overview. Zoom into individual areas when reading labels. Open a subprocess with its + or its drill-down control, and use the breadcrumb to return to the main view. Select an element and expand **Documentation** to read its rationale and assumptions.

For the demonstration, explain the producer's responsibilities, the marketplace and payment-provider boundaries, the shared records, the accepted/unavailable order decision and how fulfilled orders support settlement and safety tracing.

The file addresses the modelling scope stated in issue #15. Tutor acceptance and consistency with the group's customer-side diagram still require review when the group merges its strategic model under issue #17.

## Sources

- [GitHub issue 15](https://github.com/sungurz/bristol-food-marketplace/issues/15).
- Supplied **Case Study - v2.pdf**, pages 1–2.
- Supplied **UFCFTR-30-3 -First Sit - Task 1(1).pdf**, pages 3–4.
- [Camunda BPMN reference](https://camunda.com/bpmn/reference/).
