const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const walkthroughService = require("../services/walkthroughService");
const pdfService = require("../services/pdfService");
const Walkthrough = require("../models/Walkthrough");
const Analysis = require("../models/Analysis");
const Organization = require("../models/Organization");

const router = express.Router();

/**
 * @swagger
 * /api/v1/walkthrough/generate/{analysisId}:
 *   post:
 *     summary: Generate repair walkthrough
 *     description: Generate step-by-step repair walkthrough from analysis
 *     tags: [Walkthroughs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis ID
 *         example: 507f1f77bcf86cd799439015
 *     responses:
 *       200:
 *         description: Walkthrough generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: walkthrough_generated
 *               title: Walkthrough Generated Successfully
 *               detail: Repair walkthrough has been generated successfully
 *               data:
 *                 walkthrough:
 *                   _id: 507f1f77bcf86cd799439016
 *                   steps:
 *                     - title: Check ignition system
 *                       detail: Inspect spark plugs and coils
 *                       type: check
 *                       estMinutes: 30
 *                       order: 1
 *                   difficulty: medium
 *                   totalEstimatedTime: 90
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
 *         description: Analysis not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/generate/:analysisId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await walkthroughService.generateWalkthrough(
        analysisId,
        userId,
        orgId
      );

      res.status(200).json({
        type: "walkthrough_generated",
        title: "Walkthrough Generated Successfully",
        detail: result.message,
        data: result.walkthrough,
      });
    } catch (error) {
      console.error("Error generating walkthrough:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   GET /api/v1/walkthrough/:analysisId
// @desc    Get walkthrough for an analysis
// @access  Private
router.get("/:analysisId", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await walkthroughService.getWalkthrough(
      analysisId,
      userId,
      orgId
    );

    res.status(200).json({
      type: "walkthrough_retrieved",
      title: "Walkthrough Retrieved Successfully",
      data: result.walkthrough,
    });
  } catch (error) {
    console.error("Error retrieving walkthrough:", error);
    res.status(404).json({
      type: "walkthrough_not_found",
      title: "Walkthrough Not Found",
      detail: error.message,
    });
  }
});

// @route   PUT /api/v1/walkthrough/:walkthroughId
// @desc    Update walkthrough steps
// @access  Private (Garage users only)
router.put(
  "/:walkthroughId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  [
    body("steps")
      .isArray({ min: 1 })
      .withMessage("Steps must be a non-empty array"),
    body("steps.*.title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Step title is required"),
    body("steps.*.detail")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Step detail is required"),
    body("steps.*.type")
      .isIn(["check", "replace", "retest"])
      .withMessage("Step type must be check, replace, or retest"),
    body("steps.*.order")
      .isInt({ min: 1 })
      .withMessage("Step order must be a positive integer"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Invalid input data",
        status: 400,
        errors: errors.array(),
      });
    }

    try {
      const { walkthroughId } = req.params;
      const { steps } = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await walkthroughService.updateWalkthrough(
        walkthroughId,
        steps,
        userId,
        orgId
      );

      res.status(200).json({
        type: "walkthrough_updated",
        title: "Walkthrough Updated Successfully",
        detail: result.message,
        data: result.walkthrough,
      });
    } catch (error) {
      console.error("Error updating walkthrough:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   POST /api/v1/walkthrough/:walkthroughId/steps
// @desc    Add new step to walkthrough
// @access  Private (Garage users only)
router.post(
  "/:walkthroughId/steps",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Step title is required"),
    body("detail")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Step detail is required"),
    body("type")
      .isIn(["check", "replace", "retest"])
      .withMessage("Step type must be check, replace, or retest"),
    body("estMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Estimated minutes must be a non-negative integer"),
    body("order")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Step order must be a positive integer"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Invalid input data",
        status: 400,
        errors: errors.array(),
      });
    }

    try {
      const { walkthroughId } = req.params;
      const step = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await walkthroughService.addStep(
        walkthroughId,
        step,
        userId,
        orgId
      );

      res.status(201).json({
        type: "step_added",
        title: "Step Added Successfully",
        detail: result.message,
        data: result.walkthrough,
      });
    } catch (error) {
      console.error("Error adding step:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   DELETE /api/v1/walkthrough/:walkthroughId
// @desc    Delete walkthrough
// @access  Private (Garage users only)
router.delete(
  "/:walkthroughId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const { walkthroughId } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await walkthroughService.deleteWalkthrough(
        walkthroughId,
        userId,
        orgId
      );

      res.status(200).json({
        type: "walkthrough_deleted",
        title: "Walkthrough Deleted Successfully",
        detail: result.message,
      });
    } catch (error) {
      console.error("Error deleting walkthrough:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/walkthrough/{walkthroughId}/export:
 *   get:
 *     summary: Export walkthrough as PDF
 *     description: Generate and download repair walkthrough as PDF document
 *     tags: [Walkthroughs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walkthroughId
 *         required: true
 *         schema:
 *           type: string
 *         description: Walkthrough ID
 *         example: 507f1f77bcf86cd799439016
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               format: binary
 *             example: "<!DOCTYPE html>..."
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
 *         description: Walkthrough not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:walkthroughId/export", authMiddleware, async (req, res) => {
  try {
    const { walkthroughId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Get walkthrough with all related data
    const walkthrough = await Walkthrough.findById(walkthroughId)
      .populate('analysisId');

    if (!walkthrough) {
      return res.status(404).json({
        type: "walkthrough_not_found",
        title: "Walkthrough Not Found",
        detail: "Walkthrough not found",
      });
    }

    // Get analysis data
    const analysis = await Analysis.findById(walkthrough.analysisId)
      .populate('vehicleId')
      .populate('orgId');

    if (!analysis) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: "Related analysis not found",
      });
    }

    // Check access permissions
    if (analysis.orgId && analysis.orgId._id.toString() !== orgId.toString()) {
      return res.status(403).json({
        type: "access_denied",
        title: "Access Denied",
        detail: "You don't have permission to access this walkthrough",
      });
    }

    // Get organization data
    const organization = analysis.orgId || await Organization.findById(orgId);

    if (!organization) {
      return res.status(404).json({
        type: "organization_not_found",
        title: "Organization Not Found",
        detail: "Organization not found",
      });
    }

    // Generate PDF
    const pdfResult = await pdfService.generateWalkthroughPDF(
      walkthrough,
      analysis,
      organization
    );

    // Set response headers for HTML download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    
    res.status(200).send(pdfResult.html);
  } catch (error) {
    console.error("Error exporting walkthrough:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

module.exports = router;
