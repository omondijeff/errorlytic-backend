const axios = require('axios');
const crypto = require('crypto');

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = 'https://api.paystack.co';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate a unique transaction reference
   */
  generateReference(prefix = 'ERR') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Initialize a transaction
   * @param {Object} params - Transaction parameters
   * @param {string} params.email - Customer email
   * @param {number} params.amount - Amount in kobo (for NGN) or cents
   * @param {string} params.currency - Currency code (NGN, GHS, ZAR, USD)
   * @param {string} params.reference - Unique transaction reference
   * @param {string} params.callbackUrl - URL to redirect after payment
   * @param {Object} params.metadata - Additional data to attach
   */
  async initializeTransaction({
    email,
    amount,
    currency = 'KES',
    reference,
    callbackUrl,
    metadata = {},
  }) {
    try {
      // Paystack expects amount in lowest currency unit (kobo/cents)
      const amountInLowest = Math.round(amount * 100);
      const ref = reference || this.generateReference();

      const response = await this.axiosInstance.post('/transaction/initialize', {
        email,
        amount: amountInLowest,
        currency,
        reference: ref,
        callback_url: callbackUrl,
        metadata,
      });

      return {
        success: true,
        data: {
          reference: ref,
          authorizationUrl: response.data.data.authorization_url,
          accessCode: response.data.data.access_code,
        },
      };
    } catch (error) {
      console.error('Paystack initialize error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to initialize transaction',
      };
    }
  }

  /**
   * Verify a transaction
   * @param {string} reference - Transaction reference
   */
  async verifyTransaction(reference) {
    try {
      const response = await this.axiosInstance.get(`/transaction/verify/${reference}`);
      const data = response.data.data;

      return {
        success: true,
        data: {
          status: data.status,
          reference: data.reference,
          amount: data.amount / 100, // Convert from lowest unit
          currency: data.currency,
          paidAt: data.paid_at,
          channel: data.channel,
          transactionId: data.id.toString(),
          authorization: data.authorization ? {
            authorizationCode: data.authorization.authorization_code,
            cardType: data.authorization.card_type,
            last4: data.authorization.last4,
            bank: data.authorization.bank,
            brand: data.authorization.brand,
            countryCode: data.authorization.country_code,
            reusable: data.authorization.reusable,
          } : null,
          customer: {
            id: data.customer.id,
            email: data.customer.email,
          },
          metadata: data.metadata,
        },
      };
    } catch (error) {
      console.error('Paystack verify error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to verify transaction',
      };
    }
  }

  /**
   * Create or update a customer
   * @param {Object} params - Customer details
   */
  async createCustomer({ email, firstName, lastName, phone, metadata = {} }) {
    try {
      const response = await this.axiosInstance.post('/customer', {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        metadata,
      });

      return {
        success: true,
        data: {
          customerId: response.data.data.customer_code,
          email: response.data.data.email,
          id: response.data.data.id,
        },
      };
    } catch (error) {
      console.error('Paystack create customer error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create customer',
      };
    }
  }

  /**
   * Create a subscription plan
   * @param {Object} params - Plan details
   */
  async createPlan({ name, amount, interval, currency = 'KES', description }) {
    try {
      const response = await this.axiosInstance.post('/plan', {
        name,
        amount: Math.round(amount * 100), // Convert to lowest unit
        interval, // 'daily', 'weekly', 'monthly', 'quarterly', 'annually'
        currency,
        description,
      });

      return {
        success: true,
        data: {
          planCode: response.data.data.plan_code,
          name: response.data.data.name,
          amount: response.data.data.amount / 100,
          interval: response.data.data.interval,
        },
      };
    } catch (error) {
      console.error('Paystack create plan error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create plan',
      };
    }
  }

  /**
   * Subscribe a customer to a plan
   * @param {Object} params - Subscription details
   */
  async createSubscription({ customerEmail, planCode, authorizationCode, startDate }) {
    try {
      const response = await this.axiosInstance.post('/subscription', {
        customer: customerEmail,
        plan: planCode,
        authorization: authorizationCode,
        start_date: startDate,
      });

      return {
        success: true,
        data: {
          subscriptionCode: response.data.data.subscription_code,
          status: response.data.data.status,
          nextPaymentDate: response.data.data.next_payment_date,
        },
      };
    } catch (error) {
      console.error('Paystack create subscription error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create subscription',
      };
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionCode - Subscription code
   * @param {string} emailToken - Email token for the subscription
   */
  async cancelSubscription(subscriptionCode, emailToken) {
    try {
      const response = await this.axiosInstance.post('/subscription/disable', {
        code: subscriptionCode,
        token: emailToken,
      });

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      console.error('Paystack cancel subscription error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to cancel subscription',
      };
    }
  }

  /**
   * Charge an authorization (for recurring payments)
   * @param {Object} params - Charge details
   */
  async chargeAuthorization({ email, amount, authorizationCode, currency = 'KES', reference, metadata = {} }) {
    try {
      const ref = reference || this.generateReference('CHG');
      const response = await this.axiosInstance.post('/transaction/charge_authorization', {
        email,
        amount: Math.round(amount * 100),
        authorization_code: authorizationCode,
        currency,
        reference: ref,
        metadata,
      });

      return {
        success: true,
        data: {
          reference: response.data.data.reference,
          status: response.data.data.status,
          amount: response.data.data.amount / 100,
          transactionId: response.data.data.id.toString(),
        },
      };
    } catch (error) {
      console.error('Paystack charge authorization error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to charge authorization',
      };
    }
  }

  /**
   * Refund a transaction
   * @param {Object} params - Refund details
   */
  async refundTransaction({ transactionId, amount, currency, reason }) {
    try {
      const response = await this.axiosInstance.post('/refund', {
        transaction: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
        currency,
        customer_note: reason,
      });

      return {
        success: true,
        data: {
          status: response.data.data.status,
          amount: response.data.data.amount / 100,
          transactionId: response.data.data.transaction.id,
        },
      };
    } catch (error) {
      console.error('Paystack refund error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to process refund',
      };
    }
  }

  /**
   * Validate a webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - X-Paystack-Signature header
   */
  validateWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event data
   */
  processWebhookEvent(event) {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'charge.success':
        return {
          type: 'payment_success',
          reference: data.reference,
          amount: data.amount / 100,
          currency: data.currency,
          transactionId: data.id.toString(),
          channel: data.channel,
          paidAt: data.paid_at,
          authorization: data.authorization,
          customer: data.customer,
          metadata: data.metadata,
        };

      case 'charge.failed':
        return {
          type: 'payment_failed',
          reference: data.reference,
          amount: data.amount / 100,
          currency: data.currency,
          failureMessage: data.gateway_response,
        };

      case 'subscription.create':
        return {
          type: 'subscription_created',
          subscriptionCode: data.subscription_code,
          planCode: data.plan.plan_code,
          customerEmail: data.customer.email,
          nextPaymentDate: data.next_payment_date,
        };

      case 'subscription.disable':
        return {
          type: 'subscription_cancelled',
          subscriptionCode: data.subscription_code,
          customerEmail: data.customer.email,
        };

      case 'invoice.payment_failed':
        return {
          type: 'subscription_payment_failed',
          subscriptionCode: data.subscription.subscription_code,
          customerEmail: data.customer.email,
        };

      default:
        return {
          type: 'unknown',
          eventType,
          data,
        };
    }
  }

  /**
   * Get list of supported banks
   * @param {string} country - Country code (NG, GH, ZA, KE)
   */
  async getBanks(country = 'KE') {
    try {
      const response = await this.axiosInstance.get(`/bank?country=${country}`);
      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      console.error('Paystack get banks error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get banks list',
      };
    }
  }
}

module.exports = new PaystackService();
