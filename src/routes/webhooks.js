const express = require('express');
const PaymentController = require('../controllers/paymentController');

const router = express.Router();

// PayPal Webhook endpoint - Note: PayPal sends JSON, not form-urlencoded
router.post('/paypal', express.json({ verify: (req, res, buf) => {
  // Store the raw body for signature verification
  req.rawBody = buf.toString();
}}), PaymentController.handlePaypalWebhook);

module.exports = router;
