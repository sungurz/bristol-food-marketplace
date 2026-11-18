# Sprint 2 checkout tests

Issue: #38
Prepared by: Efe Genc
Date: 18 November 2026

This file records how we tested the first version of the checkout (Functionality A): the four checkout forms, the routing in the checkout BPMN, and the workers that exist so far. It also lists what we could not test yet and why.

## 1. What we tested and how

| Part | How it was tested |
| --- | --- |
| Four checkout forms (`forms/`) | Opened in the Camunda Modeler 5.52 form preview with sample data from `examples/` (see section 3). The same checks were also run in the form-js 2.0.2 renderer, which Modeler 5.52 uses. |
| Checkout routing in Camunda 8 Run 8.10 | Done in the Sprint 2 group review on 17 November 2026, using a test copy of the checkout BPMN and the real forms (section 4). |
| Workers (stock, fulfilment preparation, fulfilment validation, order creation, commission) | Automated tests: `node --test` from the repository root (section 5). |
| 48-hour rule and producer options | `npm run demo:validate-fulfilment` and the worker tests (TC12, TC14, TC15). |
| Two-producer order, payment and commission | Ahmet's S2-11 integration run in Camunda (section 4). |

All data is sample data. No real customers, producers or payments are used.

## 2. Test cases

| ID | Scenario | Input | Expected result | Result |
| --- | --- | --- | --- | --- |
| TC1 | Not enough stock | Basket asks for 5 apples, only 3 available | Amend form opens and shows "Apples: requested 5, but only 3 available" | Pass |
| TC2 | Customer fixes the basket | Change apples from 5 to 2 | Form saves `basket.items` with quantity 2; stock is checked again | Pass |
| TC3 | Part units | Type 1.5 as a quantity | Form refuses to submit ("Value is expected to be an integer") | Pass |
| TC4 | Blank added row | Click "Add new", then submit | Form refuses to submit; the empty producer and product are required | Pass |
| TC5 | Stock service down, customer cancels | `stockRetry` left unticked | Checkout ends on the cancel path | Pass (group review) |
| TC6 | Stock service down, customer retries | `stockRetry` ticked | Stock is checked again and succeeds | Pass (group review) |
| TC7 | One row per producer | Two producers in the basket | Fulfilment form shows two producer blocks, using data in the shape `prepare-fulfilment` produces | Pass |
| TC8 | Producer offers collection only | `farm-b` supports only collection | Only "Collection" is shown for `farm-b` | Pass |
| TC9 | Rejected choice is explained | `fulfilmentValidation.errors` contains a 48-hour problem | The message is shown at the top of the fulfilment form | Pass (form only) |
| TC10 | Review before confirming | Two producers, total 1600 pence | Review form shows items, prices, "Total to pay: £16.00" and the delivery choices | Pass |
| TC11 | Review decision | Choose confirm, change or cancel | `checkoutDecision` is `confirm`, `amend` or `cancel` | Pass |
| TC12 | 48-hour rule rejects an early time | farm-a delivery 24 hours ahead | `isValid` is false; message "Producers need at least 48 hours to prepare…"; customer goes back to the fulfilment form | Pass (worker test and demo) |
| TC13 | Successful multi-producer purchase | Two producers (£16.00), confirmed checkout, approved test payment | Main order and two producer orders created; payment succeeds; 80p commission | **Partly passed:** passed in Ahmet's S2-11 run, which starts after checkout is confirmed. The run from the checkout forms is not recorded yet. |
| TC14 | 48-hour rule accepts a valid time | Both producers 72 hours ahead | `isValid` is true; checkout continues to the review form | Pass (worker test and demo) |
| TC15 | Producer only offers collection | farm-b delivery 72 hours ahead | `isValid` is false; message "Delivery is not offered by this producer. Choose collection." | Pass (worker test and demo) |

## 3. Sample data for the form preview

Paste into the **Form Input** box in Camunda Modeler. The values match `examples/stock-catalogue.json` and `examples/producer-fulfilment-options.json`.

Amend form (TC1 to TC4):

```json
{"stockValidation":{"canCheckout":false,"errors":[{"code":"INSUFFICIENT_STOCK","message":"Apples: requested 5, but only 3 available. Amend the basket.","producerId":"farm-a","productId":"apples"}]},"basket":{"items":[{"producerId":"farm-a","productId":"apples","quantity":5},{"producerId":"farm-b","productId":"bread","quantity":1}]}}
```

Fulfilment form (TC7 to TC9):

```json
{"fulfilmentOptions":[{"producerId":"farm-a","supportedMethods":["delivery","collection"]},{"producerId":"farm-b","supportedMethods":["collection"]}],"fulfilmentSelections":[{"producerId":"farm-a","fulfilmentMethod":null,"scheduledFor":null},{"producerId":"farm-b","fulfilmentMethod":null,"scheduledFor":null}],"fulfilmentValidation":{"isValid":false,"errors":[{"producerId":"farm-a","message":"Choose a time at least 48 hours from now."}]}}
```

Review form (TC10 and TC11):

```json
{"orderQuote":{"currency":"GBP","items":[{"producerId":"farm-a","productId":"apples","quantity":2,"unitPriceInPence":600,"lineTotalInPence":1200},{"producerId":"farm-b","productId":"bread","quantity":1,"unitPriceInPence":400,"lineTotalInPence":400}],"totalInPence":1600},"fulfilmentSelections":[{"producerId":"farm-a","fulfilmentMethod":"delivery","scheduledFor":"2026-11-20T10:00Z"},{"producerId":"farm-b","fulfilmentMethod":"collection","scheduledFor":"2026-11-21T14:00Z"}]}
```

TC9 uses a sample error message. The real message format must be agreed with Ahmet when `validate-fulfilment` is written.

## 4. Engine tests from the group review

The Sprint 2 group review (17 November 2026) deployed the checkout BPMN and the four forms to Camunda 8 Run 8.10.9. It used a test copy with its own process ID, so other jobs were not affected.

| Test | Instance | Result |
| --- | --- | --- |
| Short stock, amend 5 to 2, stock checked again | 2251799813685663 | Pass |
| Stock service down, cancel | 2251799813685694 | Pass |
| Stock service down, retry, then success | 2251799813685719 | Pass |

These runs used the forms as they were before the fixes in section 6. The fixes did not change any form ID or key, so the routing is the same.

Ahmet's S2-11 integration run (18 November 2026, `docs/s2-11-integration.md`) used two demo processes connected by a call activity. It started from a confirmed checkout with two producers:

| Result | Value |
| --- | --- |
| Producer orders | 2 (farm-a delivery, farm-b collection) |
| Total | £16.00 |
| Simulated payment | Succeeded |
| Commission | £0.80 (farm-a payout £11.40, farm-b payout £3.80) |

The order status stays `awaiting_payment` after payment; this is recorded as a follow-up in that document.

## 5. Automated tests

Command: `node --test` from the repository root.

Result on 18 November 2026: **143 tests, 143 passed, 0 failed.** They cover stock validation, the stock worker, fulfilment preparation, fulfilment validation (12 new tests), order creation, the order store and the commission calculation. They do not cover the whole journey from basket to payment.

## 6. Problems found and fixed

The group review found these problems in the forms. They were fixed in #33:

- Review form did not show items, prices or the total, and its table was too narrow.
- Amend form showed only an error code such as `INSUFFICIENT_STOCK`.
- Amend form accepted 1.5 as a quantity, and an empty "Add new" row could be submitted.
- Fulfilment form offered delivery to producers that only offer collection, and could not show rejection messages.

The review also found that the 48-hour check was missing. It was added as the `validate-fulfilment` worker (`docs/validate-fulfilment.md`).

## 7. Known limitations

- **Adding products during amend:** Camunda uses one setting for both adding and removing rows. We need removing, so "Add new" is still visible. An empty row cannot be submitted, and the form tells the customer to go back to the shop to add a different product.
- **48-hour rule in Camunda:** `validate-fulfilment` now enforces the rule (TC12, TC14, TC15), but a run of it in a live Camunda engine is not recorded yet.
- **Full purchase:** TC13 passed from a confirmed checkout. Running it from the checkout forms needs the checkout-to-payment handoff (#37). Planned for Sprint 3.
- **Empty basket:** if the customer removes every item in the amend form, there is no cancel option there. The stock check returns `EMPTY_BASKET` and the form appears again. Planned for Sprint 3.
- **Names:** forms show IDs such as `farm-a` and `apples`, not display names.

