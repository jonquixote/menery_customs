const express = require('express');
const WebhookController = require('../controllers/webhookController');

const router = express.Router();

// Middleware to capture raw body for webhook signature verification
router.use('/stripe', express.raw({ type: 'application/json' }));

// POST /api/webhooks/stripe
router.post('/stripe', WebhookController.handleStripeWebhook);

module.exports = router;
