const { User, Order } = require('../models');
const EmailService = require('../services/emailService');
const SquarePaymentService = require('../services/squareService');
const PaypalService = require('../services/paypalService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class PaymentController {

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

  static async createPaypalOrder(req, res) {
    try {
      console.log('Received request to create PayPal order with body:', JSON.stringify(req.body, null, 2));
      
      const { orderId, amount, description, customerEmail, customerName, redirectUrl } = req.body;
      
      console.log('Creating PayPal order for order ID:', orderId);
      
      if (!orderId) {
        const error = new Error('Order ID is required');
        console.error('Validation error:', error.message);
        return res.status(400).json({ 
          success: false,
          error: error.message,
          details: { receivedBody: req.body }
        });
      }
      
      // Get the order from database to verify it exists
      console.log('Looking up order in database...');
      const order = await Order.findByPk(orderId);
      if (!order) {
        const error = new Error(`Order not found with ID: ${orderId}`);
        console.error('Order lookup failed:', error.message);
        return res.status(404).json({ 
          success: false,
          error: error.message,
          details: { orderId }
        });
      }
      
      console.log('Order found, creating PayPal order...');
      
      // Create PayPal order
      const paypalOrder = await PaypalService.createOrder({
        orderId,
        amount: parseFloat(amount),
        description: description || `Voiceover Order - ${orderId}`,
        customerEmail: customerEmail || order.customerEmail,
        customerName: customerName || order.customerName,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/status`
      });
      
      console.log('PayPal order created successfully:', paypalOrder);
      
      // Update order with PayPal details
      await order.update({
        paymentIntentId: paypalOrder.id,
        paymentMethod: 'paypal',
        paymentStatus: paypalOrder.status || 'pending'
      });
      
      res.json({ id: paypalOrder.id });
      
    } catch (error) {
      console.error('Error in createPaypalOrder:', {
        message: error.message,
        stack: error.stack,
        details: error.details || error.response?.data
      });
      
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to create PayPal order',
        details: error.details || error.response?.data,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  }

  static async capturePaypalOrder(req, res) {
    try {
      const { orderID } = req.body;
      console.log('Capturing PayPal order:', orderID);
      
      if (!orderID) {
        return res.status(400).json({ 
          error: 'orderID is required' 
        });
      }
      
      const captureData = await PaypalService.capturePayment(orderID);
      console.log('PayPal order captured successfully:', captureData.id);
      
      // Find and update the order in our database
      if (captureData.status === 'COMPLETED' && captureData.purchase_units && captureData.purchase_units[0]) {
        const paypalOrderId = captureData.purchase_units[0].reference_id || captureData.id;
        
        // Try to find the order by PayPal order ID or custom ID
        const order = await Order.findOne({
          where: { 
            [Op.or]: [
              { paymentIntentId: paypalOrderId },
              { id: paypalOrderId }
            ]
          }
        });
        
        if (order) {
          // Update the order status
          await order.update({
            paymentStatus: 'paid',
            status: 'processing',
            paymentDetails: JSON.stringify(captureData)
          });
          
          console.log(`Order ${order.id} updated to paid status`);
          
          // Send confirmation email
          try {
            await EmailService.sendOrderConfirmation({
              email: order.customerEmail,
              orderId: order.id,
              customerName: order.customerName,
              amount: order.price,
              paymentMethod: 'PayPal'
            });
            console.log('Order confirmation email sent');
          } catch (emailError) {
            console.error('Error sending order confirmation email:', emailError);
            // Don't fail the request if email fails
          }
        }
      }
      
      res.json({
        success: true,
        status: captureData.status,
        orderId: captureData.id,
        captureId: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error in capturePaypalOrder:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to capture PayPal order',
        details: error.details || error.response?.data
      });
    }
  }
}

module.exports = PaymentController;
