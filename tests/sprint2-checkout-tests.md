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
| Workers (stock, fulfilment preparation, order creation, commission) | Automated tests: `node --test` from the repository root (section 5). |

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
| TC12 | 48-hour rule is enforced | Choose a time 24 hours ahead | Checkout sends the customer back to the fulfilment form | **Not tested yet:** `validate-fulfilment` is not implemented |
| TC13 | Full multi-producer purchase | Two producers, valid choices, confirm, approved test payment | Order is created and the payment process starts | **Not tested yet:** `validate-fulfilment` and the checkout-to-payment handoff (#37) are missing |

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

## 5. Automated tests

Command: `node --test` from the repository root.

Result on 18 November 2026: **131 tests, 131 passed, 0 failed.** They cover stock validation, the stock worker, fulfilment preparation, order creation, the order store and the commission calculation. They do not cover the whole journey from basket to payment.

## 6. Problems found and fixed

The group review found these problems in the forms. They were fixed in #33:

- Review form did not show items, prices or the total, and its table was too narrow.
- Amend form showed only an error code such as `INSUFFICIENT_STOCK`.
- Amend form accepted 1.5 as a quantity, and an empty "Add new" row could be submitted.
- Fulfilment form offered delivery to producers that only offer collection, and could not show rejection messages.

## 7. Known limitations

- **Adding products during amend:** Camunda uses one setting for both adding and removing rows. We need removing, so "Add new" is still visible. An empty row cannot be submitted, and the form tells the customer to go back to the shop to add a different product.
- **48-hour rule:** the forms explain the rule, but only `validate-fulfilment` can enforce it with the server's clock. It is not written yet (TC12).
- **Full purchase:** TC13 needs `validate-fulfilment` and the payment handoff (#37). Planned for Sprint 3.
- **Names:** forms show IDs such as `farm-a` and `apples`, not display names.

