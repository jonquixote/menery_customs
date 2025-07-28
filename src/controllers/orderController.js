const { User, Order } = require('../models');
const S3Service = require('../services/s3Service');
const emailService = require('../services/emailService');
const PaypalService = require('../services/paypalService');
const { v4: uuidv4 } = require('uuid');

class OrderController {

  static async createOrder(req, res) {
    try {
      console.log('=== REQUEST HEADERS ===', req.headers);
      console.log('=== REQUEST BODY ===', JSON.stringify(req.body, null, 2));
      
      // Log raw body for debugging
      if (req.rawBody) {
        console.log('=== RAW REQUEST BODY ===', req.rawBody.toString('utf8'));
      }
      
      const {
        name,
        email,
        phone = '',
        notes = '',
        duration,
        amount,
        paymentMethod = 'paypal',
        videoKey = '', // Allow passing an existing S3 key
        isTest = true, // Default to test mode for now
        orderCustomerEmail // Check for alternate email field name
      } = req.body;
      
      // Use orderCustomerEmail if email is not present
      const customerEmail = email || orderCustomerEmail;
      
      console.log('Parsed email from request:', customerEmail);
      
      if (!customerEmail) {
        console.error('No email found in request. Available fields:', Object.keys(req.body));
        return res.status(400).json({ 
          error: 'Email is required. Please provide an email address.' 
        });
      }

      let videoFile = req.files?.video;
      let s3Key;

      // Handle case where we have a direct file upload
      if (videoFile) {
        // Validate video file
        const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/webm'];
        if (!allowedTypes.includes(videoFile.mimetype)) {
          return res.status(400).json({
            error: 'Invalid file type. Only MP4, AVI, MOV, and WebM videos are allowed.'
          });
        }
        
        // Upload the new file to S3
        const s3UploadResult = await S3Service.uploadFile(videoFile);
        s3Key = s3UploadResult.key;
      } 
      // Handle case where we have an existing S3 key
      else if (videoKey) {
        // Verify the key exists in S3
        const keyExists = await S3Service.keyExists(videoKey);
        if (!keyExists) {
          return res.status(400).json({ 
            error: 'The specified video key does not exist in storage' 
          });
        }
        s3Key = videoKey;
      } 
      // No video provided
      else {
        return res.status(400).json({ 
          error: 'No video file provided. Either upload a file or provide a valid video key.' 
        });
      }

      // Validate required fields
      if (!name || !duration || !amount) {
        console.error('Missing required fields. Received:', { name, duration, amount, customerEmail });
        return res.status(400).json({ 
          error: 'Missing required fields. Please provide name, duration, and amount.' 
        });
      }

      // At this point, s3Key contains either the newly uploaded file's key or the existing key
      if (!s3Key) {
        throw new Error('Failed to process video - no valid key available');
      }

      // Find or create a test user for test orders
      let user;
      if (isTest) {
        // Try to find an existing test user with the provided email
        user = await User.findOne({
          where: { email: customerEmail }
        });

        // If no user exists with this email, create one
        if (!user) {
          user = await User.create({
            email: customerEmail,
            firstName: name.split(' ')[0] || 'Test',
            lastName: name.split(' ').slice(1).join(' ') || 'User',
            phone: phone || '+15555555555',
            password: uuidv4(), // Random password for test user
            isTest: true
          });
        }
      } else {
        // In production, you'd want to use the authenticated user
        user = await User.findOne({
          where: { email: customerEmail }
        });

        if (!user) {
          return res.status(400).json({ 
            error: 'User not found. Please sign up first.' 
          });
        }
      }

      // Create order in database
      const order = await Order.create({
        customerName: name,
        customerEmail: customerEmail,
        customerPhone: phone,
        status: req.body.status || 'pending',
        price: parseFloat(amount) || 0,
        duration: parseInt(duration) || 0,
        paymentStatus: 'pending',
        paymentMethod: paymentMethod,
        paymentIntentId: `paypal_${Date.now()}`,
        originalVideoKey: s3Key,
        finalVideoKey: '',
        notes: notes,
        userId: user.id  // Associate with the user
      });
      
      // Ensure we have the email before proceeding
      if (!order.customerEmail) {
        console.error('No customer email found in order:', order);
        throw new Error('Customer email is required');
      }

      // Emails will be sent after successful payment capture.

      // Now, create the PayPal order immediately
      const paypalOrder = await PaypalService.createOrder({
        orderId: order.id,
        amount: order.price,
        description: `Voiceover Order #${order.id}`
      });

      // Update our order with the PayPal order ID
      await order.update({ paymentIntentId: paypalOrder.id });

      res.status(201).json({
        success: true,
        orderId: order.id,
        paypalOrderId: paypalOrder.id, // Send the PayPal ID to the client
        message: 'Order created successfully'
      });

    } catch (error) {
      console.error('Error in createOrder:', error);
      res.status(500).json({ 
        error: 'Failed to create order' 
      });
    }
  }

  static async getOrder(req, res) {
    try {
      const { orderId } = req.params;

      const order = await Order.findByPk(orderId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'phone']
        }]
      });

      if (!order) {
        return res.status(404).json({ 
          error: 'Order not found' 
        });
      }

      res.json(order);

    } catch (error) {
      console.error('Error in getOrder:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve order' 
      });
    }
  }
}

module.exports = OrderController;
