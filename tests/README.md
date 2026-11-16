# Stock-validation tests

Run `node --test` from the repository root. Tests cover single-producer and multi-producer baskets, exact stock boundaries, unavailable products, incorrect producer/product pairs, repeated lines, malformed quantities and stock data, amendment, unchanged stock, and the local JSON command.

`stock-worker.test.js` also tests the worker using local HTTP servers: completion/error requests, fresh trusted stock, invalid sources, authentication headers, timeouts, retry/backoff and shutdown. All 56 component/protocol checks passed on 15 November 2026.

With an isolated Camunda engine running, `node scripts/check-stock-camunda.js` checks 8 actual engine routes. This does not edit the assessed diagram or supply missing Forms/order/payment components. See the [validation record](../docs/stock-validation-verification.md).
