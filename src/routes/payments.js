const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');

// POST /api/payments/create-link - Create a Square payment link
router.post('/create-link', PaymentController.createPaymentLink);

// GET /api/payments/status/:paymentId - Get payment status from Square
router.get('/status/:paymentId', PaymentController.getPaymentStatus);

module.exports = router;
