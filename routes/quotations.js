const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const quotationService = require("../services/quotationService");
const pdfService = require("../services/pdfService");
const Quotation = require("../models/Quotation");
const Analysis = require("../models/Analysis");
const Walkthrough = require("../models/Walkthrough");
const Organization = require("../models/Organization");

const router = express.Router();

/**
 * @swagger
 * /api/v1/quotations/generate/{analysisId}:
 *   post:
 *     summary: Generate quotation from analysis
 *     description: Generate a detailed quotation from analysis and walkthrough data
 *     tags: [Quotations]
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency:
 *                 type: string
 *                 enum: [KES, UGX, TZS, USD]
 *                 example: KES
 *               laborRate:
 *                 type: number
 *                 minimum: 0
 *                 example: 2500
 *               markupPct:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 15
 *               taxPct:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 16
 *               useOEMParts:
 *                 type: boolean
 *                 example: true
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "This quotation includes all necessary parts and labor."
 *     responses:
 *       201:
 *         description: Quotation generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: quotation_generated
 *               title: Quotation Generated Successfully
 *               detail: Quotation has been generated successfully
 *               data:
 *                 quotation:
 *                   _id: 507f1f77bcf86cd799439017
 *                   currency: KES
 *                   totals:
 *                     grand: 18964
 *                   status: draft
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
 */
router.post(
  "/generate/:analysisId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  [
    body("currency")
      .optional()
      .isIn(["KES", "UGX", "TZS", "USD"])
      .withMessage("Invalid currency"),
    body("laborRate")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Labor rate must be a positive number"),
    body("markupPct")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Markup percentage must be between 0 and 100"),
    body("taxPct")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Tax percentage must be between 0 and 100"),
    body("useOEMParts")
      .optional()
      .isBoolean()
      .withMessage("useOEMParts must be a boolean"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
    body("lineItems")
      .optional()
      .isArray()
      .withMessage("Line items must be an array"),
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
      const { analysisId } = req.params;
      const options = {
        ...req.body,
        customLineItems: req.body.lineItems, // Map lineItems to customLineItems
      };
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await quotationService.generateQuotation(
        analysisId,
        options,
        userId,
        orgId
      );

      res.status(201).json({
        type: "quotation_generated",
        title: "Quotation Generated Successfully",
        detail: result.message,
        data: result.quotation,
      });
    } catch (error) {
      console.error("Error generating quotation:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   GET /api/v1/quotations/:quotationId
// @desc    Get quotation by ID
// @access  Private
router.get("/:quotationId", authMiddleware, async (req, res) => {
  try {
    const { quotationId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await quotationService.getQuotation(
      quotationId,
      userId,
      orgId
    );

    res.status(200).json({
      type: "quotation_retrieved",
      title: "Quotation Retrieved Successfully",
      data: result.quotation,
    });
  } catch (error) {
    console.error("Error retrieving quotation:", error);
    res.status(404).json({
      type: "quotation_not_found",
      title: "Quotation Not Found",
      detail: error.message,
    });
  }
});

// @route   GET /api/v1/quotations
// @desc    Get quotations with pagination and filtering
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const { page = 1, limit = 10, status, currency, analysisId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (currency) filters.currency = currency;
    if (analysisId) filters.analysisId = analysisId;

    const result = await quotationService.getQuotations(
      userId,
      orgId,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      type: "quotations_retrieved",
      title: "Quotations Retrieved Successfully",
      data: result.quotations,
      meta: {
        total: result.total,
        page: result.page,
        pages: result.pages,
      },
    });
  } catch (error) {
    console.error("Error retrieving quotations:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

// @route   PUT /api/v1/quotations/:quotationId
// @desc    Update quotation
// @access  Private (Garage users only)
router.put(
  "/:quotationId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  [
    body("labor.hours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Labor hours must be a positive number"),
    body("labor.ratePerHour")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Labor rate must be a positive number"),
    body("parts").optional().isArray().withMessage("Parts must be an array"),
    body("parts.*.name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Part name is required"),
    body("parts.*.unitPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Unit price must be a positive number"),
    body("parts.*.qty")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),
    body("taxPct")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Tax percentage must be between 0 and 100"),
    body("markupPct")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Markup percentage must be between 0 and 100"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
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
      const { quotationId } = req.params;
      const updates = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await quotationService.updateQuotation(
        quotationId,
        updates,
        userId,
        orgId
      );

      res.status(200).json({
        type: "quotation_updated",
        title: "Quotation Updated Successfully",
        detail: result.message,
        data: result.quotation,
      });
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   POST /api/v1/quotations/:quotationId/status
// @desc    Update quotation status
// @access  Private (Garage users only)
router.post(
  "/:quotationId/status",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  [
    body("status")
      .isIn(["draft", "sent", "approved", "rejected"])
      .withMessage("Invalid status"),
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
      const { quotationId } = req.params;
      const { status } = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await quotationService.updateQuotationStatus(
        quotationId,
        status,
        userId,
        orgId
      );

      res.status(200).json({
        type: "quotation_status_updated",
        title: "Quotation Status Updated Successfully",
        detail: result.message,
        data: result.quotation,
      });
    } catch (error) {
      console.error("Error updating quotation status:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   POST /api/v1/quotations/:quotationId/share
// @desc    Generate shareable link for quotation
// @access  Private (Garage users only)
router.post(
  "/:quotationId/share",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const { quotationId } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await quotationService.generateShareLink(
        quotationId,
        userId,
        orgId
      );

      res.status(200).json({
        type: "share_link_generated",
        title: "Share Link Generated Successfully",
        detail: result.message,
        data: {
          shareLinkId: result.shareLinkId,
          shareUrl: result.shareUrl,
        },
      });
    } catch (error) {
      console.error("Error generating share link:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

// @route   GET /api/v1/quotations/share/:shareLinkId
// @desc    Get quotation by share link (public access)
// @access  Public
router.get("/share/:shareLinkId", async (req, res) => {
  try {
    const { shareLinkId } = req.params;

    const result = await quotationService.getQuotationByShareLink(shareLinkId);

    res.status(200).json({
      type: "quotation_retrieved",
      title: "Quotation Retrieved Successfully",
      data: result.quotation,
    });
  } catch (error) {
    console.error("Error retrieving quotation by share link:", error);
    res.status(404).json({
      type: "quotation_not_found",
      title: "Quotation Not Found",
      detail: error.message,
    });
  }
});

// @route   GET /api/v1/quotations/statistics
// @desc    Get quotation statistics
// @access  Private
router.get("/statistics", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await quotationService.getQuotationStatistics(userId, orgId);

    res.status(200).json({
      type: "quotation_statistics",
      title: "Quotation Statistics Retrieved Successfully",
      data: result.statistics,
    });
  } catch (error) {
    console.error("Error retrieving quotation statistics:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

// @route   DELETE /api/v1/quotations/:quotationId
// @desc    Delete quotation
// @access  Private (Garage users only)
router.delete(
  "/:quotationId",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const { quotationId } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await quotationService.deleteQuotation(
        quotationId,
        userId,
        orgId
      );

      res.status(200).json({
        type: "quotation_deleted",
        title: "Quotation Deleted Successfully",
        detail: result.message,
      });
    } catch (error) {
      console.error("Error deleting quotation:", error);
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
 * /api/v1/quotations/{quotationId}/export:
 *   get:
 *     summary: Export quotation as PDF
 *     description: Generate and download quotation as PDF document
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *         example: 507f1f77bcf86cd799439017
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
 *         description: Quotation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:quotationId/export", authMiddleware, async (req, res) => {
  try {
    const { quotationId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Get quotation with all related data
    const quotation = await Quotation.findById(quotationId)
      .populate('analysisId')
      .populate('orgId');

    if (!quotation) {
      return res.status(404).json({
        type: "quotation_not_found",
        title: "Quotation Not Found",
        detail: "Quotation not found",
      });
    }

    // Check access permissions
    if (quotation.orgId && quotation.orgId._id.toString() !== orgId.toString()) {
      return res.status(403).json({
        type: "access_denied",
        title: "Access Denied",
        detail: "You don't have permission to access this quotation",
      });
    }

    // Get analysis and walkthrough data
    const analysis = await Analysis.findById(quotation.analysisId)
      .populate('vehicleId')
      .populate('uploadId');

    if (!analysis) {
      return res.status(404).json({
        type: "analysis_not_found",
        title: "Analysis Not Found",
        detail: "Related analysis not found",
      });
    }

    const walkthrough = await Walkthrough.findOne({ analysisId: analysis._id });

    // Get organization data
    const organization = quotation.orgId || await Organization.findById(orgId);

    if (!organization) {
      return res.status(404).json({
        type: "organization_not_found",
        title: "Organization Not Found",
        detail: "Organization not found",
      });
    }

    // Generate PDF
    const pdfResult = await pdfService.generateQuotationPDF(
      quotation,
      organization,
      analysis,
      walkthrough
    );

    // Set response headers for HTML download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    
    res.status(200).send(pdfResult.html);
  } catch (error) {
    console.error("Error exporting quotation:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

module.exports = router;
