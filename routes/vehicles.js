const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware } = require("../middleware/auth");
const Vehicle = require("../models/Vehicle");
const AuditLog = require("../models/AuditLog");
const openaiService = require("../services/openaiService");

const router = express.Router();

/**
 * @route   POST /api/v1/vehicles/generate-image
 * @desc    Generate AI vehicle image using DALL-E
 * @access  Private
 */
router.post(
  "/generate-image",
  authMiddleware,
  [
    body("vehicleId").notEmpty().withMessage("Vehicle ID is required"),
    body("make").notEmpty().withMessage("Make is required"),
    body("model").notEmpty().withMessage("Model is required"),
    body("year").isNumeric().withMessage("Year must be a number"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Error",
          detail: errors.array()[0].msg,
          instance: "/api/v1/vehicles/generate-image",
        });
      }

      const { vehicleId, make, model, year, color } = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      // Verify vehicle ownership
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        $or: [{ ownerUserId: userId }, { orgId: orgId }],
      });

      if (!vehicle) {
        return res.status(404).json({
          type: "vehicle_not_found",
          title: "Vehicle Not Found",
          detail: "Vehicle not found or you don't have access to it",
          instance: "/api/v1/vehicles/generate-image",
        });
      }

      // Generate vehicle image using OpenAI DALL-E
      const imageUrl = await openaiService.generateVehicleImage({
        make,
        model,
        year,
        color: color || vehicle.color || "silver",
      });

      // Update vehicle record with generated image URL
      vehicle.imageUrl = imageUrl;
      await vehicle.save();

      // Log image generation activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "vehicle_image_generated",
        target: {
          type: "vehicle",
          id: vehicleId,
          make,
          model,
          year,
        },
        meta: {
          imageUrl,
          provider: "openai-dalle",
        },
      });

      res.json({
        success: true,
        message: "Vehicle image generated successfully",
        data: {
          vehicleId: vehicle._id,
          imageUrl: vehicle.imageUrl,
        },
      });
    } catch (error) {
      console.error("Vehicle image generation error:", error);

      if (error.message.includes("quota") || error.message.includes("rate limit")) {
        return res.status(429).json({
          type: "rate_limit_error",
          title: "Rate Limit Exceeded",
          detail: "AI image generation quota exceeded. Please try again later.",
          instance: "/api/v1/vehicles/generate-image",
        });
      }

      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "Failed to generate vehicle image",
      });
    }
  }
);

/**
 * @route   GET /api/v1/vehicles/metrics
 * @desc    Get vehicle metrics for overview
 * @access  Private
 */
router.get("/metrics", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const query = {
      $or: [{ ownerUserId: userId }, { orgId: orgId }],
    };

    // Get total vehicles
    const totalCars = await Vehicle.countDocuments(query);

    // Get active vehicles
    const activeCars = await Vehicle.countDocuments({ ...query, isActive: true });

    // Get unique users (vehicle owners)
    const vehicles = await Vehicle.find(query).select("ownerUserId").lean();
    const uniqueUsers = new Set(vehicles.map((v) => v.ownerUserId?.toString()).filter(Boolean));
    const totalUsers = uniqueUsers.size;

    // Get active users
    const User = require("../models/User");
    const activeUserIds = Array.from(uniqueUsers);
    const activeUsers = await User.countDocuments({
      _id: { $in: activeUserIds },
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalCars,
        activeUsers,
        changePercentage: 4.6, // Placeholder - can be calculated from historical data
      },
    });
  } catch (error) {
    console.error("Get vehicle metrics error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve vehicle metrics",
    });
  }
});

/**
 * @route   GET /api/v1/vehicles/:vehicleId
 * @desc    Get vehicle details
 * @access  Private
 */
router.get("/:vehicleId", authMiddleware, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      $or: [{ ownerUserId: userId }, { orgId: orgId }],
    });

    if (!vehicle) {
      return res.status(404).json({
        type: "vehicle_not_found",
        title: "Vehicle Not Found",
        detail: "Vehicle not found or you don't have access to it",
        instance: "/api/v1/vehicles/:vehicleId",
      });
    }

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error("Get vehicle error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve vehicle",
    });
  }
});

/**
 * @route   GET /api/v1/vehicles
 * @desc    Get all vehicles for user/organization
 * @access  Private
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const { page = 1, limit = 10, search } = req.query;

    const query = {
      $or: [{ ownerUserId: userId }, { orgId: orgId }],
      isActive: true,
    };

    // Add search filter if provided
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { plate: { $regex: search, $options: "i" } },
          { make: { $regex: search, $options: "i" } },
          { model: { $regex: search, $options: "i" } },
          { "ownerInfo.name": { $regex: search, $options: "i" } },
        ],
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const vehicles = await Vehicle.find(query)
      .populate("ownerUserId", "email profile.name profile.phone isActive")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Vehicle.countDocuments(query);

    // Transform data for frontend
    const transformedVehicles = vehicles.map((vehicle) => ({
      id: vehicle._id,
      name: vehicle.ownerInfo?.name || vehicle.ownerUserId?.profile?.name || "N/A",
      registrationNo: vehicle.plate || "N/A",
      carType: `${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "N/A",
      email: vehicle.ownerUserId?.email || "N/A",
      status: vehicle.isActive && vehicle.ownerUserId?.isActive ? "Active" : "Inactive",
      vehicleId: vehicle._id,
      ownerId: vehicle.ownerUserId?._id || null,
    }));

    res.json({
      success: true,
      data: transformedVehicles,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve vehicles",
    });
  }
});

module.exports = router;
