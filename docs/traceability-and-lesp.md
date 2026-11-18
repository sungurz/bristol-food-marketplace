# Model traceability and LESP considerations

Issue: #39 (S2-13)
Prepared by: Efe Genc

This document links stakeholder needs from the case study to our i\* Strategic Dependency model, the strategic BPMN and the two operational BPMN models. It also records the legal, ethical, social and professional (LESP) issues that affect our use case.

Models used:

- i\* SD model: `Diagrams/iStar-models/iStar-strategic-dependency-model` (#27)
- i\* SR model: strategic rationale model in `Diagrams/iStar-models/`
- Strategic BPMN: `Diagrams/Merged BPMN.bpmn`
- Functionality A, checkout: `Diagrams/Checkout diagram.bpmn` (#29)
- Functionality B, payment: `Diagrams/S2-04_Payment_and_Order_Confirmation_Operational.bpmn` (#30)
- Checkout forms: `forms/` (#33)

## 1. Traceability for Use Case 2

Each row starts from a need in the case study and shows where it appears in each model.

| # | Stakeholder need (case study) | i\* SD dependency | Strategic BPMN | Operational BPMN |
| --- | --- | --- | --- | --- |
| T1 | Checkout must handle single and multi-vendor orders (p.2) | *Multi-vendor order processed* (Goal, Customers → BRFN) | BRFN: *Check stock and review checkout*, *Create order + producer parts* | Checkout: *6. Make the main order and each producer's order* (repeats per producer) |
| T2 | Products must be available in the amount ordered (p.1, inventory updates) | *Up-to-date stock* (Resource, BRFN → Producers) | BRFN: *Check stock and review checkout* | Checkout: *1. Check items and stock amounts*, gateway *Are all items and amounts available?*, *Read problems and change the basket*; amend form shows each stock problem message |
| T3 | Clear delivery and collection arrangements per supplier (p.2) | *Delivery/collection details* (Resource, Customers → BRFN) | Customer: *Review suppliers and confirm*; message *Delivery collection handover* | Checkout: *2. Find producers and delivery / collection choices*, *3. Choose delivery or collection for each producer*; fulfilment form shows only the methods each producer offers |
| T4 | Producers need orders at least 48 hours ahead (p.1–2) | *Order details (48h ahead)* (Resource, Producers → BRFN) | Producer: *Check stock and 48 hour lead time*; message *Producer specific order* | Checkout: *4. Check the choices and 48-hour preparation time* (job `validate-fulfilment`, not implemented yet); fulfilment form note; Payment: *Send each producer its confirmed order + allocation* |
| T5 | One simple checkout instead of many suppliers (p.1, restaurants) | *Low admin effort* (Softgoal, Customers → BRFN) | Customer: one journey from basket to purchase | Checkout: *5. Check the order*; review form shows items, prices, total and arrangements before confirm, change or cancel |
| T6 | Customers pay for their order (p.2, secure payment system) | *Payment for the order* (Resource, BRFN → Customers) | Customer: *Chose test payment retry or cancel*; BRFN: *Reserve stock / test payment* | Payment: *Choose sandbox payment and enter details*, *Submit payment details* |
| T7 | Payments processed by a payment system (p.2; disclaimer: sandbox only) | *Payment request* and *Payment result* (Resources, between BRFN and Payment Service) | Test Payment pool; messages *Test payment request* and *Result / reconsile same attempt* | Payment: *Request sandbox payment*, *Receive payment result*, gateway *Payment result?*; Sandbox payment provider pool |
| T8 | Payments must be secure (p.2) | *Secure payment* (Softgoal, Customers → BRFN) | BRFN boundary events *Review again* and *Cancel* | Payment: *Notify customer payment was declined*, *Choose retry or cancel*, gateway *Retry?* |
| T9 | 5% commission and correct producer amounts (p.2) | *Weekly payment*, *Transparent financial records* (Producers → BRFN) | Note on *Confirm orders and notify* | Payment: *Calculate 5% commission and producer allocations* |
| T10 | Producers see their incoming orders (p.1–2) | *Order details (48h ahead)* | Producer: *Producer order received* | Payment: *Send each producer its confirmed order + allocation*; Producer: *Review own confirmed order and allocation* |
| T11 | Stock kept up to date after a sale (p.2, inventory management) | *Up-to-date stock* | BRFN: *Reserve stock / test payment* | Payment: *Update inventory without duplicate deduction* |
| T12 | Personal and payment data protected (p.2) | *Data protection* (Softgoal, Customers → BRFN) | Not shown at this level | Checkout: customer answers kept separate from stock, prices and order IDs; Payment: sandbox provider only, payment attempt ID |

### Vulnerability: the Payment Service

In the SD model, BRFN depends on the Payment Service for the *Payment result*. This gives BRFN the ability to take payments, but also makes it vulnerable if the service fails. The payment BPMN handles this with the boundary event *No reply after 30 seconds*, *Query original attempt without charging again*, and *Still unavailable*. This means a failure does not charge the customer twice or stop the process without an answer.

### Dependencies outside our use case

These dependencies are in the SD model because it covers the whole case study, but they are not part of Use Case 2. In the strategic BPMN they fall under *Other marketplace work* and *Other producer work*.

| i\* dependency | Business process |
| --- | --- |
| *Product listings*, *Label food information*, *Accurate product information* | Product listing (Use Case 1) |
| *Notify about food safety issues*, *Safe and traceable food* | Food safety and traceability (Use Case 3) |
| *Food miles information*, *Surplus discounts*, *Recipes and farm stories* | Sustainability and community features |
| *Reach more customers*, *Reliable supply*, *Simple to use*, *Easy product search*, *Order prepared and handed over* | Wider marketplace goals |

### Gaps to agree as a group

- **Stock reservation:** the strategic BPMN says *Reserve stock / test payment*, but the checkout document says no stock is reserved during checkout. We need to agree when stock is reserved (#31).
- **48-hour rule:** the rule is shown in the forms, but the trusted check (`validate-fulfilment`) is not implemented yet. Until it exists, T4 is only partly traced to working software.
- **SR and SD directions:** the Sprint 2 review found that *Delivery/collection details* and *Payment request* point the opposite way in the SR model. The SD direction should be kept, so the SR model needs correcting.
- **Allergen information** is not shown at checkout yet (see section 2).
- **Data protection** is not visible in the strategic BPMN. This is acceptable at a high level, but the operational models and forms should only collect the data they need.

## 2. Legal, ethical, social and professional considerations

Each issue is linked to the part of our models it affects.

### Legal

| Issue | Linked to | What it means for our system |
| --- | --- | --- |
| **UK GDPR and Data Protection Act 2018** | *Data protection* softgoal; checkout forms (#33) | Our checkout forms only collect the basket, delivery or collection choices and dates, and the customer's decision. They do not ask for names, addresses or card details. When delivery addresses are added later, we should only collect what is needed for the order (data minimisation) and keep it secure (ICO, no date). |
| **Consumer Contracts Regulations 2013** | Checkout step *5. Check the order*; review form | Before confirming, the customer must see the total price, each supplier and the delivery or collection arrangements. The review form now shows the items, prices, total and arrangements (#33). Fresh food that goes off quickly is an exception to the usual right to cancel. |
| **Food allergen information** | *Label food information* task | For food sold online, allergen information must be available before the order is completed and again at delivery (CIEH, no date). Our use case does not add products, but the checkout should show allergen information. This is not in the forms yet. |
| **Payment card data (PCI DSS)** | *Secure payment* softgoal; sandbox payment provider | PCI DSS is an industry standard for handling card data (PCI Security Standards Council, 2024). We never store card details: the sandbox provider handles payment, and the case study forbids real payment data. |

### Ethical

- **Fair and transparent payments:** producers depend on BRFN for *Weekly payment* and *Transparent financial records*. *Calculate 5% commission and producer allocations* must be correct and explainable to producers.
- **No double charging:** *Query original attempt without charging again* and *Update inventory without duplicate deduction* protect customers and producers when something fails.

### Social

- **Digital inclusion:** many producers are not confident with technology (*Simple to use*). Forms should be short and clear. The WCAG 2.2 guidelines (W3C, 2023) are a good standard for accessible forms.
- **Supporting local producers:** multi-vendor checkout lets small producers reach customers beyond farmers' markets (*Reach more customers*).

### Professional

- **Test data only:** all demos use the sandbox payment provider and sample data, as the case study requires.
- **BCS Code of Conduct:** relevant principles are public interest (privacy and security), and professional competence and integrity (BCS, no date).
- **Honest records:** the group records AI assistance and individual contributions in the repository, as the assessment brief requires.


## Contribution and assistance record

I prepared this document. Claude (AI) helped structure the traceability table and draft the LESP section. I checked every link against the models.



