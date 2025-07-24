const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const WebhookController = require('../controllers/webhookController');

// Create payment link
router.post('/create-link', async (req, res) => {
  try {
    const { orderId, amount, customerEmail, customerName, description, redirectUrl } = req.body;
    
    if (!orderId || !amount || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentLink = await PaymentController.createPaymentLink({
      orderId,
      amount,
      customerEmail,
      customerName: customerName || 'Customer',
      description: description || 'Voiceover Order',
      redirectUrl: redirectUrl || `${process.env.FRONTEND_URL}/order/${orderId}/status`
    });

    res.json({
      success: true,
      paymentUrl: paymentLink.paymentUrl,
      paymentId: paymentLink.paymentId,
      orderId: paymentLink.orderId
    });
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link', details: error.message });
  }
});

// Get payment status
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const status = await PaymentController.getPaymentStatus(paymentId);
    res.json(status);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Save raw body for signature verification
    const rawBody = req.body.toString();
    req.rawBody = rawBody;
    req.body = JSON.parse(rawBody);
    
    await WebhookController.handleSquareWebhook(req, res);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
