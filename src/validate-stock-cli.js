import { readFile } from 'node:fs/promises';
import { validateStockVariables } from './stock-validation.js';

const inputPath = process.argv[2];
if (!inputPath || process.argv.length !== 3) {
  console.error('Usage: node src/validate-stock-cli.js path/to/input.json');
  process.exitCode = 1;
} else {
  try {
    const variables = JSON.parse(await readFile(inputPath, 'utf8'));
    const output = validateStockVariables(variables);
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = output.stockValidation.canCheckout ? 0 : 2;
  } catch (cause) {
    console.error(`Unable to read a valid JSON input file: ${cause.message}`);
    process.exitCode = 1;
  }
}
