# Case Study Analysis

Prepared by: Gokdeniz Taslioglu
Focus: Payments, producer settlements and traceability
Status: Draft for group discussion

## 1. Stakeholders and their needs

### Producers

Producers require weekly payment settlements and transparent financial
records suitable for accounting and tax reporting. They need to understand
how their payments relate to sales and the marketplace's commission.

Technical capabilities vary between producers. This suggests that financial
information should be straightforward to access and understand without
extensive technical training.

Producers also need to provide clear product information, including organic
certification status, allergen warnings and best-before dates, to support
product traceability and quality communication.

### Customers

Customers need secure payment processing for purchases involving one or
several producers. They also need clear information about the suppliers
responsible for their orders.

Customers may be affected by product-quality or food-safety concerns.
Records connecting their purchases to products and producers must allow
the relevant customers to be identified and contacted quickly.

### BRFN marketplace operator

The marketplace needs to calculate its 5% commission automatically,
coordinate payments to producers and maintain transparent financial records.

It also needs records linking customers, products and producers to support
rapid communication when quality concerns arise.

“Marketplace operator” is an inferred organisational role. The case study
does not define BRFN's internal departments or staff positions.

### External payment service

An external payment service can support transaction processing and return
payment results to the marketplace. The specific provider and interface
have not been selected.

For this assessment, payment processing must use a sandbox or simulated
service. Live payments and real financial data must not be used.

## 2. Major business processes

### Customer payment processing

The marketplace must support payments for both single-vendor and
multi-vendor orders. For multi-vendor orders, it must preserve the
connection between the overall purchase and each producer's products.

At a high level, this involves determining the payment amount, processing
the payment through the selected test service and recording its result.

The case study requires secure processing but does not specify the
detailed sequence or payment-failure procedure.

### Commission calculation and allocation

The system must automatically calculate BRFN's 5% commission and identify
the amounts attributable to the relevant producers.

For a multi-vendor purchase, financial records need to distinguish each
producer's sales and the associated commission.

The treatment of delivery charges, discounts, taxes and refunds is not
defined and requires clarification before detailed calculations are designed.

### Weekly producer settlements

Payments must be distributed to producers on a weekly basis, supported by
transparent audit trails suitable for accounting and tax reporting.

A proposed settlement record would show the producer, settlement period,
related sales, commission deductions, amount payable and settlement status.
These fields are suggested design details rather than an explicit list
provided by the case study.

### Product traceability and quality communication

The marketplace must maintain records connecting customers, purchased
products and the producers who supplied them.

When a quality concern arises, these connections should allow the relevant
producer and affected customers to be identified quickly.

Organic certification status, allergen warnings and best-before dates
support this process. The case study does not define a complete incident
investigation or closure procedure.

## 3. Organisational responsibilities

### Producers

- Supply and maintain relevant product information.
- Provide clear certification, allergen and best-before information.
- Participate in communication concerning their affected products.

Producer participation in quality follow-up is a proposed responsibility
for group agreement; the case does not define the complete procedure.

### BRFN marketplace operator

- Oversee commission and producer settlement arrangements.
- Ensure financial records support transparent payment reporting.
- Coordinate the use of traceability records and quality communication.

These are proposed organisational responsibilities inferred from the
marketplace's requirements. Specific staff ownership needs clarification.

### Customers

- Provide the information needed to complete their purchases.
- Receive relevant order and product-quality communications.

The exact contact details collected and communication methods used remain
design decisions.

### External payment service

- Process sandbox or simulated payment requests.
- Return payment results to the marketplace.

The division of responsibility for producer payouts depends on the selected
service and settlement design.

### Platform automation

The platform supports these actors by calculating commission, recording
payment and settlement information, and maintaining traceability links.
Automated activities should be distinguished from organisational accountability.

## 4. Interactions and dependencies

- The marketplace depends on producers for accurate product information.
- Payment processing depends on order totals and the selected test service.
- Producer settlements depend on accurate sales, payment and commission records.
- Producers depend on BRFN for timely settlements and understandable records.
- Quality communication depends on links between customers, products and
  producers, together with usable customer contact information.
- The marketplace operator depends on the platform to retrieve relevant
  financial and traceability records.

## 5. Evidence from the case study

Source: Case Study - v2, Bristol Regional Food Network - Digital Marketplace.

- Page 1, Important Disclaimers:
  Payment development and testing must use sandbox or simulated services,
  without live payments or real financial data.

- Pages 1–2, Stakeholder Requirements — Producers:
  Producers have varying technical capabilities and require weekly
  settlements with financial audit trails for accounting and tax reporting.

- Page 2, Stakeholder Requirements — Customers:
  Checkout must support single-vendor and multi-vendor orders and communicate
  individual supplier responsibilities.

- Page 2, System Requirements — Core Functionality:
  Payment processing must support multiple vendors, distribute producer
  payments and calculate the network's 5% commission automatically.
  The case also requires compliance with applicable data protection and
  financial services regulations.

- Page 2, Quality Assurance and Community Features:
  Product information must support basic traceability, and records must link
  customers, products and producers for rapid quality-related communication.

## 6. Questions and assumptions

### Questions for the group or module team

1. What day and cut-off time define the weekly settlement period?
2. Is commission calculated before or after discounts, delivery charges and taxes?
3. How should refunds, cancellations and unsuccessful payments affect settlements?
4. Does the payment service distribute producer payments, or does BRFN
   coordinate a separate settlement process?
5. Who is responsible for coordinating a product-quality incident?
6. Which communication methods should be used, and what happens if contact fails?
7. Is product-level traceability sufficient, or is batch-level identification needed?
8. What access controls and retention arrangements are needed for financial
   and customer records?

### Assumptions requiring agreement

- BRFN has an authorised representative responsible for overseeing
  settlements and quality communication.
- Completed orders retain links to the products and producers involved.
- Settlement information should be accessible to producers with limited
  technical experience.

These assumptions are proposed interpretations, not confirmed requirements.
