# Fulfilment validation worker (48-hour rule)

Issue: #33 (S2-07)
Prepared by: Efe Genc

This worker runs the checkout service task **4. Check the choices and 48-hour preparation time** (job type `validate-fulfilment`) in `Diagrams/Checkout diagram.bpmn`.

## What it checks

For every producer in the order, it checks that:

1. The customer chose delivery or collection.
2. The producer offers that method (from the trusted `fulfilmentOptions` written by `prepare-fulfilment`).
3. The date and time is at least **48 hours** after the server's clock.
4. There is exactly one choice per producer, and no choice for a producer outside the order.

It returns `fulfilmentValidation`:

| Result | What happens next |
| --- | --- |
| `isValid: true`, no errors | The gateway *Are the choices and times OK?* continues to the review form. |
| `isValid: false`, with `errors` | The customer goes back to the fulfilment form, which shows each `producerId` and `message` in the "Please fix these choices" table. |

Each error has a `code`, a `producerId` and a `message`, for example:

```json
{ "code": "LEAD_TIME_TOO_SHORT", "producerId": "farm-a", "message": "Producers need at least 48 hours to prepare. Choose 2026-11-20 16:43 UTC or later." }
```

Codes: `METHOD_REQUIRED`, `METHOD_NOT_OFFERED`, `TIME_REQUIRED`, `INVALID_TIME`, `LEAD_TIME_TOO_SHORT`, `SELECTION_MISSING`, `DUPLICATE_SELECTION`, `UNKNOWN_PRODUCER`.

If `fulfilmentOptions` is missing or invalid, this is a process problem, not a customer mistake. The worker fails the job with no retries, so Camunda shows an incident instead of a wrong business decision.

## How to run

Node.js 22 or later. No npm packages are needed.

| Command | What it does |
| --- | --- |
| `npm run demo:validate-fulfilment` | Shows the three Sprint 2 checks without Camunda. |
| `node --test tests/camunda-validate-fulfilment-worker.test.js` | Runs the 12 tests for this worker. |
| `npm run worker:validate-fulfilment` | Starts the worker against Camunda (default `http://localhost:8080/v2`; set `CAMUNDA_REST_URL` and `CAMUNDA_TOKEN` if needed). |

Run it together with the stock worker and `prepare-fulfilment`, so the checkout can reach this task.

Expected demo output:

```text
1. farm-a delivery 24 hours away
   REJECTED -> customer goes back to the fulfilment form
   farm-a: Producers need at least 48 hours to prepare. Choose <time> or later.

2. both producers 72 hours away
   ACCEPTED -> checkout continues to the review form

3. delivery for farm-b, which only offers collection
   REJECTED -> customer goes back to the fulfilment form
   farm-b: Delivery is not offered by this producer. Choose collection.
```

## Limits

- Tested with unit tests and the demo script. A run in a live Camunda engine still needs to be recorded.
- The rule uses UTC. Producer opening hours and last-minute surplus discounts are not included.

