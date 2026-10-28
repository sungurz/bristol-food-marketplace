# Case Study Analysis
 
Author: Efe Genc
Focus: Stakeholder needs and enterprise-wide coverage
 
## Stakeholders and their needs
 
| Stakeholder | What they need |
| --- | --- |
| Producers | Simple product listing and stock updates. Orders at least 48 hours ahead. Weekly payments with clear records. |
| Families and young professionals | Local food without visiting farm shops in short opening hours. |
| Community groups | Reliable local suppliers for catering. |
| Restaurants and cafés | Local ingredients without managing many small suppliers. |
| BRFN | Connect producers and customers, earn 5% commission, support food safety and the community. |
| Payment service | Process payments (sandbox or mock only). |
 
## Major business processes
 
1. Products and stock
2. Browsing and ordering
3. Fulfilment (preparation, delivery or collection)
4. Payments and settlements
5. Food safety and traceability
6. Sustainability and community (food miles, surplus discounts, recipes)
Our use case covers areas 2 and 4, but the strategic BPMN should show all six.
 
## Organisational responsibilities
 
| Activity | Responsible |
| --- | --- |
| Listing products and updating stock | Producer |
| Ordering and paying | Customer |
| Coordinating orders, commission and weekly payments | BRFN |
| Processing payments | Payment service |
| Delivery or collection | Not clear in the case study |
 
## Interactions and dependencies
 
- Customers need correct product and stock information from producers.
- Producers need order details from BRFN at least 48 hours ahead.
- BRFN needs the payment result before confirming an order.
- Food safety depends on BRFN linking customers, products and producers.
## Evidence from the case study
 
- **Page 1, Background:** 40 producers, three customer segments and their problems.
- **Page 1, Producers:** different technical skills, simple listing and seasonal updates.
- **Pages 1–2, Producers:** 48-hour preparation, weekly payments with audit trails.
- **Page 2, Customers:** categories, search, single and multi-vendor checkout.
- **Page 2, Core Functionality:** secure payments, 5% commission, data protection rules.
- **Page 2, Quality Assurance and Community Features:** traceability, food miles, surplus discounts, recipes.
- **Page 1, Disclaimers:** payments must use test environments only.
## Questions and assumptions
 
**Questions:**
- Who does delivery or runs collection?
- How do last-minute surplus discounts work with the 48-hour rule?
- Do community groups and restaurants need anything different at checkout?
**Assumptions:**
- Each producer prepares their own products.
- Products will be sample data in our demo.
