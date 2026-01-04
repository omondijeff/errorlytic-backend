const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["subscription", "api_usage", "overage", "one_time"],
      required: true,
    },
    period: {
      start: {
        type: Date,
        required: true,
      },
      end: {
        type: Date,
        required: true,
      },
    },
    items: [
      {
        description: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        total: {
          type: Number,
          required: true,
          min: 0,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    totals: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      tax: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        enum: ["KES", "UGX", "TZS", "USD"],
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "overdue", "canceled"],
      default: "draft",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    stripe: {
      invoiceId: {
        type: String,
        trim: true,
      },
    },
    pdfUrl: {
      type: String,
      trim: true,
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
invoiceSchema.index({ userId: 1 });
invoiceSchema.index({ orgId: 1 });
invoiceSchema.index({ subscriptionId: 1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ "period.start": 1, "period.end": 1 });

// Pre-save middleware to generate invoice number and calculate totals
invoiceSchema.pre("save", function (next) {
  if (this.isNew) {
    // Generate invoice number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    this.invoiceNumber = `INV-${dateStr}-${randomNum}`;
  }

  // Calculate totals
  this.totals.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.totals.total = this.totals.subtotal + this.totals.tax;

  next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);
