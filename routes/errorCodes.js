const express = require("express");
const { query, validationResult } = require("express-validator");
const ErrorCode = require("../models/ErrorCode");
const { authMiddleware } = require("../middleware/auth");
const openaiService = require("../services/openaiService");

const router = express.Router();

/**
 * @swagger
 * /api/v1/error-codes:
 *   get:
 *     summary: Get DTC error codes
 *     description: Retrieve diagnostic trouble codes with filtering and pagination
 *     tags: [Error Codes]
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
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Filter by DTC code
 *         example: P0300
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Engine, Transmission, ABS, Airbag, Climate, Body, Other]
 *         description: Filter by category
 *         example: Engine
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity
 *         example: critical
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *         example: misfire
 *     responses:
 *       200:
 *         description: Error codes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: error_codes_retrieved
 *               title: Error Codes Retrieved Successfully
 *               data:
 *                 errorCodes:
 *                   - _id: 507f1f77bcf86cd799439018
 *                     code: P0300
 *                     title: Random/Multiple Cylinder Misfire Detected
 *                     category: Engine
 *                     severity: critical
 *                     description: This code indicates that the engine control module has detected random or multiple cylinder misfires
 *               meta:
 *                 total: 1
 *                 page: 1
 *                 pages: 1
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("code")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Error code must not be empty"),
    query("category")
      .optional()
      .isIn([
        "Engine",
        "Transmission",
        "Electrical",
        "Suspension",
        "Brakes",
        "Exhaust",
        "Cooling",
        "Emissions",
        "Body",
        "Other",
      ])
      .withMessage("Invalid category"),
    query("severity")
      .optional()
      .isIn(["low", "medium", "high", "critical"])
      .withMessage("Invalid severity level"),
    query("make")
      .optional()
      .isIn(["Volkswagen", "Audi", "Porsche", "Skoda", "Seat", "Fiat"])
      .withMessage("Invalid vehicle make"),
    query("minCost")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Minimum cost must be a positive number"),
    query("maxCost")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Maximum cost must be a positive number"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const {
        page = 1,
        limit = 20,
        code,
        category,
        severity,
        make,
        minCost,
        maxCost,
      } = req.query;

      const skip = (page - 1) * limit;

      // Build filter
      const filter = { isActive: true };

      if (code) {
        filter.code = { $regex: code.toUpperCase(), $options: "i" };
      }

      if (category) filter.category = category;
      if (severity) filter.severity = severity;

      if (make) {
        filter["vagModels.make"] = make;
      }

      if (minCost || maxCost) {
        filter.estimatedCostKes = {};
        if (minCost) filter.estimatedCostKes.$gte = parseFloat(minCost);
        if (maxCost) filter.estimatedCostKes.$lte = parseFloat(maxCost);
      }

      const errorCodes = await ErrorCode.find(filter)
        .sort({ code: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ErrorCode.countDocuments(filter);

      res.json({
        success: true,
        data: {
          errorCodes,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit),
          },
        },
      });
    } catch (error) {
      console.error("Error codes fetch error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error while fetching error codes",
      });
    }
  }
);

// @route   GET /api/error-codes/:code
// @desc    Get a specific error code by code
// @access  Public
router.get("/:code", async (req, res) => {
  try {
    const errorCode = await ErrorCode.findOne({
      code: req.params.code.toUpperCase(),
      isActive: true,
    });

    if (!errorCode) {
      return res.status(404).json({
        success: false,
        error: "Error code not found",
      });
    }

    res.json({
      success: true,
      data: { errorCode },
    });
  } catch (error) {
    console.error("Error code fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while fetching error code",
    });
  }
});

// @route   GET /api/error-codes/search/autocomplete
// @desc    Search error codes for autocomplete
// @access  Public
router.get(
  "/search/autocomplete",
  [
    query("q")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Search query is required"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { q } = req.query;
      const searchRegex = new RegExp(q, "i");

      const errorCodes = await ErrorCode.find({
        $or: [
          { code: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { subcategory: searchRegex },
        ],
        isActive: true,
      })
        .select("code description category severity estimatedCostKes")
        .limit(10)
        .sort({ code: 1 });

      res.json({
        success: true,
        data: { errorCodes },
      });
    } catch (error) {
      console.error("Error code search error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error while searching error codes",
      });
    }
  }
);

// @route   GET /api/error-codes/stats/summary
// @desc    Get error code statistics summary
// @access  Public
router.get("/stats/summary", async (req, res) => {
  try {
    const stats = await ErrorCode.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalErrorCodes: { $sum: 1 },
          avgCost: { $avg: "$estimatedCostKes" },
          totalCost: { $sum: "$estimatedCostKes" },
          categories: { $addToSet: "$category" },
          severities: { $addToSet: "$severity" },
        },
      },
      {
        $project: {
          _id: 0,
          totalErrorCodes: 1,
          avgCost: { $round: ["$avgCost", 2] },
          totalCost: 1,
          categoryCount: { $size: "$categories" },
          severityCount: { $size: "$severities" },
        },
      },
    ]);

    // Get category breakdown
    const categoryBreakdown = await ErrorCode.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          avgCost: { $avg: "$estimatedCostKes" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          avgCost: { $round: ["$avgCost", 2] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get severity breakdown
    const severityBreakdown = await ErrorCode.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
          avgCost: { $avg: "$estimatedCostKes" },
        },
      },
      {
        $project: {
          severity: "$_id",
          count: 1,
          avgCost: { $round: ["$avgCost", 2] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {},
        categoryBreakdown,
        severityBreakdown,
      },
    });
  } catch (error) {
    console.error("Error code stats error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while fetching error code statistics",
    });
  }
});

// @route   GET /api/error-codes/vehicle/:make
// @desc    Get error codes specific to a vehicle make
// @access  Public
router.get(
  "/vehicle/:make",
  [
    query("model")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Model must not be empty if provided"),
    query("year")
      .optional()
      .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
      .withMessage("Invalid year"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { make } = req.params;
      const { model, year } = req.query;

      if (
        !["Volkswagen", "Audi", "Porsche", "Skoda", "Seat", "Fiat"].includes(
          make
        )
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid vehicle make",
        });
      }

      // Build filter for vehicle-specific error codes
      const filter = {
        isActive: true,
        "vagModels.make": make,
      };

      if (model) {
        filter["vagModels.models"] = { $regex: model, $options: "i" };
      }

      if (year) {
        filter.$or = [
          { "vagModels.years.start": { $lte: parseInt(year) } },
          { "vagModels.years.end": { $gte: parseInt(year) } },
          { "vagModels.years.start": { $exists: false } },
          { "vagModels.years.end": { $exists: false } },
        ];
      }

      const errorCodes = await ErrorCode.find(filter)
        .sort({ code: 1 })
        .limit(100);

      res.json({
        success: true,
        data: {
          make,
          model,
          year,
          errorCodes,
          count: errorCodes.length,
        },
      });
    } catch (error) {
      console.error("Vehicle-specific error codes fetch error:", error);
      res.status(500).json({
        success: false,
        error:
          "Internal server error while fetching vehicle-specific error codes",
      });
    }
  }
);

// @route   POST /api/error-codes/ai-explanation
// @desc    Get AI-powered explanation for an error code
// @access  Private
router.post("/ai-explanation", authMiddleware, async (req, res) => {
  try {
    const { errorCode, description, vehicleMake, vehicleModel, audience } = req.body;

    if (!errorCode || !description) {
      return res.status(400).json({
        success: false,
        error: "Error code and description are required",
      });
    }

    const aiExplanation = await openaiService.generateAIExplanation(
      errorCode,
      description,
      vehicleMake || "VAG",
      vehicleModel || "Vehicle",
      audience || 'user' // 'user' or 'mechanic'
    );

    res.json({
      success: true,
      data: {
        errorCode,
        description,
        aiExplanation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating AI explanation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate AI explanation",
    });
  }
});

// @route   POST /api/error-codes/ai-estimate
// @desc    Get AI-enhanced repair estimate
// @access  Private
router.post("/ai-estimate", authMiddleware, async (req, res) => {
  try {
    const { errorCodes, vehicleInfo } = req.body;

    if (!errorCodes || !Array.isArray(errorCodes) || errorCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Error codes array is required",
      });
    }

    const aiEstimate = await openaiService.generateAIEnhancedEstimate(
      errorCodes,
      vehicleInfo || { make: "VAG", model: "Vehicle", year: "Unknown" }
    );

    res.json({
      success: true,
      data: aiEstimate,
    });
  } catch (error) {
    console.error("Error generating AI estimate:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate AI estimate",
    });
  }
});

// @route   POST /api/error-codes/troubleshooting
// @desc    Get AI-powered troubleshooting steps for an error code
// @access  Private
router.post("/troubleshooting", authMiddleware, async (req, res) => {
  try {
    const { errorCode, vehicleMake, vehicleModel } = req.body;

    if (!errorCode) {
      return res.status(400).json({
        success: false,
        error: "Error code is required",
      });
    }

    const troubleshootingSteps =
      await openaiService.generateTroubleshootingSteps(
        errorCode,
        vehicleMake || "VAG",
        vehicleModel || "Vehicle"
      );

    res.json({
      success: true,
      data: {
        errorCode,
        troubleshootingSteps,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating troubleshooting steps:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate troubleshooting steps",
    });
  }
});

module.exports = router;
