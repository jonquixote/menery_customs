const { User, Order } = require('../models');
const EmailService = require('../services/emailService');
const PaymentService = require('../services/squareService');
const { v4: uuidv4 } = require('uuid');

class PaymentController {
  static async createPaymentLink(req, res) {
    console.log('Attempting to create payment link...'); // Added for debugging
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
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Use real Square service
      const { url, paymentId } = await PaymentService.createPaymentLink({
        name: description,
        price: amount,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${orderId}/status`
      });

      res.json({
        success: true,
        paymentUrl,
        paymentId,
        orderId
      });

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
      const { paymentId } = req.params; // This is the Square Order ID
      const status = await PaymentService.getPaymentStatus(paymentId);
      
      res.json({
        status: status,
        orderId: paymentId
      });

    } catch (error) {
      console.error('Error in getPaymentStatus controller:', error);
      res.status(500).json({ 
        error: 'Failed to get payment status',
        details: error.message
      });
    }
  }
}

module.exports = PaymentController;
