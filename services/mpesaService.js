const axios = require('axios');
const crypto = require('crypto');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE || '174379'; // Sandbox default
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.environment = process.env.MPESA_ENV || 'sandbox';

    this.baseUrl = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate OAuth access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 50 minutes (tokens expire in 1 hour)
      this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('M-Pesa auth error:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  /**
   * Generate password for STK push
   */
  generatePassword() {
    const timestamp = this.getTimestamp();
    const data = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Get current timestamp in YYYYMMDDHHmmss format
   */
  getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format phone number for M-Pesa (must be 254XXXXXXXXX format)
   */
  formatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('0')) {
      // Kenyan format: 0712345678 -> 254712345678
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('+')) {
      // International format: +254712345678 -> 254712345678
      cleaned = cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      // Assume Kenyan number without prefix
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  /**
   * Generate unique account reference
   */
  generateAccountReference(prefix = 'ERR') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(2).toString('hex');
    return `${prefix}${timestamp}${random}`.toUpperCase().substring(0, 12);
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   * @param {Object} params - Payment parameters
   * @param {string} params.phoneNumber - Customer phone number
   * @param {number} params.amount - Amount to charge (in KES)
   * @param {string} params.accountReference - Unique reference (max 12 chars)
   * @param {string} params.transactionDesc - Description (max 13 chars)
   */
  async initiateSTKPush({ phoneNumber, amount, accountReference, transactionDesc = 'Payment' }) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const reference = accountReference || this.generateAccountReference();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.ceil(amount), // M-Pesa only accepts whole numbers
          PartyA: formattedPhone,
          PartyB: this.shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: this.callbackUrl,
          AccountReference: reference.substring(0, 12),
          TransactionDesc: transactionDesc.substring(0, 13),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      if (data.ResponseCode === '0') {
        return {
          success: true,
          data: {
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
            responseDescription: data.ResponseDescription,
            customerMessage: data.CustomerMessage,
            accountReference: reference,
            phoneNumber: formattedPhone,
            amount: Math.ceil(amount),
          },
        };
      } else {
        return {
          success: false,
          error: data.ResponseDescription || 'STK push initiation failed',
          errorCode: data.ResponseCode,
        };
      }
    } catch (error) {
      console.error('M-Pesa STK push error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Failed to initiate M-Pesa payment',
      };
    }
  }

  /**
   * Query STK Push status
   * @param {string} checkoutRequestId - CheckoutRequestID from initiateSTKPush
   */
  async querySTKStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      // Result codes:
      // 0 = Success
      // 1032 = Cancelled by user
      // 1037 = Timeout
      // 2001 = Wrong PIN
      if (data.ResultCode === '0' || data.ResultCode === 0) {
        return {
          success: true,
          status: 'completed',
          data: {
            resultCode: data.ResultCode,
            resultDescription: data.ResultDesc,
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
          },
        };
      } else {
        return {
          success: true,
          status: data.ResultCode === '1032' ? 'cancelled' : 'failed',
          data: {
            resultCode: data.ResultCode,
            resultDescription: data.ResultDesc,
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
          },
        };
      }
    } catch (error) {
      // If error message contains "being processed", payment is still pending
      if (error.response?.data?.errorMessage?.includes('processed')) {
        return {
          success: true,
          status: 'pending',
          data: {
            checkoutRequestId,
            message: 'Payment is being processed',
          },
        };
      }

      console.error('M-Pesa query error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Failed to query payment status',
      };
    }
  }

  /**
   * Process STK callback
   * @param {Object} callbackData - Callback data from M-Pesa
   */
  processSTKCallback(callbackData) {
    try {
      const stkCallback = callbackData.Body?.stkCallback;

      if (!stkCallback) {
        return {
          success: false,
          error: 'Invalid callback data structure',
        };
      }

      const merchantRequestId = stkCallback.MerchantRequestID;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      // Result code 0 means success
      if (resultCode === 0) {
        // Parse callback metadata
        const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
        const metadata = {};

        callbackMetadata.forEach(item => {
          metadata[item.Name] = item.Value;
        });

        return {
          success: true,
          status: 'completed',
          data: {
            merchantRequestId,
            checkoutRequestId,
            resultCode,
            resultDescription: resultDesc,
            amount: metadata.Amount,
            mpesaReceiptNumber: metadata.MpesaReceiptNumber,
            transactionDate: metadata.TransactionDate?.toString(),
            phoneNumber: metadata.PhoneNumber?.toString(),
          },
        };
      } else {
        // Payment failed or was cancelled
        return {
          success: true,
          status: resultCode === 1032 ? 'cancelled' : 'failed',
          data: {
            merchantRequestId,
            checkoutRequestId,
            resultCode,
            resultDescription: resultDesc,
          },
        };
      }
    } catch (error) {
      console.error('M-Pesa callback processing error:', error);
      return {
        success: false,
        error: 'Failed to process callback',
      };
    }
  }

  /**
   * Register C2B URLs (for paybill confirmation)
   * @param {Object} params - Registration parameters
   */
  async registerC2BUrls({ confirmationUrl, validationUrl }) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/c2b/v1/registerurl`,
        {
          ShortCode: this.shortcode,
          ResponseType: 'Completed',
          ConfirmationURL: confirmationUrl,
          ValidationURL: validationUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('M-Pesa C2B registration error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Failed to register C2B URLs',
      };
    }
  }

  /**
   * Check account balance
   */
  async checkBalance() {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/mpesa/accountbalance/v1/query`,
        {
          Initiator: process.env.MPESA_INITIATOR_NAME,
          SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
          CommandID: 'AccountBalance',
          PartyA: this.shortcode,
          IdentifierType: '4',
          Remarks: 'Balance check',
          QueueTimeOutURL: `${this.callbackUrl}/timeout`,
          ResultURL: `${this.callbackUrl}/balance`,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('M-Pesa balance check error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Failed to check balance',
      };
    }
  }
}

module.exports = new MpesaService();
