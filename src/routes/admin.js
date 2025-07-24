const express = require('express');
const AdminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateAdmin);

// POST /api/admin/orders/:orderId/complete
router.post('/orders/:orderId/complete', AdminController.completeOrder);

// PUT /api/admin/orders/:orderId/status
router.put('/orders/:orderId/status', AdminController.updateOrderStatus);

// GET /api/admin/orders
router.get('/orders', AdminController.getAllOrders);

module.exports = router;
