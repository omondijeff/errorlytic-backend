const mongoose = require("mongoose");

const meteringSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["analysis", "parse", "quotation", "walkthrough"],
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
    },
    period: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/, // Format: YYYY-MM
    },
    metadata: {
      analysisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Analysis",
      },
      uploadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Upload",
      },
      quotationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quotation",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
meteringSchema.index({ orgId: 1, period: 1 });
meteringSchema.index({ userId: 1, period: 1 });
meteringSchema.index({ type: 1, period: 1 });
meteringSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Metering", meteringSchema);
