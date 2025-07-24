// Import test utilities
const request = require('supertest');
const { sequelize } = require('../src/models');
const jwt = require('jsonwebtoken');

// Generate a test admin token
const adminToken = jwt.sign(
  { role: 'admin', id: 1 },
  process.env.JWT_SECRET || 'test-secret'
);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = 0; // Use random port for testing
process.env.JWT_SECRET = 'test-secret-key';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SQUARE_ACCESS_TOKEN = 'sandbox-sq0atb-TestToken';
process.env.SQUARE_ENV = 'sandbox';
process.env.SQUARE_LOCATION_ID = 'test-location';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.AWS_REGION = 'us-test-1';
process.env.AWS_BUCKET_NAME = 'test-bucket';
process.env.ADMIN_TOKEN = 'test-admin-token';

// Mock external services
jest.mock('../src/services/emailService', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
  sendNewOrderAlert: jest.fn().mockResolvedValue(true),
  sendOrderComplete: jest.fn().mockResolvedValue(true)
}));

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-s3-url.com/upload')
}));

// Mock Square service
jest.mock('../src/services/squareService', () => ({
  createPaymentLink: jest.fn().mockResolvedValue({
    paymentUrl: 'https://square.link/test-payment',
    paymentId: 'test-payment-id',
    orderId: 'test-order-id'
  }),
  getPaymentStatus: jest.fn().mockResolvedValue({
    status: 'COMPLETED',
    amount: 1000,
    currency: 'USD'
  }),
  verifyWebhookSignature: jest.fn().mockReturnValue(true)
}));

// Mock admin service
jest.mock('../src/services/adminService', () => ({
  listOrders: jest.fn().mockResolvedValue({
    orders: [{
      id: 'test-order-id',
      status: 'pending',
      price: 1000,
      user: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      }
    }]
  }),
  updateOrderStatus: jest.fn().mockResolvedValue({
    id: 'test-order-id',
    status: 'processing',
    updatedAt: new Date().toISOString()
  })
}));

// Mock webhook service
jest.mock('../src/services/webhookService', () => ({
  handleWebhook: jest.fn().mockResolvedValue({ success: true })
}));

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, res, next) => {
    if (req.headers.authorization === `Bearer ${process.env.ADMIN_TOKEN}`) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}));

// Import app after setting up mocks
const { app, connectDB } = require('../src/server');

// Mock the auth middleware before importing routes
jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (token === 'invalid-token') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = { id: 1, role: 'admin' };
    next();
  }),
  authenticateUser: jest.fn((req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  })
}));

describe('Backend API Tests', () => {
  let testOrderId;
  let testPaymentId = `test-pay-${Date.now()}`;
  let server;
  let adminToken = 'test-admin-token';
  
  beforeAll(async () => {
    // Connect to test database
    await connectDB();
    
    // Start server on random port
    server = await app.listen(0);
    
    // Store the base URL for requests
    global.__SERVER__ = `http://localhost:${server.address().port}`;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close server and database connection
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await sequelize.close();
  });

  describe('Order Endpoints', () => {
    test('should initiate file upload', async () => {
      const response = await request(__SERVER__)
        .post('/api/orders/initiate-upload')
        .send({
          fileName: 'test-video.mp4',
          fileType: 'video/mp4',
          userId: 'test-user-id'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Upload URL generated successfully');
      expect(response.body).toHaveProperty('objectKey');
      expect(response.body).toHaveProperty('preSignedUrl');
    });

    test('should create a new order', async () => {
      const orderData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        price: 1000,
        duration: 30,
        script: 'Test script',
        originalVideoKey: 'test-video-key',
        paymentMethod: 'square',
        paymentIntentId: 'test-payment-intent-id',
        userId: 'test-user-id'
      };

      const response = await request(__SERVER__)
        .post('/api/orders')
        .send(orderData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('orderId');
      expect(response.body).toHaveProperty('message', 'Order created successfully');
      testOrderId = response.body.orderId;
    });
  });

  describe('Payment Endpoints', () => {
    // Import the mocked squareService
    const squareService = require('../src/services/squareService');

    test('should create payment link', async () => {
      // First create a test order
      const orderData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        price: 1000,
        duration: 30,
        script: 'Test script',
        originalVideoKey: 'test-video-key',
        paymentMethod: 'square',
        paymentIntentId: 'test-payment-intent-id',
        userId: 'test-user-id'
      };

      const orderResponse = await request(__SERVER__)
        .post('/api/orders')
        .send(orderData);
      
      testOrderId = orderResponse.body.orderId;

      // Prepare payment link request data
      const paymentData = {
        orderId: testOrderId,
        amount: 1000, // in cents
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        description: 'Test Voiceover Order',
        redirectUrl: 'http://localhost:3000/order-complete'
      };

      // Mock the Square service response
      const mockPaymentLink = {
        paymentUrl: 'https://square.link/test-payment',
        paymentId: 'test-payment-id',
        orderId: testOrderId
      };
      
      squareService.createPaymentLink.mockResolvedValueOnce(mockPaymentLink);

      // Make the request to create payment link
      const response = await request(__SERVER__)
        .post('/api/payments/create-link')
        .send(paymentData);

      // Debug logging
      console.log('Payment Link Request:', {
        url: '/api/payments/create-link',
        method: 'POST',
        body: paymentData,
        response: {
          status: response.statusCode,
          body: response.body
        }
      });

      // Verify the response
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('paymentUrl', mockPaymentLink.paymentUrl);
      expect(response.body).toHaveProperty('paymentId', mockPaymentLink.paymentId);
      
      // Update the test payment ID for subsequent tests
      testPaymentId = response.body.paymentId;
      
      // Verify the mock was called with the correct parameters
      expect(squareService.createPaymentLink).toHaveBeenCalledWith({
        orderId: testOrderId,
        amount: 1000,
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        description: 'Test Voiceover Order',
        redirectUrl: 'http://localhost:3000/order-complete'
      });
    });

    test('should get payment status', async () => {
      const paymentId = testPaymentId || 'test-payment-id';
      
      const response = await request(__SERVER__)
        .get(`/api/payments/status/${paymentId}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'COMPLETED');
      expect(squareService.getPaymentStatus).toHaveBeenCalledWith(paymentId);
    });
  });

  describe('Admin Endpoints', () => {
    // Mock the models
    const mockOrder = {
      id: 1,
      userId: 1,
      status: 'pending',
      price: 1000,
      duration: 30,
      script: 'Test script',
      originalVideoKey: 'test-video-key',
      paymentMethod: 'square',
      paymentIntentId: 'test-payment-intent-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        toJSON() {
          const { toJSON, ...rest } = this;
          return rest;
        }
      },
      toJSON() {
        const { toJSON, user, ...rest } = this;
        return rest;
      }
    };

    // Import models after setting up mocks
    const { Order, User } = require('../src/models');
    const { isAdmin } = require('../src/middleware/auth');

    // Mock the Order model methods
    Order.findAndCountAll = jest.fn().mockResolvedValue({
      rows: [mockOrder],
      count: 1
    });

    Order.findByPk = jest.fn().mockResolvedValue({
      ...mockOrder,
      update: jest.fn().mockResolvedValue([1, [{ ...mockOrder, status: 'processing' }]])
    });

    Order.update = jest.fn().mockResolvedValue([1, [{ ...mockOrder, status: 'processing' }]]);

    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
      
      // Reset the mock implementations
      Order.findAndCountAll.mockResolvedValue({
        rows: [mockOrder],
        count: 1
      });
      
      Order.findByPk.mockResolvedValue({
        ...mockOrder,
        update: jest.fn().mockResolvedValue([1, [{ ...mockOrder, status: 'processing' }]])
      });
      
      // Reset the auth middleware mocks
      const { authenticateAdmin, authenticateUser } = require('../src/middleware/auth');
      authenticateAdmin.mockImplementation((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        if (token === 'invalid-token') {
          return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = { id: 1, role: 'admin' };
        next();
      });
      
      authenticateUser.mockImplementation((req, res, next) => {
        req.user = { id: 1, role: 'user' };
        next();
      });
    });

    test('should list all orders', async () => {
      // Act
      const response = await request(__SERVER__)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.orders.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('total');
      
      // Verify the database was queried correctly
      expect(Order.findAndCountAll).toHaveBeenCalledTimes(1);
      expect(Order.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: [{
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'phone']
        }],
        order: [['createdAt', 'DESC']],
        limit: 50,
        offset: 0
      });
    });

    test('should return 401 without valid token', async () => {
      // Test with no token - should be handled by the auth middleware
      const response1 = await request(__SERVER__)
        .get('/api/admin/orders');
      
      // The auth middleware should return 401 for missing token
      expect(response1.statusCode).toBe(401);
      expect(response1.body).toHaveProperty('error');
      
      // Test with invalid token - should be handled by the auth middleware
      const response2 = await request(__SERVER__)
        .get('/api/admin/orders')
        .set('Authorization', 'Bearer invalid-token');
      
      // The auth middleware should return 401 for invalid token
      expect(response2.statusCode).toBe(401);
      expect(response2.body).toHaveProperty('error');
    });

    test('should update order status', async () => {
      // Arrange
      const orderId = 1;
      const newStatus = 'processing';
      
      // Setup the mock for this specific test
      const mockOrder = {
        id: orderId,
        status: 'pending',
        update: jest.fn().mockResolvedValue([1, [{
          id: orderId,
          status: newStatus
        }]])
      };
      
      Order.findByPk.mockResolvedValueOnce(mockOrder);

      // Act
      const response = await request(__SERVER__)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: newStatus });

      // Assert - the controller returns the order ID as a number
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', newStatus);
      expect(response.body).toHaveProperty('orderId', orderId);
      expect(response.body).toHaveProperty('message', 'Order status updated successfully');
      
      // Verify the update was called with the correct parameters
      expect(mockOrder.update).toHaveBeenCalledWith(
        { status: newStatus }
      );
    });
    
    test('should return 404 for non-existent order when updating status', async () => {
      // Arrange
      const orderId = 999; // Non-existent order ID
      const newStatus = 'processing';
      
      // Setup the mock to return null (order not found)
      Order.findByPk.mockResolvedValueOnce(null);

      // Act
      const response = await request(__SERVER__)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: newStatus });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error', 'Order not found');
    });
    
    test('should return 400 for invalid status', async () => {
      // Arrange
      const orderId = 1;
      const invalidStatus = 'invalid-status';
      
      // Act
      const response = await request(__SERVER__)
        .put(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: invalidStatus });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid status');
    });
  });

  describe('Webhook Endpoints', () => {
    // Import the mocked services
    const webhookService = require('../src/services/webhookService');
    const squareService = require('../src/services/squareService');
    
    test('should handle Square webhook events', async () => {
      // Mock webhook event data
      const webhookEvent = {
        type: 'payment.updated',
        data: {
          object: {
            payment: {
              id: testPaymentId || 'test-payment-id',
              status: 'COMPLETED',
              amount_money: {
                amount: 1000,
                currency: 'USD'
              },
              created_at: new Date().toISOString(),
              metadata: {
                orderId: testOrderId || 'test-order-id'
              }
            }
          }
        }
      };

      const signature = 'test-signature';
      const response = await request(__SERVER__)
        .post('/api/webhooks/square')
        .set('x-square-hmacsha256-signature', signature)
        .send(webhookEvent);

      // Verify the response
      expect(response.statusCode).toBe(200);
      
      // Verify the webhook service was called
      expect(webhookService.handleWebhook).toHaveBeenCalledWith(
        webhookEvent,
        signature
      );
      
      // Verify the response body
      expect(response.body).toHaveProperty('success', true);
    });
    
    test('should return 401 for invalid webhook signature', async () => {
      // Mock the verifyWebhookSignature to return false
      squareService.verifyWebhookSignature.mockReturnValueOnce(false);
      
      const response = await request(__SERVER__)
        .post('/api/webhooks/square')
        .set('x-square-hmacsha256-signature', 'invalid-signature')
        .send({ type: 'test.event' });
        
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid webhook signature');
    });
  });
});
