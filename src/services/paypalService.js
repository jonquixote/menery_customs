const paypal = require('@paypal/checkout-server-sdk');
const { Order, Op } = require('../models');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Returns a PayPal HTTP client instance.
 * @returns {paypal.core.PayPalHttpClient}
 */
function getClient() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
    throw new Error('PayPal credentials are not configured. Please check your .env file.');
  }
  const environment = NODE_ENV === 'production'
    ? new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY)
    : new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY);
  return new paypal.core.PayPalHttpClient(environment);
}

/**
 * Create a PayPal order
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} PayPal order details
 */
async function createOrder(orderData) {
  console.log('PayPalService.createOrder called with data:', JSON.stringify(orderData, null, 2));

  const { orderId, amount, description = 'Custom Voiceover Order' } = orderData;

  if (!orderId || !amount || isNaN(amount) || amount <= 0) {
    throw new Error('orderId and a valid amount are required');
  }

  const client = getClient();
  const request = new paypal.orders.OrdersCreateRequest();
  const formattedAmount = parseFloat(amount).toFixed(2);

  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: orderId,
      description: description,
      custom_id: orderId,
      amount: {
        currency_code: 'USD',
        value: formattedAmount,
      },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'Bob Menery Voiceovers',
          locale: 'en-US',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/cancel`,
        },
      },
    },
  });

  try {
    console.log('[PayPal] Creating order with payload...');
    const response = await client.execute(request);
    const paypalOrder = response.result;
    console.log(`[PayPal] Order created successfully with ID: ${paypalOrder.id}`);

    await Order.update({
        paymentIntentId: paypalOrder.id,
        paymentStatus: paypalOrder.status.toLowerCase(),
        paymentMethod: 'paypal',
      },
      { where: { id: orderId } }
    );

    return paypalOrder;
  } catch (error) {
    console.error('[PayPal] Error creating order:', JSON.stringify(error, null, 2));
    const userError = new Error('Failed to create PayPal payment. Please try again.');
    userError.originalError = error;
    throw userError;
  }
}

/**
 * Capture payment for an order
 * @param {string} paypalOrderId - PayPal order ID
 * @returns {Promise<Object>} Capture details
 */
async function capturePayment(paypalOrderId) {
  const client = getClient();
  const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
  request.requestBody({});

  try {
    console.log(`[PayPal] Capturing payment for order: ${paypalOrderId}`);
    const response = await client.execute(request);
    const capture = response.result;
    console.log(`[PayPal] Payment captured successfully with status: ${capture.status}`);

    if (capture.status === 'COMPLETED') {
      await Order.update({
          paymentStatus: 'paid',
          status: 'processing',
          paymentDetails: JSON.stringify(capture, null, 2),
        },
        { where: { paymentIntentId: paypalOrderId } }
      );
    }

    return capture;
  } catch (error) {
    console.error(`[PayPal] Error capturing payment for order ${paypalOrderId}:`, JSON.stringify(error, null, 2));
    const userError = new Error('Failed to capture PayPal payment.');
    userError.originalError = error;
    throw userError;
  }
}

/**
 * Process a webhook event from PayPal
 * @param {Object} event - Webhook event data
 * @returns {Promise<Object>} Processing result
 */
async function processWebhook(event) {
  const { event_type, resource } = event;
  console.log(`[PayPal Webhook] Received event: ${event_type}`);

  try {
    switch (event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        await capturePayment(resource.id);
        return { success: true, action: 'payment_captured' };

      case 'PAYMENT.CAPTURE.COMPLETED':
        await Order.update({
            paymentStatus: 'paid',
            status: 'processing',
            paymentDetails: JSON.stringify(resource, null, 2),
          },
          { where: { paymentIntentId: resource.purchase_units[0].payments.captures[0].id } }
        );
        return { success: true, action: 'order_updated' };

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.FAILED':
        await Order.update({
            paymentStatus: 'failed',
            status: 'payment_failed',
            paymentDetails: JSON.stringify(resource, null, 2),
          },
          { where: { paymentIntentId: resource.id } }
        );
        return { success: false, action: 'payment_failed' };

      default:
        return { success: true, action: 'no_action' };
    }
  } catch (error) {
    console.error(`[PayPal Webhook] Error processing event ${event_type}:`, error);
    throw new Error(`Failed to process webhook: ${error.message}`);
  }
}

/**
 * Get payment status for an order
 * @param {string} paypalOrderId - PayPal order ID
 * @returns {Promise<Object>} Order status details
 */
async function getPaymentStatus(paypalOrderId) {
  const client = getClient();
  const request = new paypal.orders.OrdersGetRequest(paypalOrderId);

  try {
    console.log(`[PayPal] Getting status for order: ${paypalOrderId}`);
    const response = await client.execute(request);
    console.log(`[PayPal] Successfully retrieved status for order: ${paypalOrderId}`);
    return response.result;
  } catch (error) {
    console.error(`[PayPal] Error getting status for order ${paypalOrderId}:`, JSON.stringify(error, null, 2));
    const userError = new Error('Failed to get PayPal order status.');
    userError.originalError = error;
    throw userError;
  }
}

module.exports = {
  createOrder,
  capturePayment,
  processWebhook,
  getPaymentStatus,
};
