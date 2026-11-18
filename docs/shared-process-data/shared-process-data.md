# Shared process data

Issue: [#31 / S2-05](https://github.com/sungurz/bristol-food-marketplace/issues/31) · Owner: Ahmet 

## Why this document exists

Our checkout and payment processes are built by different people, in different models, with different workers behind them. They only work together if everyone means the same thing by the same name. If one model writes `paymentStatus` and another checks `paymentOutcome`, both look fine on their own and the order still gets stuck between them.

This document is the one place where we agree those names: what each variable is called, what values it can hold, which states an order moves through, and what is passed along at each handover.

It covers Use Case 2, as split in the [functional scope](../two-major-functionalities-scope.md):

- **Functionality A – Checkout and order creation.** [Checkout diagram](../../Diagrams/Checkout%20diagram.bpmn) (#29).
- **Functionality B – Payment and commission.** [S2-04 model](../../Diagrams/S2-04_Payment_and_Order_Confirmation_Operational.bpmn) (#30) and [S2-09 test payment](../../Diagrams/s2-09-test-payment.bpmn) (#35).

### How this document is organised

It is deliberately split in three, so nobody mistakes a plan for something that works today.

| Part | Sections | What it contains |
|---|---|---|
| **Sprint 2 shared data** | 1 to 6 | What our models and workers use now, plus the few names they still need. This is what issue #31 asks for. |
| **Planned for Sprint 3** | 7 | Changes the group intends to make. **None of them is implemented.** |
| **Open decisions** | 8 | Questions nobody has answered yet. |

In the tables, the "Status" column says **In use** when a committed model or worker already uses the name exactly as written, and **To add** when it is defined here but nothing writes it yet.

## 1. Naming rules

| Rule | Example |
|---|---|
| Variables are written in camelCase. | `orderId`, `paymentAttemptId` |
| Status and decision values are lowercase, with an underscore between words. | `succeeded`, `awaiting_payment` |
| Error codes raised by workers are in capitals with underscores. | `STOCK_CHECK_UNAVAILABLE` |
| IDs are text, never empty, and compared exactly. | `ORD-1001`, `farm-a` |
| Money is a whole number of pence, in a variable ending in `InPence`. Decimals cause rounding errors, so we never use them. | `amountInPence: 1600` is £16.00 |
| Quantities are whole units, always more than zero. | `quantity: 2` |
| Dates and times use ISO 8601 in UTC. | `2026-11-19T10:00:00Z` |
| Yes/no values are real booleans. | `retryPayment = true` |
| Each idea has one name. The payment result is `paymentStatus`, never `paymentOutcome` or `paymentResult`. | |
| The overall order state uses `orderStatus`, never `orderState`. Each producer's own state uses `producerOrderStatus`. | `orderStatus: "awaiting_payment"` |
| All sample data is made up. No real names, addresses or card details appear in variables, Forms or examples. | `customerId: "CUS-205"` |

## 2. Variable dictionary

"Written by" names the authorised writer or writers and, where more than one is listed, which stage each may update. Everything under "Read by" may use the variable but must not change it unless also named as a writer.

### 2.1 Checkout and order creation (Functionality A)

| Variable | Type | What it means and what it may hold | Written by | Read by | Status |
|---|---|---|---|---|---|
| `customerId` | String | The customer placing the order. | Checkout start | Order creation, notifications | To add |
| `checkoutId` | String | Unique, stable identifier for one checkout. Created before any order exists; unchanged across basket amendments and technical retries. A new checkout gets a new ID. Never supplied or edited by a Form. | Trusted checkout start | `create-marketplace-order`, order-creation records, integration audit | To add (named in BPMN documentation; no implementation) |
| `basket` | Object | The customer's basket. Holds `items`. | Checkout start; Form `brfn-checkout-amend` | `validate-stock`, `prepare-fulfilment` | In use |
| `basket.items[]` | List | One row per product: `producerId`, `productId`, `quantity`. Never empty. | Same as `basket` | Same as `basket` | In use |
| `producerId` | String | A producer, e.g. `farm-a`. | Product catalogue | Every process | In use |
| `productId` | String | One producer's product, e.g. `apples`. Unique together with `producerId`. | Product catalogue | Stock check, order creation, stock update | In use |
| `quantity` | Integer | Units wanted. Whole number above zero. | Customer | Stock check, order creation, stock update | In use |
| `stockValidation` | Object | Result of the stock check: `canCheckout` and `errors`. Each check replaces the whole result. | `validate-stock` worker only | Gateway "Are all items and amounts available?"; amend Form | In use |
| `stockValidation.canCheckout` | Boolean | True only if every item is available in the amount requested. One failing item blocks the whole checkout. | `validate-stock` | Gateway | In use |
| `stockValidation.errors[].code` | String | Why an item failed: `EMPTY_BASKET`, `INVALID_BASKET`, `INVALID_ITEM`, `INVALID_QUANTITY`, `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `INVALID_STOCK_DATA`. | `validate-stock` | Amend Form | In use |
| `stockRetry` | Boolean | The customer's choice when the stock service is down. True means try again; anything else cancels. | Form `brfn-checkout-stock-recovery` | Gateway "Try again?" | In use |
| `producers` | List | The producers in this basket, each appearing once, with their items and the fulfilment methods they offer. | `prepare-fulfilment` | Fulfilment Form; order-creation loop | In use (contents to agree with #33) |
| `fulfilmentOptions` | List | One entry for every unique producer in the current basket: `producerId` and nonempty `supportedMethods[]` containing `delivery`, `collection` or both. Options come from trusted producer data, never customer input. | `prepare-fulfilment` | Fulfilment Form, `validate-fulfilment` | To add (demonstration values proposed; worker not implemented) |
| `orderQuote` | Object | Trusted, display-only quote for the current basket: `currency` (`GBP`), `items[]` (each with `producerId`, `productId`, `quantity`, `unitPriceInPence`, `lineTotalInPence`) and `totalInPence`. Rebuilt after basket amendments. | `prepare-fulfilment` | Review Form, `create-marketplace-order`, `create-producer-order` | To add (named in BPMN documentation; no quote-producing worker) |
| `producer` | Object | One entry of `producers` inside the order-creation loop. | Loop | `create-producer-order` | In use |
| `fulfilmentSelections` | List | The customer's choice for each producer: `producerId`, `fulfilmentMethod`, `scheduledFor`. | `prepare-fulfilment` (initialises one row per unique producer); Form `brfn-checkout-fulfilment` (updates customer selections) | `validate-fulfilment`, order creation | In use (contents to agree with #33) |
| `fulfilmentMethod` | String | `delivery` or `collection`. | Customer | Order creation, producer notification | To add |
| `scheduledFor` | Date-time | When the delivery or collection is due. Must be at least 48 hours after the moment `validate-fulfilment` checks it, using the server's clock. | Customer | `validate-fulfilment`, producer | To add |
| `fulfilmentValidation` | Object | Result of checking one selection per current producer, whether its method is in that producer's trusted `supportedMethods`, and the 48-hour rule: `isValid` and `errors`. | `validate-fulfilment` | Gateway "Are the choices and times OK?"; fulfilment Form for error messages | In use |
| `checkoutDecision` | String | The customer's decision on the review Form: `confirm`, `amend` or `cancel`. Anything that is not `confirm` or `amend` counts as cancel. | Form `brfn-checkout-review` | Gateway "What does the customer choose?" | In use |
| `orderId` | String | The customer's overall order. All customer messages are matched on it. At most one `orderId` may exist for a `checkoutId`; retries return the same order rather than creating another. | `create-marketplace-order` | Every later step | In use |
| `orderCreatedAt` | Date-time | When the order was created, from the server's clock. | `create-marketplace-order` | Records | To add |
| `orderStatus` | String | Where the order is in its life. See [section 3.1](#31-overall-order-orderstatus). | Order creation, then the payment process | Every process | To add |
| `producerOrder` | Object | One producer's share of the order. See section 2.3. | `create-producer-order` | Collected into `producerOrders` | In use |
| `producerOrders` | List | Every producer's share. One per producer, never empty. | Order-creation loop | Payment, commission, producer notification | In use |
| `amountInPence` | Integer | The total the customer pays. Must equal `orderQuote.totalInPence` and all `producerSubtotalInPence` added together. | `create-marketplace-order` | Payment request | In use |

#### Preparing fulfilment selections

Every time `prepare-fulfilment` runs, including after a customer amends the basket and the new stock check passes, it must derive the unique producers from the **current** basket. It must initialise `fulfilmentSelections` with **exactly one row per producer**, containing that producer's `producerId` and empty customer-editable choices for `fulfilmentMethod` and `scheduledFor`. The producer ID is not editable in the Form. Preparation must also produce `fulfilmentOptions` for those same producers, using trusted producer data as described in section 2.5.

Preparation **replaces** the previous selections array after a basket change; it must not retain a producer removed from the basket or silently reuse choices made for the old basket. The customer then chooses an available method and a valid time for every remaining producer in `brfn-checkout-fulfilment`. `validate-fulfilment` checks all of these choices before checkout can continue. These are agreed responsibilities, not a claim that the missing worker is already implemented.

#### Preparing the trusted order quote

After stock validation passes, `prepare-fulfilment` must read **trusted catalogue prices** for the basket items and write `orderQuote` before the customer reaches the review Form. Each line identifies its producer and product and records a positive whole-unit quantity, a nonnegative integer `unitPriceInPence` and `lineTotalInPence = quantity × unitPriceInPence`. Repeated occurrences of the same producer/product pair in the basket must be combined consistently. `totalInPence` is the sum of every line total, in GBP pence. A missing, invalid or inconsistent trusted price must block preparation rather than be replaced with a price supplied by a Form.

The review Form must show the current quote's products, producers, quantities, prices and total alongside fulfilment selections. The Form can display `orderQuote` but must not write or override it. After a basket amendment, the next successful stock check is followed by a **fresh quote**; old basket lines and totals must not survive. At order creation, the order workers must use or verify the trusted quote so that the overall `amountInPence` and per-producer subtotals agree. These requirements still need worker and Form implementation.

#### Checkout identity and safe retries

The trusted checkout start creates one nonempty, unique `checkoutId` (for example, `CHK-1001` in test data) before stock validation or customer review. It stays the same when the customer amends their basket and when a Camunda job is retried. Cancelling before confirmation leaves a checkout identity but **no `orderId`**. Starting a genuinely new checkout creates a new `checkoutId`.

`create-marketplace-order` must use `checkoutId` as an **idempotency key**: store a durable, unique mapping from `checkoutId` to its created `orderId`. When the same checkout is processed again, the worker returns the existing order rather than inserting another parent order. If a retry supplies conflicting confirmed order data, the worker reports a conflict instead of silently replacing the order. Creating producer orders must also avoid duplicates for the same `orderId` and `producerId`. An in-memory check or process variable alone is not enough to guarantee this across worker restarts. This is a required implementation behaviour, **not yet demonstrated by code**.

### 2.2 Payment and commission (Functionality B)

| Variable | Type | What it means and what it may hold | Written by | Read by | Status |
|---|---|---|---|---|---|
| `testScenario` | String | The outcome the sandbox should simulate: `approve`, `decline` or `outage`. It stands in for card details, which we never collect. | Customer payment Form | Sandbox gateway "Test scenario?" | In use |
| `paymentAttemptId` | String | One attempt at paying. Provider replies are matched on it. A retry gets a new one; a status query reuses the same one. | "Create and persist payment attempt ID" | Payment request, status query, worker | In use |
| `paymentStatus` | String | The result of the current attempt. See [section 3.3](#33-payment-attempt-paymentstatus). | Sandbox provider / `simulate-payment` worker | Gateway "Payment result?" | In use |
| `paymentReference` | String | The provider's reference for a successful payment. Always supplied by the provider; the marketplace never builds it. Empty (`null`) until a payment succeeds. | Sandbox provider / `simulate-payment` worker | Order record, confirmation | In use |
| `paymentProvider` | String | Who handled the payment. Always `simulated`. | Sandbox provider / `simulate-payment` worker | Order record | In use |
| `retryPayment` | Boolean | The customer's choice after a decline. True means try again; anything else cancels the order. | Customer Form "Choose retry or cancel" | Gateway "Retry?" | In use |
| `commissionTotalInPence` | Integer | BRFN's commission on the whole order: all `commissionInPence` added together. | "Calculate 5% commission and producer allocations" | Records | To add |

### 2.3 What one producer order contains

| Field | Type | What it means and what it may hold | Status |
|---|---|---|---|
| `producerOrderId` | String | One producer's share of an order, e.g. `PO-1001-A`. | To add |
| `orderId` | String | The overall order it belongs to. | In use |
| `producerId` | String | The producer who fulfils it. Appears once per order. | In use |
| `producerOrderStatus` | String | See [section 3.2](#32-producer-order-producerorderstatus). | To add |
| `fulfilmentMethod`, `scheduledFor` | String, Date-time | Copied from the customer's `fulfilmentSelections`. | To add |
| `items[]` | List | `productId`, `quantity`, `unitPriceInPence`, `lineTotalInPence`. Line total = quantity × unit price. Prices come from the catalogue, never from a Form. | To add |
| `producerSubtotalInPence` | Integer | The value of this producer's items. | To add |
| `commissionInPence` | Integer | 5% of the subtotal, rounded half up to a whole penny. Filled in only after payment succeeds. | To add |
| `producerPayoutInPence` | Integer | Subtotal minus commission. | To add |

### 2.4 The trusted stock record

This is not a process variable. The stock worker reads it from its own trusted source and ignores stock figures sent by a Form.

| Field | Type | What it means | Status |
|---|---|---|---|
| `producerId`, `productId` | String | Which product this is. | In use |
| `availableQuantity` | Integer, zero or more | Units that can be ordered. | In use |
| `isAvailable` | Boolean | Whether the product can be ordered now, including whether it is in season. | In use |
| `name` | String, optional | The name shown to customers. | In use |
| `unitPriceInPence` | Nonnegative integer | The catalogue's trusted selling price for one unit, used to build `orderQuote`. Never taken from a customer Form. | To add |

The revised demonstration [stock catalogue](../../examples/stock-catalogue.json) contains `unitPriceInPence`: **600p per apple at `farm-a`** and **400p per bread at `farm-b`**. Ensure that this revised file, rather than the older stock-only version, is copied into the repository. These are test prices from the trusted example data, not customer Form values. The missing `prepare-fulfilment` worker must still read them to produce `orderQuote`.

### 2.5 Trusted producer fulfilment options

Producer-specific fulfilment availability is business data, not a value the customer is allowed to set. A trusted producer configuration must supply one record per `producerId`, with a nonempty `supportedMethods[]` array whose only allowed values are `delivery` and `collection`. `prepare-fulfilment` copies the relevant records into the process variable `fulfilmentOptions` for the producers in the current basket. If any producer has no trusted options, preparation must not guess that both methods are available; it should report the missing configuration.

The [producer fulfilment options file](../../examples/producer-fulfilment-options.json) defines the methods separately from product stock, with one record per producer. For the simulated Use Case 2 demonstration, Ahmet proposes the following configuration, pending confirmation with Efe and Kaan:

| Demonstration producer | Supported methods | Reason for the example |
|---|---|---|
| `farm-a` (apples) | `delivery`, `collection` | Shows a producer offering the customer a choice. |
| `farm-b` (bread) | `collection` only | Demonstrates that unsupported delivery must be rejected. |

The proposed trusted producer records, in the same shape as the `fulfilmentOptions` process variable, are:

```json
[
  { "producerId": "farm-a", "supportedMethods": ["delivery", "collection"] },
  { "producerId": "farm-b", "supportedMethods": ["collection"] }
]
```

This is **test data, not a factual claim about real farms**, and it agrees with the successful two-producer example in section 5.1 (`farm-a` delivery, `farm-b` collection). The separate JSON file is now prepared as the trusted demonstration source, but `prepare-fulfilment` must still be implemented to load it. A submitted `delivery` choice for `farm-b` must fail server validation. Efe's current form displays both radio options for every producer, so the form and Ahmet's `validate-fulfilment` worker still need to handle unsupported choices and understandable rejection messages. The server must reject unsupported methods even when a Form offers them.

## 3. States

Three things have a state: the overall order, each producer's share of it, and each attempt to pay. They are kept apart on purpose. "The payment was declined" is a fact about one attempt, not about the order.

### 3.1 Overall order: `orderStatus`

| Value | What it means | Becomes this when | Can move to |
|---|---|---|---|
| `awaiting_payment` | The order and its producer orders exist; nothing has been paid. | "Make main order – Waiting for payment" finishes. | `confirmed`, `cancelled` |
| `confirmed` | Payment succeeded and the order is accepted. | "Confirm overall order and linked producer orders" finishes. | Fulfilment (Sprint 3) |
| `cancelled` | The customer cancelled before paying. | "Close pending overall and producer orders" finishes. | Nothing; final. |

```mermaid
stateDiagram-v2
    [*] --> awaiting_payment: order created
    awaiting_payment --> awaiting_payment: payment declined, customer retries
    awaiting_payment --> confirmed: paymentStatus = succeeded
    awaiting_payment --> cancelled: customer cancels
    confirmed --> [*]: handed to fulfilment
    cancelled --> [*]
```

- **There is no order until the customer confirms.** Cancelling during checkout simply ends the process. A `checkoutId` may exist, but no `orderId` exists, so there is no "draft" or "failed" order state.
- **A declined payment leaves the order alone.** It stays `awaiting_payment` until the customer pays or cancels.
- **A confirmed order cannot be cancelled.** The functional scope (#13) puts refunds and cancelling a paid order out of scope.
- **Fulfilment states come later.** Preparing, ready and completed will be defined under S3-03.

### 3.2 Producer order: `producerOrderStatus`

It uses the same three values and always matches the overall order. The customer pays for the order as a whole, so in Sprint 2 two producer orders of one order are never in different states.

### 3.3 Payment attempt: `paymentStatus`

| Value | What it means | What the marketplace does next | Status |
|---|---|---|---|
| `pending` | The attempt exists but has no final result. | Waits for the provider. | To add |
| `succeeded` | The test payment was approved. | Records the payment, calculates commission, confirms the orders, updates stock, sends notifications. | In use |
| `declined` | The test payment was refused. | Tells the customer and waits for them to retry or cancel. | In use |
| `unknown` | The provider answered a status query but has no final result. | Waits 30 seconds and asks about the **same** attempt again. It never starts a new charge. | In use |

```mermaid
stateDiagram-v2
    [*] --> pending: attempt created
    pending --> succeeded: provider approves
    pending --> declined: provider declines
    pending --> unknown: no reply in 30 s, status query has no result
    unknown --> succeeded: later status query
    unknown --> declined: later status query
    unknown --> unknown: still no result, wait 30 s
    succeeded --> [*]
    declined --> [*]
```

`succeeded` and `declined` are final. A retry after a decline is a new attempt with a new `paymentAttemptId`.

**If the first reply was lost.** When a status query reports `succeeded`, the reply must also carry `paymentReference` and `paymentProvider`, just as the original reply would have. The marketplace must not guess the reference from the attempt ID. The S2-04 model does not show this yet (see section 6).

### 3.4 Stock

Stock has no status variable. What the models do today:

1. Checkout **checks** stock. Nothing is reserved.
2. Stock is **deducted** after a successful payment, by "Update inventory without duplicate deduction".
3. A declined payment or a cancellation therefore needs no stock to be restored.

**Known limits of this.** Two customers can both pass the stock check for the last item, and nothing yet guarantees that a repeated job deducts only once. Both are Sprint 3 work; see section 7.

## 4. Process handoffs

Each row is a point where one participant or process passes work to another.

| # | Trigger | From → To | Carried by | Data sent | If it works | If it does not |
|---|---|---|---|---|---|---|
| 1 | Customer starts checkout | Customer → Checkout process | Process start / trusted checkout initiator | `customerId`, `basket`; a unique `checkoutId` is created once | The process starts with a stable `checkoutId`. | — |
| 2 | Checkout starts, or the basket is changed | Checkout → Stock service | Job `validate-stock` | `basket` | `stockValidation.canCheckout = true` | `false` with `errors`: the customer changes the basket. Service down: `STOCK_CHECK_UNAVAILABLE`, then `stockRetry`. |
| 3 | Stock is approved | Checkout → Fulfilment preparation | Job `prepare-fulfilment` | Current `basket`, trusted producer configuration and trusted catalogue prices | Unique `producers`, their `fulfilmentOptions`, a newly initialised `fulfilmentSelections` row for each, and a fresh `orderQuote`; previous selections and quote are replaced | Incident after retries, including missing options or prices. |
| 4 | Customer chooses arrangements | Customer → Checkout | Form `brfn-checkout-fulfilment`, then job `validate-fulfilment` | Customer's `fulfilmentSelections`; worker also reads trusted `fulfilmentOptions` | `fulfilmentValidation.isValid = true` only for supported methods and times at least 48 hours ahead | `false`: the customer sees relevant errors and changes their choices. |
| 5 | Customer reviews the order | Customer → Checkout | Form `brfn-checkout-review` (reads the trusted `orderQuote`) | `checkoutDecision` only; quote is read-only | `confirm`: orders are created after the customer sees items, quantities, prices, total and arrangements. | `amend`: back to the stock check; after any changed basket passes, fulfilment preparation rebuilds selections and quote. `cancel`: the process ends, no order. |
| 6 | Customer confirms | Checkout → Order service | Jobs `create-marketplace-order`, then `create-producer-order` per `producer` | Stable `checkoutId`, `customerId`, `basket`, trusted `orderQuote`, `fulfilmentSelections`; per producer, `orderId` and `producer` | One persistent parent order per `checkoutId`, `orderCreatedAt`, `orderStatus = "awaiting_payment"`, `amountInPence` equal to the quote total, and unique `producerOrders` whose subtotals reconcile | Retry must return existing orders, not create duplicates; conflicting data causes an incident. |
| 7 | All producer orders exist | Checkout process → Payment process | Job `handoff-payment`, message `brfn.pending-order-ready` | `orderId`, `customerId`, `amountInPence`, `orderStatus`, `producerOrders` | The payment process starts for this `orderId`. | **Not connected yet; see below.** |
| 8 | Customer submits a test payment | Customer → Marketplace | Message `PaymentDetails`, matched on `orderId` | `orderId`, `testScenario` | The marketplace creates a `paymentAttemptId`. | — |
| 9 | Attempt ID is stored | Marketplace → Sandbox provider | "Sandbox payment request" / job `simulate-payment` | `orderId`, `paymentAttemptId`, `amountInPence`, `testScenario` | Message `ProviderResult`, matched on `paymentAttemptId`: `paymentStatus`, `paymentReference`, `paymentProvider` | No reply in 30 seconds: handoff 10. |
| 10 | No reply, or no final result | Marketplace → Sandbox provider | "Query same attempt" | `paymentAttemptId` | Message `StatusResult`, matched on `paymentAttemptId`: `paymentStatus`, plus `paymentReference` and `paymentProvider` when it succeeded | `unknown` or no answer: wait 30 seconds, ask again. |
| 11 | `paymentStatus = "declined"` | Marketplace → Customer | Message `Decline`, matched on `orderId` | `orderId`, `paymentStatus` | `retryPayment = true`: handoff 8 with a new attempt. | Customer cancels: handoff 12. |
| 12 | Customer cancels | Customer → Marketplace → Customer | Messages `Cancellation`, then `Cancelled`, matched on `orderId` | `orderId` | `orderStatus` and every `producerOrderStatus` become `cancelled`; the customer gets an acknowledgement. | — |
| 13 | `paymentStatus = "succeeded"` | Inside the marketplace | Jobs `b-record`, `b-commission`, `b-confirm`, `b-inventory` | `orderId`, `paymentReference`, `producerOrders` | Commission is filled in, statuses become `confirmed`, stock is deducted. | Incident. |
| 14 | Order is confirmed | Marketplace → Customer | Message `ConfirmationConfirmed`, matched on `orderId` | `orderId`, `orderStatus`, `amountInPence`, `paymentReference`, fulfilment details | The customer reads the confirmation. | The notification is retried. |
| 15 | Order is confirmed | Marketplace → each Producer | One message per `producerOrder` | That producer's whole producer order (section 2.3) | The producer records the order for fulfilment. | The notification is retried. |

**Handoff 7 does not work yet.** Checkout publishes `brfn.pending-order-ready`, but the S2-04 payment process begins with a plain start event, so nothing receives it. Connecting them is integration work under #37.

**What a producer sees.** Only their own producer order: never another producer's items, and nothing about the customer's payment.

## 5. Sample data

Both examples use the same basket and the stock in `examples/stock-catalogue.json`: three units of apples at `farm-a` and four of bread at `farm-b`.

### 5.1 A successful order from two producers

A customer orders two apples from `farm-a`, to be delivered, and one bread from `farm-b`, to be collected. The test payment is approved first time.

| Producer | Items | Subtotal | 5% commission | Payout |
|---|---|---|---|---|
| `farm-a` (delivery) | 2 × apples at £6.00 | 1200p | 60p | 1140p |
| `farm-b` (collection) | 1 × bread at £4.00 | 400p | 20p | 380p |
| **Order `ORD-1001`** | | **1600p** | **80p** | **1520p** |

Checked by hand: 1200 + 400 = 1600, the amount charged. 60 + 20 = 80, the order's commission. 1140 + 380 + 80 = 1600. Stock afterwards: apples 3 → 1, bread 4 → 3. Both times are three days ahead, well over 48 hours.

Before the review Form, preparation should produce this **trusted quote** from the current basket and catalogue prices (illustrative data; not yet emitted by a worker):

```json
{
  "currency": "GBP",
  "items": [
    { "producerId": "farm-a", "productId": "apples", "quantity": 2, "unitPriceInPence": 600, "lineTotalInPence": 1200 },
    { "producerId": "farm-b", "productId": "bread", "quantity": 1, "unitPriceInPence": 400, "lineTotalInPence": 400 }
  ],
  "totalInPence": 1600
}
```

The larger JSON below shows the process variables at the end of the payment process. The complete file, [order-success.json](order-success.json), adds the stock before and after and the notifications sent.

```json
{
  "orderId": "ORD-1001",
  "checkoutId": "CHK-1001",
  "customerId": "CUS-205",
  "basket": {
    "items": [
      { "producerId": "farm-a", "productId": "apples", "quantity": 2 },
      { "producerId": "farm-b", "productId": "bread", "quantity": 1 }
    ]
  },
  "stockValidation": { "canCheckout": true, "errors": [] },
  "fulfilmentSelections": [
    { "producerId": "farm-a", "fulfilmentMethod": "delivery", "scheduledFor": "2026-11-19T10:00:00Z" },
    { "producerId": "farm-b", "fulfilmentMethod": "collection", "scheduledFor": "2026-11-19T14:00:00Z" }
  ],
  "fulfilmentValidation": { "isValid": true, "errors": [] },
  "checkoutDecision": "confirm",
  "orderCreatedAt": "2026-11-16T10:00:00Z",
  "orderStatus": "confirmed",
  "amountInPence": 1600,
  "testScenario": "approve",
  "paymentAttemptId": "ATTEMPT-1001-1",
  "paymentStatus": "succeeded",
  "paymentReference": "SIM-ATTEMPT-1001-1",
  "paymentProvider": "simulated",
  "commissionTotalInPence": 80,
  "producerOrders": [
    {
      "producerOrderId": "PO-1001-A",
      "orderId": "ORD-1001",
      "producerId": "farm-a",
      "producerOrderStatus": "confirmed",
      "fulfilmentMethod": "delivery",
      "scheduledFor": "2026-11-19T10:00:00Z",
      "items": [{"productId": "apples", "quantity": 2, "unitPriceInPence": 600, "lineTotalInPence": 1200}],
      "producerSubtotalInPence": 1200,
      "commissionInPence": 60,
      "producerPayoutInPence": 1140
    },
    {
      "producerOrderId": "PO-1001-B",
      "orderId": "ORD-1001",
      "producerId": "farm-b",
      "producerOrderStatus": "confirmed",
      "fulfilmentMethod": "collection",
      "scheduledFor": "2026-11-19T14:00:00Z",
      "items": [{"productId": "bread", "quantity": 1, "unitPriceInPence": 400, "lineTotalInPence": 400}],
      "producerSubtotalInPence": 400,
      "commissionInPence": 20,
      "producerPayoutInPence": 380
    }
  ]
}
```

### 5.2 A declined payment

The same basket as order `ORD-1002`, but the sandbox declines the payment. The variables that differ:

```json
{
  "orderId": "ORD-1002",
  "checkoutId": "CHK-1002",
  "orderStatus": "awaiting_payment",
  "amountInPence": 1600,
  "testScenario": "decline",
  "paymentAttemptId": "ATTEMPT-1002-1",
  "paymentStatus": "declined",
  "paymentReference": null
}
```

Nothing else moves. The order stays open, both producer orders stay `awaiting_payment`, stock is untouched, no commission is calculated and no producer hears about it. The complete file is [payment-failed.json](payment-failed.json).

### 5.3 Other situations

| Situation | What happens | What we expect |
|---|---|---|
| Payment declined, customer retries | `retryPayment = true`, then `testScenario = "approve"` | A new attempt, `ATTEMPT-1002-2`, on the same `orderId`. Ends like 5.1. |
| Payment declined, customer cancels | `retryPayment = false` | The order and both producer orders become `cancelled`. No stock change, no refund, no producer notification. |
| Payment service outage | `testScenario = "outage"`: no reply in 30 seconds | The marketplace queries the same `paymentAttemptId`. `unknown`: wait 30 seconds and ask again. `succeeded`: confirm as in 5.1, using the reference from the reply. No second charge. |
| Not enough stock | The basket asks for 5 apples; 3 are available | `stockValidation.canCheckout = false` with `INSUFFICIENT_STOCK`. Checkout waits until the basket is changed. No order is created. |
| Stock service down | The stock source cannot be read | `STOCK_CHECK_UNAVAILABLE`. The customer chooses `stockRetry`. No order is created. |
| Customer cancels at review | `checkoutDecision = "cancel"` | Checkout ends. No `orderId`, no order state. |
| Time chosen is too soon | `scheduledFor` is 24 hours away | `fulfilmentValidation.isValid = false`. The customer picks a later time. |

## 6. Consistency check against the models

The acceptance criterion asks that the data is used consistently, not only written down. On 15 November 2026 I compared this document with the models and workers on `main` and with the stock-validation branch (PR #42).

### What already matches

| Model point | Variables used | Matches? |
|---|---|---|
| Checkout: gateway "Are all items and amounts available?" | `stockValidation.canCheckout = true` | Yes |
| Checkout: gateway "Try again?" | `stockRetry = true` | Yes |
| Checkout: gateway "Are the choices and times OK?" | `fulfilmentValidation.isValid = true` | Yes |
| Checkout: gateway "What does the customer choose?" | `checkoutDecision` = `"confirm"` / `"amend"` | Yes |
| Checkout: producer-order loop | `producers` → `producer` → `producerOrder` → `producerOrders`, with `orderId` | Yes |
| Stock worker (PR #42) | `basket.items`, `stockValidation`, `STOCK_CHECK_UNAVAILABLE` | Yes |
| S2-04: gateway "Payment result?" | `paymentStatus` = `"succeeded"` / `"declined"` | Yes |
| S2-04: gateway "Test scenario?" | `testScenario` = `"approve"` / `"decline"` / `"outage"` | Yes |
| S2-04: gateway "Retry?" | `retryPayment = true` | Yes |
| S2-04: message matching | `orderId` for customer messages, `paymentAttemptId` for provider replies | Yes |
| S2-09 worker | Takes `orderId`, `paymentAttemptId`, `amountInPence`; returns `paymentStatus`, `paymentReference`, `paymentProvider` | Yes |

### 6.1 Known model-documentation mismatch: `orderState`

**Canonical choice: `orderStatus`.** Section 2.1, section 3.1, the order-creation handoff in section 4, and both sample outcome files all use `orderStatus` with values such as `awaiting_payment` and `confirmed`. Do not introduce an `orderState` alias.

The published [Checkout diagram](../../Diagrams/Checkout%20diagram.bpmn), in the documentation of its service task **“Make main order – Waiting for payment”** (`create-marketplace-order`), currently says: `Return orderId and orderState representing awaiting payment.` This is a **wording mismatch in the BPMN task documentation**, not evidence of an executable `orderState` mapping.

**Exact correction still needed in the BPMN file:** replace that sentence with `Return orderId and orderStatus = awaiting_payment.` Then ensure the eventual `create-marketplace-order` worker actually outputs `orderStatus` using the agreed values. The diagram and worker have **not** been modified by this document change; this item remains open until Ahmet updates the BPMN and verifies the implementation.

## 7. Planned for Sprint 3

This section describes **remaining work**, not behaviour already demonstrated. Sprint 2 requires initial working automation: the review on 17 November 2026 found no published handlers for `prepare-fulfilment`, `validate-fulfilment`, `create-marketplace-order`, `create-producer-order` or `handoff-payment`, and no working checkout-to-payment handoff. Those initial implementations and a basic multi-producer test must not be mislabelled as finished or postponed merely because Sprint 3 completes the wider behaviour.

| Sprint 3 backlog | Planned completion | Relevant shared data | Owner |
|---|---|---|---|
| S3-01 | Handle stock changes between checkout and payment through an agreed recheck or reservation approach. | `basket`, `stockValidation` | Kaan |
| S3-02 | Complete fulfilment validation, the 48-hour rule, supplier-specific options, user-visible errors, amendment and cancellation flows. | `fulfilmentOptions`, `fulfilmentSelections`, `fulfilmentValidation`, `checkoutDecision` | Efe, coordinating with the fulfilment worker owner |
| S3-03 | Keep overall and producer order states consistent and prevent duplicate orders on repeated requests. | `checkoutId`, `orderId`, `orderStatus`, `producerOrders` | Ahmet |
| S3-04 | Complete payment decline, retry, lost-response and service-outage handling without a second charge for the same attempt. | `paymentAttemptId`, `paymentStatus`, `retryPayment`, `paymentReference` | Gokdeniz |
| S3-05 and S3-06 | Verify commission and payouts; update inventory and send notifications once after successful payment. | `amountInPence`, `commissionTotalInPence`, `producerOrders`, `orderStatus` | Gokdeniz (commission); Kaan (follow-up) |
| S3-07 and S3-08 | Complete checkout/payment integration and record reproducible successful, declined, shortage and outage tests. | All handoff data in section 4 | Ahmet (integration); Efe (tests) |

Any completed functionality must be supported by published code and recorded test evidence; a BPMN job type, documentation paragraph or sample JSON is not proof of a running worker.

## 8. Open decisions and unresolved interfaces

The following choices still require agreement or implementation checks. The proposed values are **demonstration assumptions**, not real producer facts or claims of completed functionality.

| Item | Current proposal or question | Who needs to confirm / next action | Status |
|---|---|---|---|
| Producer delivery/collection options | For the demo, `farm-a` offers both methods and `farm-b` offers collection only (section 2.5). | Efe and Kaan confirm the sample scenario with Ahmet. | Proposed, not yet group-confirmed |
| Trusted option source | The prepared `examples/producer-fulfilment-options.json` stores one supported-methods list per producer. | Confirm the sample methods with Efe and Kaan; load the file in `prepare-fulfilment`. | Sample data prepared; worker not implemented |
| Trusted prices | The revised `examples/stock-catalogue.json` supplies apples at 600p and bread at 400p. | Make sure the revised catalogue is in the repository and implement trusted `orderQuote` calculation in `prepare-fulfilment`. | Sample data prepared; quote worker not implemented |
| Fulfilment error contract and Form display | `validate-fulfilment` must identify the affected producer and explain unsupported methods and times under 48 hours. | Ahmet and Efe agree an `errors[]` shape and show its messages in the Form. | To agree and implement |
| Durable order idempotency | Use `checkoutId` for the parent and `(orderId, producerId)` for producer orders, with persistent duplicate protection. | Ahmet chooses and tests durable storage/uniqueness; Form data cannot choose IDs. | Contract defined; worker not implemented |





