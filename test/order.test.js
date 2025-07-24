require('dotenv').config();
const emailService = require('../src/services/emailService');

async function runOrderTest() {
  console.log('--- Running Email Service Test ---');

  const orderDetails = {
    orderId: 'test-order-123',
    customerName: 'John Hawley',
    customerEmail: 'jehawley@gmail.com',
    customerPhone: '123-456-7890',
    price: 5000, // in cents
    duration: 60,
    script: 'This is a test script.',
    originalVideoKey: 'uploads/6ba2bc24-c2e2-4579-887a-9e0546fbb183.mp4',
    paymentMethod: 'Square'
  };

  console.log('Sending new order alert to:', orderDetails.customerEmail);

  try {
    const result = await emailService.sendNewOrderAlert(orderDetails);
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.error('❌ Failed to send email:');
      console.error('Error:', result.error);
      if (result.details) {
        console.error('Details:', JSON.stringify(result.details, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ An unexpected error occurred:');
    console.error(error);
  }

  console.log('--- Email Service Test Finished ---');
}

runOrderTest();
