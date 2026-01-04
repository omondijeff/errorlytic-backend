const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const creditService = require('../services/creditService');
const featureGateService = require('../services/featureGateService');

/**
 * @route GET /api/v1/credits/packs
 * @desc Get available credit packs
 * @access Public
 */
router.get('/packs', async (req, res) => {
  try {
    const packs = await creditService.getCreditPacks();

    res.json({
      success: true,
      data: packs,
    });
  } catch (error) {
    console.error('Get credit packs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit packs',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/credits/balance
 * @desc Get user's credit balance
 * @access Private
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const balance = await creditService.getBalance(req.user._id);

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit balance',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/v1/credits/purchase
 * @desc Initialize a credit pack purchase
 * @access Private
 */
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const {
      packType,
      paymentMethod,
      currency,
      promoCode,
      phoneNumber,
    } = req.body;

    if (!packType) {
      return res.status(400).json({
        success: false,
        error: 'Pack type is required',
      });
    }

    if (!paymentMethod || !['paystack', 'mpesa'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Valid payment method is required (paystack or mpesa)',
      });
    }

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required for M-Pesa payment',
      });
    }

    // Get callback URL from environment or request
    const callbackUrl = process.env.PAYMENT_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/v1/payments/callback/paystack`;

    const result = await creditService.initializePurchase({
      userId: req.user._id,
      packType,
      paymentMethod,
      currency: currency || 'KES',
      promoCode,
      phoneNumber,
      callbackUrl,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Purchase initialization error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to initialize purchase',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/credits/history
 * @desc Get user's purchase history
 * @access Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const result = await creditService.getPurchaseHistory(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    res.json({
      success: true,
      data: result.purchases,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get purchase history',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/credits/features
 * @desc Get user's feature access
 * @access Private
 */
router.get('/features', authMiddleware, async (req, res) => {
  try {
    const features = await featureGateService.getAllFeatureAccess(req.user._id);

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    console.error('Get features error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get feature access',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/v1/credits/can-analyze
 * @desc Check if user can perform an analysis
 * @access Private
 */
router.get('/can-analyze', authMiddleware, async (req, res) => {
  try {
    const permission = await featureGateService.canPerformAnalysis(req.user._id);

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error('Check analyze permission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check analysis permission',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/v1/credits/add
 * @desc Add complimentary credits (admin only)
 * @access Private - Superadmin
 */
router.post(
  '/add',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { userId, credits, reason } = req.body;

      if (!userId || !credits) {
        return res.status(400).json({
          success: false,
          error: 'User ID and credits amount are required',
        });
      }

      if (credits < 1 || credits > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Credits must be between 1 and 1000',
        });
      }

      const result = await creditService.addComplimentaryCredits(
        userId,
        credits,
        reason || 'Admin added'
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Add credits error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add credits',
        message: error.message,
      });
    }
  }
);

/**
 * @route POST /api/v1/credits/promo/validate
 * @desc Validate a promo code
 * @access Private
 */
router.post('/promo/validate', authMiddleware, async (req, res) => {
  try {
    const { code, packType, currency = 'KES' } = req.body;

    if (!code || !packType) {
      return res.status(400).json({
        success: false,
        error: 'Promo code and pack type are required',
      });
    }

    const PricingConfig = require('../models/PricingConfig');
    const config = await PricingConfig.getActive();

    // Get pack to calculate amount
    const pack = config.individual.creditPacks.find(p => p.type === packType);
    if (!pack) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pack type',
      });
    }

    const amount = pack.pricing[currency];
    const result = config.validatePromoCode(code, 'credits', currency, amount);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        code: result.promo.code,
        discountType: result.promo.discountType,
        discountValue: result.promo.discountValue,
        discount: result.discount,
        originalAmount: amount,
        finalAmount: result.finalAmount,
        currency,
      },
    });
  } catch (error) {
    console.error('Validate promo error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate promo code',
      message: error.message,
    });
  }
});

module.exports = router;
