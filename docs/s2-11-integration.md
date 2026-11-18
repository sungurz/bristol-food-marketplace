
# S2-11: Integrate Initial Executable Processes

## Objective

Integrate the customer checkout and order creation process with the
simulated payment and commission process in Camunda 8.

## Implementation

Two executable BPMN processes were connected using a Camunda Call Activity:

1. Checkout and order creation
   - Creates a marketplace order using trusted catalogue prices.
   - Creates a separate producer order for each participating producer.
   - Passes order information to the payment process.

2. Simulated payment and commission
   - Simulates payment processing.
   - Calculates producer commissions and payouts.
   - Returns payment and commission results to the parent process.

The processes were deployed to the UWE Frenchay 2026 Camunda environment.

## Integration Test

An integration test was executed on 18 November 2026 using a basket
containing products from two producers.

| Result | Value |
|---|---|
| Marketplace order | Created successfully |
| Producer orders | 2 |
| Total order amount | £16.00 |
| Simulated payment | Succeeded |
| Total commission | £0.80 |
| Farm A payout | £11.40 |
| Farm B payout | £3.80 |

The test demonstrated successful execution of both processes and
the exchange of order, payment and commission data.

## Evidence

- [Camunda integration result](evidence/s2-11-integration-success.png)
- [Integration worker output](evidence/s2-11-integration-worker.png)

## Current Scope and Limitations

This test demonstrates the successful integration path using confirmed
checkout data and simulated payment.

The order record currently retains the status `awaiting_payment` after
the simulated payment succeeds. Updating the persisted order status
remains a follow-up task.

Additional error handling and complete end-to-end checkout validation
are outside the scope of this initial integration demonstration.
