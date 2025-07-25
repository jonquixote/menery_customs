# PayPal Integration Guide

This document provides a comprehensive guide to the PayPal integration in the Bob Menery Custom Voiceovers application.

## Table of Contents
1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [Environment Variables](#environment-variables)
4. [API Endpoints](#api-endpoints)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

## Overview
The application uses PayPal's REST API to process payments. The integration includes:
- Creating PayPal orders
- Processing payments
- Handling webhook notifications
- Checking payment status

## Setup Instructions

### 1. Prerequisites
- Node.js v14+
- PayPal Business Account (sandbox for testing)
- Environment variables configured (see below)

### 2. Installation
Install the required dependencies:
```bash
npm install @paypal/checkout-server-sdk
```

## Environment Variables
Add these variables to your `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET_KEY=your_paypal_secret_key
PAYPAL_SANDBOX_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
```

## API Endpoints

### 1. Create Payment Link
- **Endpoint**: `POST /api/payments/create-payment-link`
- **Request Body**:
  ```json
  {
    "orderId": "unique-order-id",
    "amount": 19.99,
    "customerEmail": "customer@example.com",
    "paymentMethod": "paypal",
    "customerName": "John Doe",
    "description": "Voiceover Order",
    "redirectUrl": "https://yourapp.com/order/status"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "paymentUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...",
    "paymentId": "PAY-...",
    "orderId": "unique-order-id",
    "paymentMethod": "paypal"
  }
  ```

### 2. Check Payment Status
- **Endpoint**: `GET /api/payments/status/:paymentId/paypal`
- **Response**:
  ```json
  {
    "status": "COMPLETED",
    "orderId": "PAY-...",
    "amount": "19.99",
    "currency": "USD"
  }
  ```

## Webhook Configuration

### 1. Set up Webhook in PayPal Developer Dashboard
1. Go to PayPal Developer Dashboard
2. Navigate to your app
3. Add a webhook URL: `https://yourdomain.com/api/webhooks/paypal`
4. Subscribe to these events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.CAPTURE.REFUNDED`

### 2. Webhook Verification
The application verifies webhook signatures using the following headers:
- `paypal-transmission-id`
- `paypal-transmission-time`
- `paypal-cert-url`
- `paypal-transmission-sig`
- `paypal-auth-algo`

## Testing

### 1. Using Test Endpoint (Development Only)
```bash
curl -X GET http://localhost:3001/api/test/test-paypal
```

### 2. Using PayPal Sandbox
1. Use the sandbox business account credentials:
   - Email: sb-ce3xy44912487@business.example.com
   - Password: 0zK_OR/0
2. Navigate to the payment URL returned by the API
3. Log in with sandbox credentials
4. Complete the payment

## Troubleshooting

### Common Issues
1. **Invalid Credentials**
   - Verify `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET_KEY`
   - Ensure you're using the correct environment (sandbox/production)

2. **Webhook Verification Failed**
   - Check `PAYPAL_WEBHOOK_ID` matches your PayPal app settings
   - Verify webhook URL is correctly configured in PayPal Dashboard
   - Ensure server time is synchronized (NTP)

3. **Payment Not Captured**
   - Check order status in PayPal Dashboard
   - Verify webhook events are being received
   - Check server logs for errors

## Security Considerations

1. **Never expose** your PayPal secret key in client-side code
2. Always use HTTPS for webhook endpoints
3. Verify webhook signatures
4. Implement rate limiting on API endpoints
5. Keep dependencies updated
6. Use environment variables for sensitive data

## Support
For issues not covered in this guide, refer to:
- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal API Reference](https://developer.paypal.com/api/rest/)
- [PayPal Webhooks](https://developer.paypal.com/api/rest/webhooks/)

---
Last Updated: July 24, 2025
