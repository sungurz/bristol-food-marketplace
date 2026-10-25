# Project Diagrams

## Customer strategic BPMN

The customer-side model for **issue #16** covers product discovery, basket management, checkout, stock reservation, simulated payment and order confirmation for the Bristol Regional Food Network marketplace.

- [Editable Camunda BPMN model](strategic-customer.bpmn)
- [Exported overview](strategic-customer.bpmn.png)

The four subprocesses represent the customer purchasing journey: discovering products and building a basket, reviewing checkout and fulfilment, reserving stock and processing a test payment, and creating orders and confirming the purchase. The model supports single- and multi-producer orders and includes supplier-specific delivery or collection arrangements, a minimum 48-hour preparation period and the network's 5% commission.

The top-level view provides the customer-side overview; opening each subprocess reveals its detailed activities and exception paths. The model includes Camunda implementation settings, but user-task forms, automated workers and runtime testing are still required before execution. Payment processing must use simulated or sandbox services only.
