const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["subscription", "api_call", "overage", "one_time"],
      required: true,
    },
    amount: {
      value: {
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "bank_transfer", "mobile_money", "mpesa", "paystack", "manual"],
      required: true,
    },
    reference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stripe: {
      paymentIntentId: {
        type: String,
        trim: true,
      },
      chargeId: {
        type: String,
        trim: true,
      },
      customerId: {
        type: String,
        trim: true,
      },
    },
    paystack: {
      reference: {
        type: String,
        trim: true,
      },
      transactionId: {
        type: String,
        trim: true,
      },
      authorizationCode: {
        type: String,
        trim: true,
      },
      channel: {
        type: String,
        enum: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
      },
      cardType: {
        type: String,
        trim: true,
      },
      last4: {
        type: String,
        trim: true,
      },
      bank: {
        type: String,
        trim: true,
      },
      countryCode: {
        type: String,
        trim: true,
      },
      brand: {
        type: String,
        trim: true,
      },
    },
    mpesa: {
      checkoutRequestId: {
        type: String,
        trim: true,
      },
      merchantRequestId: {
        type: String,
        trim: true,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      mpesaReceiptNumber: {
        type: String,
        trim: true,
      },
      transactionDate: {
        type: String,
        trim: true,
      },
      accountReference: {
        type: String,
        trim: true,
      },
    },
    metadata: {
      apiCalls: {
        type: Number,
        default: 0,
      },
      analysisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Analysis",
      },
      quotationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quotation",
      },
      walkthroughId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Walkthrough",
      },
    },
    processedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    refundedAt: {
      type: Date,
    },
    refundReason: {
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
paymentSchema.index({ userId: 1 });
paymentSchema.index({ orgId: 1 });
paymentSchema.index({ subscriptionId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ "stripe.paymentIntentId": 1 });
paymentSchema.index({ "paystack.reference": 1 });
paymentSchema.index({ "paystack.transactionId": 1 });
paymentSchema.index({ "mpesa.checkoutRequestId": 1 });
paymentSchema.index({ "mpesa.mpesaReceiptNumber": 1 });
paymentSchema.index({ type: 1, createdAt: -1 });

// Pre-save middleware to set processedAt when status changes to completed
paymentSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.processedAt
  ) {
    this.processedAt = new Date();
  }
  if (
    this.isModified("status") &&
    this.status === "refunded" &&
    !this.refundedAt
  ) {
    this.refundedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
