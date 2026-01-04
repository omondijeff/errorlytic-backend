const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const billingService = require("../services/billingService");
const stripeService = require("../services/stripeService");
const invoiceService = require("../services/invoiceService");
const fraudDetectionService = require("../services/fraudDetectionService");
const billingDashboardService = require("../services/billingDashboardService");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");

const router = express.Router();

/**
 * @swagger
 * /api/v1/billing/subscribe:
 *   post:
 *     summary: Create subscription
 *     description: Create a new subscription for the user
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planTier
 *             properties:
 *               planTier:
 *                 type: string
 *                 enum: [basic, pro, enterprise]
 *                 example: pro
 *               currency:
 *                 type: string
 *                 enum: [KES, UGX, TZS, USD]
 *                 default: KES
 *                 example: KES
 *               orgId:
 *                 type: string
 *                 description: Organization ID (optional)
 *                 example: 507f1f77bcf86cd799439012
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: subscription_created
 *               title: Subscription Created Successfully
 *               detail: Subscription has been created successfully
 *               data:
 *                 subscription:
 *                   _id: 507f1f77bcf86cd799439019
 *                   plan:
 *                     tier: pro
 *                     name: Pro (Garages)
 *                     price:
 *                       amount: 7500
 *                       currency: KES
 *                   status: trial
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/subscribe",
  authMiddleware,
  [
    body("planTier")
      .isIn(["basic", "pro", "enterprise"])
      .withMessage("Invalid plan tier"),
    body("currency")
      .optional()
      .isIn(["KES", "UGX", "TZS", "USD"])
      .withMessage("Invalid currency"),
    body("orgId").optional().isMongoId().withMessage("Invalid organization ID"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Error",
          detail: errors.array()[0].msg,
          status: 400,
        });
      }

      const { planTier, currency = "KES", orgId } = req.body;
      const userId = req.user._id;

      const result = await billingService.createSubscription(
        userId,
        planTier,
        currency,
        orgId
      );

      res.status(201).json({
        type: "subscription_created",
        title: "Subscription Created Successfully",
        detail: "Subscription has been created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(400).json({
        type: "subscription_error",
        title: "Subscription Error",
        detail: error.message,
        status: 400,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/billing/usage:
 *   get:
 *     summary: Get billing information
 *     description: Get user's billing information including subscription, payments, and usage
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: billing_info_retrieved
 *               title: Billing Information Retrieved Successfully
 *               data:
 *                 subscription:
 *                   plan:
 *                     tier: pro
 *                     name: Pro (Garages)
 *                   status: trial
 *                   usage:
 *                     currentPeriod:
 *                       apiCalls:
 *                         used: 15
 *                         limit: 500
 *                 payments: []
 *                 invoices: []
 *                 usage:
 *                   analysis: 10
 *                   quotation: 5
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/usage", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await billingService.getBillingInfo(userId);

    res.json({
      type: "billing_info_retrieved",
      title: "Billing Information Retrieved Successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Get billing info error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while retrieving billing information",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/plans:
 *   get:
 *     summary: Get available plans
 *     description: Get all available subscription plans with pricing
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: plans_retrieved
 *               title: Plans Retrieved Successfully
 *               data:
 *                 plans:
 *                   basic:
 *                     name: Basic (Individuals/Communities)
 *                     price:
 *                       KES: 1300
 *                       USD: 10
 *                     features:
 *                       apiCalls:
 *                         included: 50
 *                       analysis: true
 *                       walkthrough: false
 */
router.get("/plans", async (req, res) => {
  try {
    res.json({
      type: "plans_retrieved",
      title: "Plans Retrieved Successfully",
      data: {
        plans: billingService.pricing.plans,
        bundles: billingService.pricing.bundles,
        apiCallRates: billingService.pricing.apiCallRates,
      },
    });
  } catch (error) {
    console.error("Get plans error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while retrieving plans",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/payments:
 *   get:
 *     summary: Get payment history
 *     description: Get user's payment history
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/payments", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({ userId, isActive: true });

    res.json({
      type: "payments_retrieved",
      title: "Payment History Retrieved Successfully",
      data: {
        payments,
        meta: {
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while retrieving payments",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/invoices:
 *   get:
 *     summary: Get invoice history
 *     description: Get user's invoice history
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Invoice history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/invoices", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments({ userId, isActive: true });

    res.json({
      type: "invoices_retrieved",
      title: "Invoice History Retrieved Successfully",
      data: {
        invoices,
        meta: {
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while retrieving invoices",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/subscription/{subscriptionId}/invoice:
 *   post:
 *     summary: Generate invoice
 *     description: Generate invoice for a subscription
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *         example: 507f1f77bcf86cd799439019
 *     responses:
 *       201:
 *         description: Invoice generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/subscription/:subscriptionId/invoice",
  authMiddleware,
  async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const userId = req.user._id;

      // Verify subscription belongs to user
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId,
        isActive: true,
      });

      if (!subscription) {
        return res.status(404).json({
          type: "subscription_not_found",
          title: "Subscription Not Found",
          detail: "Subscription not found or does not belong to user",
          status: 404,
        });
      }

      const result = await billingService.generateInvoice(subscriptionId);

      res.status(201).json({
        type: "invoice_generated",
        title: "Invoice Generated Successfully",
        detail: "Invoice has been generated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Generate invoice error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while generating invoice",
        status: 500,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/billing/invoice/{invoiceId}/pdf:
 *   get:
 *     summary: Download invoice PDF
 *     description: Generate and download invoice as PDF
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *         example: 507f1f77bcf86cd799439020
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/invoice/:invoiceId/pdf", authMiddleware, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user._id;

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId,
      isActive: true,
    });

    if (!invoice) {
      return res.status(404).json({
        type: "invoice_not_found",
        title: "Invoice Not Found",
        detail: "Invoice not found or does not belong to user",
        status: 404,
      });
    }

    // Generate PDF
    const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Generate invoice PDF error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while generating the invoice PDF",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/invoice/{invoiceId}/email:
 *   post:
 *     summary: Send invoice via email
 *     description: Send invoice as PDF attachment via email
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *         example: 507f1f77bcf86cd799439020
 *     responses:
 *       200:
 *         description: Invoice sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/invoice/:invoiceId/email", authMiddleware, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user._id;

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId,
      isActive: true,
    });

    if (!invoice) {
      return res.status(404).json({
        type: "invoice_not_found",
        title: "Invoice Not Found",
        detail: "Invoice not found or does not belong to user",
        status: 404,
      });
    }

    // Send email
    const result = await invoiceService.sendInvoiceEmail(invoiceId);

    res.json({
      type: "invoice_sent",
      title: "Invoice Sent Successfully",
      detail: "Invoice has been sent via email",
      data: result,
    });
  } catch (error) {
    console.error("Send invoice email error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while sending the invoice email",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/dashboard:
 *   get:
 *     summary: Get billing dashboard data
 *     description: Get comprehensive billing dashboard with charts, stats, and alerts
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *         description: Chart period for data visualization
 *         example: monthly
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: dashboard_data_retrieved
 *               title: Dashboard Data Retrieved Successfully
 *               data:
 *                 subscription:
 *                   hasSubscription: true
 *                   subscription:
 *                     plan:
 *                       tier: pro
 *                       name: Pro (Garages)
 *                     status: trial
 *                     isTrialActive: true
 *                     daysUntilRenewal: 3
 *                 usageStats:
 *                   totalCalls: 150
 *                   avgCallsPerDay: 5
 *                 paymentStats:
 *                   totalPayments: 2
 *                   totalAmount: 15000
 *                 alerts:
 *                   - type: warning
 *                     title: Trial Ending Soon
 *                     message: Your trial ends in 3 day(s)
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const period = req.query.period || "monthly";

    const result = await billingDashboardService.getDashboardData(
      userId,
      orgId,
      period
    );

    res.json({
      type: "dashboard_data_retrieved",
      title: "Dashboard Data Retrieved Successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Get dashboard data error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while retrieving dashboard data",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/fraud/analyze:
 *   post:
 *     summary: Analyze user for fraud indicators
 *     description: Perform comprehensive fraud analysis on user behavior
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 properties:
 *                   userAgent:
 *                     type: string
 *                     example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                   ipAddress:
 *                     type: string
 *                     example: "192.168.1.1"
 *                   country:
 *                     type: string
 *                     example: "KE"
 *                   timezone:
 *                     type: string
 *                     example: "Africa/Nairobi"
 *     responses:
 *       200:
 *         description: Fraud analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: fraud_analysis_completed
 *               title: Fraud Analysis Completed
 *               data:
 *                 overallScore: 25
 *                 riskLevel: low
 *                 scores:
 *                   apiUsage: 20
 *                   payments: 10
 *                   analysis: 30
 *                   quotations: 15
 *                   device: 25
 *                   location: 10
 *                 recommendations: []
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/fraud/analyze", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const context = req.body.context || {};

    // Add request context
    context.userAgent = req.headers["user-agent"];
    context.ipAddress = req.ip || req.connection.remoteAddress;

    const result = await fraudDetectionService.analyzeUserBehavior(
      userId,
      orgId,
      context
    );

    // Log fraud detection event
    await fraudDetectionService.logFraudEvent(userId, result.data);

    res.json({
      type: "fraud_analysis_completed",
      title: "Fraud Analysis Completed",
      data: result.data,
    });
  } catch (error) {
    console.error("Fraud analysis error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred during fraud analysis",
      status: 500,
    });
  }
});

/**
 * @swagger
 * /api/v1/billing/fraud/rules:
 *   get:
 *     summary: Get fraud detection rules
 *     description: Get current fraud detection rules and thresholds
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fraud detection rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/fraud/rules",
  authMiddleware,
  requireRole(["superadmin", "insurer_admin"]),
  async (req, res) => {
    try {
      res.json({
        type: "fraud_rules_retrieved",
        title: "Fraud Detection Rules Retrieved Successfully",
        data: {
          rules: fraudDetectionService.rules,
          description: "Current fraud detection rules and thresholds",
        },
      });
    } catch (error) {
      console.error("Get fraud rules error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while retrieving fraud rules",
        status: 500,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/billing/webhooks/stripe:
 *   post:
 *     summary: Stripe webhook endpoint
 *     description: Handle Stripe webhook events for payment processing
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"];
      const payload = req.body;

      if (!signature) {
        return res.status(400).json({
          type: "webhook_error",
          title: "Webhook Error",
          detail: "Missing Stripe signature header",
          status: 400,
        });
      }

      const result = await stripeService.handleWebhook(payload, signature);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({
        type: "webhook_error",
        title: "Webhook Error",
        detail: error.message,
        status: 400,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/billing/subscription/{subscriptionId}/cancel:
 *   post:
 *     summary: Cancel subscription
 *     description: Cancel a user's subscription
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *         example: 507f1f77bcf86cd799439019
 *     responses:
 *       200:
 *         description: Subscription canceled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/subscription/:subscriptionId/cancel",
  authMiddleware,
  async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const userId = req.user._id;

      // Verify subscription belongs to user
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId,
        isActive: true,
      });

      if (!subscription) {
        return res.status(404).json({
          type: "subscription_not_found",
          title: "Subscription Not Found",
          detail: "Subscription not found or does not belong to user",
          status: 404,
        });
      }

      // Cancel Stripe subscription if exists
      if (subscription.billing.stripeSubscriptionId) {
        await stripeService.cancelSubscription(
          subscription.billing.stripeSubscriptionId
        );
      }

      // Update local subscription
      subscription.status = "canceled";
      await subscription.save();

      res.json({
        type: "subscription_canceled",
        title: "Subscription Canceled Successfully",
        detail: "Subscription has been canceled successfully",
        data: { subscription },
      });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while canceling the subscription",
        status: 500,
      });
    }
  }
);

module.exports = router;
