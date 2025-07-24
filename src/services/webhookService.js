const { Order } = require('../models');
const { sendNewOrderAlert } = require('./emailService');
const { getPaymentStatus } = require('./squareService');

/**
 * Handle incoming webhook events
 * @param {Object} event - Webhook event data
 * @param {string} signature - Webhook signature for verification
 * @returns {Promise<Object>} Result of webhook processing
 */
const handleWebhook = async (event, signature) => {
  try {
    // Verify the webhook signature
    const isVerified = await verifyWebhookSignature(event, signature);
    if (!isVerified) {
      throw new Error('Invalid webhook signature');
    }

    const eventType = event.type;
    console.log(`Processing webhook event: ${eventType}`);

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'payment.updated':
        return await handlePaymentUpdated(event.data.object.payment);
      case 'order.updated':
        return await handleOrderUpdated(event.data.object.order);
      default:
        console.log(`Unhandled event type: ${eventType}`);
        return { success: true, message: 'Event type not handled' };
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
};

/**
 * Handle payment.updated webhook event
 * @param {Object} payment - Payment data from webhook
 * @returns {Promise<Object>} Result of processing
 */
const handlePaymentUpdated = async (payment) => {
  try {
    const { id: paymentId, status, order_id: orderId } = payment;
    
    if (!orderId) {
      console.error('No order ID found in payment webhook');
      return { success: false, message: 'No order ID in payment data' };
    }

    // Find the order
    const order = await Order.findByPk(orderId);
    if (!order) {
      console.error(`Order ${orderId} not found for payment ${paymentId}`);
      return { success: false, message: 'Order not found' };
    }

    // Update order status based on payment status
    switch (status) {
      case 'COMPLETED':
        order.status = 'paid';
        await order.save();
        
        // Send notification about new paid order
        await sendNewOrderAlert(order);
        break;
        
      case 'FAILED':
        order.status = 'payment_failed';
        await order.save();
        break;
        
      // Add other status handlers as needed
    }

    return { success: true, orderId };
  } catch (error) {
    console.error('Error handling payment updated webhook:', error);
    throw error;
  }
};

/**
 * Handle order.updated webhook event
 * @param {Object} orderData - Order data from webhook
 * @returns {Promise<Object>} Result of processing
 */
const handleOrderUpdated = async (orderData) => {
  try {
    const { id: orderId, state } = orderData;
    
    // Find the order
    const order = await Order.findByPk(orderId);
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return { success: false, message: 'Order not found' };
    }

    // Update order status based on Square order state
    switch (state) {
      case 'COMPLETED':
        order.status = 'completed';
        break;
      case 'CANCELED':
        order.status = 'cancelled';
        break;
      // Add other state handlers as needed
    }

    await order.save();
    return { success: true, orderId };
  } catch (error) {
    console.error('Error handling order updated webhook:', error);
    throw error;
  }
};

/**
 * Verify webhook signature
 * @param {Object} event - Webhook event data
 * @param {string} signature - Webhook signature
 * @returns {Promise<boolean>} Whether the signature is valid
 */
const verifyWebhookSignature = async (event, signature) => {
  try {
    // In a real implementation, verify the webhook signature using Square's SDK
    // For testing, we'll just return true if a signature is provided
    return !!signature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

module.exports = {
  handleWebhook,
  verifyWebhookSignature
};
