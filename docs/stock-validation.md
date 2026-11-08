# Stock validation

Issue: [#32 / S2-06](https://github.com/sungurz/bristol-food-marketplace/issues/32)

Checks the availability and quantity of each product in a basket for Use Case 2. The JavaScript code runs locally with sample data. The input/output format still needs agreement in [#31](https://github.com/sungurz/bristol-food-marketplace/issues/31), and the Camunda connection is pending. JavaScript was chosen for this local version; the group has not specified a worker runtime.

## Run it

Use Node.js 22 or later. Tested with Node.js 24.22.1. No extra packages or credentials are needed.

From the repository folder:

```sh
node --test
node examples/stock-validation-demo.js
node src/validate-stock-cli.js examples/stock-validation-input.json
```

The equivalent package commands are `npm test`, `npm run demo` and `npm run validate:stock -- examples/stock-validation-input.json`.

The command returns exit code 0 for an allowed basket, 2 for a blocked basket, or 1 for an unreadable or invalid JSON file.

## How the code works

1. Check that the basket and stock data have the expected structure.
2. Look up stock by producer ID and product ID.
3. Add together repeated basket lines for the same producer/product pair.
4. Check that each product exists, is available and has enough stock for the combined requested quantity.
5. Return `canCheckout: true` when every check passes, or false with the item errors when any check fails.

`validateBasket` in `src/stock-validation.js` performs the checks. `validateStockVariables` reads `basket` and `products`, then returns the result under `stockValidation`.

## Input format - pending #31

```json
{
  "basket": {
    "items": [
      { "producerId": "farm-a", "productId": "apples", "quantity": 2 },
      { "producerId": "farm-b", "productId": "bread", "quantity": 1 }
    ]
  },
  "products": [
    {
      "producerId": "farm-a",
      "productId": "apples",
      "name": "Apples",
      "availableQuantity": 3,
      "isAvailable": true
    },
    {
      "producerId": "farm-b",
      "productId": "bread",
      "name": "Bread",
      "availableQuantity": 4,
      "isAvailable": true
    }
  ]
}
```

IDs must be non-empty strings and match exactly. Product names are optional. This version uses whole units, such as items or packs. Requested quantities must be positive safe integers; stock quantities must be non-negative safe integers. Agree the units before adding fractional quantities for products sold by weight. Availability must be a boolean.

Use trusted product-service data or server-side sample data for `products`, rather than stock figures supplied by a customer form. `availableQuantity` is the quantity available for checkout; the reservation rule still needs agreement. `isAvailable` comes from the product service and should account for seasonal availability. This function does not calculate availability dates.

## Output format - pending #31

For a valid basket:

```json
{
  "stockValidation": {
    "canCheckout": true,
    "errors": []
  }
}
```

Requesting 5 apples when only 3 are available returns false. The error identifies the producer, product, requested quantity and available quantity. The result includes all item errors found in that check.

| Error code | Meaning and response |
|---|---|
| `EMPTY_BASKET` | Add an item before checkout. |
| `INVALID_BASKET`, `INVALID_ITEM`, `INVALID_QUANTITY` | Correct the basket structure, IDs or quantity. |
| `PRODUCT_NOT_FOUND` | The product is not listed for the requested producer; amend the basket. |
| `PRODUCT_UNAVAILABLE` | Remove or replace the unavailable product. |
| `INSUFFICIENT_STOCK` | Reduce the quantity or remove the item. |
| `INVALID_STOCK_DATA` | Stock data is missing, malformed or ambiguous. Refresh or fix that data; changing a valid customer basket alone does not fix it. |

## Remaining Camunda work

- Agree the variable names, quantity units, stock source and result format with Ahmet under #31 and Efe's checkout Forms work under #33.
- Have the chosen Camunda worker or service task call this module using fresh trusted stock data and publish the returned result as a process variable.
- Configure the checkout gateway to continue only when the returned boolean is true. The blocked route must show appropriate errors and require amendment; stock-data failures need an appropriate recovery route.
- Demonstrate both routes in the actual Camunda process and connect them with the team's order creation and integration work.

Worker registration and BPMN deployment are still pending. The current tests cover the JavaScript component; the group still needs to demonstrate it running inside the process.

## Scope and limits

- This component checks stock only. Order creation, order states, payments, commission, stock reservation/deduction and notifications are separate work.
- The checkout model and Forms cover the 48-hour preparation rule. Inventory deduction and producer notifications follow successful payment in the agreed backlog.
- The stock snapshot may change after validation. Concurrent purchasing, reservations, locking and a later stock recheck require the team's agreed rule and the Sprint 3 stock-handling work. This initial check does not guarantee stock will still be available at payment time.
- Completing #32 requires integration and a demonstration of the actual Camunda flow.

## Requirement references

- [Development notes](development-notes.md): tools used during implementation and validation.
- Supplied `Task 1 - Use Cases.pdf`, Use Case 2, page 2: check all selected products and requested quantities; unavailable or insufficient stock requires amendment.
- Supplied `Case Study - v2.pdf`, page 2: support single-producer and multi-producer checkout.
- Supplied Task 1 assessment brief, pages 4-6: executable Camunda processes and initial automation are required alongside operational models.
- [Agreed product backlog](product-backlog.md): S2-05 shared data; S2-06 initial validation; S2-07 Forms; S2-11 integration; S2-12 testing; S3-01 later stock/amendment handling.
