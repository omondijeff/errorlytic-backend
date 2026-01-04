const mongoose = require("mongoose");

const walkthroughSchema = new mongoose.Schema(
  {
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis",
      required: true,
    },
    steps: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        detail: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: ["check", "replace", "retest"],
          required: true,
        },
        estMinutes: {
          type: Number,
          min: 0,
        },
        order: {
          type: Number,
          required: true,
        },
      },
    ],
    parts: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        oem: {
          type: String,
          trim: true,
        },
        alt: [
          {
            type: String,
            trim: true,
          },
        ],
        qty: {
          type: Number,
          required: true,
          min: 1,
        },
        estimatedCost: {
          type: Number,
          min: 0,
        },
      },
    ],
    tools: [
      {
        type: String,
        trim: true,
      },
    ],
    totalEstimatedTime: {
      type: Number,
      min: 0,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "expert"],
      default: "medium",
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

// Index for efficient queries
walkthroughSchema.index({ analysisId: 1 });

// Calculate total estimated time before saving
walkthroughSchema.pre("save", function (next) {
  this.totalEstimatedTime = this.steps.reduce((total, step) => {
    return total + (step.estMinutes || 0);
  }, 0);
  next();
});

module.exports = mongoose.model("Walkthrough", walkthroughSchema);
