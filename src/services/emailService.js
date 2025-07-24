const sgMail = require('@sendgrid/mail');
const S3Service = require('./s3Service');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  static async sendNewOrderAlert(orderDetails) {
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

      const msg = {
        to: process.env.ADMIN_EMAIL_ADDRESS,
        from: process.env.SENDER_EMAIL_ADDRESS,
        subject: `New Voiceover Order: #${orderId}`,
        html: `
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
            </div>

            <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #28a745; margin-top: 0;">Customer Information</h3>
              <p><strong>Name:</strong> ${customerName}</p>
              <p><strong>Email:</strong> ${customerEmail}</p>
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

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666;">
                This is an automated notification from the Bob Menery Custom Voiceovers system.
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(msg);
      console.log(`New order alert email sent for order ${orderId}`);

    } catch (error) {
      console.error('Error sending new order alert:', error);
      throw new Error('Failed to send new order alert email');
    }
  }

  static async sendCompletionEmail(orderDetails) {
    try {
      const {
        customerEmail,
        customerName,
        orderId,
        finalVideoKey
      } = orderDetails;

      // Generate secure download link for the final video
      const downloadUrl = await S3Service.generateDownloadUrl(finalVideoKey);

      const msg = {
        to: customerEmail,
        from: process.env.SENDER_EMAIL_ADDRESS,
        subject: 'Your Bob Menery Voiceover is Ready!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin-bottom: 10px;">🎉 Your Voiceover is Ready!</h1>
              <p style="font-size: 18px; color: #666;">
                Hey ${customerName.split(' ')[0]}, Bob Menery has completed your custom voiceover!
              </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0;">
              <h2 style="color: #28a745; margin-bottom: 20px;">🎬 Download Your Video</h2>
              <p style="margin-bottom: 25px; color: #555;">
                Your personalized Bob Menery voiceover is ready for download. Click the button below to get your video!
              </p>
              
              <a href="${downloadUrl}" 
                 style="display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🎥 Download Your Voiceover
              </a>
              
              <p style="font-size: 12px; color: #666; margin-top: 15px;">
                <em>Download link expires in 24 hours</em>
              </p>
            </div>

            <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Order Information</h3>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Status:</strong> Complete ✅</p>
            </div>

            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">💡 Tips for Your Video</h3>
              <ul style="color: #856404;">
                <li>Save the video to your device immediately</li>
                <li>Share it on social media and tag Bob Menery!</li>
                <li>Use it for your content, presentations, or just for fun</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666; margin-bottom: 10px;">
                Thanks for choosing Bob Menery Custom Voiceovers!
              </p>
              <p style="color: #666; font-size: 14px;">
                Questions? Reply to this email or contact our support team.
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(msg);
      console.log(`Completion email sent to ${customerEmail} for order ${orderId}`);

    } catch (error) {
      console.error('Error sending completion email:', error);
      throw new Error('Failed to send completion email');
    }
  }

  static async sendOrderConfirmation(orderDetails) {
    try {
      const {
        customerEmail,
        customerName,
        orderId,
        price,
        duration
      } = orderDetails;

      const msg = {
        to: customerEmail,
        from: process.env.SENDER_EMAIL_ADDRESS,
        subject: `Order Confirmation - Bob Menery Voiceover #${orderId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin-bottom: 10px;">🎬 Order Confirmed!</h1>
              <p style="font-size: 18px; color: #666;">
                Thanks ${customerName.split(' ')[0]}! Your Bob Menery voiceover order has been confirmed.
              </p>
            </div>

            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">✅ Payment Successful</h3>
              <p style="color: #155724;">
                Your payment has been processed successfully. Bob will start working on your voiceover shortly!
              </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Order Summary</h3>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Amount Paid:</strong> $${(price / 100).toFixed(2)}</p>
              <p><strong>Duration:</strong> ${duration} seconds</p>
              <p><strong>Status:</strong> Processing 🔄</p>
            </div>

            <div style="background-color: #cce5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #004085; margin-top: 0;">What's Next?</h3>
              <ol style="color: #004085;">
                <li>Bob will review your video and create your custom voiceover</li>
                <li>You'll receive an email when your voiceover is ready</li>
                <li>Download and enjoy your personalized Bob Menery content!</li>
              </ol>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666;">
                Questions about your order? Reply to this email for support.
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(msg);
      console.log(`Order confirmation email sent to ${customerEmail} for order ${orderId}`);

    } catch (error) {
      console.error('Error sending order confirmation:', error);
      throw new Error('Failed to send order confirmation email');
    }
  }
}

module.exports = EmailService;
