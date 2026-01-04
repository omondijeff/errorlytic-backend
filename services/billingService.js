const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Metering = require("../models/Metering");
const AuditLog = require("../models/AuditLog");

class BillingService {
  constructor() {
    // Pricing configuration based on the strategy guide
    this.pricing = {
      // Pay-per-API call rates (in USD)
      apiCallRates: {
        KES: 50, // KES 50 per call
        UGX: 200000, // UGX 200,000 per call
        TZS: 125000, // TZS 125,000 per call
        USD: 0.35, // USD $0.35 per call
      },

      // Subscription plans
      plans: {
        basic: {
          name: "Basic (Individuals/Communities)",
          price: {
            KES: 1300, // KES 1,300/month
            UGX: 520000, // UGX 520,000/month
            TZS: 325000, // TZS 325,000/month
            USD: 10, // USD $10/month
          },
          features: {
            apiCalls: { included: 50, overageRate: 0.4 },
            analysis: true,
            walkthrough: false,
            quotations: false,
            multiCurrency: false,
            exportPdf: false,
            customIntegrations: false,
            fraudDetection: false,
          },
        },
        pro: {
          name: "Pro (Garages)",
          price: {
            KES: 7500, // KES 7,500/month
            UGX: 3000000, // UGX 3,000,000/month
            TZS: 1875000, // TZS 1,875,000/month
            USD: 50, // USD $50/month
          },
          features: {
            apiCalls: { included: 500, overageRate: 0.3 },
            analysis: true,
            walkthrough: true,
            quotations: true,
            multiCurrency: true,
            exportPdf: true,
            customIntegrations: false,
            fraudDetection: false,
          },
        },
        enterprise: {
          name: "Enterprise (Insurance/Large Garages)",
          price: {
            KES: 97500, // KES 97,500/month
            UGX: 39000000, // UGX 39,000,000/month
            TZS: 24375000, // TZS 24,375,000/month
            USD: 650, // USD $650/month
          },
          features: {
            apiCalls: { included: -1, overageRate: 0.2 }, // Unlimited
            analysis: true,
            walkthrough: true,
            quotations: true,
            multiCurrency: true,
            exportPdf: true,
            customIntegrations: true,
            fraudDetection: true,
          },
        },
      },

      // Bundle pricing for micropayments
      bundles: {
        small: {
          calls: 50,
          discount: 0.1, // 10% discount
          name: "Small Bundle (50 calls)",
        },
        medium: {
          calls: 200,
          discount: 0.15, // 15% discount
          name: "Medium Bundle (200 calls)",
        },
        large: {
          calls: 500,
          discount: 0.2, // 20% discount
          name: "Large Bundle (500 calls)",
        },
      },
    };
  }

  /**
   * Create a new subscription
   * @param {string} userId - User ID
   * @param {string} planTier - Plan tier (basic, pro, enterprise)
   * @param {string} currency - Currency code
   * @param {string} orgId - Organization ID (optional)
   * @returns {Promise<Object>} Subscription result
   */
  async createSubscription(userId, planTier, currency = "KES", orgId = null) {
    try {
      const plan = this.pricing.plans[planTier];
      if (!plan) {
        throw new Error(`Invalid plan tier: ${planTier}`);
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trial"] },
        isActive: true,
      });

      if (existingSubscription) {
        throw new Error("User already has an active subscription");
      }

      // Create subscription
      const subscription = new Subscription({
        userId,
        orgId,
        plan: {
          tier: planTier,
          name: plan.name,
          price: {
            amount: plan.price[currency],
            currency,
            interval: "month",
          },
          features: plan.features,
        },
        status: "trial",
        trial: {
          isActive: true,
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days
        },
        billing: {
          cycleStart: new Date(),
          cycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          nextBillingDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // Trial ends
        },
      });

      await subscription.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "subscription_created",
        target: {
          type: "subscription",
          id: subscription._id,
          plan: planTier,
          currency,
        },
      });

      return {
        success: true,
        subscription,
        message: "Subscription created successfully",
      };
    } catch (error) {
      console.error("Create subscription error:", error);
      throw error;
    }
  }

  /**
   * Process API call payment (micropayment)
   * @param {string} userId - User ID
   * @param {string} currency - Currency code
   * @param {Object} metadata - Call metadata
   * @returns {Promise<Object>} Payment result
   */
  async processApiCallPayment(userId, currency, metadata = {}) {
    try {
      const rate = this.pricing.apiCallRates[currency];
      if (!rate) {
        throw new Error(`Unsupported currency: ${currency}`);
      }

      // Create payment record
      const payment = new Payment({
        userId,
        type: "api_call",
        amount: {
          value: rate,
          currency,
        },
        description: `API Call - ${metadata.type || "analysis"}`,
        status: "pending",
        paymentMethod: "stripe", // Default to Stripe
        metadata: {
          apiCalls: 1,
          ...metadata,
        },
      });

      await payment.save();

      // TODO: Integrate with Stripe for actual payment processing
      // For now, mark as completed for testing
      payment.status = "completed";
      payment.processedAt = new Date();
      await payment.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "api_call_payment",
        target: {
          type: "payment",
          id: payment._id,
          amount: rate,
          currency,
        },
      });

      return {
        success: true,
        payment,
        message: "API call payment processed successfully",
      };
    } catch (error) {
      console.error("Process API call payment error:", error);
      throw error;
    }
  }

  /**
   * Check if user can make API call (quota/billing check)
   * @param {string} userId - User ID
   * @param {string} callType - Type of API call
   * @returns {Promise<Object>} Check result
   */
  async checkApiCallPermission(userId, callType = "analysis") {
    try {
      // Get user's subscription
      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trial"] },
        isActive: true,
      });

      if (!subscription) {
        // No subscription - allow pay-per-use
        return {
          allowed: true,
          paymentRequired: true,
          paymentType: "api_call",
        };
      }

      // Check if call type is allowed in current plan
      const planFeatures = subscription.plan.features;
      if (callType === "analysis" && !planFeatures.analysis) {
        return {
          allowed: false,
          reason: "Analysis not included in current plan",
          upgradeRequired: true,
        };
      }
      if (callType === "walkthrough" && !planFeatures.walkthrough) {
        return {
          allowed: false,
          reason: "Walkthrough not included in current plan",
          upgradeRequired: true,
        };
      }
      if (callType === "quotation" && !planFeatures.quotations) {
        return {
          allowed: false,
          reason: "Quotations not included in current plan",
          upgradeRequired: true,
        };
      }

      // Check API call limits
      const currentUsage = subscription.usage.currentPeriod.apiCalls;
      const limit = currentUsage.limit;

      if (limit === -1) {
        // Unlimited plan
        return {
          allowed: true,
          paymentRequired: false,
          subscription: subscription,
        };
      }

      if (currentUsage.used < limit) {
        // Within limits
        return {
          allowed: true,
          paymentRequired: false,
          subscription: subscription,
          remainingCalls: limit - currentUsage.used,
        };
      } else {
        // Over limit - check if overage is allowed
        return {
          allowed: true,
          paymentRequired: true,
          paymentType: "overage",
          subscription: subscription,
          overageRate: subscription.plan.features.apiCalls.overageRate,
        };
      }
    } catch (error) {
      console.error("Check API call permission error:", error);
      throw error;
    }
  }

  /**
   * Record API call usage
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {string} callType - Type of API call
   * @param {Object} metadata - Call metadata
   * @returns {Promise<Object>} Usage result
   */
  async recordApiCallUsage(userId, orgId, callType, metadata = {}) {
    try {
      // Update subscription usage
      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trial"] },
        isActive: true,
      });

      if (subscription) {
        subscription.usage.currentPeriod.apiCalls.used += 1;
        await subscription.save();
      }

      // Record in metering
      await Metering.create({
        orgId,
        userId,
        type: callType,
        count: 1,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM format
        metadata,
      });

      return {
        success: true,
        message: "API call usage recorded successfully",
      };
    } catch (error) {
      console.error("Record API call usage error:", error);
      throw error;
    }
  }

  /**
   * Get user's billing information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Billing information
   */
  async getBillingInfo(userId) {
    try {
      const subscription = await Subscription.findOne({
        userId,
        isActive: true,
      }).populate("orgId");

      const payments = await Payment.find({
        userId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const invoices = await Invoice.find({
        userId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const usage = await Metering.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            period: new Date().toISOString().slice(0, 7),
          },
        },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$count" },
          },
        },
      ]);

      return {
        success: true,
        data: {
          subscription,
          payments,
          invoices,
          usage: usage.reduce((acc, item) => {
            acc[item._id] = item.total;
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      console.error("Get billing info error:", error);
      throw error;
    }
  }

  /**
   * Generate invoice for subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Invoice result
   */
  async generateInvoice(subscriptionId) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      // Calculate usage charges
      const usage = await Metering.aggregate([
        {
          $match: {
            userId: subscription.userId,
            createdAt: {
              $gte: subscription.billing.cycleStart,
              $lt: subscription.billing.cycleEnd,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: "$count" },
          },
        },
      ]);

      const totalCalls = usage[0]?.totalCalls || 0;
      const includedCalls = subscription.plan.features.apiCalls.included;
      const overageCalls = Math.max(0, totalCalls - includedCalls);
      const overageRate = subscription.plan.features.apiCalls.overageRate;

      // Create invoice items
      const items = [
        {
          description: `${
            subscription.plan.name
          } - ${subscription.billing.cycleStart.toISOString().slice(0, 7)}`,
          quantity: 1,
          unitPrice: subscription.plan.price.amount,
          total: subscription.plan.price.amount,
        },
      ];

      if (overageCalls > 0) {
        items.push({
          description: `API Call Overage (${overageCalls} calls)`,
          quantity: overageCalls,
          unitPrice: overageRate * 100, // Convert to cents
          total: overageCalls * overageRate * 100,
        });
      }

      // Create invoice
      const invoice = new Invoice({
        userId: subscription.userId,
        orgId: subscription.orgId,
        subscriptionId: subscription._id,
        type: "subscription",
        period: {
          start: subscription.billing.cycleStart,
          end: subscription.billing.cycleEnd,
        },
        items,
        totals: {
          subtotal: items.reduce((sum, item) => sum + item.total, 0),
          tax: 0, // No tax for now
          total: items.reduce((sum, item) => sum + item.total, 0),
          currency: subscription.plan.price.currency,
        },
        dueDate: subscription.billing.nextBillingDate,
      });

      await invoice.save();

      return {
        success: true,
        invoice,
        message: "Invoice generated successfully",
      };
    } catch (error) {
      console.error("Generate invoice error:", error);
      throw error;
    }
  }
}

module.exports = new BillingService();
