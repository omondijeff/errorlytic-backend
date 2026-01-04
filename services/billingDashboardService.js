const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Metering = require("../models/Metering");
const User = require("../models/User");
const Organization = require("../models/Organization");
const mongoose = require("mongoose");

class BillingDashboardService {
  constructor() {
    this.chartPeriods = {
      daily: 7, // Last 7 days
      weekly: 4, // Last 4 weeks
      monthly: 12, // Last 12 months
    };
  }

  /**
   * Get comprehensive billing dashboard data
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {string} period - Chart period (daily, weekly, monthly)
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(userId, orgId, period = "monthly") {
    try {
      const [
        subscription,
        usageStats,
        paymentStats,
        invoiceStats,
        chartData,
        recentActivity,
        alerts,
      ] = await Promise.all([
        this.getSubscriptionData(userId, orgId),
        this.getUsageStats(userId, orgId),
        this.getPaymentStats(userId, orgId),
        this.getInvoiceStats(userId, orgId),
        this.getChartData(userId, orgId, period),
        this.getRecentActivity(userId, orgId),
        this.getAlerts(userId, orgId),
      ]);

      return {
        success: true,
        data: {
          subscription,
          usageStats,
          paymentStats,
          invoiceStats,
          chartData,
          recentActivity,
          alerts,
          lastUpdated: new Date(),
        },
      };
    } catch (error) {
      console.error("Get dashboard data error:", error);
      throw error;
    }
  }

  /**
   * Get subscription data
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Subscription data
   */
  async getSubscriptionData(userId, orgId) {
    try {
      const subscription = await Subscription.findOne({
        userId,
        isActive: true,
      }).populate("orgId");

      if (!subscription) {
        return {
          hasSubscription: false,
          message: "No active subscription found",
        };
      }

      const now = new Date();
      const trialEndsAt = subscription.trial.endsAt;
      const isTrialActive = subscription.trial.isActive && trialEndsAt > now;
      const daysUntilRenewal = Math.ceil(
        (subscription.billing.nextBillingDate - now) / (1000 * 60 * 60 * 24)
      );

      return {
        hasSubscription: true,
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          status: subscription.status,
          isTrialActive,
          trialEndsAt: isTrialActive ? trialEndsAt : null,
          daysUntilRenewal: daysUntilRenewal > 0 ? daysUntilRenewal : 0,
          billingCycle: {
            start: subscription.billing.cycleStart,
            end: subscription.billing.cycleEnd,
            nextBilling: subscription.billing.nextBillingDate,
          },
          usage: subscription.usage.currentPeriod,
        },
      };
    } catch (error) {
      console.error("Get subscription data error:", error);
      throw error;
    }
  }

  /**
   * Get usage statistics
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(userId, orgId) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get usage by type
      const usageByType = await Metering.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: "$type",
            totalCalls: { $sum: "$count" },
            avgCallsPerDay: { $avg: "$count" },
          },
        },
      ]);

      // Get daily usage for the last 30 days
      const dailyUsage = await Metering.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalCalls: { $sum: "$count" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
        },
      ]);

      // Calculate totals
      const totalCalls = usageByType.reduce(
        (sum, item) => sum + item.totalCalls,
        0
      );
      const avgCallsPerDay =
        dailyUsage.length > 0
          ? dailyUsage.reduce((sum, item) => sum + item.totalCalls, 0) /
            dailyUsage.length
          : 0;

      return {
        totalCalls,
        avgCallsPerDay: Math.round(avgCallsPerDay),
        usageByType: usageByType.reduce((acc, item) => {
          acc[item._id] = {
            totalCalls: item.totalCalls,
            avgCallsPerDay: Math.round(item.avgCallsPerDay),
          };
          return acc;
        }, {}),
        dailyUsage: dailyUsage.map((item) => ({
          date: new Date(item._id.year, item._id.month - 1, item._id.day),
          calls: item.totalCalls,
        })),
      };
    } catch (error) {
      console.error("Get usage stats error:", error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Payment statistics
   */
  async getPaymentStats(userId, orgId) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get payment statistics
      const paymentStats = await Payment.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount.value" },
          },
        },
      ]);

      // Get total amounts by currency
      const amountsByCurrency = await Payment.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
            isActive: true,
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$amount.currency",
            totalAmount: { $sum: "$amount.value" },
            count: { $sum: 1 },
          },
        },
      ]);

      // Calculate totals
      const totalPayments = paymentStats.reduce(
        (sum, item) => sum + item.count,
        0
      );
      const totalAmount = paymentStats
        .filter((item) => item._id === "completed")
        .reduce((sum, item) => sum + item.totalAmount, 0);

      return {
        totalPayments,
        totalAmount,
        amountsByCurrency: amountsByCurrency.reduce((acc, item) => {
          acc[item._id] = {
            totalAmount: item.totalAmount,
            count: item.count,
          };
          return acc;
        }, {}),
        statusBreakdown: paymentStats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount,
          };
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Get payment stats error:", error);
      throw error;
    }
  }

  /**
   * Get invoice statistics
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Invoice statistics
   */
  async getInvoiceStats(userId, orgId) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get invoice statistics
      const invoiceStats = await Invoice.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totals.total" },
          },
        },
      ]);

      // Get overdue invoices
      const overdueInvoices = await Invoice.find({
        userId,
        status: { $ne: "paid" },
        dueDate: { $lt: now },
        isActive: true,
      });

      const totalInvoices = invoiceStats.reduce(
        (sum, item) => sum + item.count,
        0
      );
      const totalAmount = invoiceStats.reduce(
        (sum, item) => sum + item.totalAmount,
        0
      );
      const overdueAmount = overdueInvoices.reduce(
        (sum, invoice) => sum + invoice.totals.total,
        0
      );

      return {
        totalInvoices,
        totalAmount,
        overdueAmount,
        overdueCount: overdueInvoices.length,
        statusBreakdown: invoiceStats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount,
          };
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Get invoice stats error:", error);
      throw error;
    }
  }

  /**
   * Get chart data for visualizations
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {string} period - Chart period
   * @returns {Promise<Object>} Chart data
   */
  async getChartData(userId, orgId, period) {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case "daily":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "weekly":
          startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get usage chart data
      const usageChartData = await Metering.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: period === "daily" ? { $dayOfMonth: "$createdAt" } : null,
              week: period === "weekly" ? { $week: "$createdAt" } : null,
            },
            calls: { $sum: "$count" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
        },
      ]);

      // Get payment chart data
      const paymentChartData = await Payment.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: startDate },
            status: "completed",
            isActive: true,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: period === "daily" ? { $dayOfMonth: "$createdAt" } : null,
              week: period === "weekly" ? { $week: "$createdAt" } : null,
            },
            amount: { $sum: "$amount.value" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
        },
      ]);

      return {
        usage: usageChartData.map((item) => ({
          date: this.formatChartDate(item._id, period),
          calls: item.calls,
        })),
        payments: paymentChartData.map((item) => ({
          date: this.formatChartDate(item._id, period),
          amount: item.amount,
          count: item.count,
        })),
      };
    } catch (error) {
      console.error("Get chart data error:", error);
      throw error;
    }
  }

  /**
   * Get recent activity
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Recent activity
   */
  async getRecentActivity(userId, orgId) {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get recent payments
      const recentPayments = await Payment.find({
        userId,
        createdAt: { $gte: sevenDaysAgo },
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5);

      // Get recent invoices
      const recentInvoices = await Invoice.find({
        userId,
        createdAt: { $gte: sevenDaysAgo },
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5);

      // Combine and sort activities
      const activities = [
        ...recentPayments.map((payment) => ({
          type: "payment",
          id: payment._id,
          title: `Payment ${payment.status}`,
          description: `${payment.amount.currency} ${payment.amount.value} - ${payment.description}`,
          timestamp: payment.createdAt,
          status: payment.status,
        })),
        ...recentInvoices.map((invoice) => ({
          type: "invoice",
          id: invoice._id,
          title: `Invoice ${invoice.invoiceNumber}`,
          description: `${invoice.totals.currency} ${invoice.totals.total} - ${invoice.status}`,
          timestamp: invoice.createdAt,
          status: invoice.status,
        })),
      ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      return activities;
    } catch (error) {
      console.error("Get recent activity error:", error);
      throw error;
    }
  }

  /**
   * Get alerts and notifications
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Alerts
   */
  async getAlerts(userId, orgId) {
    try {
      const alerts = [];
      const now = new Date();

      // Check subscription status
      const subscription = await Subscription.findOne({
        userId,
        isActive: true,
      });

      if (subscription) {
        // Trial ending soon
        if (subscription.trial.isActive && subscription.trial.endsAt) {
          const daysUntilTrialEnds = Math.ceil(
            (subscription.trial.endsAt - now) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilTrialEnds <= 2 && daysUntilTrialEnds > 0) {
            alerts.push({
              type: "warning",
              title: "Trial Ending Soon",
              message: `Your trial ends in ${daysUntilTrialEnds} day(s). Please add a payment method to continue.`,
              action: "add_payment_method",
              priority: "high",
            });
          }
        }

        // Usage approaching limit
        const usage = subscription.usage.currentPeriod.apiCalls;
        const limit = usage.limit;

        if (limit > 0 && usage.used / limit > 0.8) {
          alerts.push({
            type: "info",
            title: "Usage Alert",
            message: `You've used ${usage.used} of ${limit} API calls this period.`,
            action: "view_usage",
            priority: "medium",
          });
        }

        // Payment failed
        if (subscription.status === "past_due") {
          alerts.push({
            type: "error",
            title: "Payment Failed",
            message:
              "Your last payment failed. Please update your payment method.",
            action: "update_payment_method",
            priority: "high",
          });
        }
      }

      // Check for overdue invoices
      const overdueInvoices = await Invoice.find({
        userId,
        status: { $ne: "paid" },
        dueDate: { $lt: now },
        isActive: true,
      });

      if (overdueInvoices.length > 0) {
        alerts.push({
          type: "error",
          title: "Overdue Invoices",
          message: `You have ${overdueInvoices.length} overdue invoice(s).`,
          action: "view_invoices",
          priority: "high",
        });
      }

      return alerts;
    } catch (error) {
      console.error("Get alerts error:", error);
      throw error;
    }
  }

  /**
   * Format chart date based on period
   * @param {Object} dateObj - Date object from aggregation
   * @param {string} period - Chart period
   * @returns {string} Formatted date
   */
  formatChartDate(dateObj, period) {
    const { year, month, day, week } = dateObj;

    switch (period) {
      case "daily":
        return new Date(year, month - 1, day).toISOString().slice(0, 10);
      case "weekly":
        return `Week ${week}, ${year}`;
      case "monthly":
        return new Date(year, month - 1).toISOString().slice(0, 7);
      default:
        return new Date(year, month - 1, day).toISOString().slice(0, 10);
    }
  }
}

module.exports = new BillingDashboardService();
