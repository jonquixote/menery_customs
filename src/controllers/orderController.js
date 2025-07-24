const { User, Order } = require('../models');
const S3Service = require('../services/s3Service');

class OrderController {
  static async initiateUpload(req, res) {
    try {
      const { fileName, fileType } = req.body;

      // Validate input
      if (!fileName || !fileType) {
        return res.status(400).json({ 
          error: 'fileName and fileType are required' 
        });
      }

      // Validate file type (only allow video files)
      const allowedTypes = [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 
        'video/flv', 'video/webm', 'video/mkv'
      ];
      
      if (!allowedTypes.includes(fileType.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Invalid file type. Only video files are allowed.' 
        });
      }

      // Generate pre-signed URL
      const { preSignedUrl, objectKey } = await S3Service.generatePreSignedUrl(fileName, fileType);

      res.json({
        preSignedUrl,
        objectKey,
        message: 'Upload URL generated successfully'
      });

    } catch (error) {
      console.error('Error in initiateUpload:', error);
      res.status(500).json({ 
        error: 'Failed to generate upload URL' 
      });
    }
  }

  static async createOrder(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        price,
        duration,
        script,
        originalVideoKey,
        paymentMethod,
        paymentIntentId
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !price || !duration || 
          !originalVideoKey || !paymentMethod || !paymentIntentId) {
        return res.status(400).json({ 
          error: 'Missing required fields' 
        });
      }

      // Create or find user
      const [user] = await User.findOrCreate({
        where: { email },
        defaults: {
          firstName,
          lastName,
          email,
          phone
        }
      });

      // Create order
      const order = await Order.create({
        userId: user.id,
        status: 'pending',
        price,
        duration,
        script,
        originalVideoKey,
        paymentMethod,
        paymentIntentId
      });

      res.status(201).json({
        orderId: order.id,
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
