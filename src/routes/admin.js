const express = require('express');
const AdminController = require('../controllers/adminController');

const router = express.Router();


// POST /api/admin/generate-token - This route is unprotected
router.post('/generate-token', AdminController.generateToken);

// POST /api/admin/orders - Create order from admin dashboard
router.post('/orders', AdminController.createOrder);

// PUT /api/admin/orders/:id - Edit order from admin dashboard
router.put('/orders/:id', AdminController.updateOrderFromAdmin);

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', AdminController.deleteOrder);

module.exports = router;
