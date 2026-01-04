const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const Upload = require("../models/Upload");
const Analysis = require("../models/Analysis");
const Vehicle = require("../models/Vehicle");
const Metering = require("../models/Metering");
const AuditLog = require("../models/AuditLog");
const minioService = require("../services/minioService");
const redisService = require("../services/redisService");
const vcdsParserService = require("../services/vcdsParserService");

const router = express.Router();

// Configure multer for memory storage (we'll upload directly to MinIO)
const storage = multer.memoryStorage();

// File filter for VCDS/OBD reports
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "text/plain", // .txt files
    "text/csv", // .csv files
    "application/pdf", // .pdf files
    "application/xml", // .xml files
    "text/xml", // .xml files
    "application/vnd.ms-excel", // .xls files
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx files
  ];

  const allowedExtensions = [".txt", ".csv", ".pdf", ".xml", ".xls", ".xlsx"];
  const fileExt = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf("."));

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(fileExt)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only VCDS/OBD report formats are allowed."),
      false
    );
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1,
  },
});

/**
 * @swagger
 * /api/v1/upload:
 *   post:
 *     summary: Upload VCDS/OBD file
 *     description: Upload and parse VCDS/OBD diagnostic files
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: VCDS/OBD diagnostic file (TXT, PDF, XML, CSV, XLS, XLSX)
 *               vehicleId:
 *                 type: string
 *                 description: Vehicle ID (optional)
 *                 example: 507f1f77bcf86cd799439013
 *               source:
 *                 type: string
 *                 enum: [VCDS, OBD, Other]
 *                 default: VCDS
 *                 description: Diagnostic tool source
 *     responses:
 *       201:
 *         description: File uploaded and parsed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: file_uploaded
 *               title: File Uploaded Successfully
 *               detail: File has been uploaded and parsed successfully
 *               data:
 *                 upload:
 *                   _id: 507f1f77bcf86cd799439014
 *                   status: parsed
 *                   meta:
 *                     source: VCDS
 *                     format: TXT
 *                     originalName: vcds-report.txt
 *                   parseResult:
 *                     dtcs:
 *                       - code: P0300
 *                         description: Random/Multiple Cylinder Misfire Detected
 *                         status: active
 *       400:
 *         description: Validation error or invalid file
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
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/",
  authMiddleware,
  [
    body("vehicleId").optional().isMongoId().withMessage("Invalid vehicle ID"),
    body("source")
      .optional()
      .isIn(["VCDS", "OBD", "Other"])
      .withMessage("Invalid source"),
    upload.single("file"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          errors: errors.array(),
        });
      }

      if (!req.file) {
        return res.status(400).json({
          type: "missing_file",
          title: "No File Uploaded",
          detail: "Please select a file to upload",
        });
      }

      const { vehicleId, source = "Other" } = req.body;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      // Verify vehicle belongs to user/organization if provided
      if (vehicleId) {
        const vehicle = await Vehicle.findOne({
          _id: vehicleId,
          $or: [{ ownerUserId: userId }, { orgId: orgId }],
        });

        if (!vehicle) {
          return res.status(404).json({
            type: "vehicle_not_found",
            title: "Vehicle Not Found",
            detail:
              "The specified vehicle does not exist or you don't have access to it",
          });
        }
      }

      // Generate unique file key for MinIO
      const fileKey = minioService.generateFileKey(
        req.file.originalname,
        userId.toString(),
        orgId ? orgId.toString() : null
      );

      // Upload file to MinIO
      const uploadResult = await minioService.uploadFile(
        req.file.buffer,
        fileKey,
        req.file.mimetype,
        {
          "original-name": req.file.originalname,
          "uploaded-by": userId.toString(),
          "organization-id": orgId ? orgId.toString() : "individual",
          source: source,
        }
      );

      // Create upload record
      const uploadRecord = new Upload({
        orgId: orgId,
        userId: userId,
        vehicleId: vehicleId || null,
        storage: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          size: uploadResult.size,
          mime: req.file.mimetype,
        },
        status: "uploaded",
        meta: {
          source: source,
          format: req.file.originalname.split(".").pop().toUpperCase(),
          originalName: req.file.originalname,
        },
      });

      await uploadRecord.save();

      // Log upload activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "file_uploaded",
        target: {
          type: "upload",
          id: uploadRecord._id,
          filename: req.file.originalname,
          size: req.file.size,
        },
        meta: {
          source: source,
          format: uploadRecord.meta.format,
        },
      });

      // Record API usage
      await Metering.create({
        orgId: orgId,
        userId: userId,
        type: "parse",
        count: 1,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM format
      });

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          uploadId: uploadRecord._id,
          filename: req.file.originalname,
          size: req.file.size,
          status: uploadRecord.status,
          storage: uploadRecord.storage,
        },
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "Failed to upload file",
      });
    }
  }
);

// @route   POST /api/v1/upload/:uploadId/parse
// @desc    Parse uploaded VCDS/OBD report
// @access  Private
router.post("/:uploadId/parse", authMiddleware, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Find upload record
    const uploadRecord = await Upload.findOne({
      _id: uploadId,
      userId: userId,
      status: "uploaded",
    });

    if (!uploadRecord) {
      return res.status(404).json({
        type: "upload_not_found",
        title: "Upload Not Found",
        detail:
          "The specified upload does not exist or has already been processed",
      });
    }

    // Get file from MinIO
    const fileUrl = await minioService.getFileUrl(uploadRecord.storage.key);

    // Determine file type from upload record
    const fileType = uploadRecord.meta.format.toLowerCase();

    // Parse the file
    const parseResult = await vcdsParserService.parseVCDSReport(
      fileUrl,
      fileType
    );

    if (!parseResult.success) {
      // Update upload status to failed
      uploadRecord.status = "failed";
      await uploadRecord.save();

      return res.status(400).json({
        type: "parse_failed",
        title: "Parse Failed",
        detail: parseResult.error || "Failed to parse the uploaded file",
      });
    }

    // Update upload record with parse results
    uploadRecord.status = "parsed";
    uploadRecord.parseResult = {
      dtcs: parseResult.errorCodes || [],
      rawContent: parseResult.rawContent || "",
      parseErrors: parseResult.parseErrors || [],
      analysisSummary: parseResult.analysisSummary || {},
      vehicleInfo: parseResult.vehicleInfo || {},
      diagnosticInfo: parseResult.diagnosticInfo || {},
    };
    await uploadRecord.save();

    // Create analysis record
    const analysis = new Analysis({
      orgId: orgId,
      userId: userId,
      vehicleId: uploadRecord.vehicleId,
      uploadId: uploadRecord._id,
      dtcs: parseResult.errorCodes || [],
      summary: {
        overview: parseResult.analysisSummary?.totalErrors
          ? `Found ${parseResult.analysisSummary.totalErrors} error codes`
          : "Analysis completed",
        severity: parseResult.analysisSummary?.priority || "monitor",
        totalErrors: parseResult.analysisSummary?.totalErrors || 0,
        criticalErrors: parseResult.analysisSummary?.criticalErrors || 0,
        estimatedCost: parseResult.analysisSummary?.estimatedTotalCost || 0,
      },
      causes: parseResult.analysisSummary?.categories
        ? Object.keys(parseResult.analysisSummary.categories)
        : [],
      recommendations: parseResult.analysisSummary?.recommendations || [],
      module: parseResult.vehicleInfo?.vin
        ? "VIN: " + parseResult.vehicleInfo.vin
        : "Unknown",
      vehicleInfo: parseResult.vehicleInfo || {},
      diagnosticInfo: parseResult.diagnosticInfo || {},
    });

    await analysis.save();

    // Log analysis activity
    await AuditLog.create({
      actorId: userId,
      orgId: orgId,
      action: "analysis_created",
      target: {
        type: "analysis",
        id: analysis._id,
        uploadId: uploadRecord._id,
        dtcCount: parseResult.errorCodes?.length || 0,
      },
      meta: {
        source: uploadRecord.meta.source,
        format: uploadRecord.meta.format,
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

    res.json({
      success: true,
      message: "File parsed successfully",
      data: {
        uploadId: uploadRecord._id,
        analysisId: analysis._id,
        dtcs: parseResult.errorCodes || [],
        summary: analysis.summary,
        vehicleInfo: parseResult.vehicleInfo,
        diagnosticInfo: parseResult.diagnosticInfo,
      },
    });
  } catch (error) {
    console.error("File parsing error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to parse file",
    });
  }
});

// @route   GET /api/v1/upload
// @desc    Get user's uploads
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const { page = 1, limit = 10, status, vehicleId } = req.query;

    // Build query
    const query = { userId: userId };
    if (orgId) {
      query.orgId = orgId;
    }
    if (status) {
      query.status = status;
    }
    if (vehicleId) {
      query.vehicleId = vehicleId;
    }

    // Get uploads with pagination
    const uploads = await Upload.find(query)
      .populate("vehicleId", "make model year plate")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Upload.countDocuments(query);

    res.json({
      success: true,
      data: {
        uploads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Get uploads error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve uploads",
    });
  }
});

// @route   GET /api/v1/upload/:uploadId
// @desc    Get specific upload details
// @access  Private
router.get("/:uploadId", authMiddleware, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const upload = await Upload.findOne({
      _id: uploadId,
      userId: userId,
    }).populate("vehicleId", "make model year plate");

    if (!upload) {
      return res.status(404).json({
        type: "upload_not_found",
        title: "Upload Not Found",
        detail: "The specified upload does not exist",
      });
    }

    // Generate presigned URL for file access
    const fileUrl = await minioService.getFileUrl(upload.storage.key);

    res.json({
      success: true,
      data: {
        upload: {
          ...upload.toObject(),
          fileUrl: fileUrl,
        },
      },
    });
  } catch (error) {
    console.error("Get upload error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve upload",
    });
  }
});

// @route   DELETE /api/v1/upload/:uploadId
// @desc    Delete upload and associated files
// @access  Private
router.delete("/:uploadId", authMiddleware, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const upload = await Upload.findOne({
      _id: uploadId,
      userId: userId,
    });

    if (!upload) {
      return res.status(404).json({
        type: "upload_not_found",
        title: "Upload Not Found",
        detail: "The specified upload does not exist",
      });
    }

    // Delete file from MinIO
    await minioService.deleteFile(upload.storage.key);

    // Delete associated analysis if exists
    await Analysis.deleteMany({ uploadId: uploadId });

    // Delete upload record
    await Upload.deleteOne({ _id: uploadId });

    // Log deletion activity
    await AuditLog.create({
      actorId: userId,
      orgId: orgId,
      action: "file_deleted",
      target: {
        type: "upload",
        id: uploadId,
        filename: upload.storage.key,
      },
    });

    res.json({
      success: true,
      message: "Upload deleted successfully",
    });
  } catch (error) {
    console.error("Delete upload error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to delete upload",
    });
  }
});

// @route   GET /api/v1/upload/stats
// @desc    Get upload statistics
// @access  Private
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const query = { userId: userId };
    if (orgId) {
      query.orgId = orgId;
    }

    const stats = await Upload.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSize: { $sum: "$storage.size" },
        },
      },
    ]);

    const totalUploads = await Upload.countDocuments(query);
    const totalSize = await Upload.aggregate([
      { $match: query },
      { $group: { _id: null, totalSize: { $sum: "$storage.size" } } },
    ]);

    res.json({
      success: true,
      data: {
        totalUploads,
        totalSize: totalSize[0]?.totalSize || 0,
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            size: stat.totalSize,
          };
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get upload stats error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "Failed to retrieve upload statistics",
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        type: "file_too_large",
        title: "File Too Large",
        detail: "Maximum file size is 10MB",
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        type: "unexpected_file",
        title: "Unexpected File Field",
        detail: 'Use "file" as the field name',
      });
    }
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      type: "invalid_file_type",
      title: "Invalid File Type",
      detail: error.message,
    });
  }

  next(error);
});

module.exports = router;
