const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  static async createPaymentIntent(amount, orderId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, // Amount in cents
        currency: 'usd',
        metadata: {
          orderId: orderId.toString(),
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  static async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  static async updatePaymentIntent(paymentIntentId, updates) {
    try {
      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, updates);
      return paymentIntent;
    } catch (error) {
      console.error('Error updating payment intent:', error);
      throw new Error('Failed to update payment intent');
    }
  }

  static verifyWebhookSignature(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

module.exports = StripeService;
