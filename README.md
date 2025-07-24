# Bob Menery Custom Voiceovers - Backend

A complete Node.js backend for the Bob Menery Custom Voiceovers web application.

## Features

- 🎬 Secure video file uploads to AWS S3
- 💳 Stripe payment processing with webhooks
- 📧 Automated email notifications (SendGrid)
- 🗄️ PostgreSQL database with Sequelize ORM
- 🔒 Security middleware (helmet, CORS, rate limiting)
- 👨‍💼 Admin endpoints for order management

## Setup Instructions

### 1. Environment Configuration

The `.env` file has been created with AWS credentials. You need to configure:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/menery_customs"

# Payment Processor Configuration
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"

# Email Service Configuration
SENDGRID_API_KEY="SG.your_sendgrid_api_key"
ADMIN_EMAIL_ADDRESS="bob.menery.admin@example.com"
SENDER_EMAIL_ADDRESS="noreply@menerycustoms.com"
```

### 2. Database Setup

1. Install PostgreSQL if not already installed
2. Create a database named `menery_customs`
3. Update the `DATABASE_URL` in `.env` with your credentials
4. The database tables will be created automatically when you start the server

### 3. External Service Setup

#### Stripe
1. Create a Stripe account at https://stripe.com
2. Get your secret key from the Stripe dashboard
3. Set up a webhook endpoint pointing to `your-domain.com/api/webhooks/stripe`
4. Configure the webhook to listen for `payment_intent.succeeded` events

#### SendGrid
1. Create a SendGrid account at https://sendgrid.com
2. Generate an API key
3. Verify your sender email address

#### AWS S3
1. The AWS credentials are already provided
2. Ensure the S3 bucket `menery-customs` exists and is accessible

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on port 3001 (or the PORT specified in .env).

## API Endpoints

### Orders
- `POST /api/orders/initiate-upload` - Generate pre-signed URL for file upload
- `POST /api/orders` - Create a new order
- `GET /api/orders/:orderId` - Get order details

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `GET /api/payments/status/:paymentIntentId` - Get payment status

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Admin (for Bob Menery)
- `GET /api/admin/orders` - List all orders
- `POST /api/admin/orders/:orderId/complete` - Mark order as complete
- `PUT /api/admin/orders/:orderId/status` - Update order status

## Project Structure

```
src/
├── config/
│   └── database.js          # Database configuration
├── controllers/
│   ├── adminController.js   # Admin endpoints
│   ├── orderController.js   # Order management
│   ├── paymentController.js # Payment processing
│   └── webhookController.js # Webhook handlers
├── models/
│   ├── User.js             # User model
│   ├── Order.js            # Order model
│   └── index.js            # Model associations
├── routes/
│   ├── admin.js            # Admin routes
│   ├── orders.js           # Order routes
│   ├── payments.js         # Payment routes
│   └── webhooks.js         # Webhook routes
├── services/
│   ├── emailService.js     # Email notifications
│   ├── s3Service.js        # AWS S3 operations
│   └── stripeService.js    # Stripe operations
└── server.js               # Main server file
```

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Webhook signature verification
- Input validation
- Secure file upload with pre-signed URLs

## Email Templates

The system sends three types of emails:
1. **Order Confirmation** - Sent immediately after payment intent creation
2. **New Order Alert** - Sent to Bob when payment succeeds
3. **Completion Email** - Sent to customer when order is marked complete

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL format
   - Verify database exists

2. **Stripe Webhook Issues**
   - Verify webhook secret in Stripe dashboard
   - Ensure webhook URL is accessible
   - Check webhook event types

3. **Email Delivery Issues**
   - Verify SendGrid API key
   - Check sender email verification
   - Review SendGrid activity dashboard

4. **File Upload Issues**
   - Verify AWS credentials
   - Check S3 bucket permissions
   - Ensure bucket exists in correct region

## Next Steps

1. Configure all environment variables
2. Set up external services (Stripe, SendGrid)
3. Test the complete flow from frontend to backend
4. Deploy to production environment
5. Set up monitoring and logging

## Support

For technical support, contact the development team or refer to the service documentation:
- [Stripe Documentation](https://stripe.com/docs)
- [SendGrid Documentation](https://docs.sendgrid.com)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3)
- [Sequelize Documentation](https://sequelize.org)
