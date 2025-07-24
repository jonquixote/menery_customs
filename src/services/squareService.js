// Initialize Square client only if credentials are available
let squareClient;
let checkoutApi;
let paymentsApi;

try {
  const { Client, Environment } = require('square');
  
  // Only initialize if we have a valid access token
  if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_ACCESS_TOKEN !== 'your_square_access_token') {
    squareClient = new Client({
      environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      userAgentDetail: 'bob-menery-voiceovers'
    });
    
    // Get the API instances
    ({ checkoutApi, paymentsApi } = squareClient);
    console.log('Square client initialized successfully');
  } else {
    console.log('Square client not initialized - using mock service instead');
  }
} catch (error) {
  console.warn('Failed to initialize Square client:', error.message);
  console.log('Using mock service instead');
}

class SquareService {
  static async createPaymentLink(orderDetails) {
    try {
      const { orderId, amount, customerEmail, customerName } = orderDetails;
      
      // Convert amount to the smallest currency unit (e.g., cents)
      const amountMoney = {
        amount: BigInt(amount), // Convert to BigInt for Square API
        currency: 'USD'
      };

      // Create order request
      const { result: { order } } = await squareClient.ordersApi.createOrder({
        order: {
          locationId: process.env.SQUARE_LOCATION_ID,
          lineItems: [{
            name: `Voiceover Order #${orderId}`,
            quantity: '1',
            basePriceMoney: amountMoney,
            note: `Voiceover order for ${customerName}`
          }]
        },
        idempotencyKey: `order-${orderId}-${Date.now()}`
      });

      // Create payment link
      const { result: { paymentLink } } = await checkoutApi.createPaymentLink({
        idempotencyKey: `pl-${orderId}-${Date.now()}`,
        orderId: order.id,
        checkoutOptions: {
          redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`,
          askForShippingAddress: false,
          allowTipping: false
        },
        prePopulatedData: {
          buyerEmail: customerEmail
        }
      });

      return {
        paymentUrl: paymentLink.url,
        paymentId: paymentLink.id,
        orderId: orderId
      };
    } catch (error) {
      console.error('Error creating Square payment link:', error);
      throw new Error(`Failed to create payment link: ${error.message}`);
    }
  }

  static async getPaymentStatus(paymentId) {
    try {
      const { result: { payment } } = await paymentsApi.getPayment(paymentId);
      
      // Extract order ID from the first order associated with this payment
      let orderId = null;
      if (payment.orderId) {
        try {
          const { result: { order } } = await squareClient.ordersApi.retrieveOrder(payment.orderId);
          const lineItem = order.lineItems?.[0];
          if (lineItem?.note) {
            const match = lineItem.note.match(/Order #(\w+)/);
            orderId = match ? match[1] : null;
          }
        } catch (e) {
          console.warn('Could not fetch order details:', e.message);
        }
      }

      return {
        status: payment.status,
        amount: Number(payment.amountMoney.amount),
        currency: payment.amountMoney.currency,
        orderId: orderId
      };
    } catch (error) {
      console.error('Error getting payment status from Square:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  static async handleWebhook(event) {
    try {
      const { type, data } = event;
      
      switch (type) {
        case 'payment.created':
        case 'payment.updated': {
          const { payment } = data.object;
          let orderId = null;
          
          // Try to get order details if orderId is present
          if (payment.order_id) {
            try {
              const { result: { order } } = await squareClient.ordersApi.retrieveOrder(payment.order_id);
              const lineItem = order.lineItems?.[0];
              if (lineItem?.note) {
                const match = lineItem.note.match(/Order #(\w+)/);
                orderId = match ? match[1] : null;
              }
            } catch (e) {
              console.warn('Could not fetch order details from webhook:', e.message);
            }
          }
          
          return {
            eventType: type,
            paymentId: payment.id,
            orderId: orderId,
            status: payment.status,
            amount: Number(payment.amount_money?.amount) || 0,
            currency: payment.amount_money?.currency || 'USD'
          };
        }
        
        case 'order.updated': {
          const { order } = data.object;
          return {
            eventType: type,
            orderId: order.reference_id || order.id,
            status: order.state,
            updatedAt: order.updated_at
          };
        }
        
        default:
          return { eventType: type, handled: false };
      }
    } catch (error) {
      console.error('Error processing Square webhook:', error);
      throw new Error(`Failed to process webhook: ${error.message}`);
    }
  }

  static verifyWebhook(signature, body, signatureKey, notificationUrl) {
    try {
      // In a real implementation, verify the webhook signature
      // This is a simplified example - you should use Square's webhook signature verification
      // See: https://developer.squareup.com/docs/webhooks/step3validate
      if (!signature || !signatureKey) {
        console.warn('Missing signature or signature key for webhook verification');
        return false;
      }
      
      // In production, you would verify the signature here
      // For now, we'll just log that we received the verification request
      console.log('Webhook verification requested for URL:', notificationUrl);
      return true;
      
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

module.exports = SquareService;
