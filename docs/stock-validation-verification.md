# Stock-worker validation — 15 November 2026

Scope: issue #32's stock service and Camunda connection. This records local execution, not formal assessment submission or proof that the whole checkout is integrated.

- `node --test`: **56 passed**, 0 failed, 0 skipped.
- `node scripts/check-stock-camunda.js`: **8 real-engine cases passed**, using Camunda 8 Run **8.10.9**.
- Deployment `2251799813685445`, process `stock_worker_test_1794752378155`.
- The standalone worker entry point was also started directly with Node.js 24.22.1; instance `2251799813685618` completed with the allowed route and a true stock result using the default catalogue file.

| Real-engine case | Process instance | Observed route |
|---|---|---|
| Valid multi-producer basket | 2251799813685448 | allowed |
| Shortage despite forged process stock | 2251799813685468 | amend |
| Corrected quantity | 2251799813685488 | allowed |
| Changed source stock | 2251799813685508 | amend |
| Unavailable product | 2251799813685528 | amend |
| Invalid stock JSON | 2251799813685547 | recovery |
| Missing stock file | 2251799813685568 | recovery |
| Restored source | 2251799813685589 | allowed |

The fixture records a branch marker after the engine's actual exclusive gateway/error boundary. Assertions check that marker and the returned stock result, including overwriting a deliberately seeded earlier success. An initial engine run exposed that thrown-error variables did not propagate outside the boundary scope. The worker now clears the root stock result before throwing the error; all recovery assertions then passed.

Component/protocol checks cover producer/product identity, aggregated repeated rows, invalid/overflowing quantities, malformed stock, immutability, CLI statuses, exact REST requests, separate bearer tokens, trusted-source reloads, ignored customer stock, source timeout/redirect rejection, transient activation failure, non-successful completion responses and graceful shutdown.

This fixture is generated in memory solely for testing. It is not an assessed diagram or a completed customer interface/order/payment test. Rechecks after amendment/recovery are separate instances. Actual Forms and the other services must still be integrated with the handmade checkout model. These checks do not prove reservation, concurrent purchasing or later stock deduction.

See [stock-worker.md](stock-worker.md) for configuration and the requirement mapping. Re-running the script creates new keys; those above belong to this recorded local run.
