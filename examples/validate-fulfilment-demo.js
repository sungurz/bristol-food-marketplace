// Shows the three Sprint 2 fulfilment checks without Camunda: node examples/validate-fulfilment-demo.js
import { readFile } from 'node:fs/promises';
import { validateFulfilmentVariables } from '../src/camunda-validate-fulfilment-worker.js';

const fulfilmentOptions = JSON.parse(await readFile(new URL('./producer-fulfilment-options.json', import.meta.url), 'utf8'));
const now = Date.now();
const inHours = (h) => new Date(now + h * 3600000).toISOString().slice(0, 16) + 'Z'; // same format as the Form

const scenarios = [
  ['1. farm-a delivery 24 hours away', [
    { producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: inHours(24) },
    { producerId: 'farm-b', fulfilmentMethod: 'collection', scheduledFor: inHours(72) }]],
  ['2. both producers 72 hours away', [
    { producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: inHours(72) },
    { producerId: 'farm-b', fulfilmentMethod: 'collection', scheduledFor: inHours(72) }]],
  ['3. delivery for farm-b, which only offers collection', [
    { producerId: 'farm-a', fulfilmentMethod: 'delivery', scheduledFor: inHours(72) },
    { producerId: 'farm-b', fulfilmentMethod: 'delivery', scheduledFor: inHours(72) }]],
];

console.log(`Server time: ${new Date(now).toISOString()}\n`);
for (const [title, fulfilmentSelections] of scenarios) {
  const { fulfilmentValidation } = validateFulfilmentVariables({ fulfilmentSelections, fulfilmentOptions }, { now });
  console.log(title);
  console.log(fulfilmentValidation.isValid ? '   ACCEPTED -> checkout continues to the review form'
    : '   REJECTED -> customer goes back to the fulfilment form');
  for (const error of fulfilmentValidation.errors) console.log(`   ${error.producerId}: ${error.message}`);
  console.log();
}
