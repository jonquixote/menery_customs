const { Order } = require('../models');
const EmailService = require('../services/emailService');

// Use mock service in development, real service in production
const useMockService = process.env.NODE_ENV !== 'production' && 
                      (!process.env.SQUARE_ACCESS_TOKEN || 
                       process.env.SQUARE_ACCESS_TOKEN === 'your_square_access_token');

// Conditional import based on environment
let PaymentService;
if (useMockService) {
  console.log('Using Mock Square Service for webhooks');
  PaymentService = require('../services/mockSquareService');
} else {
  console.log('Using Real Square Service for webhooks');
  PaymentService = require('../services/squareService');
}

class WebhookController {
  static async handleSquareWebhook(req, res) {
    const signature = req.headers['x-square-hmacsha256-signature'];
    const squareSignatureKey = process.env.SQUARE_SIGNATURE_KEY;
    
    try {
      // Verify webhook signature
      const isValid = PaymentService.verifyWebhook(
        signature,
        req.rawBody || JSON.stringify(req.body),
        squareSignatureKey,
        req.originalUrl
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = req.body;
      console.log('Received Square webhook event:', event.type);

      // Process the webhook event
      const result = await PaymentService.handleWebhook(req.body);
      
      if (result.eventType === 'payment.updated' || result.eventType === 'payment.created') {
        if (result.status === 'COMPLETED') {
          await WebhookController.handlePaymentSuccess(result);
        } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
          await WebhookController.handlePaymentFailure(result);
        }
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  }

  static async handlePaymentSuccess(paymentData) {
    try {
      const { paymentId, orderId, amount, currency } = paymentData;
      
      // Find the order by payment ID
      const order = await Order.findByPk(orderId, {
        include: [{
          model: require('../models').User,
          as: 'user'
        }]
      });

      if (!order) {
        console.error('Order not found for payment ID:', paymentId);
        return;
      }

      // Update order status to 'paid'
      await order.update({ 
        status: 'paid',
        paymentIntentId: paymentId
      });
      
      console.log(`Order ${order.id} marked as paid`);

      // Send notification email to Bob Menery
      await EmailService.sendNewOrderAlert({
        orderId: order.id,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        customerEmail: order.user.email,
        customerPhone: order.user.phone,
        price: amount / 100, // Convert back to dollars
        duration: order.duration,
        script: order.script,
        originalVideoKey: order.originalVideoKey,
        paymentMethod: order.paymentMethod
      });

      console.log(`New order alert sent for order ${order.id}`);

    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  static async handlePaymentFailure(paymentData) {
    try {
      const { paymentId, orderId } = paymentData;
      
      // Find the order by payment ID
      const order = await Order.findByPk(orderId);

      if (!order) {
        console.error('Order not found for failed payment ID:', paymentId);
        return;
      }

      // Update order status to 'failed'
      await order.update({ status: 'failed' });
      console.log(`Payment failed for order ${order.id}`);

    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }
}

module.exports = WebhookController;
