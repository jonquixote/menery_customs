const { Order, Admin, User } = require('../models');
const EmailService = require('../services/emailService');
const S3Service = require('../services/s3Service');
const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');



class AdminController {
  static async createOrder(req, res) {
    try {
      const { customerName, status, price, originalVideoKey } = req.body;
      if (!customerName || !status || price === undefined || isNaN(Number(price)) || !originalVideoKey) {
        return res.status(400).json({ error: 'Missing required fields. Video must be uploaded first.' });
      }
      // Create order with required fields to match model constraints
      const order = await Order.create({
        customerName,
        status,
        price: Number(price),
        originalVideoKey,
        duration: 1,
        paymentMethod: 'admin',
        paymentIntentId: 'admin-' + Date.now(),
        customerEmail: 'menerycustoms@gmail.com',
        userId: 1
      });
      // Generate video URL if key exists
      let videoUrl = null;
      if (order.originalVideoKey) {
        try {
          videoUrl = await S3Service.generateDownloadUrl(order.originalVideoKey);
        } catch (err) {
          console.error('Error generating video URL:', err);
        }
      }
      res.json({
        message: 'Order created successfully',
        order: {
          ...order.toJSON(),
          videoUrl
        }
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order', details: error.message });
    }
  }

  static async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await Order.findByPk(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      await order.destroy();
      res.json({ message: 'Order deleted successfully', orderId: id });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  }

  static async generateToken(req, res) {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

    if (email.toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    const admin = await Admin.findOne({ where: { email: adminEmail } });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      user: {
        id: 'admin',
        role: 'admin'
      }
    };

    const jwtSecret = process.env.JWT_SECRET || 'c89b8e5a6a3b4c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d';
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
    
    res.json({ token });
  }

  static async completeOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { finalVideoKey } = req.body;

      if (!finalVideoKey) {
        return res.status(400).json({ 
          error: 'finalVideoKey is required' 
        });
      }

      // Find the order
      const order = await Order.findByPk(orderId, {
        include: [{
          model: User,
          as: 'user'
        }]
      });

      if (!order) {
        return res.status(404).json({ 
          error: 'Order not found' 
        });
      }

      if (order.status !== 'paid' && order.status !== 'processing') {
        return res.status(400).json({ 
          error: 'Order must be paid or processing to complete' 
        });
      }

      // Update order with final video and mark as complete
      await order.update({
        finalVideoKey,
        status: 'complete'
      });

      // Send completion email to customer
      await EmailService.sendCompletionEmail({
        customerEmail: order.user.email,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        orderId: order.id,
        finalVideoKey
      });

      res.json({
        message: 'Order completed successfully',
        orderId: order.id,
        status: 'complete'
      });

    } catch (error) {
      console.error('Error in completeOrder:', error);
      res.status(500).json({ 
        error: 'Failed to complete order' 
      });
    }
  }

  static async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'paid', 'processing', 'complete'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }

      const order = await Order.findByPk(orderId);
      if (!order) {
        return res.status(404).json({ 
          error: 'Order not found' 
        });
      }

      await order.update({ status });

      res.json({
        message: 'Order status updated successfully',
        orderId: order.id,
        status
      });

    } catch (error) {
      console.error('Error in updateOrderStatus:', error);
      res.status(500).json({ 
        error: 'Failed to update order status' 
      });
    }
  }

  static async getAllOrders(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      const whereClause = status ? { status } : {};

      const { count, rows } = await Order.findAndCountAll({
        where: whereClause,
        include: [{
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'phone']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const ordersWithUrls = await Promise.all(rows.map(async (order) => {
        const orderJson = order.toJSON();
        if (orderJson.originalVideoKey) {
          orderJson.videoUrl = await S3Service.generateDownloadUrl(orderJson.originalVideoKey);
        }
        return orderJson;
      }));

      res.json({
        orders: ordersWithUrls,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('Error in getAllOrders:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve orders' 
      });
    }
  }
}

module.exports = AdminController;
