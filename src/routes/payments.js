const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// GET /api/payments/status/:paymentId/:paymentMethod - Get payment status
// Note: paymentMethod needs to be passed to the controller to determine which service to use.
router.get('/status/:paymentId/:paymentMethod', PaymentController.getPaymentStatus);

// POST /api/payments/create-paypal-order - Create a PayPal order
router.post('/create-paypal-order', PaymentController.createPaypalOrder);

// POST /api/payments/capture-paypal-order - Capture a PayPal order
router.post('/capture-paypal-order', PaymentController.capturePaypalOrder);

// POST /api/payments/process-square-payment - Process a Square payment
router.post('/process-square-payment', PaymentController.processSquarePayment);

module.exports = router;
