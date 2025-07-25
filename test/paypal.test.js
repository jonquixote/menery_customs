const request = require('supertest');
const { initTestDatabase, closeTestDatabase, db } = require('./test-helper');
const { v4: uuidv4 } = require('uuid');
const PaypalService = require('../src/services/paypalService');

// Mock PayPal API calls
jest.mock('axios');
const axios = require('axios');

// Mock the getAuthHeaders function from paypalService
jest.mock('../src/services/paypalService', () => {
  const originalModule = jest.requireActual('../src/services/paypalService');
  return {
    ...originalModule,
    getAuthHeaders: jest.fn().mockResolvedValue({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'PayPal-Request-Id': `test-request-${Date.now()}`,
      'Prefer': 'return=representation'
    })
  };
});

// Set a longer timeout for all tests (30 seconds)
jest.setTimeout(30000);

describe('PayPal Payment Flow', () => {
  let server;
  let testOrderId;
  let paypalOrderId;

  beforeAll(async () => {
    try {
      console.log('Initializing test database...');
      await initTestDatabase();
      console.log('Test database initialized');

      // Start the server
      console.log('Starting test server...');
      const app = require('../src/server');
      server = app.listen(0); // Use a random available port
      console.log(`Test server started on port ${server.address().port}`);

      // Create a test user first
      console.log('Creating test user...');
      const user = await db.User.create({
        email: 'test@example.com',
        password: 'testpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer'
      });
      console.log(`Created test user with ID: ${user.id}`);

      // Create a test order in the database
      console.log('Creating test order...');
      const order = await db.Order.create({
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'paypal',
        paymentIntentId: `test-paypal-${Date.now()}`,
        price: 49.99,
        duration: 30,
        notes: 'Test order for PayPal integration',
        originalVideoKey: 'test/test-video.mp4',
        userId: user.id // Use the created user's ID
      });
      
      testOrderId = order.id;
      console.log(`Created test order with ID: ${testOrderId}`);
      
      // Mock PayPal API responses
      axios.post.mockImplementation((url) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve({
            data: {
              access_token: 'test-access-token',
              token_type: 'Bearer',
              expires_in: 3600
            }
          });
        }
        
        if (url.includes('/v2/checkout/orders')) {
          const orderId = `PAYPAL-${Date.now()}`;
          return Promise.resolve({
            data: {
              id: orderId,
              status: 'CREATED',
              links: [
                { rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, method: 'GET' }
              ]
            }
          });
        }
        
        return Promise.reject(new Error(`Unexpected API call to ${url}`));
      });
    } catch (error) {
      console.error('Error in beforeAll:', error);
      throw error;
    }
  });
  
  afterAll(async () => {
    try {
      // Close the server
      if (server) {
        console.log('Closing test server...');
        await new Promise((resolve, reject) => {
          server.close(err => {
            if (err) {
              console.error('Error closing server:', err);
              reject(err);
            } else {
              console.log('Test server closed');
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('Error in afterAll:', error);
      throw error;
    } finally {
      // Always clean up test database
      try {
        console.log('Cleaning up test database...');
        await closeTestDatabase();
        console.log('Test database cleanup complete');
      } catch (error) {
        console.error('Error cleaning up test database:', error);
      }
    }
  });
  
  test('should create a PayPal order', async () => {
    const response = await request(server)
      .post('/api/payments/create-paypal-order')
      .send({
        orderId: testOrderId,
        amount: 49.99,
        description: 'Test PayPal Order',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        redirectUrl: 'http://localhost:3000/order/status'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('orderId');
    
    paypalOrderId = response.body.orderId;
  });
  
  test('should get payment status', async () => {
    if (!paypalOrderId) {
      console.warn('Skipping status check - no PayPal order ID available');
      return;
    }
    
    // Mock the get order details response
    axios.get.mockResolvedValueOnce({
      data: {
        id: paypalOrderId,
        status: 'APPROVED',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: '49.99'
          }
        }]
      }
    });
    
    const response = await request(server)
      .get(`/api/payments/status/${paypalOrderId}/paypal`);
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('paymentId', paypalOrderId.toString());
    expect(response.body).toHaveProperty('paymentMethod', 'paypal');
  });
  
  test('should handle payment capture', async () => {
    if (!paypalOrderId) {
      console.warn('Skipping capture test - no PayPal order ID available');
      return;
    }
    
    // Mock the capture payment response
    axios.post.mockResolvedValueOnce({
      data: {
        id: `PAY-${Date.now()}`,
        status: 'COMPLETED',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
        purchase_units: [{
          payments: {
            captures: [{
              id: `CAPTURE-${Date.now()}`,
              status: 'COMPLETED',
              amount: {
                currency_code: 'USD',
                value: '49.99'
              },
              seller_receivable_breakdown: {
                gross_amount: { currency_code: 'USD', value: '49.99' },
                paypal_fee: { currency_code: 'USD', value: '1.75' },
                net_amount: { currency_code: 'USD', value: '48.24' }
              }
            }]
          }
        }]
      }
    });
    
    const response = await request(server)
      .post('/api/payments/capture-paypal-order')
      .send({
        orderID: paypalOrderId,
        orderId: testOrderId
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBeDefined();
    expect(['COMPLETED', 'PENDING', 'CREATED']).toContain(response.body.status);
  });
});
