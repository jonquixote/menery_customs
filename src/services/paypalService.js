const axios = require('axios');
const { Order, Op } = require('../models');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY;
const PAYPAL_SANDBOX_URL = process.env.PAYPAL_SANDBOX_URL || 'https://api-m.sandbox.paypal.com';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Get authentication headers for PayPal API
 * @returns {Promise<Object>} Authorization headers for PayPal API
 */
async function getAuthHeaders() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
    throw new Error('PayPal credentials are not configured. Please check your .env file.');
  }
  
  try {
    // Get access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`).toString('base64');
    const response = await axios.post(
      `${PAYPAL_SANDBOX_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${response.data.access_token}`,
      'PayPal-Request-Id': `menery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      'Prefer': 'return=representation'
    };
  } catch (error) {
    console.error('Error getting PayPal access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with PayPal');
  }
}

/**
 * Create a PayPal order
 * @param {Object} orderData - Order details
 * @param {string} orderData.orderId - Internal order ID (required)
 * @param {number} orderData.amount - Order amount in USD (required)
 * @param {string} [orderData.description] - Order description
 * @param {string} [orderData.customerEmail] - Customer email
 * @param {string} [orderData.customerName] - Customer name
 * @param {string} [orderData.redirectUrl] - URL to redirect after payment
 * @returns {Promise<Object>} PayPal order details
 */
async function createOrder(orderData) {
  console.log('PayPalService.createOrder called with data:', JSON.stringify(orderData, null, 2));

  const {
    orderId,
    amount,
    description = 'Custom Voiceover Order',
    customerEmail,
    customerName,
    redirectUrl
  } = orderData;

  if (!orderId) {
    const error = new Error('orderId is required');
    console.error('PayPalService.createOrder validation error:', error.message);
    throw error;
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    const error = new Error('A valid amount is required');
    console.error('PayPalService.createOrder validation error:', error.message, { amount });
    throw error;
  }

  try {
    console.log('Getting PayPal auth headers...');
    const headers = await getAuthHeaders();
    console.log('Successfully obtained PayPal auth headers');

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = redirectUrl || `${baseUrl}/order/${orderId}/status`;
    console.log('Using return URL:', returnUrl);

    const formattedAmount = parseFloat(amount).toFixed(2);
    console.log('Formatted amount:', formattedAmount);

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: description,
        custom_id: orderId,
        invoice_id: `VO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        soft_descriptor: 'BOBMENERYVO',
        amount: {
          currency_code: 'USD',
          value: formattedAmount,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: formattedAmount
            }
          }
        },
        items: [{
          name: (description || 'Custom Voiceover').substring(0, 127),
          description: (description || 'Custom Voiceover Order').substring(0, 127),
          quantity: '1',
          unit_amount: {
            currency_code: 'USD',
            value: formattedAmount
          }
        }],
        payee: {
          email_address: process.env.PAYPAL_MERCHANT_EMAIL || 'sb-43d7pz31518415@business.example.com' // Default sandbox email
        }
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
            payment_method_selected: 'PAYPAL',
            return_url: returnUrl,
            cancel_url: `${baseUrl}/order/cancel`,
            customer_service_instructions: [
              'Contact us at support@bobmenery.com for any questions about your order.'
            ]
          }
        }
      }
    };

    console.log('[PayPal] Creating order with payload:', JSON.stringify(orderPayload, null, 2));

    // Make the API call to create the order
    let response;
    try {
      response = await axios.post(
        `${PAYPAL_SANDBOX_URL}/v2/checkout/orders`,
        orderPayload,
        {
          headers: {
            ...headers,
            'PayPal-Request-Id': `menery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            'Prefer': 'return=representation',
            'PayPal-Partner-Attribution-Id': 'BobMenery_SP',
            'PayPal-Client-Metadata-Id': orderId
          },
          timeout: 30000, // 30 second timeout
          maxBodyLength: Infinity,
          validateStatus: null // Don't throw on HTTP error status
        }
      );
    } catch (networkError) {
      console.error('[PayPal] Network error creating order:', {
        message: networkError.message,
        code: networkError.code,
        config: networkError.config ? {
          url: networkError.config.url,
          method: networkError.config.method,
          timeout: networkError.config.timeout,
          headers: Object.keys(networkError.config.headers || {})
        } : null
      });
      throw new Error(`Network error while communicating with PayPal: ${networkError.message}`);
    }

    console.log(`[PayPal] Order creation response (${response.status}):`,
      JSON.stringify(response.data, null, 2));

    // Handle non-2xx responses
    if (response.status >= 400) {
      const errorMsg = response.data?.message || 'Failed to create PayPal order';
      const details = response.data?.details || [];
      console.error(`[PayPal] Error ${response.status}:`, errorMsg, { details });

      // Try to extract a more specific error message
      const specificError = details[0]?.description || errorMsg;
      throw new Error(`PayPal API error (${response.status}): ${specificError}`);
    }

    // Find the approval link in the response
    const approvalLink = response.data.links?.find(link =>
      link.rel === 'approve' || link.rel === 'payer-action' || link.rel === 'self'
    );

    if (!approvalLink) {
      console.error('[PayPal] No approval URL found in response. Links:',
        response.data.links?.map(l => `${l.rel}: ${l.href}`) || 'No links found');
      throw new Error('Could not find approval URL in PayPal response');
    }

    // Prepare the result object
    const result = {
      id: response.data.id,
      status: response.data.status,
      links: response.data.links,
      create_time: response.data.create_time,
      paypalOrderId: response.data.id,
      approval_url: approvalLink.href,
      reference_id: orderId
    };

    // Update the order in our database with PayPal details
    try {
      const [updated] = await Order.update(
        {
          paymentIntentId: response.data.id,
          paymentStatus: response.data.status.toLowerCase(),
          paymentMethod: 'paypal',
          paymentDetails: JSON.stringify({
            paypalOrderId: response.data.id,
            status: response.data.status,
            create_time: response.data.create_time,
            links: response.data.links,
            reference_id: orderId,
            amount: formattedAmount
          }, null, 2)
        },
        {
          where: {
            id: orderId,
            paymentStatus: {
              [Op.or]: [
                'pending',
                null,
                'created'
              ]
            }
          },
          returning: true,
          individualHooks: true
        }
      );

      if (updated === 0) {
        console.warn(`[PayPal] Order ${orderId} not updated - may already be processed`);
      } else {
        console.log(`[PayPal] Updated order ${orderId} with PayPal ID: ${response.data.id}`);
      }
    } catch (dbError) {
      console.error('[PayPal] Error updating order with PayPal ID:', {
        orderId,
        paypalOrderId: response.data.id,
        error: dbError.message,
        stack: dbError.stack
      });
      // Continue even if DB update fails
    }

    return result;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack,
      orderId: orderId,
      timestamp: new Date().toISOString()
    };

    console.error('[PayPal] Error creating order:', JSON.stringify(errorDetails, null, 2));

    // Try to update the order status in our database
    if (orderId) {
      try {
        await Order.update(
          {
            paymentStatus: 'failed',
            status: 'payment_failed',
            paymentDetails: JSON.stringify({
              error: error.message,
              code: error.code,
              details: error.response?.data || {},
              timestamp: new Date().toISOString()
            }, null, 2)
          },
          {
            where: { id: orderId },
            silent: true // Don't trigger hooks
          }
        );
        console.log(`[PayPal] Updated order ${orderId} with payment failure`);
      } catch (dbError) {
        console.error('[PayPal] Error updating order with error status:', {
          orderId,
          error: dbError.message,
          originalError: error.message
        });
      }
    }

    // Extract a user-friendly error message
    let userFriendlyError = 'Failed to create payment. Please try again.';

    if (error.response?.data) {
      const paypalError = error.response.data;

      // Handle OAuth errors (invalid credentials)
      if (paypalError.error === 'invalid_client') {
        userFriendlyError = 'Payment system configuration error. Please contact support.';
      }
      // Handle validation errors
      else if (paypalError.details?.length > 0) {
        const firstError = paypalError.details[0];
        userFriendlyError = firstError.description || firstError.issue || userFriendlyError;

        // Handle specific validation issues
        if (firstError.issue === 'INVALID_REQUEST') {
          userFriendlyError = 'Invalid payment request. Please check your information and try again.';
        } else if (firstError.issue === 'UNPROCESSABLE_ENTITY') {
          userFriendlyError = 'Unable to process payment. Please verify your payment details.';
        }
      }
      // Handle rate limiting
      else if (error.response.status === 429) {
        userFriendlyError = 'Too many payment attempts. Please wait a moment and try again.';
      }
    } else if (error.code === 'ECONNABORTED') {
      userFriendlyError = 'Payment request timed out. Please try again.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      userFriendlyError = 'Unable to connect to payment service. Please check your internet connection.';
    }

    // Create a new error with the user-friendly message
    const userError = new Error(userFriendlyError);
    userError.originalError = error;
    userError.isUserFacing = true;

    throw userError;
  }
}

/**
 * Capture payment for an order
 * @param {string} orderId - PayPal order ID
 * @returns {Promise<Object>} Capture details
 */
async function capturePayment(orderId) {
  try {
    const headers = await getAuthHeaders();

    const response = await axios.post(
      `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers }
    );

    if (response.data.status === 'COMPLETED') {
      // Update order in database
      await Order.update(
        {
          paymentStatus: 'paid',
          status: 'processing',
          paymentDetails: response.data
        },
        { where: { paymentIntentId: orderId } }
      );
    }

    return response.data;
  } catch (error) {
    console.error('Error capturing PayPal payment:', error.response?.data || error.message);
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
}

/**
 * Process a webhook event from PayPal
 * @param {Object} event - Webhook event data
 * @returns {Promise<Object>} Processing result
 */
async function processWebhook(event) {
  try {
    const { event_type, resource } = event;

    switch (event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        // Order was approved by the payer
        await capturePayment(resource.id);
        return { success: true, action: 'payment_captured' };

      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment was successfully captured
        await Order.update(
          {
            paymentStatus: 'paid',
            status: 'processing',
            paymentDetails: resource
          },
          { where: { paymentIntentId: resource.id } }
        );
        return { success: true, action: 'order_updated' };

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.FAILED':
        // Payment capture failed
        await Order.update(
          {
            paymentStatus: 'failed',
            status: 'payment_failed',
            paymentDetails: resource
          },
          { where: { paymentIntentId: resource.id } }
        );
        return { success: false, action: 'payment_failed' };

      default:
        return { success: true, action: 'no_action' };
    }
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    throw new Error(`Failed to process webhook: ${error.message}`);
  }
}

/**
 * Get payment status for an order
 * @param {string} orderId - PayPal order ID
 * @returns {Promise<Object>} Order status details
 */
async function getPaymentStatus(orderId) {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}`,
      { headers }
    );

    if (response.data) {
      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.purchase_units?.[0]?.amount?.value,
        currency: response.data.purchase_units?.[0]?.amount?.currency_code,
        createTime: response.data.create_time,
        updateTime: response.data.update_time,
        paypalData: response.data
      };
    } else {
      throw new Error('Failed to get PayPal order status: Invalid response from PayPal API.');
    }
  } catch (error) {
    console.error('Error getting PayPal order status:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get PayPal order status: ' + (error.response?.data?.message || error.message));
  }
}

module.exports = {
  createOrder,
  capturePayment,
  processWebhook,
  getPaymentStatus,
  getAuthHeaders
};
