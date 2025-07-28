const express = require('express');
const AdminController = require('../controllers/adminController');

const router = express.Router();

// POST /api/admin/generate-token - This route is unprotected
router.post('/generate-token', AdminController.generateToken);

module.exports = router;
