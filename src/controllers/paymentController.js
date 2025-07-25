const { User, Order } = require('../models');
const EmailService = require('../services/emailService');
const SquarePaymentService = require('../services/squareService');
const PaypalService = require('../services/paypalService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class PaymentController {
  static async createPaymentLink(req, res) {
    console.log('Attempting to create payment link...'); // Added for debugging
    try {
      const {
        orderId,
        amount,
        customerEmail,
        paymentMethod, // Added paymentMethod
        customerName = 'Customer',
        description = 'Voiceover Order',
        redirectUrl
      } = req.body;

      // Validate required fields
      if (!orderId || amount === undefined || amount === null || !customerEmail || !paymentMethod) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Convert amount to cents for Square, keep as decimal for PayPal
      const amountInCents = paymentMethod.toLowerCase() === 'square' ? Math.round(parseFloat(amount) * 100) : parseFloat(amount);
      
      if (isNaN(amountInCents) || amountInCents <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      let paymentResult;

      if (paymentMethod.toLowerCase() === 'paypal') {
        // Use PayPal service
        paymentResult = await PaypalService.createOrder({
          orderId: orderId, // Pass the orderId to update the correct order
          amount: amountInCents,
          description: description,
          redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`
        });
        
        res.json({
          success: true,
          paymentUrl: paymentResult.paypalRedirectUrl, // PayPal redirect URL
          paymentId: paymentResult.orderId, // PayPal Order ID
          orderId: orderId,
          paymentMethod: 'PayPal'
        });

      } else if (paymentMethod.toLowerCase() === 'square') {
        // Use Square service
        paymentResult = await SquarePaymentService.createPaymentLink({
          name: description,
          price: amount,
          redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`
        });

        res.json({
          success: true,
          paymentUrl: paymentResult.paymentUrl,
          paymentId: paymentResult.paymentId,
          orderId: orderId,
          paymentMethod: 'Square'
        });
      } else {
        return res.status(400).json({ error: 'Unsupported payment method' });
      }

    } catch (error) {
      console.error('Error in createPaymentLink controller:', error);
      res.status(500).json({ 
        error: 'Failed to create payment link',
        details: error.message 
      });
    }
  }

  static async getPaymentStatus(req, res) {
    try {
      const { paymentId, paymentMethod } = req.params;
      
      if (!paymentMethod) {
        return res.status(400).json({ error: 'Payment method is required' });
      }

      let status;
      if (paymentMethod.toLowerCase() === 'paypal') {
        const paymentStatus = await PaypalService.getPaymentStatus(paymentId);
        status = paymentStatus.status;
      } else if (paymentMethod.toLowerCase() === 'square') {
        status = await SquarePaymentService.getPaymentStatus(paymentId);
      } else {
        return res.status(400).json({ error: 'Unsupported payment method' });
      }
      
      res.json({
        status: status,
        paymentId: paymentId,
        paymentMethod: paymentMethod.toLowerCase()
      });

    } catch (error) {
      console.error('Error in getPaymentStatus controller:', error);
      res.status(500).json({ 
        error: 'Failed to get payment status',
        details: error.message
      });
    }
  }

  // Webhook handler for PayPal IPN (Instant Payment Notification)
  static async handlePaypalWebhook(req, res) {
    try {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID; // Should be set in .env
      const webhookEvent = req.body;
      
      // Verify the webhook signature (important for security)
      const authString = `${req.headers['paypal-auth-algo']}|${req.headers['paypal-transmission-id']}|${req.headers['paypal-transmission-time']}|${webhookId}`;
      const signature = crypto
        .createHmac('sha256', process.env.PAYPAL_SECRET_KEY)
        .update(authString)
        .digest('hex');
      
      // Verify the webhook signature (highly recommended in production)
      // For production, implement signature verification using PayPal's webhook ID
      
      // Process the event using our PaypalService
      const result = await PaypalService.processWebhook(event);
      
      // If this was a payment capture, send appropriate emails
      if (result.action === 'order_updated' && event.resource) {
        const order = await Order.findOne({
          where: { paymentIntentId: event.resource.id }
        });
        
        if (order) {
          // Send confirmation email to customer
          await EmailService.sendOrderConfirmation({
            email: order.customerEmail,
            orderId: order.id,
            customerName: order.customerName,
            amount: order.price
          });
          
          // Send admin notification
          await EmailService.sendAdminNotification({
            orderId: order.id,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            amount: order.price,
            notes: order.notes
          });
        }
      }

      // Acknowledge receipt of the webhook
      res.status(200).json({ 
        success: true, 
        processed: result.action 
      });
      
    } catch (error) {
      console.error('Error processing PayPal webhook:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to process webhook',
        details: error.message 
      });
    }
  }
}

module.exports = PaymentController;
