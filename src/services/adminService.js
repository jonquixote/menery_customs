const { Order } = require('../models');
const { sendNewOrderAlert, sendOrderComplete } = require('./emailService');

/**
 * List all orders with optional filtering
 * @param {Object} filters - Filters for querying orders
 * @returns {Promise<Array>} Array of orders
 */
const listOrders = async (filters = {}) => {
  try {
    const whereClause = {};
    
    // Add filters if provided
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.userId) {
      whereClause.userId = filters.userId;
    }
    
    const orders = await Order.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });
    
    return { orders };
  } catch (error) {
    console.error('Error listing orders:', error);
    throw new Error('Failed to list orders');
  }
};

/**
 * Update order status and trigger appropriate notifications
 * @param {string} orderId - ID of the order to update
 * @param {string} status - New status for the order
 * @returns {Promise<Object>} Updated order
 */
const updateOrderStatus = async (orderId, status) => {
  try {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Update order status
    order.status = status;
    await order.save();
    
    // Send appropriate notifications based on status
    if (status === 'completed') {
      await sendOrderComplete({
        to: order.user.email,
        name: `${order.user.firstName} ${order.user.lastName}`,
        orderId: order.id
      });
    }
    
    return order;
  } catch (error) {
    console.error(`Error updating order ${orderId} status:`, error);
    throw new Error(`Failed to update order status: ${error.message}`);
  }
};

/**
 * Get order details by ID
 * @param {string} orderId - ID of the order to retrieve
 * @returns {Promise<Object>} Order details
 */
const getOrderDetails = async (orderId) => {
  try {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    return order;
  } catch (error) {
    console.error(`Error getting order ${orderId} details:`, error);
    throw new Error(`Failed to get order details: ${error.message}`);
  }
};

module.exports = {
  listOrders,
  updateOrderStatus,
  getOrderDetails
};
