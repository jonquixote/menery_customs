const express = require('express');
const router = express.Router();
const PaypalService = require('../services/paypalService');

// Test endpoint to verify PayPal integration
router.get('/test-paypal', async (req, res) => {
  try {
    // Test creating a test order
    const orderData = {
      amount: '19.99', // $19.99 test amount
      description: 'Test Voiceover Order',
      redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/test/paypal/return`,
      orderId: `TEST-${Date.now()}`
    };

    const result = await PaypalService.createOrder(orderData);
    
    res.json({
      success: true,
      message: 'PayPal integration test successful',
      order: result,
      nextSteps: [
        '1. Use the paypalRedirectUrl to complete the payment in the PayPal sandbox',
        '2. After payment, PayPal will redirect to the specified redirectUrl',
        '3. The webhook will receive payment notifications',
        `4. Check payment status at: /api/payments/status/${result.orderId}/paypal`
      ]
    });
  } catch (error) {
    console.error('PayPal test error:', error);
    res.status(500).json({
      success: false,
      error: 'PayPal test failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
