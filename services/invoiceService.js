const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Payment = require("../models/Payment");
const pdfService = require("./pdfService");
const nodemailer = require("nodemailer");

class InvoiceService {
  constructor() {
    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Generate invoice for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} options - Invoice options
   * @returns {Promise<Object>} Generated invoice
   */
  async generateInvoice(subscriptionId, options = {}) {
    try {
      const subscription = await Subscription.findById(subscriptionId)
        .populate("userId")
        .populate("orgId");

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      // Calculate usage for the billing period
      const usage = await this.calculateUsage(subscription);

      // Create invoice items
      const items = [
        {
          description: `${subscription.plan.name} - ${this.formatPeriod(
            subscription.billing.cycleStart
          )}`,
          quantity: 1,
          unitPrice: subscription.plan.price.amount,
          total: subscription.plan.price.amount,
          metadata: {
            planTier: subscription.plan.tier,
            period: this.formatPeriod(subscription.billing.cycleStart),
          },
        },
      ];

      // Add overage charges if applicable
      if (usage.overageCalls > 0) {
        const overageRate = subscription.plan.features.apiCalls.overageRate;
        const overageAmount = usage.overageCalls * overageRate * 100; // Convert to cents

        items.push({
          description: `API Call Overage (${usage.overageCalls} calls)`,
          quantity: usage.overageCalls,
          unitPrice: overageRate * 100,
          total: overageAmount,
          metadata: {
            type: "overage",
            calls: usage.overageCalls,
            rate: overageRate,
          },
        });
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = subscription.orgId?.settings?.taxRatePct || 16; // Default 16% VAT
      const tax = Math.round((subtotal * taxRate) / 100);
      const total = subtotal + tax;

      // Create invoice
      const invoice = new Invoice({
        userId: subscription.userId._id,
        orgId: subscription.orgId?._id,
        subscriptionId: subscription._id,
        type: "subscription",
        period: {
          start: subscription.billing.cycleStart,
          end: subscription.billing.cycleEnd,
        },
        items,
        totals: {
          subtotal,
          tax,
          total,
          currency: subscription.plan.price.currency,
        },
        dueDate: subscription.billing.nextBillingDate,
        status: "draft",
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

  /**
   * Generate PDF for invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateInvoicePDF(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate("userId")
        .populate("orgId")
        .populate("subscriptionId");

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Generate PDF using the existing PDF service
      const pdfBuffer = await pdfService.generateInvoicePDF(invoice);

      return pdfBuffer;
    } catch (error) {
      console.error("Generate invoice PDF error:", error);
      throw error;
    }
  }

  /**
   * Send invoice via email
   * @param {string} invoiceId - Invoice ID
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Email result
   */
  async sendInvoiceEmail(invoiceId, options = {}) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate("userId")
        .populate("orgId")
        .populate("subscriptionId");

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Generate PDF
      const pdfBuffer = await this.generateInvoicePDF(invoiceId);

      // Prepare email
      const emailOptions = {
        from: process.env.SMTP_FROM || "noreply@Errorlytic.com",
        to: invoice.userId.email,
        subject: `Invoice ${invoice.invoiceNumber} - Errorlytic`,
        html: this.generateInvoiceEmailHTML(invoice),
        attachments: [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      };

      // Send email
      const result = await this.emailTransporter.sendMail(emailOptions);

      // Update invoice status
      invoice.status = "sent";
      await invoice.save();

      return {
        success: true,
        messageId: result.messageId,
        message: "Invoice sent successfully",
      };
    } catch (error) {
      console.error("Send invoice email error:", error);
      throw error;
    }
  }

  /**
   * Calculate usage for subscription period
   * @param {Object} subscription - Subscription object
   * @returns {Promise<Object>} Usage data
   */
  async calculateUsage(subscription) {
    try {
      const Metering = require("../models/Metering");

      const usage = await Metering.aggregate([
        {
          $match: {
            userId: subscription.userId._id,
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

      return {
        totalCalls,
        includedCalls,
        overageCalls,
      };
    } catch (error) {
      console.error("Calculate usage error:", error);
      throw error;
    }
  }

  /**
   * Format period for display
   * @param {Date} date - Date to format
   * @returns {string} Formatted period
   */
  formatPeriod(date) {
    return date.toISOString().slice(0, 7); // YYYY-MM format
  }

  /**
   * Generate HTML email template for invoice
   * @param {Object} invoice - Invoice object
   * @returns {string} HTML content
   */
  generateInvoiceEmailHTML(invoice) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .invoice-details { background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
          .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .total { font-weight: bold; font-size: 18px; color: #2c3e50; }
          .footer { margin-top: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Errorlytic Invoice</h1>
            <p>Invoice #${invoice.invoiceNumber}</p>
            <p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          </div>
          
          <div class="invoice-details">
            <h3>Bill To:</h3>
            <p><strong>${invoice.userId.profile.name}</strong></p>
            <p>${invoice.userId.email}</p>
            ${invoice.orgId ? `<p>${invoice.orgId.name}</p>` : ""}
            
            <h3>Invoice Items:</h3>
            ${invoice.items
              .map(
                (item) => `
              <div class="item">
                <span>${item.description}</span>
                <span>${item.quantity} × ${this.formatCurrency(
                  item.unitPrice,
                  invoice.totals.currency
                )} = ${this.formatCurrency(
                  item.total,
                  invoice.totals.currency
                )}</span>
              </div>
            `
              )
              .join("")}
            
            <div class="item">
              <span><strong>Subtotal:</strong></span>
              <span><strong>${this.formatCurrency(
                invoice.totals.subtotal,
                invoice.totals.currency
              )}</strong></span>
            </div>
            
            <div class="item">
              <span><strong>Tax:</strong></span>
              <span><strong>${this.formatCurrency(
                invoice.totals.tax,
                invoice.totals.currency
              )}</strong></span>
            </div>
            
            <div class="item total">
              <span><strong>Total:</strong></span>
              <span><strong>${this.formatCurrency(
                invoice.totals.total,
                invoice.totals.currency
              )}</strong></span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for using Errorlytic!</p>
            <p>This invoice was generated automatically. Please contact support if you have any questions.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format currency for display
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency
   */
  formatCurrency(amount, currency) {
    const symbols = {
      KES: "KSh",
      UGX: "USh",
      TZS: "TSh",
      USD: "$",
    };

    const symbol = symbols[currency] || currency;
    const value = (amount / 100).toFixed(2);

    return `${symbol} ${value}`;
  }

  /**
   * Get invoice statistics
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Statistics
   */
  async getInvoiceStatistics(userId, orgId) {
    try {
      const stats = await Invoice.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            orgId: orgId ? new mongoose.Types.ObjectId(orgId) : null,
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: "$totals.total" },
            paidAmount: {
              $sum: {
                $cond: [{ $eq: ["$status", "paid"] }, "$totals.total", 0],
              },
            },
            overdueAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", "paid"] },
                      { $lt: ["$dueDate", new Date()] },
                    ],
                  },
                  "$totals.total",
                  0,
                ],
              },
            },
          },
        },
      ]);

      return {
        success: true,
        data: stats[0] || {
          totalInvoices: 0,
          totalAmount: 0,
          paidAmount: 0,
          overdueAmount: 0,
        },
      };
    } catch (error) {
      console.error("Get invoice statistics error:", error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();
