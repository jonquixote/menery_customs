// inspect-square-client.js
// Print all properties and methods of the SquareClient instance for SDK introspection

require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');

const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const env = process.env.SQUARE_ENVIRONMENT?.toLowerCase();

const client = new SquareClient({
  environment: env === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  accessToken,
});

console.log('--- SquareClient Properties ---');
console.log(Object.keys(client));
console.log('-------------------------------');

for (const key of Object.keys(client)) {
  try {
    console.log(`Type of client.${key}:`, typeof client[key]);
    if (typeof client[key] === 'object' && client[key] !== null) {
      console.log(`Properties of client.${key}:`, Object.keys(client[key]));
    }
  } catch (e) {
    console.log(`Error inspecting client.${key}:`, e.message);
  }
}
