const axios = require('axios');
const { Order } = require('../models');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY;
const PAYPAL_SANDBOX_URL = process.env.PAYPAL_SANDBOX_URL || 'https://api-m.sandbox.paypal.com';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Helper function to get auth headers
const getAuthHeaders = async () => {
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
};

/**
 * PayPal Service for handling payments
 */
class PaypalService {
  /**
   * Create a PayPal order
   * @param {Object} orderData - Order details
   * @param {number} orderData.amount - Order amount in USD
   * @param {string} orderData.description - Order description
   * @param {string} orderData.redirectUrl - URL to redirect after payment
   * @param {string} orderData.orderId - Internal order ID
   * @returns {Promise<Object>} PayPal order details
   */
  static async createOrder(orderData) {
    const { amount, description, redirectUrl, orderId } = orderData;
    
    try {
      const headers = await getAuthHeaders();
      const returnUrl = redirectUrl || 
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`;
      
      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId || `order_${Date.now()}`,
          amount: {
            currency_code: 'USD',
            value: parseFloat(amount).toFixed(2),
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: parseFloat(amount).toFixed(2)
              }
            }
          },
          description: description || 'Custom Voiceover Order',
          custom_id: orderId || `custom_${Date.now()}`,
          invoice_id: `VO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          soft_descriptor: 'BOBMENERYVO',
          items: [{
            name: description || 'Custom Voiceover',
            description: description || 'Custom Voiceover Order',
            quantity: '1',
            unit_amount: {
              currency_code: 'USD',
              value: parseFloat(amount).toFixed(2)
            }
          }]
        }],
        application_context: {
          brand_name: 'Bob Menery Voiceovers',
          locale: 'en-US',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/cancel`
        }
      };

      console.log('Creating PayPal order with payload:', JSON.stringify(orderPayload, null, 2));
      
      const response = await axios.post(
        `${PAYPAL_SANDBOX_URL}/v2/checkout/orders`,
        orderPayload,
        { headers }
      );

      console.log('PayPal API Response:', JSON.stringify(response.data, null, 2));
      
      // Extract the approval URL from the response
      const approvalLink = response.data.links.find(link => link.rel === 'approve' || link.rel === 'payer-action');
      
      if (!approvalLink) {
        console.error('Could not find approval URL in PayPal response. Available links:', 
          response.data.links?.map(l => `${l.rel}: ${l.href}`) || 'No links found');
        throw new Error('Could not find approval URL in PayPal response');
      }

      // Return the PayPal order details
      const result = {
        orderId: response.data.id,
        status: response.data.status,
        paypalRedirectUrl: approvalLink.href,
        links: response.data.links
      };

      // Save the PayPal order ID to the database if orderId is provided
      if (orderId) {
        try {
          await Order.update(
            { payment_intent_id: response.data.id },
            { 
              where: { 
                id: orderId,
                payment_intent_id: null // Only update if payment_intent_id is not already set
              } 
            }
          );
        } catch (dbError) {
          console.error('Error updating order with PayPal ID:', {
            orderId,
            paypalOrderId: response.data.id,
            error: dbError.message
          });
          // Don't fail the whole operation if DB update fails
        }
      }

      return result;
    } catch (error) {
      console.error('Error creating PayPal order:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      throw new Error(`Failed to create PayPal order: ${error.message}`);
    }
  }

  /**
   * Capture payment for an order
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<Object>} Capture details
   */
  static async capturePayment(orderId) {
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
   * Get order details from PayPal
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<Object>} Order details
   */
  static async getOrderDetails(orderId) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await axios.get(
        `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}`,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting PayPal order details:', error.response?.data || error.message);
      throw new Error(`Failed to get order details: ${error.message}`);
    }
  }

  /**
   * Process a webhook event from PayPal
   * @param {Object} event - Webhook event data
   * @returns {Promise<Object>} Processing result
   */
  static async processWebhook(event) {
    try {
      const { event_type, resource } = event;
      
      switch (event_type) {
        case 'CHECKOUT.ORDER.APPROVED':
          // Order was approved by the payer
          await this.capturePayment(resource.id);
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
   * Get the status of a PayPal payment
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<Object>} Payment status details
   */
  static async getPaymentStatus(orderId) {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}`,
        { headers }
      );

      if (response.data) {
        return {
          status: response.data.status,
          orderId: response.data.id,
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
}

module.exports = PaypalService;
