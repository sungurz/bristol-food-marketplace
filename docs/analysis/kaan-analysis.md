# Case Study Analysis

Prepared by: Ege Kaan Mansur 
Focus: Producer-side processes and responsibilities  
Status: Draft for group discussion

## 1. Stakeholders and their needs

### Producers

Producers need a simple way to maintain product listings, prices, quantities and seasonal availability. They supply farm origin, harvest dates, organic certification status, allergen warnings and best-before information so customers can make informed choices.

They need to see incoming orders with at least 48 hours to prepare and receive weekly settlements with transparent accounting records. For multi-vendor orders, each producer must be able to identify their own products and commitments. Technical confidence varies, so routine tasks should be straightforward and reduce separate customer conversations.

### Customers

Customers depend on accurate product and availability information. They need to know which producer supplies each part of an order and what delivery or collection arrangements apply.

### BRFN marketplace operator

BRFN needs current listings, clear supplier responsibilities and coordination between ordering and producer preparation. Producer information also supports traceability and community activity. “Marketplace operator” is an inferred role; specific departments and staff positions are not established.

## 2. Major business processes

### Creating and updating listings

Producers create or change offers, supplying product details, prices and availability timeframes. The platform records and displays this information. Required-field checks and any manual approval process are proposed details requiring agreement.

### Managing stock and seasonal availability

Producers update quantities and availability as supply changes. The platform presents current offers to customers. Stock reservation and the handling of products that become unavailable after ordering remain open decisions.

### Maintaining food information

Producers supply origin, harvest, certification, allergen and best-before information. The platform presents it with the product and preserves its producer connection. Who checks certification claims and how changed information affects historical purchases need clarification.

### Receiving orders and preparing products

The marketplace passes each producer the relevant order details, allowing the minimum 48-hour preparation lead time required by the case study. Producers review their products and quantities and prepare the goods.

Order acceptance, preparation statuses and shortage notifications are possible process choices; their precise sequence has not been agreed.

### Coordinating fulfilment

Producers and the marketplace exchange the information needed for agreed delivery or collection, such as readiness and handover details. Customers need clear supplier commitments. A dedicated courier or central delivery team is not established, so transport ownership remains unresolved.

### Supporting traceability and community activity

Product information supports links between producers, purchased products and affected customers when quality concerns arise. Coordinate this with Gokdeniz's analysis.

The platform must support surplus communication and last-minute discounts, and allow producers to share seasonal recipes, storage guidance and farm stories. The relationship between last-minute offers and the 48-hour preparation rule needs clarification.

## 3. Organisational responsibilities

### Producers

- Maintain their product details, prices, stock and seasonal availability.
- Supply relevant origin and food information.
- Review their part of incoming orders and prepare goods.
- Provide agreed fulfilment information and relevant surplus or community content.

Responsibilities for accepting orders, reporting shortages and responding to quality concerns require group agreement.

### BRFN marketplace operator

- Coordinate listings, supplier-specific orders and fulfilment information.
- Support producers in routine marketplace tasks.
- Agree how listing problems, shortages and fulfilment exceptions are resolved.

These are proposed organisational responsibilities. Staff ownership and approval authority remain unspecified.

### Customers

Customers select products and provide necessary order and fulfilment information. Their role in agreeing substitutions or changed arrangements remains open.

### Platform automation

The platform stores and displays information, routes producer orders and maintains record links. Automation does not settle organisational accountability: storing certification status does not establish who verifies it.

## 4. Interactions and dependencies

- Customers depend on producers for accurate listings and on the marketplace for accessible information.
- Producers depend on ordering to identify their commitments and allow sufficient preparation time.
- Ordering and preparation depend on agreed rules for shortages and partial fulfilment.
- Producers, customers and BRFN exchange fulfilment information; coordinate this with Ahmet's customer-side analysis.
- Traceability depends on preserving producer–product–purchase links; coordinate this with Gokdeniz.
- Surplus and community services depend on current producer contributions.

These relationships provide input to later strategic BPMN and i* modelling.

## 5. Evidence from the case study

Source: *Case Study - v2*, Bristol Regional Food Network - Digital Marketplace, pages 1–2.

- **Page 1, Stakeholder Requirements — Producers:** intuitive listings must include names, detailed descriptions, prices and availability timeframes. Seasonal updates must not require extensive technical knowledge or training; some producers spend around fifteen hours weekly on customer communications.
- **Pages 1–2, Stakeholder Requirements — Producers:** incoming orders require at least 48 hours' preparation lead time. Page 2 also requires weekly settlements and transparent audit trails.
- **Page 2, Stakeholder Requirements — Customers:** customers need harvest dates, farm origin and seasonal indicators, with clear supplier responsibilities and delivery or collection arrangements for single- and multi-vendor orders.
- **Page 2, System Requirements — Core Functionality:** product management must support seasonal availability and inventory management; aggregated orders must preserve supplier responsibilities and delivery commitments.
- **Page 2, Quality Assurance and Community Features:** producers must be able to indicate organic certification status, allergen warnings and best-before dates. Customer–product–producer records must support rapid quality-related communication.
- **Page 2, Quality Assurance and Community Features:** the platform must support surplus communication and last-minute discounts and enable producers to share recipes, storage guidance and farm stories.

## 6. Questions and assumptions

### Questions for the group or module team

- Who checks listings, certification claims and food information?
- When is stock reserved, and who resolves shortages or partial multi-vendor orders?
- Must producers accept orders, and what happens if they cannot fulfil them?
- How is the 48-hour lead time calculated, including for last-minute surplus offers?
- Who delivers or operates collection, and who communicates changes?
- What historical product information must remain available for traceability?
- Who coordinates quality concerns, and what support is available to less confident producers?

### Assumptions requiring agreement

- Producers maintain their own offers and report availability changes.
- Each producer can identify their commitments within a multi-vendor order.
- Purchases retain links to products and producers after listings change.
- Marketplace coordination does not establish BRFN as the delivery provider.

These are proposed interpretations, not confirmed requirements or recorded group agreement.
