const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// POST /api/payments/create-payment-link - Create a payment link (Square or PayPal)
router.post('/create-payment-link', PaymentController.createPaymentLink);

// GET /api/payments/status/:paymentId/:paymentMethod - Get payment status
// Note: paymentMethod needs to be passed to the controller to determine which service to use.
router.get('/status/:paymentId/:paymentMethod', PaymentController.getPaymentStatus);

module.exports = router;
