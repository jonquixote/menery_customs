const nodemailer = require('nodemailer');
const S3Service = require('./s3Service'); // Added S3Service require

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD
      }
    });
    this.fromEmail = process.env.ADMIN_EMAIL;
    this.adminEmail = process.env.ADMIN_EMAIL || this.fromEmail;
  }

  async sendEmail(to, subject, text, html) {
    try {
      const mailOptions = {
        from: `"Bob Menery Voiceovers" <${this.fromEmail}>`,
        to,
        subject,
        text,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { 
        success: false, 
        error: error.message,
        details: error.response || error
      };
    }
  }

  async sendNewOrderAlert(orderDetails) {
    const adminResult = await this.sendAdminNewOrderNotification(orderDetails);
    const customerResult = await this.sendCustomerOrderConfirmation(orderDetails);

    if (adminResult.success && customerResult.success) {
      return { success: true, messageId: { admin: adminResult.messageId, customer: customerResult.messageId } };
    } else {
      const errors = [];
      if (!adminResult.success) {
        errors.push({ for: 'admin', error: adminResult.error, details: adminResult.details });
      }
      if (!customerResult.success) {
        errors.push({ for: 'customer', error: customerResult.error, details: customerResult.details });
      }
      return {
        success: false,
        error: 'One or more emails failed to send.',
        details: errors
      };
    }
  }

  async sendCustomerOrderConfirmation(orderDetails) {
    try {
      const {
        orderId,
        customerName,
        customerEmail,
        price,
        duration,
        script,
        paymentMethod
      } = orderDetails;

      const subject = `Your Voiceover Order Confirmation: #${orderId}`;
      const text = `Hi ${customerName}, we've received your order! Order ID: ${orderId}.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            ✅ Your Order is Confirmed!
          </h2>
          <p>Hi ${customerName},</p>
          <p>Thank you for your order! We're excited to get started on your custom voiceover. Here are your order details:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Order Summary</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Price:</strong> $${(price / 100).toFixed(2)}</p>
            <p><strong>Duration:</strong> ${duration} seconds</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          </div>

          ${script ? `
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">Your Script/Notes</h3>
            <p style="font-style: italic;">"${script}"</p>
          </div>
          ` : ''}

          <p>We have received your video and will begin working on it shortly. You will receive another email with a link to your completed voiceover soon.</p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666;">
              Thanks,
              <br>
              The Bob Menery Team
            </p>
          </div>
        </div>
      `;

      return await this.sendEmail(customerEmail, subject, text, html);
    } catch (error) {
      console.error('Error sending customer confirmation email:', error);
      return { success: false, error: error.message, details: error };
    }
  }

  async sendAdminNewOrderNotification(orderDetails) {
    try {
      const {
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        price,
        duration,
        script,
        originalVideoKey,
        paymentMethod
      } = orderDetails;

      // Generate secure download link for the original video
      const downloadUrl = await S3Service.generateDownloadUrl(originalVideoKey);

      const subject = `New Voiceover Order: #${orderId}`;
      const text = `New order received! Order ID: ${orderId}, Customer: ${customerName} <${customerEmail}>`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            🎬 New Voiceover Order Received!
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Order Details</h3>
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Price:</strong> $${(price / 100).toFixed(2)}</p>
            <p><strong>Duration:</strong> ${duration} seconds</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
              <p><strong>Phone:</strong> ${customerPhone || 'Not provided'}</p>
            </div>

            ${script ? `
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">Script/Notes</h3>
              <p style="font-style: italic;">"${script}"</p>
            </div>
            ` : ''}

            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0c5460; margin-top: 0;">Original Video</h3>
              <p>The customer's original video is ready for download:</p>
              <a href="${downloadUrl}" 
                 style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; font-weight: bold;">
                📥 Download Original Video
              </a>
              <p style="font-size: 12px; color: #666; margin-top: 10px;">
                <em>Note: This download link expires in 24 hours for security.</em>
              </p>
            </div>
          </div>
        `;

      return await this.sendEmail(this.adminEmail, subject, text, html);
    } catch (error) {
      console.error('Error sending admin new order notification:', error);
      return { success: false, error: error.message, details: error };
    }
  }
}

module.exports = new EmailService();
