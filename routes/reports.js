const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { authMiddleware } = require("../middleware/auth");
const Upload = require("../models/Upload");
const Analysis = require("../models/Analysis");
const Vehicle = require("../models/Vehicle");
const Metering = require("../models/Metering");
const AuditLog = require("../models/AuditLog");
const minioService = require("../services/minioService");
const vcdsParserService = require("../services/vcdsParserService");
const openaiService = require("../services/openaiService");

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for VCDS/OBD reports
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "text/plain", // .txt files
    "text/csv", // .csv files
    "application/pdf", // .pdf files
    "application/xml", // .xml files
    "text/xml", // .xml files
  ];

  const allowedExtensions = [".txt", ".csv", ".pdf", ".xml", ".vcds"];
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
 * @route   POST /api/v1/reports/upload
 * @desc    Upload and analyze VCDS report (combined operation)
 * @access  Private
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const {
        firstName,
        lastName,
        registrationNumber,
        carMake,
        carModel,
        year,
      } = req.body;

      const userId = req.user._id;
      const orgId = req.user.orgId;

      // Find or create vehicle
      let vehicle = null;
      if (registrationNumber) {
        vehicle = await Vehicle.findOne({
          plate: registrationNumber.toUpperCase(),
          $or: [{ ownerUserId: userId }, { orgId: orgId }],
        });

        if (vehicle) {
          // Update vehicle information if new data is provided
          let needsUpdate = false;

          if (carMake && vehicle.make !== carMake) {
            vehicle.make = carMake;
            needsUpdate = true;
          }

          if (carModel && vehicle.model !== carModel) {
            vehicle.model = carModel;
            needsUpdate = true;
          }

          if (year && vehicle.year !== parseInt(year)) {
            vehicle.year = parseInt(year);
            needsUpdate = true;
          }

          // Update owner information from form data
          if (firstName || lastName) {
            if (!vehicle.ownerInfo) {
              vehicle.ownerInfo = {};
            }
            if (firstName) vehicle.ownerInfo.firstName = firstName;
            if (lastName) vehicle.ownerInfo.lastName = lastName;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await vehicle.save();
          }
        } else {
          // Create new vehicle
          vehicle = new Vehicle({
            orgId: orgId,
            ownerUserId: userId,
            make: carMake || "Unknown",
            model: carModel || "Unknown",
            year: year ? parseInt(year) : new Date().getFullYear(),
            plate: registrationNumber.toUpperCase(),
            ownerInfo: {
              firstName: firstName || "",
              lastName: lastName || "",
            },
          });
          await vehicle.save();
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
          source: "VCDS",
        }
      );

      // Create upload record
      const uploadRecord = new Upload({
        orgId: orgId,
        userId: userId,
        vehicleId: vehicle ? vehicle._id : null,
        storage: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          size: uploadResult.size,
          mime: req.file.mimetype,
        },
        status: "uploaded",
        meta: {
          source: "VCDS",
          format: req.file.originalname.split(".").pop().toUpperCase(),
          originalName: req.file.originalname,
          userInfo: {
            firstName,
            lastName,
            registrationNumber,
            carMake,
            carModel,
            year,
          },
        },
      });

      await uploadRecord.save();

      // Get file URL for parsing
      const fileUrl = await minioService.getFileUrl(uploadRecord.storage.key);

      // Determine file type from upload record
      const fileType = uploadRecord.meta.format.toLowerCase();

      // Parse the file
      const parseResult = await vcdsParserService.parseVCDSReport(
        fileUrl,
        fileType
      );

      if (parseResult.success) {
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

        // Generate AI-enhanced analysis if error codes were found
        let aiAssessment = null;
        if (parseResult.errorCodes && parseResult.errorCodes.length > 0) {
          try {
            console.log(`Generating AI assessment for ${parseResult.errorCodes.length} error codes...`);
            aiAssessment = await openaiService.generateAIEnhancedEstimate(
              parseResult.errorCodes,
              {
                make: vehicle?.make || carMake || "Unknown",
                model: vehicle?.model || carModel || "Unknown",
                year: vehicle?.year || year || new Date().getFullYear(),
              }
            );
            console.log('AI assessment generated successfully');
          } catch (error) {
            console.error('Failed to generate AI assessment:', error);
            // Continue without AI assessment
          }
        }

        // Create analysis record
        const analysis = new Analysis({
          orgId: orgId,
          userId: userId,
          vehicleId: vehicle ? vehicle._id : null,
          uploadId: uploadRecord._id,
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
          // Add AI assessment to the analysis record
          aiInsights: aiAssessment ? {
            assessment: aiAssessment.aiAssessment,
            timestamp: aiAssessment.timestamp,
            model: aiAssessment.model,
          } : null,
        });

        await analysis.save();

        // Log activities
        await AuditLog.create({
          actorId: userId,
          orgId: orgId,
          action: "report_uploaded_and_analyzed",
          target: {
            type: "analysis",
            id: analysis._id,
            uploadId: uploadRecord._id,
            dtcCount: parseResult.errorCodes?.length || 0,
          },
          meta: {
            source: "VCDS",
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

        res.status(201).json({
          success: true,
          message: "File uploaded and analyzed successfully",
          data: {
            uploadId: uploadRecord._id,
            analysisId: analysis._id,
            filename: req.file.originalname,
            size: req.file.size,
            vehicle: vehicle
              ? {
                  id: vehicle._id,
                  plate: vehicle.plate,
                  make: vehicle.make,
                  model: vehicle.model,
                  year: vehicle.year,
                  ownerInfo: vehicle.ownerInfo,
                }
              : null,
            dtcs: parseResult.errorCodes || [],
            summary: analysis.summary,
            vehicleInfo: parseResult.vehicleInfo,
            diagnosticInfo: parseResult.diagnosticInfo,
            // Include AI insights in the response
            aiInsights: analysis.aiInsights || null,
          },
        });
      } else {
        // Parsing failed
        uploadRecord.status = "failed";
        await uploadRecord.save();

        res.status(200).json({
          success: true,
          message: "File uploaded but parsing failed",
          data: {
            uploadId: uploadRecord._id,
            filename: req.file.originalname,
            size: req.file.size,
            parseError: parseResult.error || "Failed to parse the uploaded file",
          },
        });
      }
    } catch (error) {
      console.error("Report upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload and analyze file",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/reports/vehicle/:registrationNumber
 * @desc    Get all reports for a specific vehicle by registration number
 * @access  Private
 */
router.get(
  "/vehicle/:registrationNumber",
  authMiddleware,
  async (req, res) => {
    try {
      const { registrationNumber } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      // Find the vehicle
      const vehicle = await Vehicle.findOne({
        plate: registrationNumber.toUpperCase(),
        $or: [{ ownerUserId: userId }, { orgId: orgId }],
      });

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // Get all uploads for this vehicle
      const uploads = await Upload.find({
        vehicleId: vehicle._id,
        userId: userId,
      })
        .sort({ createdAt: -1 })
        .select("_id status meta storage createdAt parseResult");

      // Get all analyses for this vehicle
      const analyses = await Analysis.find({
        vehicleId: vehicle._id,
        userId: userId,
      })
        .sort({ createdAt: -1 })
        .select("_id uploadId dtcs summary createdAt");

      // Get report count
      const reportCount = uploads.length;

      res.json({
        success: true,
        data: {
          vehicle: {
            id: vehicle._id,
            plate: vehicle.plate,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            ownerInfo: vehicle.ownerInfo,
          },
          reportCount,
          uploads,
          analyses,
        },
      });
    } catch (error) {
      console.error("Get vehicle reports error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve vehicle reports",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/reports/my-vehicles
 * @desc    Get all vehicles with report counts for the current user
 * @access  Private
 */
router.get("/my-vehicles", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Find all vehicles for the user
    const vehicles = await Vehicle.find({
      $or: [{ ownerUserId: userId }, { orgId: orgId }],
    }).sort({ updatedAt: -1 });

    // Get report counts for each vehicle
    const vehiclesWithCounts = await Promise.all(
      vehicles.map(async (vehicle) => {
        const reportCount = await Upload.countDocuments({
          vehicleId: vehicle._id,
          userId: userId,
        });

        const latestUpload = await Upload.findOne({
          vehicleId: vehicle._id,
          userId: userId,
        })
          .sort({ createdAt: -1 })
          .select("createdAt status");

        return {
          id: vehicle._id,
          plate: vehicle.plate,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          ownerInfo: vehicle.ownerInfo,
          reportCount,
          latestUpload: latestUpload
            ? {
                date: latestUpload.createdAt,
                status: latestUpload.status,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        vehicles: vehiclesWithCounts,
        total: vehicles.length,
      },
    });
  } catch (error) {
    console.error("Get my vehicles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve vehicles",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/reports/:id/content
 * @desc    Get report content (raw VCDS file content)
 * @access  Private
 */
router.get("/:id/content", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    // Find the upload
    const upload = await Upload.findOne({
      _id: id,
      $or: [{ userId: userId }, { orgId: orgId }],
    }).populate("vehicleId");

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    // Fetch file content from MinIO using storage key
    const minioService = require("../services/minioService");
    let fileContent;

    try {
      fileContent = await minioService.getFileContent(upload.storage.key);
    } catch (error) {
      console.error("Error fetching file from MinIO:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve file content from storage",
        error: error.message,
      });
    }

    // Prepare response data
    const responseData = {
      uploadId: upload._id,
      filename: upload.meta.originalName || "unknown",
      content: fileContent,
      uploadedAt: upload.createdAt,
      fileType: upload.meta.mimetype?.split("/")[1] || "txt",
      size: upload.meta.size || 0,
    };

    // Add vehicle info if available
    if (upload.vehicleId) {
      responseData.vehicleInfo = {
        make: upload.vehicleId.make,
        model: upload.vehicleId.model,
        year: upload.vehicleId.year,
        vin: upload.vehicleId.vin,
      };
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error retrieving report content:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve report content",
      error: error.message,
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum file size is 10MB",
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: 'Use "file" as the field name',
      });
    }
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
});

module.exports = router;
