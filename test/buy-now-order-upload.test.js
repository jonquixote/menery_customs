// test/test-buy-now-order-upload.js
// Integration test: clicking Buy Now saves order and uploads video to S3

const request = require('supertest');
const app = require('../src/server'); // Adjust if your Express app is exported elsewhere
const { Order } = require('../src/models');
const fs = require('fs');
const path = require('path');


const TEST_EMAIL = 'testuser@example.com';
const VIDEO_PATH = path.resolve(__dirname, '../videoplayback.mp4');
const VIDEO_FILE = fs.readFileSync(VIDEO_PATH);
const FILE_NAME = 'videoplayback.mp4';
const FILE_TYPE = 'video/mp4';
const FILE_SIZE = VIDEO_FILE.length;
const DURATION = 30;

describe('Buy Now Order + S3 Upload', () => {

  let videoKey;
  let orderId;

  it('should upload video and get a key', async () => {
    // Step 1: Initiate upload
    const res = await request(app)
      .post('/api/upload/initiate')
      .send({ fileName: FILE_NAME, fileType: FILE_TYPE, fileSize: FILE_SIZE, duration: DURATION });
    expect(res.statusCode).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.key).toBeDefined();
    videoKey = res.body.key;

    // Step 2: Upload to S3 using presigned URL
    const s3Res = await request(res.body.uploadUrl)
      .put('')
      .set('Content-Type', FILE_TYPE)
      .send(VIDEO_FILE);
    expect(s3Res.statusCode).toBe(200);
  });

  it('should create an order with the uploaded video key and save to DB', async () => {
    const orderData = {
      name: 'Test User',
      email: TEST_EMAIL,
      phone: '1234567890',
      duration: DURATION,
      amount: 200,
      videoKey,
      instructions: 'Test instructions',
      paymentMethod: 'square', // Only save, no payment
      isTest: true
    };
    const res = await request(app)
      .post('/api/orders')
      .send(orderData);
    // Accept 200 or 201 for successful creation
    expect([200, 201]).toContain(res.statusCode);
    // Accept either id or orderId in response
    const savedOrderId = res.body.id || res.body.orderId;
    expect(savedOrderId).toBeDefined();
    orderId = savedOrderId;

    // Check order exists in DB
    const order = await Order.findByPk(orderId);
    expect(order).not.toBeNull();
    // Accept either customerEmail or email field
    expect(order.customerEmail || order.email).toBe(TEST_EMAIL);
    expect(order.videoKey || order.originalVideoKey).toBe(videoKey);
    expect(order.paymentMethod).toBe('square');
  });

  afterAll(() => {
    // No cleanup needed for real video file
  });
});
