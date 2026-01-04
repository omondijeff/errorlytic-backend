const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

class StripeService {
  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create a Stripe customer
   * @param {Object} user - User object
   * @returns {Promise<Object>} Stripe customer
   */
  async createCustomer(user) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.profile.name,
        metadata: {
          userId: user._id.toString(),
          orgId: user.orgId ? user.orgId.toString() : null,
        },
      });

      return {
        success: true,
        customer,
      };
    } catch (error) {
      console.error("Create Stripe customer error:", error);
      throw error;
    }
  }

  /**
   * Create a Stripe subscription
   * @param {string} customerId - Stripe customer ID
   * @param {string} priceId - Stripe price ID
   * @param {Object} options - Subscription options
   * @returns {Promise<Object>} Stripe subscription
   */
  async createSubscription(customerId, priceId, options = {}) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 4, // 4-day trial
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: options.metadata || {},
      });

      return {
        success: true,
        subscription,
      };
    } catch (error) {
      console.error("Create Stripe subscription error:", error);
      throw error;
    }
  }

  /**
   * Create a payment intent for one-time payments
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} customerId - Stripe customer ID
   * @param {Object} metadata - Payment metadata
   * @returns {Promise<Object>} Payment intent
   */
  async createPaymentIntent(amount, currency, customerId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        paymentIntent,
      };
    } catch (error) {
      console.error("Create payment intent error:", error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<Object>} Webhook result
   */
  async handleWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      console.log(`Received webhook event: ${event.type}`);

      switch (event.type) {
        case "customer.subscription.created":
          await this.handleSubscriptionCreated(event.data.object);
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case "invoice.payment_succeeded":
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event.data.object);
          break;

        case "payment_intent.succeeded":
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return {
        success: true,
        message: `Webhook event ${event.type} processed successfully`,
      };
    } catch (error) {
      console.error("Webhook handling error:", error);
      throw error;
    }
  }

  /**
   * Handle subscription created event
   * @param {Object} subscription - Stripe subscription object
   */
  async handleSubscriptionCreated(subscription) {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      const dbSubscription = await Subscription.findOne({
        userId,
        "billing.stripeSubscriptionId": subscription.id,
      });

      if (dbSubscription) {
        dbSubscription.status = "active";
        dbSubscription.billing.stripeCustomerId = subscription.customer;
        await dbSubscription.save();

        // Log activity
        await AuditLog.create({
          actorId: userId,
          action: "subscription_activated",
          target: {
            type: "subscription",
            id: dbSubscription._id,
            stripeSubscriptionId: subscription.id,
          },
        });
      }
    } catch (error) {
      console.error("Handle subscription created error:", error);
    }
  }

  /**
   * Handle subscription updated event
   * @param {Object} subscription - Stripe subscription object
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      const dbSubscription = await Subscription.findOne({
        userId,
        "billing.stripeSubscriptionId": subscription.id,
      });

      if (dbSubscription) {
        // Update status based on Stripe status
        const statusMap = {
          active: "active",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "canceled",
        };

        dbSubscription.status = statusMap[subscription.status] || "active";
        await dbSubscription.save();

        // Log activity
        await AuditLog.create({
          actorId: userId,
          action: "subscription_updated",
          target: {
            type: "subscription",
            id: dbSubscription._id,
            status: dbSubscription.status,
          },
        });
      }
    } catch (error) {
      console.error("Handle subscription updated error:", error);
    }
  }

  /**
   * Handle subscription deleted event
   * @param {Object} subscription - Stripe subscription object
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      const dbSubscription = await Subscription.findOne({
        userId,
        "billing.stripeSubscriptionId": subscription.id,
      });

      if (dbSubscription) {
        dbSubscription.status = "canceled";
        await dbSubscription.save();

        // Log activity
        await AuditLog.create({
          actorId: userId,
          action: "subscription_canceled",
          target: {
            type: "subscription",
            id: dbSubscription._id,
            stripeSubscriptionId: subscription.id,
          },
        });
      }
    } catch (error) {
      console.error("Handle subscription deleted error:", error);
    }
  }

  /**
   * Handle invoice payment succeeded event
   * @param {Object} invoice - Stripe invoice object
   */
  async handleInvoicePaymentSucceeded(invoice) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
      );
      const userId = subscription.metadata.userId;
      if (!userId) return;

      // Create payment record
      const payment = new Payment({
        userId,
        type: "subscription",
        amount: {
          value: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
        },
        description: `Subscription payment - ${invoice.number}`,
        status: "completed",
        paymentMethod: "stripe",
        stripe: {
          paymentIntentId: invoice.payment_intent,
          chargeId: invoice.charge,
          customerId: invoice.customer,
        },
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        },
        processedAt: new Date(),
      });

      await payment.save();

      // Update subscription billing cycle
      const dbSubscription = await Subscription.findOne({
        userId,
        "billing.stripeSubscriptionId": invoice.subscription,
      });

      if (dbSubscription) {
        dbSubscription.billing.cycleStart = new Date(
          subscription.current_period_start * 1000
        );
        dbSubscription.billing.cycleEnd = new Date(
          subscription.current_period_end * 1000
        );
        dbSubscription.billing.nextBillingDate = new Date(
          subscription.current_period_end * 1000
        );
        dbSubscription.usage.currentPeriod.apiCalls.used = 0; // Reset usage
        await dbSubscription.save();
      }

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "payment_succeeded",
        target: {
          type: "payment",
          id: payment._id,
          amount: payment.amount.value,
          currency: payment.amount.currency,
        },
      });
    } catch (error) {
      console.error("Handle invoice payment succeeded error:", error);
    }
  }

  /**
   * Handle invoice payment failed event
   * @param {Object} invoice - Stripe invoice object
   */
  async handleInvoicePaymentFailed(invoice) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
      );
      const userId = subscription.metadata.userId;
      if (!userId) return;

      // Create failed payment record
      const payment = new Payment({
        userId,
        type: "subscription",
        amount: {
          value: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
        },
        description: `Failed subscription payment - ${invoice.number}`,
        status: "failed",
        paymentMethod: "stripe",
        stripe: {
          customerId: invoice.customer,
        },
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        },
        failureReason: invoice.last_payment_error?.message || "Payment failed",
      });

      await payment.save();

      // Update subscription status
      const dbSubscription = await Subscription.findOne({
        userId,
        "billing.stripeSubscriptionId": invoice.subscription,
      });

      if (dbSubscription) {
        dbSubscription.status = "past_due";
        await dbSubscription.save();
      }

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "payment_failed",
        target: {
          type: "payment",
          id: payment._id,
          amount: payment.amount.value,
          currency: payment.amount.currency,
          reason: payment.failureReason,
        },
      });
    } catch (error) {
      console.error("Handle invoice payment failed error:", error);
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param {Object} paymentIntent - Stripe payment intent object
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      const userId = paymentIntent.metadata.userId;
      if (!userId) return;

      // Create payment record
      const payment = new Payment({
        userId,
        type: paymentIntent.metadata.type || "api_call",
        amount: {
          value: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
        },
        description: `API Call Payment - ${
          paymentIntent.metadata.callType || "analysis"
        }`,
        status: "completed",
        paymentMethod: "stripe",
        stripe: {
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
        },
        metadata: {
          apiCalls: parseInt(paymentIntent.metadata.apiCalls) || 1,
          callType: paymentIntent.metadata.callType,
        },
        processedAt: new Date(),
      });

      await payment.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "api_payment_succeeded",
        target: {
          type: "payment",
          id: payment._id,
          amount: payment.amount.value,
          currency: payment.amount.currency,
        },
      });
    } catch (error) {
      console.error("Handle payment intent succeeded error:", error);
    }
  }

  /**
   * Handle payment intent failed event
   * @param {Object} paymentIntent - Stripe payment intent object
   */
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      const userId = paymentIntent.metadata.userId;
      if (!userId) return;

      // Create failed payment record
      const payment = new Payment({
        userId,
        type: paymentIntent.metadata.type || "api_call",
        amount: {
          value: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
        },
        description: `Failed API Call Payment - ${
          paymentIntent.metadata.callType || "analysis"
        }`,
        status: "failed",
        paymentMethod: "stripe",
        stripe: {
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
        },
        metadata: {
          apiCalls: parseInt(paymentIntent.metadata.apiCalls) || 1,
          callType: paymentIntent.metadata.callType,
        },
        failureReason:
          paymentIntent.last_payment_error?.message || "Payment failed",
      });

      await payment.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "api_payment_failed",
        target: {
          type: "payment",
          id: payment._id,
          amount: payment.amount.value,
          currency: payment.amount.currency,
          reason: payment.failureReason,
        },
      });
    } catch (error) {
      console.error("Handle payment intent failed error:", error);
    }
  }

  /**
   * Cancel a Stripe subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);

      return {
        success: true,
        subscription,
      };
    } catch (error) {
      console.error("Cancel subscription error:", error);
      throw error;
    }
  }

  /**
   * Get Stripe customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object>} Customer data
   */
  async getCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);

      return {
        success: true,
        customer,
      };
    } catch (error) {
      console.error("Get customer error:", error);
      throw error;
    }
  }
}

module.exports = new StripeService();
