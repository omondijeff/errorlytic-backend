const vcdsParserService = require("./vcdsParserService");
const openaiService = require("./openaiService");
const walkthroughService = require("./walkthroughService");
const Analysis = require("../models/Analysis");
const Upload = require("../models/Upload");
const Vehicle = require("../models/Vehicle");
const Metering = require("../models/Metering");
const AuditLog = require("../models/AuditLog");
const redisService = require("./redisService");
const creditService = require("./creditService");
const featureGateService = require("./featureGateService");

/**
 * Analysis Service
 * Handles DTC processing, AI integration, and comprehensive vehicle analysis
 */
class AnalysisService {
  constructor() {
    this.cacheTimeout = 3600; // 1 hour cache timeout
  }

  /**
   * Process uploaded VCDS/OBD report and create comprehensive analysis
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Analysis result
   */
  async processAnalysis(uploadId, userId, orgId) {
    let creditReservation = null;
    const billingContext = await featureGateService.getUserBillingContext(userId);

    try {
      // Check cache first
      const cacheKey = `analysis:${uploadId}`;
      const cachedResult = await redisService.get(cacheKey);
      if (cachedResult) {
        console.log(`Analysis cache hit for upload ${uploadId}`);
        return cachedResult;
      }

      // Step 1: Check billing permission
      const billingCheck = await featureGateService.canPerformAnalysis(userId);
      if (!billingCheck.allowed) {
        throw new Error(billingCheck.reason);
      }

      // Step 2: Reserve credits for individual users
      if (billingContext.accountType === 'individual' && !billingContext.subscription) {
        creditReservation = await creditService.reserveCredits(userId, 1, 'analysis');
        console.log(`Reserved 1 credit for user ${userId}, reservation: ${creditReservation.reservationId}`);
      }

      // Get upload record
      const upload = await Upload.findOne({
        _id: uploadId,
        userId: userId,
        orgId: orgId,
        status: "uploaded",
      });

      if (!upload) {
        throw new Error("Upload not found or already processed");
      }

      // Get vehicle information if available
      let vehicle = null;
      if (upload.vehicleId) {
        vehicle = await Vehicle.findById(upload.vehicleId);
      }

      // Parse the VCDS/OBD report
      const parseResult = await vcdsParserService.parseVCDSReport(
        upload.storage.key,
        upload.meta.format.toLowerCase()
      );

      if (!parseResult.success) {
        throw new Error(`Parse failed: ${parseResult.error}`);
      }

      // Step 4: Always generate full AI analysis for all users
      const aiAnalysis = await this.generateAIAnalysis(
        parseResult.errorCodes,
        parseResult.vehicleInfo,
        vehicle
      );

      // Create comprehensive analysis
      const analysis = await this.createAnalysisRecord(
        uploadId,
        userId,
        orgId,
        parseResult,
        aiAnalysis,
        vehicle
      );

      // Update upload status
      upload.status = "parsed";
      upload.analysisId = analysis._id;
      await upload.save();

      // Step 5: Consume credits on success (for individual users)
      if (creditReservation) {
        await creditService.consumeCredits(userId, creditReservation.reservationId);
        console.log(`Consumed 1 credit for user ${userId}`);
      }

      // Record organization usage (for subscription users)
      if (orgId && billingContext.subscription) {
        await featureGateService.recordOrganizationUsage(orgId);
      }

      // Log analysis activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "analysis_completed",
        target: {
          type: "analysis",
          id: analysis._id,
          uploadId: uploadId,
          dtcCount: parseResult.errorCodes?.length || 0,
        },
        meta: {
          source: upload.meta.source,
          format: upload.meta.format,
          aiEnhanced: true,
          billingType: billingContext.subscription ? 'subscription' : 'credits',
        },
      });

      // Record API usage
      await Metering.create({
        orgId: orgId,
        userId: userId,
        type: "analysis",
        count: 1,
        period: new Date().toISOString().slice(0, 7),
      });

      // Generate walkthrough for all users
      let walkthrough = null;
      try {
        const walkthroughResult = await walkthroughService.generateWalkthrough(
          analysis._id,
          userId,
          orgId
        );
        walkthrough = walkthroughResult.walkthrough;
      } catch (walkthroughError) {
        console.warn("Failed to generate walkthrough:", walkthroughError.message);
        // Don't fail the analysis if walkthrough generation fails
      }

      const result = {
        success: true,
        analysisId: analysis._id,
        uploadId: uploadId,
        summary: analysis.summary,
        dtcs: analysis.dtcs,
        walkthroughId: walkthrough?._id || null,
        recommendations: analysis.recommendations,
        aiAnalysis: aiAnalysis,
        vehicleInfo: parseResult.vehicleInfo,
        diagnosticInfo: parseResult.diagnosticInfo,
        createdAt: analysis.createdAt,
        billingInfo: {
          type: billingContext.subscription ? 'subscription' : 'credits',
          remaining: billingContext.subscription
            ? billingContext.subscription.remainingAnalyses
            : billingContext.credits?.available - 1,
        },
      };

      // Cache the result
      await redisService.set(cacheKey, result, this.cacheTimeout);

      return result;
    } catch (error) {
      // Release reserved credits on failure
      if (creditReservation) {
        try {
          await creditService.releaseCredits(userId, creditReservation.reservationId);
          console.log(`Released reserved credit for user ${userId} due to error`);
        } catch (releaseError) {
          console.error("Failed to release reserved credits:", releaseError);
        }
      }

      console.error("Analysis processing error:", error);
      throw error;
    }
  }

  /**
   * Generate AI-enhanced analysis
   * @param {Array} errorCodes - Array of error codes
   * @param {Object} vehicleInfo - Vehicle information from parser
   * @param {Object} vehicle - Vehicle record from database
   * @returns {Promise<Object>} AI analysis result
   */
  async generateAIAnalysis(errorCodes, vehicleInfo, vehicle) {
    try {
      const vehicleData = {
        make: vehicle?.make || vehicleInfo?.make || "Unknown",
        model: vehicle?.model || vehicleInfo?.model || "Unknown",
        year: vehicle?.year || vehicleInfo?.year || "Unknown",
        vin: vehicle?.vin || vehicleInfo?.vin || "Unknown",
        mileage: vehicle?.mileage || vehicleInfo?.mileage || 0,
      };

      // Generate comprehensive AI analysis
      const aiAssessment = await openaiService.generateAIEnhancedEstimate(
        errorCodes,
        vehicleData
      );

      // Generate individual error explanations
      const errorExplanations = await Promise.all(
        errorCodes.slice(0, 10).map(async (errorCode) => {
          try {
            const explanation = await openaiService.generateAIExplanation(
              errorCode.code,
              errorCode.description,
              vehicleData.make,
              vehicleData.model
            );

            const troubleshooting =
              await openaiService.generateTroubleshootingSteps(
                errorCode.code,
                vehicleData.make,
                vehicleData.model
              );

            return {
              code: errorCode.code,
              explanation: explanation,
              troubleshooting: troubleshooting,
            };
          } catch (error) {
            console.error(
              `Error generating explanation for ${errorCode.code}:`,
              error
            );
            return {
              code: errorCode.code,
              explanation: `Error code ${errorCode.code}: ${errorCode.description}`,
              troubleshooting:
                "Consult a qualified technician for troubleshooting steps.",
            };
          }
        })
      );

      return {
        aiAssessment: aiAssessment.aiAssessment,
        errorExplanations: errorExplanations,
        timestamp: aiAssessment.timestamp,
        model: aiAssessment.model,
        vehicleData: vehicleData,
      };
    } catch (error) {
      console.error("AI analysis generation error:", error);
      return {
        aiAssessment:
          "AI analysis temporarily unavailable. Please consult a qualified technician.",
        errorExplanations: [],
        timestamp: new Date().toISOString(),
        model: "fallback",
        vehicleData: vehicleData || {},
      };
    }
  }

  /**
   * Create analysis record in database
   * @param {string} uploadId - Upload ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} parseResult - Parse result from VCDS parser
   * @param {Object} aiAnalysis - AI analysis result
   * @param {Object} vehicle - Vehicle record
   * @returns {Promise<Object>} Created analysis record
   */
  async createAnalysisRecord(
    uploadId,
    userId,
    orgId,
    parseResult,
    aiAnalysis,
    vehicle
  ) {
    const analysis = new Analysis({
      orgId: orgId,
      userId: userId,
      vehicleId: vehicle?._id || null,
      uploadId: uploadId,
      dtcs: parseResult.errorCodes || [],
      summary: {
        overview: parseResult.analysisSummary?.totalErrors
          ? `Found ${parseResult.analysisSummary.totalErrors} error codes`
          : "Analysis completed",
        severity:
          parseResult.analysisSummary?.priority === "high"
            ? "critical"
            : parseResult.analysisSummary?.priority === "medium"
            ? "recommended"
            : "monitor",
      },
      causes: parseResult.analysisSummary?.categories
        ? Object.keys(parseResult.analysisSummary.categories)
        : [],
      recommendations: parseResult.analysisSummary?.recommendations || [],
      module: "Other",
      aiEnrichment: {
        enabled: true,
        confidence: 0.8,
        provider: "openai",
      },
    });

    await analysis.save();
    return analysis;
  }

  /**
   * Get analysis by ID
   * @param {string} analysisId - Analysis ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Analysis record
   */
  async getAnalysis(analysisId, userId, orgId) {
    try {
      const analysis = await Analysis.findOne({
        _id: analysisId,
        userId: userId,
        orgId: orgId,
      }).populate("vehicleId", "make model year vin mileage");

      if (!analysis) {
        throw new Error("Analysis not found");
      }

      return {
        success: true,
        analysis: analysis,
      };
    } catch (error) {
      console.error("Get analysis error:", error);
      throw error;
    }
  }

  /**
   * Get analyses for a user/organization
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} List of analyses
   */
  async getAnalyses(userId, orgId, filters = {}) {
    try {
      const query = {
        userId: userId,
        orgId: orgId,
      };

      // Apply filters
      if (filters.vehicleId) {
        query.vehicleId = filters.vehicleId;
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      const analyses = await Analysis.find(query)
        .populate("vehicleId", "make model year vin mileage plate")
        .populate("uploadId", "meta storage status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Analysis.countDocuments(query);

      return {
        success: true,
        analyses: analyses,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Get analyses error:", error);
      throw error;
    }
  }

  /**
   * Update analysis status
   * @param {string} analysisId - Analysis ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated analysis
   */
  async updateAnalysisStatus(analysisId, userId, orgId, status) {
    try {
      const analysis = await Analysis.findOneAndUpdate(
        {
          _id: analysisId,
          userId: userId,
          orgId: orgId,
        },
        {
          isActive: status === "completed",
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!analysis) {
        throw new Error("Analysis not found");
      }

      // Log status change
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "analysis_status_updated",
        target: {
          type: "analysis",
          id: analysisId,
          status: status,
        },
      });

      return {
        success: true,
        analysis: analysis,
      };
    } catch (error) {
      console.error("Update analysis status error:", error);
      throw error;
    }
  }

  /**
   * Delete analysis
   * @param {string} analysisId - Analysis ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAnalysis(analysisId, userId, orgId) {
    try {
      const analysis = await Analysis.findOneAndDelete({
        _id: analysisId,
        userId: userId,
        orgId: orgId,
      });

      if (!analysis) {
        throw new Error("Analysis not found");
      }

      // Log deletion
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "analysis_deleted",
        target: {
          type: "analysis",
          id: analysisId,
        },
      });

      return {
        success: true,
        message: "Analysis deleted successfully",
      };
    } catch (error) {
      console.error("Delete analysis error:", error);
      throw error;
    }
  }

  /**
   * Get analysis statistics for dashboard
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Statistics
   */
  async getAnalysisStatistics(userId, orgId) {
    try {
      const query = {
        userId: userId,
        orgId: orgId,
      };

      const [
        totalAnalyses,
        completedAnalyses,
        criticalAnalyses,
        recommendedAnalyses,
        monitorAnalyses,
        recentAnalyses,
        categoryStats,
      ] = await Promise.all([
        Analysis.countDocuments({ ...query, isActive: true }),
        Analysis.countDocuments({ ...query, isActive: true }),
        Analysis.countDocuments({
          ...query,
          isActive: true,
          "summary.severity": "critical",
        }),
        Analysis.countDocuments({
          ...query,
          isActive: true,
          "summary.severity": "recommended",
        }),
        Analysis.countDocuments({
          ...query,
          isActive: true,
          "summary.severity": "monitor",
        }),
        Analysis.find({ ...query, isActive: true })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("vehicleId", "make model year"),
        Analysis.aggregate([
          { $match: { ...query, isActive: true } },
          { $unwind: "$causes" },
          { $group: { _id: "$causes", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

      return {
        success: true,
        statistics: {
          totalAnalyses,
          completedAnalyses,
          criticalAnalyses,
          recommendedAnalyses,
          monitorAnalyses,
          recentAnalyses,
          categoryStats,
        },
      };
    } catch (error) {
      console.error("Get analysis statistics error:", error);
      throw error;
    }
  }
}

module.exports = new AnalysisService();
