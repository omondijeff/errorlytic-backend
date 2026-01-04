const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  authMiddleware,
  requireRole,
  requireOrgAccess,
} = require("../middleware/auth");
const analysisService = require("../services/analysisService");
const Metering = require("../models/Metering");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

/**
 * @swagger
 * /api/v1/analysis/process/{uploadId}:
 *   post:
 *     summary: Process uploaded file and create analysis
 *     description: Process uploaded VCDS/OBD report and generate diagnostic analysis
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload ID
 *         example: 507f1f77bcf86cd799439014
 *     responses:
 *       201:
 *         description: Analysis created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: analysis_created
 *               title: Analysis Created Successfully
 *               detail: Analysis has been created successfully
 *               data:
 *                 analysis:
 *                   _id: 507f1f77bcf86cd799439015
 *                   summary:
 *                     overview: Found 1 critical error code requiring immediate attention
 *                     severity: critical
 *                   dtcs:
 *                     - code: P0300
 *                       description: Random/Multiple Cylinder Misfire Detected
 *                       status: active
 *                   module: Engine
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
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Upload not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/process/:uploadId",
  authMiddleware,
  requireOrgAccess(["garage"]),
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      // Validate upload ID
      if (!uploadId) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Error",
          detail: "Upload ID is required",
          instance: "/api/v1/analysis/process/:uploadId",
        });
      }

      // Process the analysis
      const result = await analysisService.processAnalysis(
        uploadId,
        userId,
        orgId
      );

      res.status(201).json({
        success: true,
        message: "Analysis processed successfully",
        data: result,
      });
    } catch (error) {
      console.error("Analysis processing error:", error);

      if (error.message.includes("not found")) {
        return res.status(404).json({
          type: "upload_not_found",
          title: "Upload Not Found",
          detail: error.message,
          instance: "/api/v1/analysis/process/:uploadId",
        });
      }

      if (error.message.includes("Parse failed")) {
        return res.status(400).json({
          type: "parse_error",
          title: "Parse Error",
          detail: error.message,
          instance: "/api/v1/analysis/process/:uploadId",
        });
      }

      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "Failed to process analysis",
      });
    }
  }
);

// @route   GET /api/v1/analysis/:analysisId
// @desc    Get analysis by ID
// @access  Private
router.get("/:analysisId", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await analysisService.getAnalysis(analysisId, userId, orgId);

    res.json({
      success: true,
      data: result.analysis,
    });
  } catch (error) {
    console.error("Get analysis error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: error.message,
        instance: "/api/v1/analysis/:analysisId",
      });
    }

    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve analysis",
    });
  }
});

// @route   GET /api/v1/analysis
// @desc    Get analyses for user/organization
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const filters = req.query;

    const result = await analysisService.getAnalyses(userId, orgId, filters);

    res.json({
      success: true,
      data: result.analyses,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get analyses error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve analyses",
    });
  }
});

// @route   PUT /api/v1/analysis/:analysisId/status
// @desc    Update analysis status
// @access  Private
router.put(
  "/:analysisId/status",
  authMiddleware,
  [
    body("status")
      .isIn(["pending", "processing", "completed", "failed", "cancelled"])
      .withMessage("Invalid status value"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Error",
          detail: errors.array()[0].msg,
          instance: "/api/v1/analysis/:analysisId/status",
        });
      }

      const { analysisId } = req.params;
      const { status } = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await analysisService.updateAnalysisStatus(
        analysisId,
        userId,
        orgId,
        status
      );

      res.json({
        success: true,
        message: "Analysis status updated successfully",
        data: result.analysis,
      });
    } catch (error) {
      console.error("Update analysis status error:", error);

      if (error.message.includes("not found")) {
        return res.status(404).json({
          type: "analysis_not_found",
          title: "Analysis Not Found",
          detail: error.message,
          instance: "/api/v1/analysis/:analysisId/status",
        });
      }

      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "Failed to update analysis status",
      });
    }
  }
);

// @route   DELETE /api/v1/analysis/:analysisId
// @desc    Delete analysis
// @access  Private
router.delete("/:analysisId", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await analysisService.deleteAnalysis(
      analysisId,
      userId,
      orgId
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete analysis error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: error.message,
        instance: "/api/v1/analysis/:analysisId",
      });
    }

    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to delete analysis",
    });
  }
});

// @route   GET /api/v1/analysis/statistics/dashboard
// @desc    Get analysis statistics for dashboard
// @access  Private
router.get("/statistics/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await analysisService.getAnalysisStatistics(userId, orgId);

    res.json({
      success: true,
      data: result.statistics,
    });
  } catch (error) {
    console.error("Get analysis statistics error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve analysis statistics",
    });
  }
});

// @route   GET /api/v1/analysis/:analysisId/export
// @desc    Export analysis report
// @access  Private
router.get("/:analysisId/export", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { format = "json" } = req.query;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await analysisService.getAnalysis(analysisId, userId, orgId);
    const analysis = result.analysis;

    // Log export activity
    await AuditLog.create({
      actorId: userId,
      orgId: orgId,
      action: "analysis_exported",
      target: {
        type: "analysis",
        id: analysisId,
        format: format,
      },
    });

    // Record API usage
    await Metering.create({
      orgId: orgId,
      userId: userId,
      type: "export",
      count: 1,
      period: new Date().toISOString().slice(0, 7),
    });

    if (format === "pdf") {
      // TODO: Implement PDF export
      res.status(501).json({
        type: "not_implemented",
        title: "Not Implemented",
        detail: "PDF export not yet implemented",
      });
    } else {
      // JSON export
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analysis-${analysisId}.json"`
      );
      res.json({
        analysis: analysis,
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
      });
    }
  } catch (error) {
    console.error("Export analysis error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: error.message,
        instance: "/api/v1/analysis/:analysisId/export",
      });
    }

    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to export analysis",
    });
  }
});

// @route   GET /api/v1/analysis/:analysisId/diagnostic-summary
// @desc    Get comprehensive diagnostic summary for analysis with vehicle and reports
// @access  Private
router.get("/:analysisId/diagnostic-summary", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Get the analysis
    const Analysis = require("../models/Analysis");
    const Vehicle = require("../models/Vehicle");
    const Upload = require("../models/Upload");

    const analysis = await Analysis.findOne({
      _id: analysisId,
      userId: userId,
      orgId: orgId,
    }).populate("vehicleId uploadId");

    if (!analysis) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: "Analysis not found",
        instance: "/api/v1/analysis/:analysisId/diagnostic-summary",
      });
    }

    // Get vehicle details
    const vehicle = analysis.vehicleId;
    if (!vehicle) {
      return res.status(404).json({
        type: "vehicle_not_found",
        title: "Vehicle Not Found",
        detail: "Vehicle not found for this analysis",
        instance: "/api/v1/analysis/:analysisId/diagnostic-summary",
      });
    }

    // Get all uploads/reports for this vehicle
    const uploads = await Upload.find({
      vehicleId: vehicle._id,
      userId: userId,
      orgId: orgId,
      status: { $in: ["uploaded", "parsed", "processed"] },
    })
      .sort({ createdAt: -1 })
      .populate("analysisId")
      .lean();

    // Format reports data
    const reports = uploads.map((upload) => ({
      uploadId: upload._id,
      dateUploaded: upload.createdAt,
      filename: upload.meta?.originalName || upload.meta?.fileName || "Unknown",
      analysisId: upload.analysisId?._id || null,
      status: upload.status === "parsed" || upload.status === "processed" ? "completed" : upload.status,
    }));

    // Calculate estimated cost and get last maintenance cost for comparison
    const estimatedCost = analysis.summary?.estimatedCost || 0;
    let lastMaintenanceCost = null;

    // Get previous analysis for comparison (if any)
    const previousAnalyses = await Analysis.find({
      vehicleId: vehicle._id,
      userId: userId,
      orgId: orgId,
      _id: { $ne: analysisId },
      "summary.estimatedCost": { $exists: true, $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    if (previousAnalyses.length > 0) {
      lastMaintenanceCost = previousAnalyses[0].summary?.estimatedCost || null;
    }

    // Format response data
    const responseData = {
      estimatedCost,
      lastMaintenanceCost,
      reports,
      vehicle: {
        id: vehicle._id,
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        imageUrl: vehicle.imageUrl || null,
        ownerInfo: vehicle.ownerInfo || null,
      },
      aiInsights: analysis.aiInsights || null,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get diagnostic summary error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve diagnostic summary",
    });
  }
});

module.exports = router;
