const { v4: uuidv4 } = require('uuid');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Order } = require('../models');

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

class UploadController {
  static async initiateUpload(req, res) {
    try {
      const { fileName, fileType, fileSize, duration } = req.body;
      
      if (!fileName || !fileType || !fileSize) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate file type
      const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/x-matroska'];
      if (!validTypes.includes(fileType)) {
        return res.status(400).json({ 
          error: 'Invalid file type. Supported types: MP4, MOV, AVI, WMV, MKV' 
        });
      }

      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (fileSize > maxSize) {
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 100MB' 
        });
      }

      // Generate a unique key for the file
      const fileExt = fileName.split('.').pop();
      const key = `uploads/${uuidv4()}.${fileExt}`;
      
      // Generate presigned URL for upload
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        ContentLength: fileSize,
        ACL: 'private'
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiration

      // For testing purposes, we are not creating an order record here.
      // The order will be created in the next step from the test page.

      res.status(200).json({
        uploadUrl,
        key
      });

    } catch (error) {
      console.error('Upload initiation error:', error);
      res.status(500).json({ error: 'Failed to initiate upload' });
    }
  }

  static calculatePrice(duration) {
    // Simple pricing model: $5 per 30 seconds, minimum $10
    const thirtySecondIntervals = Math.ceil(duration / 30);
    return Math.max(10, thirtySecondIntervals * 5) * 100; // Convert to cents
  }

  static async verifyUpload(req, res) {
    try {
      const { key } = req.params;
      const { orderId } = req.body;

      if (!key || !orderId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Verify the file exists in S3
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key
      });

      try {
        await s3Client.send(command);
        
        // Update order status to 'pending_payment'
        await Order.update(
          { status: 'pending_payment' },
          { where: { id: orderId } }
        );

        res.status(200).json({ success: true });
      } catch (error) {
        if (error.name === 'NoSuchKey') {
          return res.status(404).json({ error: 'File not found' });
        }
        throw error;
      }
    } catch (error) {
      console.error('Upload verification error:', error);
      res.status(500).json({ error: 'Failed to verify upload' });
    }
  }
}

module.exports = UploadController;
