import { readFile } from 'node:fs/promises';
import { validateStockVariables } from '../src/stock-validation.js';

const sample = JSON.parse(await readFile(new URL('./stock-validation-input.json', import.meta.url), 'utf8'));

function show(label, variables) {
  const { stockValidation } = validateStockVariables(variables);
  console.log(`\n${label}`);
  console.log(`  ${stockValidation.canCheckout ? 'ALLOW CHECKOUT' : 'BLOCK CHECKOUT'}`);
  for (const issue of stockValidation.errors) {
    console.log(`  [${issue.code}] ${issue.producerId ?? ''}/${issue.productId ?? ''}: ${issue.message}`);
  }
}

show('1. Two producers, all quantities available', sample);

const shortBasket = structuredClone(sample);
shortBasket.basket.items[0].quantity = 5;
show('2. Customer requests 5 apples, but only 3 are available', shortBasket);

shortBasket.basket.items[0].quantity = 3;
show('3. Customer amends the request to 3 apples', shortBasket);

const unavailable = structuredClone(sample);
unavailable.products[1].isAvailable = false;
show('4. Bread is marked unavailable', unavailable);

const repeated = structuredClone(sample);
repeated.basket.items.push({ producerId: 'farm-a', productId: 'apples', quantity: 2 });
show('5. Repeated apple lines add up to 4, exceeding stock of 3', repeated);

console.log('\nCamunda connection: pending.');
