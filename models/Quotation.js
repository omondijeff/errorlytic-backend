const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis",
      required: true,
    },
    currency: {
      type: String,
      enum: ["KES", "UGX", "TZS", "USD"],
      default: "KES",
    },
    labor: {
      hours: {
        type: Number,
        required: true,
        min: 0,
      },
      ratePerHour: {
        type: Number,
        required: true,
        min: 0,
      },
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    parts: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        qty: {
          type: Number,
          required: true,
          min: 1,
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
        partNumber: {
          type: String,
          trim: true,
        },
        isOEM: {
          type: Boolean,
          default: false,
        },
      },
    ],
    taxPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    markupPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totals: {
      parts: {
        type: Number,
        required: true,
        min: 0,
      },
      labor: {
        type: Number,
        required: true,
        min: 0,
      },
      tax: {
        type: Number,
        required: true,
        min: 0,
      },
      grand: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: ["draft", "sent", "approved", "rejected"],
      default: "draft",
    },
    shareLinkId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    validUntil: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
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

// Calculate totals before saving
quotationSchema.pre("save", function (next) {
  // Calculate parts subtotal
  this.totals.parts = this.parts.reduce((total, part) => {
    return total + part.unitPrice * part.qty;
  }, 0);

  // Calculate labor subtotal
  this.totals.labor = this.labor.hours * this.labor.ratePerHour;

  // Calculate subtotal before tax and markup
  const subtotal = this.totals.parts + this.totals.labor;

  // Apply markup
  const afterMarkup = subtotal * (1 + this.markupPct / 100);

  // Calculate tax
  this.totals.tax = afterMarkup * (this.taxPct / 100);

  // Calculate grand total
  this.totals.grand = afterMarkup + this.totals.tax;

  next();
});

// Indexes for efficient queries
quotationSchema.index({ orgId: 1 });
quotationSchema.index({ analysisId: 1 });
quotationSchema.index({ shareLinkId: 1 });
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ currency: 1 });

module.exports = mongoose.model("Quotation", quotationSchema);
