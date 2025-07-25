const nodemailer = require('nodemailer');
const S3Service = require('./s3Service');
const { format } = require('date-fns');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL || 'menerycustoms@gmail.com',
        pass: process.env.GOOGLE_APP_PASSWORD
      }
    });
    this.fromEmail = process.env.ADMIN_EMAIL || 'menerycustoms@gmail.com';
    this.adminEmail = 'menerycustoms@gmail.com';
  }

  async sendEmail(to, subject, text, html) {
    try {
      console.log(`Preparing to send email - To: ${to}, Subject: ${subject}`);
      
      // Validate email configuration
      if (!process.env.GOOGLE_APP_PASSWORD) {
        const error = 'GOOGLE_APP_PASSWORD not set. Email will not be sent.';
        console.warn(error);
        return { 
          success: false, 
          error: 'Email configuration incomplete',
          details: error
        };
      }

      // Validate recipient email
      if (!to) {
        const error = 'No recipient email address provided';
        console.error(error);
        return { 
          success: false, 
          error: 'Missing recipient',
          details: error
        };
      }

      // Ensure 'to' is an array for multiple recipients
      const recipients = Array.isArray(to) ? to : [to];
      
      // Filter out any invalid email addresses
      const validRecipients = recipients.filter(recipient => {
        const email = typeof recipient === 'string' ? recipient : (recipient.address || '');
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      });

      if (validRecipients.length === 0) {
        const error = 'No valid recipient email addresses provided';
        console.error(error);
        return { 
          success: false, 
          error: 'Invalid recipient',
          details: error
        };
      }

      const mailOptions = {
        from: `"Bob Menery Voiceovers" <${this.fromEmail}>`,
        to: validRecipients,
        subject: subject || 'No Subject',
        text: text || '',
        html: html || text || '',
        replyTo: 'menerycustoms@gmail.com'
      };

      console.log(`Attempting to send email to:`, validRecipients);
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${validRecipients.join(', ')} with message ID: ${info.messageId}`);
      return { 
        success: true, 
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return { 
        success: false, 
        error: error.message,
        details: error.response || error,
        stack: error.stack
      };
    }
  }

  async sendOrderCompleteNotification(order) {
    try {
      const { customerEmail, customerName, orderId } = order;
      
      const subject = `Your Voiceover Order #${orderId} is Ready!`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Voiceover is Ready, ${customerName}!</h2>
          <p>We're excited to let you know that your custom voiceover order #${orderId} is now complete!</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${orderId}" 
               style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold;">
              View Your Order
            </a>
          </div>
          
          <p>If you have any questions or need further assistance, please don't hesitate to contact us at 
          <a href="mailto:menerycustoms@gmail.com">menerycustoms@gmail.com</a>.</p>
          
          <p>Thank you for choosing Bob Menery Voiceovers!</p>
          
          <p>Best regards,<br>The Bob Menery Voiceovers Team</p>
        </div>
      `;

      return await this.sendEmail(customerEmail, subject, '', html);
    } catch (error) {
      console.error('Error sending order complete notification:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  async sendOrderConfirmation(order) {
    try {
      const { customerEmail, customerName, orderId, amount, originalVideoKey } = order;
      const formattedAmount = (amount / 100).toFixed(2);
      const orderDate = format(new Date(), 'MMMM d, yyyy');

      console.log('Sending order confirmation emails for order:', { orderId, customerEmail });

      // Generate S3 video URL for admin email
      let videoUrl = '';
      if (originalVideoKey) {
        try {
          // Generate a pre-signed URL for the video
          videoUrl = await S3Service.generateDownloadUrl(originalVideoKey);
          console.log('Generated S3 URL for video:', { originalVideoKey, url: videoUrl });
        } catch (s3Error) {
          console.error('Error generating S3 URL:', s3Error);
          videoUrl = `[Error generating video URL: ${s3Error.message}]`;
        }
      }

      // Email to customer
      const customerSubject = `Your Bob Menery Voiceover Order #${orderId} - Thank You!`;
      const customerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank you for your order, ${customerName || 'Valued Customer'}!</h2>
          <p>We've received your order and are excited to get started on your custom voiceover.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order #:</strong> ${orderId}</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
            <p><strong>Amount:</strong> $${formattedAmount}</p>
          </div>
          
          <p>We'll notify you once your order is complete. If you have any questions, please contact us at <a href="mailto:menerycustoms@gmail.com">menerycustoms@gmail.com</a>.</p>
          
          <p>Best regards,<br>The Bob Menery Voiceovers Team</p>
        </div>
      `;

      // Email to admin
      const adminSubject = `🎤 New Voiceover Order #${orderId} - ${customerName}`;
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎤 New Voiceover Order Received</h2>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order #:</strong> ${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a></p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
            <p><strong>Amount:</strong> $${formattedAmount}</p>
            
            <h3 style="margin-top: 20px;">Video Upload</h3>
            ${videoUrl ? `
              <p><strong>Video File:</strong> ${originalVideoKey}</p>
              <p><a href="${videoUrl}" style="display: inline-block; background: #4CAF50; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
                🔗 Download Video
              </a></p>
              <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
                <em>Link expires in 1 week</em>
              </p>
            ` : '<p>No video file available</p>'}
          </div>
          
          <div style="margin-top: 25px; padding: 15px; background: #e8f4fc; border-radius: 5px;">
            <h3>Next Steps</h3>
            <ol>
              <li>Review the video submission</li>
              <li>Create the voiceover</li>
              <li>Upload the final video to the order</li>
              <li>Mark the order as complete</li>
            </ol>
            
            <div style="margin-top: 15px;">
              <a href="${process.env.ADMIN_URL || 'http://localhost:3000/admin'}/orders/${orderId}" 
                 style="display: inline-block; background: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
                👉 View Order in Admin
              </a>
            </div>
          </div>
        </div>
      `;

      // Send customer email first
      console.log('Sending customer email to:', customerEmail);
      const customerResult = await this.sendEmail(
        customerEmail,
        customerSubject,
        `Thank you for your order #${orderId}. We've received your request and will process it shortly.`,
        customerHtml
      );

      if (!customerResult.success) {
        console.error('Failed to send customer email:', customerResult);
        // Still try to send admin notification even if customer email fails
      } else {
        console.log('Customer email sent successfully:', customerResult);
      }

      // Then send admin email
      const adminEmail = process.env.ADMIN_EMAIL || 'menerycustoms@gmail.com';
      console.log('Sending admin email to:', adminEmail);
      const adminResult = await this.sendEmail(
        adminEmail,
        adminSubject,
        `New order #${orderId} received from ${customerName || 'a customer'} (${customerEmail})`,
        adminHtml
      );

      if (!adminResult.success) {
        console.error('Failed to send admin email:', adminResult);
        // Return the admin error if customer email was sent successfully
        if (customerResult.success) {
          return {
            success: false,
            error: 'Admin email failed',
            details: adminResult,
            customerEmailSent: true
          };
        }
        // If both failed, return a combined error
        return {
          success: false,
          error: 'Both customer and admin emails failed',
          details: {
            customer: customerResult,
            admin: adminResult
          }
        };
      }

      console.log('Admin email sent successfully:', adminResult);
      return {
        success: true,
        customerEmail: customerResult.success ? customerEmail : null,
        adminEmail: adminEmail,
        messageId: adminResult.messageId,
        customerMessageId: customerResult.success ? customerResult.messageId : null
      };
    } catch (error) {
      console.error('Error in sendOrderConfirmation:', error);
      return {
        success: false,
        error: error.message,
        details: error,
        stack: error.stack
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
            Your Order is Confirmed!
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
