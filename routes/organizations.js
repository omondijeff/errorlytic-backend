const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const Organization = require("../models/Organization");

const router = express.Router();

/**
 * @route   GET /api/v1/organizations/garages
 * @desc    Get all active garages
 * @access  Private
 */
router.get("/garages", authMiddleware, async (req, res) => {
  try {
    const garages = await Organization.find({
      type: "garage",
      isActive: true,
    }).select("name contact country currency settings bookingSettings");

    res.status(200).json({
      success: true,
      data: garages,
    });
  } catch (error) {
    console.error("Error fetching garages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch garages",
      detail: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 * @access  Private
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id).select(
      "name type contact country currency settings bookingSettings"
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch organization",
      detail: error.message,
    });
  }
});

module.exports = router;
