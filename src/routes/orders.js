const express = require('express');
const OrderController = require('../controllers/orderController');

const router = express.Router();


// POST /api/orders
router.post('/', OrderController.createOrder);

// GET /api/orders/:orderId
router.get('/:orderId', OrderController.getOrder);

module.exports = router;
