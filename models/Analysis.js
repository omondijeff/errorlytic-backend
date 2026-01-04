const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
      required: true,
    },
    dtcs: [
      {
        code: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
        },
        description: {
          type: String,
          trim: true,
        },
        status: {
          type: String,
          enum: ["active", "historic"],
          default: "active",
        },
      },
    ],
    summary: {
      overview: {
        type: String,
        required: true,
      },
      severity: {
        type: String,
        enum: ["critical", "recommended", "monitor"],
        required: true,
      },
      totalErrors: {
        type: Number,
        default: 0,
      },
      criticalErrors: {
        type: Number,
        default: 0,
      },
      estimatedCost: {
        type: Number,
        default: 0,
      },
    },
    causes: [
      {
        type: String,
        trim: true,
      },
    ],
    recommendations: [
      {
        type: String,
        trim: true,
      },
    ],
    module: {
      type: String,
      required: true,
    },
    vehicleInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    diagnosticInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    aiInsights: {
      assessment: {
        type: String,
      },
      timestamp: {
        type: Date,
      },
      model: {
        type: String,
      },
    },
    aiEnrichment: {
      enabled: {
        type: Boolean,
        default: false,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },
      provider: {
        type: String,
        enum: ["openai", "local"],
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
analysisSchema.index({ orgId: 1 });
analysisSchema.index({ uploadId: 1 });
analysisSchema.index({ "dtcs.code": 1 });
analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ module: 1, "summary.severity": 1 });

module.exports = mongoose.model("Analysis", analysisSchema);
