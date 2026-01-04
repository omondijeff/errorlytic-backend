const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const creditService = require('../services/creditService');
const paystackService = require('../services/paystackService');
const mpesaService = require('../services/mpesaService');
const Payment = require('../models/Payment');

/**
 * @route GET /api/v1/payments/verify/:reference
 * @desc Verify a Paystack payment
 * @access Private
 */
router.get('/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required',
      });
    }

    const result = await creditService.verifyPaystackPayment(reference);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(400).json({
      success: false,
      error: 'Payment verification failed',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/payments/mpesa/status/:checkoutRequestId
 * @desc Check M-Pesa payment status
 * @access Private
 */
router.get('/mpesa/status/:checkoutRequestId', authMiddleware, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        error: 'Checkout request ID is required',
      });
    }

    const result = await creditService.checkMpesaStatus(checkoutRequestId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Check M-Pesa status error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to check payment status',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/v1/payments/webhook/paystack
 * @desc Handle Paystack webhook
 * @access Public (but validated)
 */
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get signature from header
    const signature = req.headers['x-paystack-signature'];

    // Get raw body
    const payload = req.body.toString();

    // Validate signature
    if (!paystackService.validateWebhookSignature(payload, signature)) {
      console.error('Invalid Paystack webhook signature');
      return res.status(401).send('Unauthorized');
    }

    // Parse the event
    const event = JSON.parse(payload);

    console.log('Paystack webhook event:', event.event);

    // Process the event
    const processedEvent = paystackService.processWebhookEvent(event);

    switch (processedEvent.type) {
      case 'payment_success':
        // Verify and process the payment
        try {
          await creditService.verifyPaystackPayment(processedEvent.reference);
          console.log('Paystack payment processed:', processedEvent.reference);
        } catch (error) {
          console.error('Error processing Paystack payment:', error.message);
        }
        break;

      case 'payment_failed':
        console.log('Paystack payment failed:', processedEvent.reference, processedEvent.failureMessage);
        // Optionally update the purchase record
        break;

      case 'subscription_created':
        console.log('Paystack subscription created:', processedEvent.subscriptionCode);
        // Handle subscription creation
        break;

      case 'subscription_cancelled':
        console.log('Paystack subscription cancelled:', processedEvent.subscriptionCode);
        // Handle subscription cancellation
        break;

      case 'subscription_payment_failed':
        console.log('Paystack subscription payment failed:', processedEvent.subscriptionCode);
        // Handle failed subscription payment
        break;

      default:
        console.log('Unhandled Paystack event:', processedEvent.type);
    }

    // Acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * @route POST /api/v1/payments/webhook/mpesa
 * @desc Handle M-Pesa STK callback
 * @access Public (from Safaricom)
 */
router.post('/webhook/mpesa', async (req, res) => {
  try {
    console.log('M-Pesa callback received:', JSON.stringify(req.body, null, 2));

    // Process the callback
    const result = await creditService.processMpesaCallback(req.body);

    console.log('M-Pesa callback processed:', result);

    // Always respond with success to M-Pesa
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success',
    });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);

    // Still respond with success to prevent retries
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success',
    });
  }
});

/**
 * @route GET /api/v1/payments/callback/paystack
 * @desc Handle Paystack redirect callback
 * @access Public
 */
router.get('/callback/paystack', async (req, res) => {
  try {
    const { reference, trxref } = req.query;
    const ref = reference || trxref;

    if (!ref) {
      return res.redirect(`${process.env.FRONTEND_URL}/credits?error=no_reference`);
    }

    // Verify the payment
    const result = await creditService.verifyPaystackPayment(ref);

    if (result.success) {
      // Redirect to success page
      res.redirect(
        `${process.env.FRONTEND_URL}/credits/success?` +
        `reference=${ref}&credits=${result.credits}&balance=${result.newBalance}`
      );
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/credits?error=payment_failed`);
    }
  } catch (error) {
    console.error('Paystack callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/credits?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * @route GET /api/v1/payments/history
 * @desc Get user's payment history
 * @access Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;

    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (type) query.type = type;

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/payments/banks
 * @desc Get list of supported banks
 * @access Public
 */
router.get('/banks', async (req, res) => {
  try {
    const { country = 'KE' } = req.query;
    const result = await paystackService.getBanks(country);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get banks list',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/v1/payments/refund
 * @desc Request a refund (admin only)
 * @access Private - Superadmin
 */
router.post(
  '/refund',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { paymentId, amount, reason } = req.body;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID is required',
        });
      }

      const payment = await Payment.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      if (payment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Only completed payments can be refunded',
        });
      }

      // Process refund based on payment method
      let refundResult;

      if (payment.paymentMethod === 'paystack' && payment.paystack?.transactionId) {
        refundResult = await paystackService.refundTransaction({
          transactionId: payment.paystack.transactionId,
          amount,
          currency: payment.amount.currency,
          reason,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Refund not supported for this payment method',
        });
      }

      if (!refundResult.success) {
        return res.status(400).json({
          success: false,
          error: refundResult.error,
        });
      }

      // Update payment status
      payment.status = 'refunded';
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      await payment.save();

      res.json({
        success: true,
        data: {
          paymentId: payment._id,
          refundAmount: refundResult.data.amount,
          status: 'refunded',
        },
      });
    } catch (error) {
      console.error('Refund error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process refund',
        message: error.message,
      });
    }
  }
);

module.exports = router;
