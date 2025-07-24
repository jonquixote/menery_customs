const { User, Order } = require('../models');
const EmailService = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

// Use mock service in development, real service in production
const useMockService = process.env.NODE_ENV !== 'production' && 
                      (!process.env.SQUARE_ACCESS_TOKEN || 
                       process.env.SQUARE_ACCESS_TOKEN === 'your_square_access_token');

// Conditional import based on environment
let PaymentService;
if (useMockService) {
  console.log('Using Mock Square Service for payments');
  PaymentService = require('../services/mockSquareService');
} else {
  console.log('Using Real Square Service for payments');
  PaymentService = require('../services/squareService');
}

class PaymentController {
  static async createPaymentLink(req, res) {
    try {
      const {
        orderId,
        amount,
        customerEmail,
        customerName = 'Customer',
        description = 'Voiceover Order',
        redirectUrl
      } = req.body;

      // Validate required fields
      if (!orderId || !amount || !customerEmail) {
        return res.status(400).json({ 
          error: 'Missing required fields' 
        });
      }

      // Validate amount (must be positive integer in cents)
      if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ 
          error: 'Invalid amount' 
        });
      }

      // Create payment link using the appropriate service
      const { paymentUrl, paymentId } = await PaymentService.createPaymentLink({
        orderId,
        amount: amount,
        customerEmail,
        customerName,
        description,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`
      });

      res.json({
        success: true,
        paymentUrl,
        paymentId,
        orderId
      });

      // Send order confirmation email
      try {
        await EmailService.sendOrderConfirmation({
          customerEmail,
          customerName,
          orderId,
          amount,
          description
        });
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Don't fail the payment process if email fails
      }

    } catch (error) {
      console.error('Error in createPaymentLink:', error);
      res.status(500).json({ 
        error: 'Failed to create payment link',
        details: error.message 
      });
    }
  }

  static async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;

      const paymentStatus = await PaymentService.getPaymentStatus(paymentId);
      
      res.json({
        status: paymentStatus.status,
        amount: paymentStatus.amount,
        currency: paymentStatus.currency,
        orderId: paymentStatus.orderId
      });

    } catch (error) {
      console.error('Error in getPaymentStatus:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve payment status',
        details: error.message
      });
    }
  }
}

module.exports = PaymentController;
