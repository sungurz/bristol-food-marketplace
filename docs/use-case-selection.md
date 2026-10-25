# Use case selection
 
Issues: #11
Prepared by: Efe Genc
Status: Waiting for final group decision
 
## What we need to do
 
The brief says each group picks one of the three use cases. Then we split it into two major functionalities. Each one becomes an operational BPMN and a working Camunda process.
  

 
## Use Case 1 – Product listing and inventory
 
A producer adds a product. The system checks the details and checks organic certification with an external service. Then the product is published. When stock is 0, the product becomes unavailable.
 
**Good:**
- Least code. Most checks are simple (is a field empty? is stock 0?).
- Lots of forms, which fits Camunda Forms well.
- Has everything the brief asks for.
- Easy to split into two parts.
- Easy to explain in the demo.
- We need a product catalogue in Task 2 anyway.
**Bad:**
- Might look too simple. We would need good exception paths to get high marks.
- Mostly one actor (the producer).
## Use Case 2 – Checkout and payment
 
A customer buys from one or more producers. The system checks stock, splits the order by producer, takes payment through a sandbox and calculates the 5% commission.
 
**Good:**
- The most complex one, so it has the highest mark potential.
- Checkout is the core of the marketplace.
- A payment sandbox is a realistic external service.

**Bad:**
- Needs the most code (payment, splitting orders, commission).
- Needs products to already exist.
- Many things are still undecided (delivery, stock reservation, refunds).
- Highest risk that the demo does not work.
## Use Case 3 – Food safety incident
 
Someone reports a food problem. The system finds affected orders and customers, the producer is contacted, the product may be suspended and customers are notified.
 
**Good:**
- Interesting BPMN (escalation, notifications, failed notifications).
- Links well to legal and ethical issues, which helps in Sprint 3.

**Bad:**
- Needs fake orders and customers to work.
- More actors, so it is harder to explain.
- Not as central for Task 2.
## Possible two functionalities
 
| Use case | Functionality A | Functionality B |
| --- | --- | --- |
| 1 | Publish a product (with certification check) | Manage stock and seasonal availability |
| 2 | Checkout and create the order | Payment and commission |
| 3 | Investigate and escalate the incident | Notify affected customers |
 
## My suggestion
 
I suggest **Use Case 1**. It covers everything the brief asks for, needs less code, and gives us the best chance of two working processes in the final demo. To make it stronger, we can add more exception paths, for example retry when the certification service is down.
 
If someone in the group is confident with coding, Use Case 2 is the other option.
 
