# Functional scope – Use Case 2
 
Issue: #13
Prepared by: Efe Genc

 
We split Use Case 2 (multi-vendor checkout and payment) into two major functionalities. Functionality A ends when the order is created. Functionality B starts there and takes the payment.
 
## Functionality A – Checkout and order creation
 
**Goal:** Turn the customer's basket into a confirmed order, where each producer's part is clear.
 
**Starts when:** The customer clicks checkout.
**Ends when:** The marketplace order is created and split into producer orders. Then Functionality B starts.
 
**In scope:**
- Check that every product in the basket is still available in the requested quantity.
- Find which producers are in the order.
- Show the delivery or collection option for each producer.
- The customer reviews and confirms the order.
- Create the marketplace order and split it into one order per producer.
**Out of scope:**
- Product search and category pages (products will be sample data).
- Adding or editing products (this is Use Case 1).
- Customer registration and login.
**Exception paths:**
- Not enough stock → the customer is told which item is the problem and asked to change the order.
- The customer cancels at the review step → the process ends without an order.
## Functionality B – Payment and commission
 
**Goal:** Take the payment for the order and work out how the money is shared.
 
**Starts when:** The order from Functionality A is created.
**Ends when:** The payment is confirmed, stock is updated and producers are notified.
 
**In scope:**
- Send the payment to a mock or sandbox payment service.
- If the payment succeeds: confirm the order, reduce stock and notify each producer.
- Calculate the amount for each producer and the marketplace's 5% commission.
**Out of scope:**
- Real payments or real card details.
- Weekly payouts to producers.
- Refunds and cancelling a paid order.
- Delivery tracking.
**Exception paths:**
- Payment declined → the customer is told and can try again.
- Payment service not available → wait and retry. If it still fails, the order is put on hold and the customer is told, instead of the process just ending.
## Brief requirements check
 
The brief says each functionality should show these things 
 
| Requirement | Functionality A | Functionality B |
| --- | --- | --- |
| User interaction | Customer reviews and confirms the order | Customer retries a declined payment |
| Automated processing | Stock check, splitting the order | Commission calculation, stock update |
| Business decision | Is there enough stock? | Payment succeeded, declined or service down? |
| Service interaction | Stock / product data | Mock payment service, producer notification |
| Data processing | Order and producer order data | Payment result, producer amounts, commission |
| Exception flow | Not enough stock | Payment declined, service down |
 


 
