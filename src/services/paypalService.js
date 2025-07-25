const axios = require('axios');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY;
const PAYPAL_SANDBOX_URL = process.env.PAYPAL_SANDBOX_URL || 'https://api-m.sandbox.paypal.com';

// Helper function to get auth headers
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`).toString('base64')}`,
    'PayPal-Request-Id': `menery-${Date.now()}`
});

class PaypalService {
    static async createOrder(orderData) {
        const { amount, description, redirectUrl } = orderData;

        if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
            throw new Error('PayPal credentials are not configured. Please check your .env file.');
        }

        try {
            const response = await axios.post(
                `${PAYPAL_SANDBOX_URL}/v2/checkout/orders`,
                {
                    intent: 'CAPTURE',
                    purchase_units: [{
                        amount: {
                            currency_code: 'USD',
                            value: amount.toString(),
                            breakdown: {
                                item_total: {
                                    currency_code: 'USD',
                                    value: amount.toString()
                                }
                            }
                        },
                        description: description,
                        custom_id: orderData.orderId, // Link to our internal order ID
                        invoice_id: `INV-${Date.now()}`
                    }],
                    payment_source: {
                        paypal: {
                            experience_context: {
                                payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                                brand_name: 'Bob Menery Voiceovers',
                                locale: 'en-US',
                                landing_page: 'NO_PREFERENCE',
                                shipping_preference: 'NO_SHIPPING',
                                user_action: 'PAY_NOW',
                                return_url: redirectUrl,
                                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/cancel`
                            }
                        }
                    }
                },
                { headers: getAuthHeaders() }
            );

            if (response.data && response.data.id) {
                return {
                    orderId: response.data.id,
                    orderStatus: response.data.status,
                    paypalRedirectUrl: response.data.links.find(link => link.rel === 'approve')?.href
                };
            } else {
                throw new Error('Failed to create PayPal order: Invalid response from PayPal API.');
            }
        } catch (error) {
            console.error('Error creating PayPal order:', error.response ? error.response.data : error.message);
            throw new Error('Failed to create PayPal order: ' + (error.response?.data?.message || error.message));
        }
    }

    static async capturePayment(orderId) {
        if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
            throw new Error('PayPal credentials are not configured. Please check your .env file.');
        }

        try {
            const response = await axios.post(
                `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}/capture`,
                {},
                { headers: getAuthHeaders() }
            );

            if (response.data && response.data.id) {
                return {
                    paymentId: response.data.id,
                    status: response.data.status,
                    payer: response.data.payer,
                    amount: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value,
                    currency: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code,
                    paypalData: response.data
                };
            } else {
                throw new Error('Failed to capture PayPal payment: Invalid response from PayPal API.');
            }
        } catch (error) {
            console.error('Error capturing PayPal payment:', error.response ? error.response.data : error.message);
            throw new Error('Failed to capture PayPal payment: ' + (error.response?.data?.message || error.message));
        }
    }

    static async getPaymentStatus(orderId) {
        if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
            throw new Error('PayPal credentials are not configured. Please check your .env file.');
        }

        try {
            const response = await axios.get(
                `${PAYPAL_SANDBOX_URL}/v2/checkout/orders/${orderId}`,
                { headers: getAuthHeaders() }
            );

            if (response.data) {
                return {
                    status: response.data.status,
                    orderId: response.data.id,
                    amount: response.data.purchase_units?.[0]?.amount?.value,
                    currency: response.data.purchase_units?.[0]?.amount?.currency_code,
                    createTime: response.data.create_time,
                    updateTime: response.data.update_time,
                    paypalData: response.data
                };
            } else {
                throw new Error('Failed to get PayPal order status: Invalid response from PayPal API.');
            }
        } catch (error) {
            console.error('Error getting PayPal order status:', error.response ? error.response.data : error.message);
            throw new Error('Failed to get PayPal order status: ' + (error.response?.data?.message || error.message));
        }
    }
}

module.exports = PaypalService;
