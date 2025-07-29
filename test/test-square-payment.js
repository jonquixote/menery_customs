// test-square-payment.js
// Standalone script to test Square payment API connection and create a $1.00 test payment

require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');
const { v4: uuidv4 } = require('uuid');

async function testSquarePayment() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const env = process.env.SQUARE_ENVIRONMENT?.toLowerCase();
  const locationId = process.env.SQUARE_LOCATION_ID;

  console.log('--- DEBUG: Square Environment Variables ---');
  console.log('SQUARE_ACCESS_TOKEN:', accessToken, `(length: ${accessToken ? accessToken.length : 0})`);
  console.log('SQUARE_ENVIRONMENT:', env, `(length: ${env ? env.length : 0})`);
  console.log('SQUARE_LOCATION_ID:', locationId, `(length: ${locationId ? locationId.length : 0})`);
  console.log('------------------------------------------');

  if (!accessToken || !env || !locationId) {
    console.error('Missing required Square environment variables.');
    process.exit(1);
  }

  const client = new SquareClient({
    environment: env === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    accessToken,
  });

  const paymentsApi = client.payments;
  if (!paymentsApi || typeof paymentsApi.create !== 'function') {
    console.error('SquareClient.payments.create is not available. Check your SDK version.');
    process.exit(1);
  }

  // This sourceId is a special sandbox value that always works for test payments
  const sourceId = 'cnon:card-nonce-ok';




  const paymentRequest = {
    sourceId,
    idempotencyKey: uuidv4(),
    amountMoney: {
      amount: 100n, // BigInt for Square SDK
      currency: 'USD',
    },
    locationId,
  };

  // For debug logging, convert BigInt to string
  const debugPaymentRequest = {
    ...paymentRequest,
    amountMoney: {
      ...paymentRequest.amountMoney,
      amount: paymentRequest.amountMoney.amount.toString(),
    },
  };

  console.log('--- DEBUG: Payment Request ---');
  console.log(JSON.stringify(debugPaymentRequest, null, 2));
  console.log('--------------------------------');

  try {
    const { result } = await paymentsApi.create(paymentRequest);
    console.log('✅ Payment created successfully!');
    console.log(JSON.stringify(result.payment, null, 2));
  } catch (error) {
    console.error('❌ Error creating Square payment:');
    if (error.body) {
      console.error('Error body:', JSON.stringify(error.body, null, 2));
    }
    if (error.request) {
      console.error('Error request:', JSON.stringify(error.request, null, 2));
    }
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response, null, 2));
    }
    console.error('Full error object:', error);
    process.exit(1);
  }
}

testSquarePayment();
