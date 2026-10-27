# Case Study Analysis

**Prepared by:** Ahmet  
**Module:** Distributed Software Enterprise  
**Focus:** Customer ordering and fulfilment coordination  
**Status:** Draft for group discussion

This analysis examines the customer journey from finding products to receiving or collecting an order, particularly where several producers are involved. Where the supplied brief does not establish an operational rule, suggested arrangements are presented as proposals rather than confirmed case-study requirements.

## 1. Stakeholders and their needs

### Customers

Customers need to browse product categories and search for specific products. Product information should help them understand what is available, where it originates, its harvest date where applicable, and how seasonal availability affects purchasing.

Customers also need to understand which producer supplies each item. When purchasing from several producers, they should be able to distinguish each supplier's contribution and understand any separate preparation times, delivery commitments or collection arrangements.

A single purchase should provide a clear overview of the order while preserving the details needed to follow each producer's progress.

### Producers

Producers need accurate information about the products and quantities ordered from them, together with the agreed fulfilment arrangements. They should be able to identify their own responsibilities without having to manage another producer's part of the purchase.

Fulfilment commitments must allow sufficient time for preparation. The ordering process should therefore take account of producer availability and preparation requirements before presenting a delivery or collection time as confirmed.

Producers also need a way to communicate changes affecting their portion of an order, such as unavailable products or preparation delays.

### BRFN marketplace operator

The marketplace needs to connect customers with producers, communicate product information and coordinate orders involving one or several suppliers.

Its coordination role includes maintaining the relationship between the customer's overall order and each producer's contribution, and communicating the relevant status and fulfilment information.

"Marketplace operator" describes an inferred organisational role. It does not establish particular departments, staffing arrangements or responsibility for physically transporting products.

## 2. Major business processes

### Product browsing and search

The customer journey begins with browsing categories or searching for products. Results should provide enough information for customers to identify relevant products and the producers offering them.

Customers should be able to move from search results to more detailed product information before adding items to their basket.

### Reviewing origin, harvest dates and availability

Product details should communicate origin, harvest dates where applicable, and seasonal availability. This information supports informed purchasing and helps customers understand when products can reasonably be supplied.

Seasonal availability and current stock should be distinguished. A product may normally be in season but temporarily unavailable from a particular producer.

The handling of unknown harvest dates and products outside their usual season requires an agreed approach. The system should avoid presenting missing or uncertain information as a confirmed fact.

### Placing single-vendor and multi-vendor orders

For a single-vendor order, all items are supplied by one producer. The customer needs a clear record of the selected products, quantities and agreed fulfilment arrangements.

For a multi-vendor order, the marketplace must preserve the connection between the overall purchase and the items supplied by each producer.

A proposed design is to maintain one overall customer order with a separate supplier portion for each producer. Each portion would identify its products, quantities, preparation requirements and fulfilment status. This is a suggested implementation approach rather than a structure explicitly established by the brief.

Adding an item to a basket should not automatically be treated as a confirmed supplier commitment. The point at which availability and fulfilment arrangements become binding needs to be agreed.

### Coordinating preparation and fulfilment commitments

The marketplace should communicate fulfilment arrangements that reflect the preparation time required by each producer. Proposed dates or collection windows should be distinguished from confirmed commitments.

For multi-vendor purchases, different suppliers may be ready at different times. The customer should therefore be told whether the order involves separate handovers or another agreed arrangement.

The process must not assume that all products can be prepared simultaneously or that one supplier's readiness means the entire order is ready.

### Communicating delivery and collection procedures

Customers need clear instructions about how they will receive their products. Relevant information includes the agreed date or time window, location, responsible contact and any collection reference required.

For collection, the customer should understand where to go, when the products will be ready and whether separate suppliers require separate collections. Whether collection takes place at producer premises or a shared location remains to be established.

**Delivery ownership is unresolved.** The case does not establish a dedicated delivery company or a central delivery team. Responsibility for arranging and carrying out delivery must therefore remain an explicit question.

### Tracking progress and handling changes

Customers should be able to identify the status of each supplier's portion of an order. Suggested statuses include awaiting confirmation, preparing, ready for collection, completed and delayed; the precise status model requires agreement.

If one producer cannot fulfil their portion, the marketplace should identify the affected items and communicate the change clearly. The brief does not establish whether the remaining portions should proceed automatically or require customer approval.

## 3. Customer-process outline

| Main stage | Actors involved | Information exchanged |
| --- | --- | --- |
| **1. Browse categories and search** | Customer; marketplace | Customer submits a category selection or search term. The marketplace returns relevant products and supplier identities. |
| **2. Review product information** | Customer; marketplace; producer | Producer information is presented to the customer, including origin, harvest dates where applicable, seasonal availability and current availability. |
| **3. Build and review the basket** | Customer; marketplace | Customer selects products and quantities. The marketplace shows which producer supplies each item and any known fulfilment conditions. |
| **4. Submit the order** | Customer; marketplace | Customer provides the information needed for the selected fulfilment option. The marketplace records the order and identifies each supplier's portion. |
| **5. Confirm supplier commitments** | Marketplace; relevant producers; customer | Each producer receives their items and quantities. Availability, preparation requirements and feasible fulfilment times are checked and communicated to the customer. The confirmation method requires agreement. |
| **6. Communicate handover arrangements** | Customer; marketplace; producers; delivery owner if established | Confirmed arrangements specify dates, time windows, locations, contacts and whether separate handovers are required. |
| **7. Prepare products and report progress** | Producers; marketplace; customer | Producers communicate readiness or delays. The marketplace associates each update with the correct supplier portion and informs the customer. |
| **8. Collect or receive products and close the order** | Customer; producer or agreed handover actor; marketplace | The relevant parties record handover or receipt. A proposed rule is to close the overall order once every supplier portion has been completed or otherwise resolved. |

## 4. Separation of responsibilities

**Customer responsibilities:** Select products and quantities, provide accurate information needed for fulfilment, and follow agreed collection or receipt arrangements.

**Producer responsibilities:** Maintain the product and availability information they supply, communicate preparation requirements, prepare their accepted items, and report changes affecting their commitments.

**Marketplace responsibilities:** Present information, record orders, identify supplier contributions, coordinate confirmations and communicate fulfilment updates. Physical delivery responsibility cannot be assigned to the marketplace without further evidence from the case.

## 5. Implications for the distributed software design

The main coordination challenge is that one customer order can depend on several independent producers. Their availability, preparation times and progress may differ.

The software should therefore maintain clear links between the overall order, its individual items and the responsible producers. Supplier updates should affect the correct portion of the order, while the customer receives a coherent overview.

A delay or failure affecting one supplier should remain visible without incorrectly changing the recorded status of another supplier's contribution. The rules governing partial fulfilment and overall order completion must be agreed before detailed implementation.

## 6. Questions requiring clarification

- **Who owns delivery?** Who arranges transport, carries the products and communicates delivery delays? No dedicated delivery company or central delivery team is established.
- Are collections arranged separately with each producer, through a shared collection point, or through multiple supported options?
- How are producer preparation times, order cut-off times and available fulfilment windows established?
- When does a submitted order become confirmed, particularly when several producers are involved?
- If one supplier cannot fulfil their portion, can the remaining portions proceed, and what decision must the customer make?
