const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticateUser } = require('../middleware/auth');

// Initiate file upload
router.post('/initiate', uploadController.initiateUpload);

// Verify file upload
router.post('/verify/:key', authenticateUser, uploadController.verifyUpload);

module.exports = router;
