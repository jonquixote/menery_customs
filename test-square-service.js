require('dotenv').config({ path: '.env' });
const SquareService = require('./src/services/squareService');

async function testSquareService() {
  console.log('=== Testing Square Service ===');
  
  // Create a new instance of SquareService
  const squareService = new SquareService();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give it time to initialize
  
  // Wait a moment for initialization to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if service is initialized
  if (squareService.isInitialized()) {
    console.log('✅ Square service is properly initialized');
    
    // Test creating a payment link
    try {
      console.log('\nTesting payment link creation...');
      const paymentLink = await squareService.createPaymentLink({
        name: 'Test Payment',
        price: 100, // $1.00
        orderId: 'test-' + Date.now()
      });
      
      console.log('✅ Payment link created successfully!');
      console.log('Payment Link:', paymentLink);
    } catch (error) {
      console.error('❌ Failed to create payment link:');
      console.error(error.message);
      if (error.response) {
        console.error('API Response:', JSON.stringify(error.response, null, 2));
      }
    }
  } else {
    console.error('❌ Square service failed to initialize');
    if (squareService._initializationError) {
      console.error('Initialization error:', squareService._initializationError.message);
    }
  }
}

testSquareService().catch(console.error);
