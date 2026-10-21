# Case-study analysis: stakeholders, processes and responsibilities

**Status: draft for group review.** Supports [issue #7](https://github.com/sungurz/bristol-food-marketplace/issues/7). The analysis is prepared for discussion; it does not record agreement or confirm that each member has read the case study.

## 1. Purpose and evidence

The Bristol Regional Food Network needs a digital marketplace that makes local food easier to buy and reduces the effort producers spend managing separate customer conversations. The case describes a network of 40 small and medium producers serving a community within a 20-mile radius of Bristol city centre. Producers have different levels of technical confidence, so routine work must be straightforward. [CS, pp. 1–2]

This document identifies the principal stakeholders, major business processes and proposed organisational responsibilities. It provides input to the i* models and strategic BPMN required by the assessment. It does not select the group's two implementation functions or define executable Camunda workflows. Those are later decisions. [AB, pp. 3–4]

Evidence labels used below:

- **Case requirement:** stated in the supplied case study.
- **Proposed responsibility:** a suggested allocation of work that the group must review.
- **Open decision:** a rule or arrangement that the supplied material does not settle.

Sources:

- **[CS]** *Case Study - v2.pdf*, pp. 1–2, Bristol Regional Food Network – Digital Marketplace. Names and organisations are fictional for the assessment.
- **[AB]** *UFCFTR-30-3 -First Sit - Task 1(1).pdf*, pp. 3–4, modelling and implementation requirements.
- **[#7]** The issue requires every member to read the full case study and agree the stakeholders, major processes and organisational responsibilities.

## 2. Principal stakeholders

The first five entries are directly grounded in the case. Specific network staff positions are proposed below rather than assumed to exist.

| ID | Stakeholder | Goals and concerns | Main dependencies |
| --- | --- | --- | --- |
| S1 | Local food producers | Reach customers; maintain products, prices and seasonal stock easily; see orders with at least 48 hours to prepare; receive weekly settlements and clear records. | Customers provide orders; the marketplace presents accurate listings and routes orders; payment handling provides payment and settlement results. |
| S2 | Individual customers: young professionals and families | Find local food conveniently, compare useful product information and complete one checkout across suppliers. | Producers supply accurate availability and food information; the network coordinates checkout and makes delivery or collection responsibilities clear. |
| S3 | Community and institutional customers: schools, educational institutions, care facilities and voluntary organisations | Obtain reliable local supplies for community catering. | Producers meet agreed supply commitments; the marketplace makes supplier responsibility and fulfilment arrangements visible. Bulk pricing or recurring orders are not specified requirements. |
| S4 | Independent restaurants and cafés | Source local ingredients while reducing administration across multiple suppliers. | Producers provide seasonal availability and reliable fulfilment; the marketplace consolidates ordering without hiding the separate suppliers. |
| S5 | Bristol Regional Food Network | Connect the local community with producers, sustain the network through its 5% commission, support quality and traceability, reduce waste and encourage community engagement. | Producer participation and accurate information; customer use; coordinated order records, payments and communications. |

### External parties and system boundary

| Participant or constraint | Evidence and treatment |
| --- | --- |
| Payment service | Secure payment processing is required. A separate payment service is a reasonable external participant, but a vendor has not been selected. Stripe/PayPal sandboxes or a mock/local simulation are permitted examples, not agreed choices. All assessment payment work must use test environments and no real financial data. [CS] |
| Delivery or collection participants | Delivery and collection arrangements must be clear. The case does not name a courier, collection hub or delivery employer. Model any such participant only when the group has agreed who performs the work. [CS] |
| Certification bodies | Organic certification status must be available. A live certification-body integration or automatic verification service is not specified. Producer-supplied information is the starting requirement; checking and escalation remain open. [CS] |
| Data-protection and financial rules | The case requires compliance. These constrain the enterprise; the case does not establish a regulator as a day-to-day process participant or specify a complete compliance design. [CS] |
| Marketplace software | Supports the people and organisations above by maintaining records and coordinating work. Keep automated service tasks distinguishable from the organisation responsible for their outcome. |

## 3. Case requirements to preserve

These IDs provide a common reference for later diagrams, requirements and backlog items. All are grounded in [CS, pp. 1–2].

| ID | Requirement | Main process links |
| --- | --- | --- |
| R1 | Simple product listing: names, descriptions, prices and availability timeframes; frequent seasonal inventory updates. | P1 |
| R2 | Categorised browsing and specific-item search; harvest dates, farm origin and seasonal availability. | P1, P2 |
| R3 | Single- and multi-vendor checkout with clear supplier responsibility and delivery or collection arrangements. | P2, P3 |
| R4 | Order visibility with a minimum 48-hour preparation lead time. | P2, P3 |
| R5 | Secure payments, weekly producer settlements, automatic 5% network commission, and transparent tax/accounting audit trails. | P4 |
| R6 | Producer-supplied organic certification status, allergens and best-before information; customer–product–producer records for rapid quality or food-safety communication. | P1, P5 |
| R7 | Food miles calculated using postcode-based distance. | P6 |
| R8 | Surplus communications and last-minute discounts to reduce waste. | P7 |
| R9 | Producer sharing of seasonal recipes, storage guidance and farm stories. | P8 |
| R10 | Accessible operation for producers with varying technical ability; the existing communications burden is around 15 hours per week for some producers. | Across P1–P8 |
| R11 | Payment features use sandbox, mock or simulated environments only; no live financial systems or real financial data. | P4 and all demonstrations |

## 4. Major business processes

These are enterprise-level processes. Several can run independently; the numbers do not imply that every customer journey runs through all eight.

| ID | Process and trigger | Principal work and outcome | Participants and records |
| --- | --- | --- | --- |
| P1 | Maintain the product catalogue and availability — producer adds or changes an offer. | Record product details, price, seasonal stock, availability and food information; publish the current offer. Outcome: usable, current listings. | Producer; network catalogue function; product, origin, harvest, certification, allergen and best-before information. |
| P2 | Discover products and place an order — customer wants local food. | Browse/search, inspect product information, choose products and delivery/collection arrangements, and check out with one or several vendors. Outcome: a recorded order with each supplier's commitments identifiable. | All customer segments; catalogue and ordering functions; products, order lines, quantities, supplier identities and fulfilment arrangements. |
| P3 | Coordinate and fulfil supplier orders — order reaches the relevant producers. | Present each producer's part of the order with the required preparation time, coordinate fulfilment information, prepare goods and complete the agreed handover. Outcome: each supplier's commitment can be followed through to completion or an exception. | Producers; customers; network order coordination; any agreed delivery/collection participant. Availability exceptions need an agreed resolution rule. |
| P4 | Collect payment and settle producers — checkout requests payment; weekly settlement becomes due. | Process test payment, associate the result with the order, calculate the network's 5% commission, distribute producer amounts on the weekly cycle and retain accounting records. Outcome: traceable payment and settlement results. | Customer; network finance function; payment service; producer; transaction, commission and settlement records. Payment timing and failure/refund rules remain open. |
| P5 | Handle quality or food-safety communication — a concern is reported. | Use the customer–product–producer links to identify relevant orders and communicate promptly with the affected parties. Outcome: traceable communication and a recorded follow-up. | Customer, producer and proposed network quality/support function. Detailed recall authority and refund decisions are not specified. |
| P6 | Provide food-mile information — relevant origin and destination postcodes are available. | Calculate and present postcode-based distance for the relevant supply journey. Outcome: understandable distance information supporting local purchasing. | Producer supplies origin; customer supplies relevant destination; marketplace calculates. Distance method and multi-vendor aggregation require agreement. |
| P7 | Communicate surplus and discounts — producer identifies surplus. | Update the surplus offer and discount information and make it visible to customers. Outcome: customers can discover surplus opportunities. | Producer; network catalogue/communications functions; customer. How last-minute offers satisfy R4 is unresolved. |
| P8 | Share producer and seasonal knowledge — producer contributes content. | Publish recipes, storage guidance and farm stories. Outcome: community information connected to local producers and seasonal food. | Producer; network community function; customers. Any moderation workflow is a proposed design choice. |

## 5. Proposed organisational responsibilities

This is a functional allocation for discussion, not a confirmed staffing structure or a final RACI chart. One person or organisation may perform several functions. The network remains responsible for the marketplace service; a service task does not replace human accountability.

| Function | Proposed responsibility | Supporting participants or automation | Boundary to confirm |
| --- | --- | --- | --- |
| Producer operations | Producers maintain their own offers, stock and supplied food information, prepare their goods and provide fulfilment updates. | Catalogue and order services store information and notify the relevant parties. | Who checks listing completeness or certification claims; how unavailable orders are resolved. |
| Customer purchasing | Customers choose items, supply necessary order/fulfilment information, complete test checkout and receive goods under the agreed arrangement. | Browsing, checkout and communication services. | Who may order for an institution; whether organisational accounts are needed. |
| Catalogue and marketplace operations | Network function maintains a usable catalogue structure and supports publication and availability management. | Producers supply content; software validates agreed fields and displays listings. | Approval rules and producer onboarding are unspecified. |
| Order coordination | Network function maintains the combined customer order, supplier-specific responsibilities and fulfilment information. Producers perform their own preparation. | Software routes the relevant information and tracks agreed statuses. | Delivery owner, charges, collection arrangements, stock reservation, cancellation and partial fulfilment. |
| Finance and settlement | Network finance function oversees commission calculation, weekly settlements and accounting records. | Payment service processes test transactions; software records results and calculates agreed amounts. | Commission basis, rounding, taxes, payment timing, failed payouts and refunds. |
| Quality and customer support | Producers supply product information; a proposed network support function coordinates traceability enquiries and communication. | Linked order/product/producer/customer records. | Escalation authority, who contacts affected customers and who decides corrective action. |
| Sustainability and community | Producers identify surplus and contribute community content; network functions make these services available. | Distance calculation and publication/communication services. | Distance display, surplus lead-time policy and any content moderation. |

Technical support is also a likely enabling network function because producer capabilities vary. Its staffing, response times and support channels are not defined in the case.

## 6. Principal relationships and information exchanges

| Relationship | Information or dependency | Why it matters to strategic BPMN and i* |
| --- | --- | --- |
| Producer → catalogue → customer | Current offers, stock, prices, origin and food information. | Customers depend on producers for accuracy and the network for accessible discovery. |
| Customer → ordering → producer | Combined customer order separated into identifiable supplier commitments. | One checkout must preserve who supplies each item and the preparation/fulfilment commitments. |
| Ordering ↔ payment service | Payment request and success/failure result associated with the order. | Payment and order coordination depend on each other; their detailed ordering is still a design decision. |
| Producer ↔ order coordination ↔ customer | Fulfilment updates, handover details and exception information. | Supplier preparation and customer convenience must be coordinated across organisational boundaries. |
| Payment/accounting → producer and network | Weekly settlement result, producer amount, 5% commission and audit records. | Producers depend on reliable income and transparency; the network depends on commission. |
| Product/order records → quality communication | Links between affected products, producers and customers. | Rapid communication depends on keeping records connected across catalogue, ordering and support. |
| Producer → surplus/community services → customer | Surplus offers, discounts, recipes, guidance and stories. | Waste reduction and community engagement create additional relationships beyond checkout. |

For i*, candidate goals include convenient local purchasing, reliable producer income, manageable administration, trustworthy food information and reduced waste. Ease of use, reliability and transparency are candidate soft goals. The stakeholder dependencies above should inform the SD model and be refined into tasks/resources in the SR model. These are modelling inputs, not completed i* diagrams. [AB, p. 3]

For strategic BPMN, distinguish independent producer/customer organisations from internal network functions. Pools and message flows represent exchanges across participant boundaries; lanes can clarify internal responsibilities once the group agrees them. Include external payment processing and cross-process relationships without inventing a courier organisation. The overall strategic model must cover the enterprise, not just producer preparation. [AB, p. 3]

## 7. Decisions still needed

| ID | Question for group review | Effect on later work |
| --- | --- | --- |
| D1 | How can last-minute surplus offers coexist with the minimum 48-hour preparation lead time? Is any exception intended? | P2, P3 and P7 cannot silently apply conflicting timing rules. |
| D2 | Who delivers or operates collection, who pays any charges, and how are different suppliers' arrangements shown? | Determines fulfilment participants, messages and customer commitments. |
| D3 | When is stock reserved, and what happens when one supplier cannot fulfil part of a multi-vendor order? | Determines order decisions, partial fulfilment and payment adjustments. |
| D4 | When is payment taken, what amount forms the 5% commission basis, and how are refunds, rounding and failed weekly settlements handled? | Determines finance rules and exception paths. No particular tax calculation is established by the case. |
| D5 | Who checks food information/certification and coordinates a safety concern? | Determines quality responsibilities, escalation and communication tasks. |
| D6 | How is the 20-mile scope applied, and how is postcode distance calculated/displayed for multiple producers? | Separates any eligibility rule from the food-mile information requirement. |
| D7 | What differences, if any, are required for institutional and restaurant customers? | Avoids assuming bulk pricing, credit accounts or subscriptions without agreement. |
| D8 | Which internal functions need separate lanes, and which external participants actually perform work? | Keeps the organisational model consistent with the agreed responsibilities. |
| D9 | Which two major functions will be proposed to the module team for implementation approval? | Supports later scoping; the assessment requires agreement before implementation. [AB, p. 4] |

## 8. Group review and completion of #7

Record the group's review in the issue or a later revision. No agreement is recorded yet.

- [ ] Every member confirms they have read the full case study.
- [ ] Agree the principal stakeholders and the distinction between confirmed actors and proposed roles.
- [ ] Agree the major processes and their main relationships.
- [ ] Agree the organisational responsibility allocation, recording any changes.
- [ ] Resolve the open decisions needed now and record owners for decisions deferred to later modelling.
- [ ] Confirm the analysis is a suitable shared basis for the i* and strategic BPMN work.

The draft analysis can be reviewed in a pull request while #7 remains open. Close the issue only when the reading and group-agreement requirements have been satisfied.
