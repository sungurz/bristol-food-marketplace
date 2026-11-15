# Running the stock-validation worker

Issue [#32 / S2-06](https://github.com/sungurz/bristol-food-marketplace/issues/32). This is the running stock-check service for Use Case 2, including the Camunda connection. The [validation module guide](stock-validation.md) describes the basket checks and error fields.

## Start it

Use Node.js 22 or later and Camunda 8's Orchestration Cluster REST API. No npm packages are required. Run from the repository root:

```sh
node --test
node examples/stock-validation-demo.js
node src/camunda-stock-worker.js
```

Or use `npm test`, `npm run demo` and `npm run worker:stock`. Start Camunda 8 Run first, then the worker in a second terminal. Defaults are `http://localhost:8080/v2` and `examples/stock-catalogue.json`. That file is **demonstration inventory**, not a production database. Stop the worker with Ctrl+C.

To configure it, copy `.env.example` to `.env`, edit it and run:

```sh
node --env-file=.env src/camunda-stock-worker.js
```

Choose exactly one of `STOCK_FILE` (server-side JSON) and `STOCK_URL` (HTTP(S) endpoint returning the same array). Remove `STOCK_FILE` if using `STOCK_URL`. Relative paths use the terminal's current directory. The file/endpoint is read on **every job**, including after amendment/retry. A valid empty array means no products are listed. Invalid/duplicate records mean the source cannot be used. Replace a live file atomically so readers do not see a partial write.

Optional `CAMUNDA_TOKEN` and `STOCK_TOKEN` supply separate bearer tokens. Local C8Run's default unprotected development API needs neither. Tokens belong in environment configuration, never process variables or committed files. The worker does not obtain/refresh OAuth tokens; the environment/process manager must renew them where required.

| Setting | Default | Purpose |
|---|---|---|
| `CAMUNDA_REST_URL` | `http://localhost:8080/v2` | REST base URL |
| `STOCK_FILE` | `examples/stock-catalogue.json` | Trusted file if no URL is set |
| `STOCK_URL` | unset | Trusted endpoint instead of the file |
| `STOCK_TIMEOUT_MS` | 5000 | Stock read timeout |
| `CAMUNDA_REQUEST_TIMEOUT_MS` | 10000 | Bound each Camunda request |
| `CAMUNDA_ACTIVATION_TIMEOUT_MS` | 5000 | Activation long poll |
| `STOCK_JOB_TIMEOUT_MS` | 60000 | Lease for one activated job |
| `STOCK_POLL_MS` | 500 | Idle poll/retry starting delay |

Timing settings must be positive integers. Activation must fit the HTTP timeout; stock loading plus two Camunda requests must fit the lease. One job is processed at a time. During API/network failures the worker backs off, up to 10 seconds with the defaults. It finishes an active job before stopping. API failures never grant checkout permission. Unacknowledged jobs become available after their lease expires; read-only validation is safe to repeat. Lease expiry alone does not decrement retries or create an incident. Persistent API/authentication faults require an operator to fix the service/configuration.

## Exact model connection

The worker registers for `validate-stock`, matching `Activity_0x7ig7l` in [Checkout diagram.bpmn](../Diagrams/Checkout%20diagram.bpmn). It fetches only `basket`; it ignores a process/Form `products` variable and loads authoritative stock from configuration.

```json
{
  "basket": { "items": [
    { "producerId": "farm-a", "productId": "apples", "quantity": 2 },
    { "producerId": "farm-b", "productId": "bread", "quantity": 1 }
  ] }
}
```

The trusted source returns an array like `examples/stock-catalogue.json`. Each record requires `producerId`, `productId`, non-negative safe-integer `availableQuantity` and boolean `isAvailable`; `name` is optional. Requested quantities are positive safe integers. This supports whole units/packs. Fractional weights require a separately agreed unit conversion. Seasonal availability must already be reflected in the trusted catalogue flag.

Normal validation completes the job with `{ "stockValidation": { "canCheckout": true, "errors": [] } }`, or false with all detected basket errors. Each check replaces the whole result. The existing gateway continues only on `= stockValidation.canCheckout = true`; its default route requires basket amendment. The amendment task supplies a revised `basket` and loops back through the worker. The worker creates no orders and reserves/deducts no stock.

Missing/unreadable stock, HTTP failures/timeouts, invalid JSON and invalid/duplicate catalogue records raise `STOCK_CHECK_UNAVAILABLE`, matching boundary `Event_0q6876y`. These failures go to retry/cancel recovery, rather than asking a customer to repair backend data.

Before throwing that error, the worker writes a false stock result and recovery message at **root process scope**, using the activated job's `processInstanceKey`. Error payloads alone remain local to the catch event unless it has output mappings. The explicit write prevents a previous success surviving in the current diagram, which has no such boundary output mapping. The worker therefore needs permission to update process variables as well as activate/complete/throw errors for jobs. If either sequential API call is not acknowledged, it does not falsely complete the job; the lease allows reactivation. No diagram edit is required.

## Handover to Ahmet and Efe

1. Keep task type `validate-stock`, the boolean gateway condition and the boundary code above. Run this worker separately from the engine and the other workers.
2. Configure the group's trusted catalogue file/endpoint with current stock. Never accept stock figures or a source URL/path from a customer Form.
3. Start checkout with `basket.items`. The amendment Form displays `stockValidation.errors`, saves only a revised basket and returns through stock validation. Customers must not overwrite stock results.
4. The recovery Form returns boolean `stockRetry` for retry/cancel. A retry reloads the source through the same worker.
5. Success continues to `prepare-fulfilment`. Other fulfilment/order workers and the payment handoff remain the relevant owners' tasks.
6. Record the shared contract under [#31](https://github.com/sungurz/bristol-food-marketplace/issues/31). This implementation already uses the published diagram's variable names. If the group changes them, update the Forms, model and worker together and retest.

The full model names four deployment-bound Forms: `brfn-checkout-amend`, `brfn-checkout-fulfilment`, `brfn-checkout-review`, `brfn-checkout-stock-recovery`. Their resources and the other workers must be supplied before the whole customer journey can run. A completed stock component does not mean the whole marketplace is finished.

## Real-engine checks

With an isolated local Camunda engine running and no other `validate-stock` worker using it:

```sh
node scripts/check-stock-camunda.js
```

Or run `npm run test:camunda:stock`. It deploys a uniquely named **test-only** process, runs the real worker and asserts actual gateway/boundary routes. It does not edit or replace the assessed diagram. Test instances remain in that engine for inspection in Operate; the temporary catalogue is removed and the test worker stops.

Eight cases cover valid multi-producer stock, shortage despite forged process stock, corrected quantity, changed inventory, unavailable product, invalid JSON, missing source and restored source. Amendment/recovery rechecks use fresh test instances; they do not claim to test the team's actual Form loop. See the [validation record](stock-validation-verification.md).

## Specification check

| Requirement | Implementation / evidence | Remaining team work |
|---|---|---|
| Use Case 2 p2: all producer quantities and availability checked | Composite IDs, repeated-row totals, all-or-nothing result; component and engine tests | Configure the agreed catalogue source |
| Use Case 2 p2: invalid items require amendment | False result and item errors follow the gateway's amendment route | Efe's actual Form and team test of its loop |
| Assessment pp4-6: executable service task and variables | Running REST worker with the published model's contract; Camunda 8.10.9 execution | Integrate all team services and Forms |
| Current model: source unavailable | Boundary error, stale-success prevention, fresh reload on retry | Recovery Form |
| Case study pp1-2: supplier preparation and safe test payments | Kept separate from the stock service | 48-hour fulfilment rules and sandbox payment |
| Backlog S3-01: changes between checkout and payment | Reloads every check; no inventory mutation | Later stock recheck/reservation/concurrency policy |
| Assessment p9: acknowledge development assistance and understand contributions | [Development notes](development-notes.md) retained | Each member explains their actual work |

Checked against the supplied `Task 1 - Use Cases.pdf` (Use Case 2 p2), `Case Study - v2.pdf` (pp1-2), `UFCFTR-30-3 -First Sit - Task 1(1).pdf` (pp4-6, p9), issue #32 and the [agreed backlog](product-backlog.md). Order creation, confirmation Forms, preparation-time validation, payment, 5% commission, inventory deduction and notifications are separate implementations. Stock validation is a snapshot, not a reservation or guarantee against concurrent purchases.
