// test-square-auth.js
// Minimal script to test Square API authentication by listing locations

require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');

async function testSquareAuth() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const env = process.env.SQUARE_ENVIRONMENT?.toLowerCase();

  console.log('--- DEBUG: Square Environment Variables ---');
  console.log('SQUARE_ACCESS_TOKEN:', accessToken, `(length: ${accessToken ? accessToken.length : 0})`);
  console.log('SQUARE_ENVIRONMENT:', env, `(length: ${env ? env.length : 0})`);
  console.log('------------------------------------------');

  if (!accessToken || !env) {
    console.error('Missing required Square environment variables.');
    process.exit(1);
  }

  const client = new SquareClient({
    environment: env === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    accessToken,
  });

  // Use the raw API client to make a GET request to /v2/locations
  try {
    const response = await client.apiCall({
      method: 'GET',
      path: '/v2/locations',
    });
    console.log('✅ Successfully authenticated! Raw response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('❌ Error authenticating with Square API:');
    if (error.body) {
      console.error('Error body:', JSON.stringify(error.body, null, 2));
    }
    console.error('Full error object:', error);
    process.exit(1);
  }
}

testSquareAuth();
