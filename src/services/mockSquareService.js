class MockSquareService {
  constructor() {
    this.payments = new Map();
    this.orders = new Map();
    this.webhookUrl = null;
    console.log('Using Mock Square Service - No real payments will be processed');
  }

  static async createPaymentLink(orderDetails) {
    const { orderId, amount, customerEmail, customerName } = orderDetails;
    
    // Generate a mock payment ID
    const paymentId = `mock_py_${Date.now()}`;
    const paymentUrl = `http://localhost:3000/mock-checkout?payment_id=${paymentId}`;
    
    // Store the order details
    const order = {
      id: `mock_order_${Date.now()}`,
      status: 'PENDING',
      amount: amount,
      currency: 'USD',
      customerEmail,
      customerName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.orders.set(orderId, order);
    
    // Store the payment
    const payment = {
      id: paymentId,
      orderId,
      status: 'PENDING',
      amount: amount,
      currency: 'USD',
      createdAt: new Date().toISOString()
    };
    
    this.payments.set(paymentId, payment);
    
    return {
      paymentUrl,
      paymentId,
      orderId
    };
  }

  static async getPaymentStatus(paymentId) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Randomly complete some payments for testing
    if (payment.status === 'PENDING' && Math.random() > 0.7) {
      payment.status = 'COMPLETED';
      payment.updatedAt = new Date().toISOString();
      
      // Update the order status if needed
      if (payment.orderId && this.orders.has(payment.orderId)) {
        const order = this.orders.get(payment.orderId);
        order.status = 'PAID';
        order.updatedAt = new Date().toISOString();
      }
    }
    
    return {
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      orderId: payment.orderId
    };
  }

  static async handleWebhook(event) {
    console.log('Received mock webhook event:', event.type);
    
    // Simulate webhook processing
    if (event.type === 'payment.updated') {
      const payment = event.data.object.payment;
      return {
        eventType: event.type,
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount_money?.amount || 0,
        currency: payment.amount_money?.currency || 'USD',
        orderId: payment.order_id || null
      };
    }
    
    return { eventType: event.type, handled: false };
  }

  static verifyWebhook() {
    // Always return true in mock mode
    return true;
  }

  // Helper method to simulate webhook calls (for testing)
  static async simulateWebhook(paymentId, eventType = 'payment.updated') {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    const webhookEvent = {
      type: eventType,
      data: {
        object: {
          payment: {
            id: payment.id,
            order_id: payment.orderId,
            status: payment.status,
            amount_money: {
              amount: payment.amount,
              currency: payment.currency
            },
            created_at: payment.createdAt,
            updated_at: new Date().toISOString()
          }
        }
      }
    };
    
    return this.handleWebhook(webhookEvent);
  }
}

module.exports = MockSquareService;
