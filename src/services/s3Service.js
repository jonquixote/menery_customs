const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

class S3Service {
  static async generatePreSignedUrl(fileName, fileType) {
    try {
      // Generate unique object key
      const timestamp = Date.now();
      const uniqueId = uuidv4();
      const objectKey = `uploads/user-video-${timestamp}-${uniqueId}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: objectKey,
        ContentType: fileType,
        Metadata: {
          'uploaded-at': new Date().toISOString()
        }
      });

      // Generate pre-signed URL with 15 minutes expiration
      const preSignedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 900 // 15 minutes
      });

      return {
        preSignedUrl,
        objectKey
      };
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  static async generateDownloadUrl(objectKey) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: objectKey
      });

      // Generate pre-signed URL for download with 24 hours expiration
      const downloadUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 86400 // 24 hours
      });

      return downloadUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }
}

module.exports = S3Service;
