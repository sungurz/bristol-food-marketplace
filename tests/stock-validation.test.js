import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateBasket, validateStockVariables } from '../src/stock-validation.js';

const examplePath = fileURLToPath(new URL('../examples/stock-validation-input.json', import.meta.url));
const cliPath = fileURLToPath(new URL('../src/validate-stock-cli.js', import.meta.url));
const example = () => JSON.parse(readFileSync(examplePath, 'utf8'));
const check = (input) => validateBasket(input.basket, input.products);

test('a valid single-producer basket can continue', () => {
  const input = example();
  input.basket.items.pop();
  assert.deepEqual(check(input), { canCheckout: true, errors: [] });
});

test('a valid multi-producer basket can continue', () => {
  assert.deepEqual(check(example()), { canCheckout: true, errors: [] });
});

test('requesting exactly the available stock is allowed', () => {
  const input = example();
  input.basket.items[0].quantity = 3;
  assert.equal(check(input).canCheckout, true);
});

test('one short-stock item blocks the whole multi-producer basket', () => {
  const input = example();
  input.basket.items[0].quantity = 5;
  assert.deepEqual(check(input), {
    canCheckout: false,
    errors: [{
      code: 'INSUFFICIENT_STOCK',
      message: 'Apples: requested 5, but only 3 available. Amend the basket.',
      producerId: 'farm-a', productId: 'apples', requestedQuantity: 5, availableQuantity: 3,
    }],
  });
});

test('zero stock blocks checkout even when the availability flag is true', () => {
  const input = example();
  input.products[0].availableQuantity = 0;
  assert.equal(check(input).errors[0].code, 'INSUFFICIENT_STOCK');
  assert.equal(check(input).canCheckout, false);
});

test('an unavailable product blocks checkout even when it has stock', () => {
  const input = example();
  input.products[1].isAvailable = false;
  assert.equal(check(input).errors[0].code, 'PRODUCT_UNAVAILABLE');
  assert.equal(check(input).canCheckout, false);
});

test('a product missing from the catalogue is rejected', () => {
  const input = example();
  input.basket.items[0].productId = 'missing';
  assert.equal(check(input).errors[0].code, 'PRODUCT_NOT_FOUND');
  assert.equal(check(input).canCheckout, false);
});

test('a product cannot be ordered under the wrong producer', () => {
  const input = example();
  input.basket.items[0].producerId = 'farm-b';
  assert.equal(check(input).errors[0].code, 'PRODUCT_NOT_FOUND');
  assert.equal(check(input).canCheckout, false);
});

test('two producers can have different stock for the same local product ID', () => {
  const input = example();
  input.products[1].productId = 'apples';
  input.basket.items[1].productId = 'apples';
  input.products[1].availableQuantity = 0;
  const output = check(input);
  assert.equal(output.errors.length, 1);
  assert.equal(output.errors[0].producerId, 'farm-b');
  assert.equal(output.canCheckout, false);
});

test('repeated basket lines cannot bypass the stock limit', () => {
  const input = example();
  input.basket.items.push({ producerId: 'farm-a', productId: 'apples', quantity: 2 });
  const output = check(input);
  assert.equal(output.canCheckout, false);
  assert.equal(output.errors[0].requestedQuantity, 4);
  assert.equal(output.errors[0].availableQuantity, 3);
});

test('repeated basket lines are accepted when their total fits', () => {
  const input = example();
  input.basket.items.push({ producerId: 'farm-a', productId: 'apples', quantity: 1 });
  assert.equal(check(input).canCheckout, true);
});

for (const quantity of [0, -1, 1.5, '2', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid basket quantity is blocked: ${String(quantity)}`, () => {
    const input = example();
    input.basket.items[0].quantity = quantity;
    const output = check(input);
    assert.equal(output.canCheckout, false);
    assert.equal(output.errors[0].code, 'INVALID_QUANTITY');
  });
}

test('a combined quantity outside the safe integer range is rejected', () => {
  const input = example();
  input.products[0].availableQuantity = Number.MAX_SAFE_INTEGER;
  input.basket.items[0].quantity = Number.MAX_SAFE_INTEGER;
  input.basket.items.push({ producerId: 'farm-a', productId: 'apples', quantity: 1 });
  assert.equal(check(input).errors[0].code, 'INVALID_QUANTITY');
  assert.equal(check(input).canCheckout, false);
});

for (const basket of [undefined, null, [], {}, { items: null }, { items: [] }]) {
  test(`missing, malformed or empty basket is blocked: ${JSON.stringify(basket)}`, () => {
    const output = validateBasket(basket, example().products);
    assert.equal(output.canCheckout, false);
    assert.ok(output.errors.length > 0);
  });
}

test('malformed items and missing IDs are rejected without throwing', () => {
  const input = example();
  input.basket.items = [null, {}, { producerId: '', productId: 'apples', quantity: 1 }];
  const output = check(input);
  assert.equal(output.canCheckout, false);
  assert.equal(output.errors.length, 3);
  assert.ok(output.errors.every((issue) => issue.code === 'INVALID_ITEM'));
});

for (const availableQuantity of [-1, 1.5, '3', NaN, Infinity]) {
  test(`invalid stock data blocks checkout: ${String(availableQuantity)}`, () => {
    const input = example();
    input.products[0].availableQuantity = availableQuantity;
    const output = check(input);
    assert.equal(output.canCheckout, false);
    assert.equal(output.errors[0].code, 'INVALID_STOCK_DATA');
  });
}

test('missing or string availability flags are not treated as true', () => {
  for (const flag of [undefined, 'false', 'true']) {
    const input = example();
    input.products[0].isAvailable = flag;
    assert.equal(check(input).canCheckout, false);
    assert.equal(check(input).errors[0].code, 'INVALID_STOCK_DATA');
  }
});

test('missing or ambiguous catalogue data never allows checkout', () => {
  const input = example();
  assert.equal(validateBasket(input.basket, undefined).canCheckout, false);
  assert.equal(validateBasket(input.basket, []).canCheckout, false);
  input.products.push({ ...input.products[0] });
  assert.equal(check(input).errors[0].code, 'INVALID_STOCK_DATA');
  assert.equal(check(input).canCheckout, false);
});

test('all unavailable or short-stock items are reported', () => {
  const input = example();
  input.basket.items[0].quantity = 5;
  input.products[1].isAvailable = false;
  assert.deepEqual(check(input).errors.map((issue) => issue.code), ['INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE']);
});

test('amending an invalid basket and checking again allows it to continue', () => {
  const input = example();
  input.basket.items[0].quantity = 5;
  assert.equal(check(input).canCheckout, false);
  input.basket.items[0].quantity = 3;
  assert.equal(check(input).canCheckout, true);
});

test('validation does not modify or deduct stock, including on repeated calls', () => {
  const input = example();
  const before = structuredClone(input);
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  freeze(input);
  assert.deepEqual(check(input), check(input));
  assert.deepEqual(input, before);
});

test('process variables contain a serialisable stockValidation result', () => {
  assert.deepEqual(validateStockVariables(example()), { stockValidation: { canCheckout: true, errors: [] } });
  assert.deepEqual(JSON.parse(JSON.stringify(validateStockVariables(example()))), validateStockVariables(example()));
  assert.equal(validateStockVariables(undefined).stockValidation.canCheckout, false);
});

test('the CLI prints the result and distinguishes allowed, blocked and unreadable inputs', () => {
  const allowed = spawnSync(process.execPath, [cliPath, examplePath], { encoding: 'utf8' });
  assert.equal(allowed.status, 0);
  assert.equal(JSON.parse(allowed.stdout).stockValidation.canCheckout, true);
  const directory = mkdtempSync(join(tmpdir(), 'brfn-stock-test-'));
  try {
    const blockedInput = example();
    blockedInput.basket.items[0].quantity = 5;
    const blockedPath = join(directory, 'blocked.json');
    writeFileSync(blockedPath, JSON.stringify(blockedInput));
    const blocked = spawnSync(process.execPath, [cliPath, blockedPath], { encoding: 'utf8' });
    assert.equal(blocked.status, 2);
    assert.equal(JSON.parse(blocked.stdout).stockValidation.canCheckout, false);
    const brokenPath = join(directory, 'broken.json');
    writeFileSync(brokenPath, '{');
    const broken = spawnSync(process.execPath, [cliPath, brokenPath], { encoding: 'utf8' });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /valid JSON/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
