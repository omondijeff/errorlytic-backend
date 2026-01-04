const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
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
    storage: {
      bucket: {
        type: String,
        required: true,
      },
      key: {
        type: String,
        required: true,
      },
      size: {
        type: Number,
        required: true,
        min: 0,
      },
      mime: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["uploaded", "parsed", "failed"],
      default: "uploaded",
    },
    meta: {
      source: {
        type: String,
        enum: ["VCDS", "OBD", "Other"],
        required: true,
      },
      format: {
        type: String,
        enum: ["TXT", "XML", "PDF"],
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
    },
    parseResult: {
      dtcs: [
        {
          code: String,
          description: String,
          status: {
            type: String,
            enum: ["active", "historic"],
            default: "active",
          },
        },
      ],
      rawContent: String,
      parseErrors: [String],
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis",
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
uploadSchema.index({ orgId: 1 });
uploadSchema.index({ userId: 1 });
uploadSchema.index({ vehicleId: 1 });
uploadSchema.index({ status: 1 });
uploadSchema.index({ "meta.source": 1, "meta.format": 1 });

module.exports = mongoose.model("Upload", uploadSchema);
