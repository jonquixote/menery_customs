const { Order, User } = require('../models');
const EmailService = require('../services/emailService');
const S3Service = require('../services/s3Service');

class AdminController {
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

      const orders = await Order.findAndCountAll({
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

      res.json({
        orders: orders.rows,
        total: orders.count,
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
