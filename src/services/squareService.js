const { SquareClient, SquareEnvironment } = require('square');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class SquareService {
  constructor() {
    this.client = null;
    this._initialized = false;
    this._initializationError = null;
    this.locationId = null;
    this.webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    this._initialize();
  }

  async _initialize() {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const env = process.env.SQUARE_ENVIRONMENT?.toLowerCase();
    this.locationId = process.env.SQUARE_LOCATION_ID;

    if (!accessToken || !env || !this.locationId) {
      this._initializationError = new Error('Square credentials are not properly configured.');
      console.error(this._initializationError.message);
      return;
    }

    this.client = new SquareClient({
      environment: env === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
      accessToken: accessToken,
    });

    this._initialized = true;
    console.log(`✅ Square service initialized successfully in ${env} mode.`);
  }

  isInitialized() {
    return this._initialized;
  }

  async createPayment({ sourceId, amount, orderId }) {
    if (!this.isInitialized()) {
      throw new Error('Square service is not properly initialized');
    }

    try {
      const { result } = await this.client.paymentsApi.createPayment({
        sourceId,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(amount),
          currency: 'USD',
        },
        orderId,
        locationId: this.locationId,
      });

      return result.payment;
    } catch (error) {
      console.error('Error creating Square payment:', error);
      throw new Error('Failed to create Square payment.');
    }
  }

  // ... other methods ...
}

module.exports = new SquareService();
