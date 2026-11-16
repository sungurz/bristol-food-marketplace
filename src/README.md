# Source Code

- [stock-validation.js](stock-validation.js): checks basket stock and returns the result as a process variable for issue #32.
- [validate-stock-cli.js](validate-stock-cli.js): run validation against a JSON file locally.
- [stock-source.js](stock-source.js): reload and validate a trusted server-side catalogue file or HTTP endpoint on every check.
- [camunda-stock-worker.js](camunda-stock-worker.js): run the `validate-stock` worker and route stock-source failures to recovery.

See the [stock-worker guide](../docs/stock-worker.md) for configuration, the current checkout contract and remaining team integration. Issue #31 records the final shared agreement.
