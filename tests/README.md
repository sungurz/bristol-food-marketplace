# Stock-validation tests

Run `node --test` from the repository root. Tests cover single-producer and multi-producer baskets, exact stock boundaries, unavailable products, incorrect producer/product pairs, repeated lines, malformed quantities and stock data, amendment, unchanged stock, and the local JSON command.

These are component tests. Camunda deployment, Forms and end-to-end process testing remain separate integration work.
