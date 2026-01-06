const Quotation = require("../models/Quotation");
const Analysis = require("../models/Analysis");
const Walkthrough = require("../models/Walkthrough");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const Metering = require("../models/Metering");
const crypto = require("crypto");

class QuotationService {
  constructor() {
    // Currency exchange rates (in production, these would come from an API)
    this.exchangeRates = {
      KES: 1.0, // Base currency
      UGX: 0.0025, // 1 KES = 400 UGX
      TZS: 0.004, // 1 KES = 250 TZS
      USD: 0.0067, // 1 KES = 150 USD (approximate)
    };

    // Default pricing for common parts (in KES)
    this.defaultPartPrices = {
      "Spark Plugs": { oem: 2500, aftermarket: 1500 },
      "Ignition Coil": { oem: 8500, aftermarket: 4500 },
      "Air Filter": { oem: 1200, aftermarket: 800 },
      "MAF Sensor": { oem: 15000, aftermarket: 8000 },
      "Transmission Fluid": { oem: 800, aftermarket: 500 },
      "Shift Solenoid": { oem: 12000, aftermarket: 6000 },
      "ABS Wheel Speed Sensor": { oem: 8500, aftermarket: 4000 },
      "ABS Sensor Cable": { oem: 3500, aftermarket: 2000 },
      "Airbag Control Module": { oem: 25000, aftermarket: 12000 },
      "Airbag Wiring Harness": { oem: 4500, aftermarket: 2500 },
    };

    // Default labor rates by region (in KES per hour)
    this.defaultLaborRates = {
      KES: 2500,
      UGX: 1000000, // Converted from KES
      TZS: 625000, // Converted from KES
      USD: 16.75, // Converted from KES
    };
  }

  /**
   * Generate quotation from analysis and walkthrough
   * @param {string} analysisId - Analysis ID
   * @param {Object} options - Quotation options
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Generated quotation
   */
  async generateQuotation(analysisId, options, userId, orgId) {
    try {
      // Get analysis and walkthrough
      const analysis = await Analysis.findById(analysisId)
        .populate("vehicleId", "make model year vin plate")
        .populate("uploadId", "meta.originalName");

      if (!analysis) {
        throw new Error("Analysis not found");
      }



      // Get organization settings (optional)
      let organization = null;
      if (orgId) {
        organization = await Organization.findById(orgId);
        if (!organization) {
          throw new Error("Organization not found");
        }
      }

      // Determine defaults based on organization or system defaults
      const orgSettings = organization?.settings || {};
      const defaultCurrency = orgSettings.currency || "KES";
      
      // Calculate default labor rate - ensure we have a fallback if currency lookup fails
      const systemDefaultLaborRate = this.defaultLaborRates[defaultCurrency] || 2500; 
      const defaultLaborRate = orgSettings.laborRate || systemDefaultLaborRate;
      
      const defaultMarkup = orgSettings.markupPercentage !== undefined ? orgSettings.markupPercentage : 15;
      const defaultTax = orgSettings.taxPercentage !== undefined ? orgSettings.taxPercentage : 16;

      // Extract options with defaults
      const {
        currency = defaultCurrency,
        laborRate = defaultLaborRate,
        markupPct = defaultMarkup,
        taxPct = defaultTax,
        useOEMParts = false,
        notes = "",
        customLineItems = [], // Extract custom line items
      } = options;

      let parts = [];
      let laborHours = 0;

      if (customLineItems && customLineItems.length > 0) {
        // Use custom line items from frontend
        parts = customLineItems.map(item => ({
          name: item.description,
          unitPrice: item.cost,
          qty: 1,
          subtotal: item.cost,
          partNumber: item.code, // Store error code as part number
          isOEM: false
        }));
        
        // When using custom line items derived from error codes, labor is typically included in the estimate
        // or set to 0 to rely on the parts (service items) cost
        laborHours = 0; 
      } else {
        // Fallback to auto-generation from walkthrough
        const walkthrough = await Walkthrough.findOne({ analysisId });

        if (!walkthrough) {
          throw new Error(
            "Walkthrough not found. Please generate walkthrough first or provide custom line items."
          );
        }

        // Calculate labor hours from walkthrough steps
        const totalMinutes = walkthrough.totalEstimatedTime || 0;
        laborHours = Math.ceil(totalMinutes / 60); // Round up to nearest hour

        // Generate parts list from walkthrough
        parts = await this.generatePartsList(
          walkthrough.parts,
          currency,
          useOEMParts
        );
      }

      // Create quotation
      const quotation = new Quotation({
        orgId,
        createdBy: userId,
        analysisId,
        currency,
        labor: {
          hours: laborHours,
          ratePerHour: laborRate,
          subtotal: laborHours * laborRate,
        },
        parts,
        taxPct,
        markupPct,
        notes,
        status: "draft",
        totals: {
          parts: 0, // Will be calculated by pre-save hook
          labor: 0, // Will be calculated by pre-save hook
          tax: 0, // Will be calculated by pre-save hook
          grand: 0, // Will be calculated by pre-save hook
        },
      });

      await quotation.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "quotation_created",
        target: {
          type: "quotation",
          id: quotation._id,
          analysisId: analysisId,
          currency: currency,
          totalAmount: quotation.totals.grand,
        },
      });

      // Record API usage
      await Metering.create({
        orgId: orgId,
        userId: userId,
        type: "quotation",
        count: 1,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM format
      });

      return {
        success: true,
        quotation,
        message: "Quotation generated successfully",
      };
    } catch (error) {
      console.error("Quotation generation error:", error);
      throw error;
    }
  }

  /**
   * Generate parts list from walkthrough parts
   * @param {Array} walkthroughParts - Parts from walkthrough
   * @param {string} currency - Target currency
   * @param {boolean} useOEM - Whether to use OEM parts
   * @returns {Promise<Array>} Formatted parts list
   */
  async generatePartsList(walkthroughParts, currency, useOEM) {
    const parts = [];

    for (const part of walkthroughParts) {
      // Get pricing for this part
      const pricing = this.getPartPricing(part.name, currency, useOEM);

      parts.push({
        name: part.name,
        unitPrice: pricing.price,
        qty: part.qty,
        subtotal: pricing.price * part.qty,
        partNumber: useOEM ? part.oem : part.alt?.[0] || part.oem,
        isOEM: useOEM,
      });
    }

    return parts;
  }

  /**
   * Get pricing for a part
   * @param {string} partName - Part name
   * @param {string} currency - Target currency
   * @param {boolean} useOEM - Whether to use OEM pricing
   * @returns {Object} Pricing information
   */
  getPartPricing(partName, currency, useOEM) {
    // Get base price in KES
    const basePricing = this.defaultPartPrices[partName] || {
      oem: 5000,
      aftermarket: 2500,
    };

    const basePrice = useOEM ? basePricing.oem : basePricing.aftermarket;

    // Convert to target currency
    const convertedPrice = this.convertCurrency(basePrice, "KES", currency);

    return {
      price: Math.round(convertedPrice * 100) / 100, // Round to 2 decimal places
      currency,
    };
  }

  /**
   * Convert currency amount
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {number} Converted amount
   */
  convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert to base currency (KES) first
    const baseAmount = amount / this.exchangeRates[fromCurrency];

    // Convert to target currency
    return baseAmount * this.exchangeRates[toCurrency];
  }

  /**
   * Get quotation by ID
   * @param {string} quotationId - Quotation ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Quotation data
   */
  async getQuotation(quotationId, userId, orgId) {
    try {
      const quotation = await Quotation.findById(quotationId)
        .populate("analysisId", "dtcs summary vehicleId")
        .populate("analysisId.vehicleId", "make model year vin plate");

      if (!quotation) {
        throw new Error("Quotation not found");
      }

      return {
        success: true,
        quotation,
      };
    } catch (error) {
      console.error("Get quotation error:", error);
      throw error;
    }
  }

  /**
   * Update quotation
   * @param {string} quotationId - Quotation ID
   * @param {Object} updates - Updates to apply
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Updated quotation
   */
  async updateQuotation(quotationId, updates, userId, orgId) {
    try {
      const quotation = await Quotation.findByIdAndUpdate(
        quotationId,
        updates,
        { new: true }
      );

      if (!quotation) {
        throw new Error("Quotation not found");
      }

      // Log update
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "quotation_updated",
        target: {
          type: "quotation",
          id: quotationId,
          updates: Object.keys(updates),
        },
      });

      return {
        success: true,
        quotation,
        message: "Quotation updated successfully",
      };
    } catch (error) {
      console.error("Update quotation error:", error);
      throw error;
    }
  }

  /**
   * Update quotation status
   * @param {string} quotationId - Quotation ID
   * @param {string} status - New status
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Updated quotation
   */
  async updateQuotationStatus(quotationId, status, userId, orgId) {
    try {
      const quotation = await Quotation.findByIdAndUpdate(
        quotationId,
        { status },
        { new: true }
      );

      if (!quotation) {
        throw new Error("Quotation not found");
      }

      // Log status change
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "quotation_status_updated",
        target: {
          type: "quotation",
          id: quotationId,
          newStatus: status,
        },
      });

      return {
        success: true,
        quotation,
        message: "Quotation status updated successfully",
      };
    } catch (error) {
      console.error("Update quotation status error:", error);
      throw error;
    }
  }

  /**
   * Generate shareable link for quotation
   * @param {string} quotationId - Quotation ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Share link
   */
  async generateShareLink(quotationId, userId, orgId) {
    try {
      const quotation = await Quotation.findById(quotationId);
      if (!quotation) {
        throw new Error("Quotation not found");
      }

      // Generate unique share link ID
      const shareLinkId = crypto.randomBytes(16).toString("hex");

      quotation.shareLinkId = shareLinkId;
      await quotation.save();

      // Log share link generation
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "quotation_share_link_generated",
        target: {
          type: "quotation",
          id: quotationId,
          shareLinkId: shareLinkId,
        },
      });

      return {
        success: true,
        shareLinkId,
        shareUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/quotation/${shareLinkId}`,
        message: "Share link generated successfully",
      };
    } catch (error) {
      console.error("Generate share link error:", error);
      throw error;
    }
  }

  /**
   * Get quotation by share link ID (public access)
   * @param {string} shareLinkId - Share link ID
   * @returns {Promise<Object>} Quotation data
   */
  async getQuotationByShareLink(shareLinkId) {
    try {
      const quotation = await Quotation.findOne({ shareLinkId })
        .populate("analysisId", "dtcs summary vehicleId")
        .populate("analysisId.vehicleId", "make model year vin plate");

      if (!quotation) {
        throw new Error("Quotation not found or link expired");
      }

      // Check if quotation is still valid
      if (quotation.validUntil < new Date()) {
        throw new Error("Quotation has expired");
      }

      return {
        success: true,
        quotation,
      };
    } catch (error) {
      console.error("Get quotation by share link error:", error);
      throw error;
    }
  }

  /**
   * Get quotations with pagination and filtering
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Filters for the query
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @returns {Promise<Object>} Paginated quotations
   */
  async getQuotations(userId, orgId, filters = {}, page = 1, limit = 10) {
    try {
      let query = { isActive: true, ...filters };
      
      // If orgId is present, scope by organization
      if (orgId) {
        query.orgId = orgId;
      } else {
        // Otherwise, scope by creator (individual user)
        query.createdBy = userId;
      }

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { createdAt: -1 },
      };

      const quotations = await Quotation.find(query, null, options)
        .populate("analysisId", "dtcs summary vehicleId")
        .populate("analysisId.vehicleId", "make model year vin plate");

      const total = await Quotation.countDocuments(query);

      return {
        success: true,
        quotations,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Get quotations error:", error);
      throw error;
    }
  }

  /**
   * Delete quotation
   * @param {string} quotationId - Quotation ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Success status
   */
  async deleteQuotation(quotationId, userId, orgId) {
    try {
      const quotation = await Quotation.findByIdAndDelete(quotationId);
      if (!quotation) {
        throw new Error("Quotation not found");
      }

      // Log deletion
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "quotation_deleted",
        target: {
          type: "quotation",
          id: quotationId,
        },
      });

      return {
        success: true,
        message: "Quotation deleted successfully",
      };
    } catch (error) {
      console.error("Delete quotation error:", error);
      throw error;
    }
  }

  /**
   * Get quotation statistics
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Statistics
   */
  async getQuotationStatistics(userId, orgId) {
    try {
      const query = { orgId: orgId, isActive: true };

      const [
        totalQuotations,
        draftQuotations,
        sentQuotations,
        approvedQuotations,
        rejectedQuotations,
        totalValue,
        recentQuotations,
      ] = await Promise.all([
        Quotation.countDocuments(query),
        Quotation.countDocuments({ ...query, status: "draft" }),
        Quotation.countDocuments({ ...query, status: "sent" }),
        Quotation.countDocuments({ ...query, status: "approved" }),
        Quotation.countDocuments({ ...query, status: "rejected" }),
        Quotation.aggregate([
          { $match: query },
          { $group: { _id: null, total: { $sum: "$totals.grand" } } },
        ]),
        Quotation.find(query)
          .sort({ createdAt: -1 })
          .limit(5)
          .select("totals.grand currency status createdAt"),
      ]);

      return {
        success: true,
        statistics: {
          totalQuotations,
          draftQuotations,
          sentQuotations,
          approvedQuotations,
          rejectedQuotations,
          totalValue: totalValue[0]?.total || 0,
          recentQuotations,
        },
      };
    } catch (error) {
      console.error("Get quotation statistics error:", error);
      throw error;
    }
  }

  /**
   * Export quotation as PDF (placeholder)
   * @param {string} quotationId - Quotation ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Export result
   */
  async exportQuotationPDF(quotationId, userId, orgId) {
    try {
      // TODO: Implement PDF generation using Puppeteer or similar
      return {
        success: false,
        message: "PDF export not yet implemented",
        placeholder: "PDF generation will be implemented in a future release",
      };
    } catch (error) {
      console.error("Export quotation PDF error:", error);
      throw error;
    }
  }
}

module.exports = new QuotationService();
