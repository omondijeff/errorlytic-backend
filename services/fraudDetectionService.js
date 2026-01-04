const mongoose = require("mongoose");
const Analysis = require("../models/Analysis");
const Quotation = require("../models/Quotation");
const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

class FraudDetectionService {
  constructor() {
    // Fraud detection rules and thresholds
    this.rules = {
      // API usage patterns
      apiUsage: {
        maxCallsPerHour: 100,
        maxCallsPerDay: 1000,
        suspiciousPatternThreshold: 0.8,
      },

      // Payment patterns
      payments: {
        maxFailedAttempts: 3,
        maxAmountPerDay: 100000, // In cents
        suspiciousAmountThreshold: 50000, // In cents
      },

      // Analysis patterns
      analysis: {
        maxAnalysesPerHour: 50,
        duplicateAnalysisThreshold: 0.9,
        suspiciousVehiclePattern: 0.7,
      },

      // Quotation patterns
      quotations: {
        maxQuotationsPerDay: 200,
        suspiciousPriceThreshold: 0.8,
        duplicateQuotationThreshold: 0.95,
      },
    };
  }

  /**
   * Analyze user behavior for fraud indicators
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Fraud analysis result
   */
  async analyzeUserBehavior(userId, orgId, context = {}) {
    try {
      const [
        apiUsageScore,
        paymentScore,
        analysisScore,
        quotationScore,
        deviceScore,
        locationScore,
      ] = await Promise.all([
        this.analyzeApiUsage(userId, orgId),
        this.analyzePaymentPatterns(userId, orgId),
        this.analyzeAnalysisPatterns(userId, orgId),
        this.analyzeQuotationPatterns(userId, orgId),
        this.analyzeDevicePatterns(userId, context),
        this.analyzeLocationPatterns(userId, context),
      ]);

      // Calculate overall fraud score (0-100)
      const overallScore = Math.round(
        apiUsageScore * 0.25 +
          paymentScore * 0.25 +
          analysisScore * 0.2 +
          quotationScore * 0.15 +
          deviceScore * 0.1 +
          locationScore * 0.05
      );

      // Determine risk level
      let riskLevel = "low";
      if (overallScore >= 80) riskLevel = "high";
      else if (overallScore >= 60) riskLevel = "medium";

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        apiUsageScore,
        paymentScore,
        analysisScore,
        quotationScore,
        deviceScore,
        locationScore,
        overallScore,
      });

      return {
        success: true,
        data: {
          userId,
          orgId,
          overallScore,
          riskLevel,
          scores: {
            apiUsage: apiUsageScore,
            payments: paymentScore,
            analysis: analysisScore,
            quotations: quotationScore,
            device: deviceScore,
            location: locationScore,
          },
          recommendations,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error("Analyze user behavior error:", error);
      throw error;
    }
  }

  /**
   * Analyze API usage patterns
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzeApiUsage(userId, orgId) {
    try {
      const Metering = require("../models/Metering");
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent API usage
      const [hourlyUsage, dailyUsage] = await Promise.all([
        Metering.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              createdAt: { $gte: oneHourAgo },
            },
          },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: "$count" },
            },
          },
        ]),
        Metering.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              createdAt: { $gte: oneDayAgo },
            },
          },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: "$count" },
            },
          },
        ]),
      ]);

      const hourlyCalls = hourlyUsage[0]?.totalCalls || 0;
      const dailyCalls = dailyUsage[0]?.totalCalls || 0;

      let score = 0;

      // Check hourly limits
      if (hourlyCalls > this.rules.apiUsage.maxCallsPerHour) {
        score += 40;
      } else if (hourlyCalls > this.rules.apiUsage.maxCallsPerHour * 0.8) {
        score += 20;
      }

      // Check daily limits
      if (dailyCalls > this.rules.apiUsage.maxCallsPerDay) {
        score += 40;
      } else if (dailyCalls > this.rules.apiUsage.maxCallsPerDay * 0.8) {
        score += 20;
      }

      // Check for suspicious patterns (burst usage)
      if (hourlyCalls > 0 && dailyCalls > 0) {
        const burstRatio = hourlyCalls / (dailyCalls / 24);
        if (burstRatio > this.rules.apiUsage.suspiciousPatternThreshold) {
          score += 20;
        }
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze API usage error:", error);
      return 0;
    }
  }

  /**
   * Analyze payment patterns
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzePaymentPatterns(userId, orgId) {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent payments
      const payments = await Payment.find({
        userId,
        createdAt: { $gte: oneDayAgo },
        isActive: true,
      });

      let score = 0;

      // Check failed payment attempts
      const failedPayments = payments.filter((p) => p.status === "failed");
      if (failedPayments.length >= this.rules.payments.maxFailedAttempts) {
        score += 50;
      }

      // Check payment amounts
      const totalAmount = payments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount.value, 0);

      if (totalAmount > this.rules.payments.maxAmountPerDay) {
        score += 40;
      } else if (totalAmount > this.rules.payments.suspiciousAmountThreshold) {
        score += 20;
      }

      // Check for duplicate payment amounts
      const amounts = payments.map((p) => p.amount.value);
      const uniqueAmounts = new Set(amounts);
      if (amounts.length > 5 && uniqueAmounts.size / amounts.length < 0.5) {
        score += 30;
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze payment patterns error:", error);
      return 0;
    }
  }

  /**
   * Analyze analysis patterns
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzeAnalysisPatterns(userId, orgId) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get recent analyses
      const analyses = await Analysis.find({
        userId,
        createdAt: { $gte: oneHourAgo },
        isActive: true,
      });

      let score = 0;

      // Check hourly analysis limits
      if (analyses.length > this.rules.analysis.maxAnalysesPerHour) {
        score += 50;
      }

      // Check for duplicate analyses (same vehicle, similar DTCs)
      if (analyses.length > 1) {
        const duplicateCount = this.findDuplicateAnalyses(analyses);
        const duplicateRatio = duplicateCount / analyses.length;

        if (duplicateRatio > this.rules.analysis.duplicateAnalysisThreshold) {
          score += 40;
        }
      }

      // Check for suspicious vehicle patterns
      const vehiclePatterns = this.analyzeVehiclePatterns(analyses);
      if (
        vehiclePatterns.suspiciousScore >
        this.rules.analysis.suspiciousVehiclePattern
      ) {
        score += 30;
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze analysis patterns error:", error);
      return 0;
    }
  }

  /**
   * Analyze quotation patterns
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzeQuotationPatterns(userId, orgId) {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent quotations
      const quotations = await Quotation.find({
        userId,
        createdAt: { $gte: oneDayAgo },
        isActive: true,
      });

      let score = 0;

      // Check daily quotation limits
      if (quotations.length > this.rules.quotations.maxQuotationsPerDay) {
        score += 40;
      }

      // Check for suspicious pricing patterns
      if (quotations.length > 1) {
        const pricePatterns = this.analyzePricePatterns(quotations);
        if (
          pricePatterns.suspiciousScore >
          this.rules.quotations.suspiciousPriceThreshold
        ) {
          score += 30;
        }
      }

      // Check for duplicate quotations
      const duplicateCount = this.findDuplicateQuotations(quotations);
      if (duotations.length > 0) {
        const duplicateRatio = duplicateCount / quotations.length;
        if (
          duplicateRatio > this.rules.quotations.duplicateQuotationThreshold
        ) {
          score += 30;
        }
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze quotation patterns error:", error);
      return 0;
    }
  }

  /**
   * Analyze device patterns
   * @param {string} userId - User ID
   * @param {Object} context - Request context
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzeDevicePatterns(userId, context) {
    try {
      // This would typically analyze:
      // - Device fingerprinting
      // - IP address patterns
      // - User agent strings
      // - Browser characteristics

      // For now, return a basic score based on available context
      let score = 0;

      if (context.userAgent) {
        // Check for suspicious user agents
        const suspiciousPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];

        if (
          suspiciousPatterns.some((pattern) => pattern.test(context.userAgent))
        ) {
          score += 50;
        }
      }

      if (context.ipAddress) {
        // Check for known proxy/VPN IPs (simplified)
        // In production, you'd use a service like MaxMind or similar
        const suspiciousIPs = [
          "127.0.0.1", // Localhost (shouldn't be used in production)
          "0.0.0.0",
        ];

        if (suspiciousIPs.includes(context.ipAddress)) {
          score += 30;
        }
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze device patterns error:", error);
      return 0;
    }
  }

  /**
   * Analyze location patterns
   * @param {string} userId - User ID
   * @param {Object} context - Request context
   * @returns {Promise<number>} Fraud score (0-100)
   */
  async analyzeLocationPatterns(userId, context) {
    try {
      // This would typically analyze:
      // - Geographic location changes
      // - Time zone patterns
      // - Country/region patterns

      // For now, return a basic score
      let score = 0;

      if (context.country && context.timezone) {
        // Check for impossible location/timezone combinations
        // This is simplified - in production you'd have a comprehensive mapping
        const suspiciousCombinations = [
          { country: "US", timezone: "Asia/Tokyo" },
          { country: "KE", timezone: "America/New_York" },
        ];

        const isSuspicious = suspiciousCombinations.some(
          (combo) =>
            combo.country === context.country &&
            combo.timezone === context.timezone
        );

        if (isSuspicious) {
          score += 40;
        }
      }

      return Math.min(score, 100);
    } catch (error) {
      console.error("Analyze location patterns error:", error);
      return 0;
    }
  }

  /**
   * Find duplicate analyses
   * @param {Array} analyses - Array of analysis objects
   * @returns {number} Number of duplicates
   */
  findDuplicateAnalyses(analyses) {
    let duplicates = 0;
    const seen = new Set();

    for (const analysis of analyses) {
      const key = `${analysis.vehicleId}-${analysis.dtcs?.length || 0}`;
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  /**
   * Find duplicate quotations
   * @param {Array} quotations - Array of quotation objects
   * @returns {number} Number of duplicates
   */
  findDuplicateQuotations(quotations) {
    let duplicates = 0;
    const seen = new Set();

    for (const quotation of quotations) {
      const key = `${quotation.analysisId}-${quotation.totals.grand}`;
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  /**
   * Analyze vehicle patterns
   * @param {Array} analyses - Array of analysis objects
   * @returns {Object} Pattern analysis result
   */
  analyzeVehiclePatterns(analyses) {
    const vehicles = analyses.map((a) => a.vehicleId).filter(Boolean);
    const uniqueVehicles = new Set(vehicles);

    // Calculate suspicious score based on vehicle diversity
    const diversityRatio = uniqueVehicles.size / vehicles.length;
    const suspiciousScore = 1 - diversityRatio;

    return {
      totalVehicles: vehicles.length,
      uniqueVehicles: uniqueVehicles.size,
      diversityRatio,
      suspiciousScore,
    };
  }

  /**
   * Analyze price patterns
   * @param {Array} quotations - Array of quotation objects
   * @returns {Object} Pattern analysis result
   */
  analyzePricePatterns(quotations) {
    const prices = quotations.map((q) => q.totals.grand);
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;

    // Calculate variance
    const variance =
      prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) /
      prices.length;
    const standardDeviation = Math.sqrt(variance);

    // Suspicious if prices are too similar (possible automation)
    const suspiciousScore = standardDeviation < avgPrice * 0.1 ? 0.8 : 0.2;

    return {
      avgPrice,
      variance,
      standardDeviation,
      suspiciousScore,
    };
  }

  /**
   * Generate fraud prevention recommendations
   * @param {Object} scores - All fraud scores
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(scores) {
    const recommendations = [];

    if (scores.apiUsageScore > 60) {
      recommendations.push({
        type: "api_usage",
        priority: "high",
        message:
          "High API usage detected. Consider implementing rate limiting.",
        action: "Implement stricter rate limits",
      });
    }

    if (scores.paymentScore > 60) {
      recommendations.push({
        type: "payments",
        priority: "high",
        message:
          "Suspicious payment patterns detected. Review payment history.",
        action: "Review payment methods and consider additional verification",
      });
    }

    if (scores.analysisScore > 60) {
      recommendations.push({
        type: "analysis",
        priority: "medium",
        message: "Unusual analysis patterns detected. Monitor for automation.",
        action: "Implement CAPTCHA or additional verification",
      });
    }

    if (scores.quotationScore > 60) {
      recommendations.push({
        type: "quotations",
        priority: "medium",
        message:
          "Suspicious quotation patterns detected. Review pricing logic.",
        action: "Review quotation generation logic",
      });
    }

    if (scores.deviceScore > 60) {
      recommendations.push({
        type: "device",
        priority: "high",
        message:
          "Suspicious device patterns detected. Consider device verification.",
        action: "Implement device fingerprinting and verification",
      });
    }

    if (scores.overallScore > 80) {
      recommendations.push({
        type: "overall",
        priority: "critical",
        message: "High fraud risk detected. Immediate action required.",
        action: "Suspend account and investigate further",
      });
    }

    return recommendations;
  }

  /**
   * Log fraud detection event
   * @param {string} userId - User ID
   * @param {Object} fraudData - Fraud detection data
   * @returns {Promise<void>}
   */
  async logFraudEvent(userId, fraudData) {
    try {
      await AuditLog.create({
        actorId: userId,
        action: "fraud_detection",
        target: {
          type: "fraud_analysis",
          riskLevel: fraudData.riskLevel,
          overallScore: fraudData.overallScore,
          recommendations: fraudData.recommendations,
        },
        metadata: {
          scores: fraudData.scores,
          timestamp: fraudData.timestamp,
        },
      });
    } catch (error) {
      console.error("Log fraud event error:", error);
    }
  }
}

module.exports = new FraudDetectionService();
