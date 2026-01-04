const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
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
    plan: {
      tier: {
        type: String,
        enum: ["basic", "pro", "enterprise"],
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      price: {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        currency: {
          type: String,
          enum: ["KES", "UGX", "TZS", "USD"],
          default: "KES",
        },
        interval: {
          type: String,
          enum: ["month", "year"],
          default: "month",
        },
      },
      features: {
        apiCalls: {
          included: {
            type: Number,
            default: 0,
          },
          overageRate: {
            type: Number,
            default: 0,
          },
        },
        analysis: {
          type: Boolean,
          default: false,
        },
        walkthrough: {
          type: Boolean,
          default: false,
        },
        quotations: {
          type: Boolean,
          default: false,
        },
        multiCurrency: {
          type: Boolean,
          default: false,
        },
        exportPdf: {
          type: Boolean,
          default: false,
        },
        customIntegrations: {
          type: Boolean,
          default: false,
        },
        fraudDetection: {
          type: Boolean,
          default: false,
        },
      },
    },
    status: {
      type: String,
      enum: ["active", "trial", "past_due", "canceled", "paused"],
      default: "trial",
    },
    billing: {
      cycleStart: {
        type: Date,
        default: Date.now,
      },
      cycleEnd: {
        type: Date,
        default: function () {
          return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        },
      },
      nextBillingDate: {
        type: Date,
        default: function () {
          return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        },
      },
      paymentMethod: {
        type: String,
        enum: ["card", "bank_transfer", "mobile_money"],
        default: "card",
      },
      stripeSubscriptionId: {
        type: String,
        trim: true,
      },
      stripeCustomerId: {
        type: String,
        trim: true,
      },
    },
    usage: {
      currentPeriod: {
        apiCalls: {
          used: {
            type: Number,
            default: 0,
          },
          limit: {
            type: Number,
            default: 0,
          },
        },
        overageCharges: {
          type: Number,
          default: 0,
        },
      },
    },
    trial: {
      isActive: {
        type: Boolean,
        default: true,
      },
      startedAt: {
        type: Date,
        default: Date.now,
      },
      endsAt: {
        type: Date,
        default: function () {
          return new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days trial
        },
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
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ orgId: 1 });
subscriptionSchema.index({ "billing.stripeSubscriptionId": 1 });
subscriptionSchema.index({ status: 1, "billing.nextBillingDate": 1 });

// Pre-save middleware to set usage limits based on plan
subscriptionSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("plan.tier")) {
    const planLimits = {
      basic: { apiCalls: 50, overageRate: 0.4 }, // $0.40 per call
      pro: { apiCalls: 500, overageRate: 0.3 }, // $0.30 per call
      enterprise: { apiCalls: -1, overageRate: 0.2 }, // Unlimited, $0.20 per call
    };

    const limits = planLimits[this.plan.tier];
    this.usage.currentPeriod.apiCalls.limit = limits.apiCalls;
    this.plan.features.apiCalls.overageRate = limits.overageRate;
  }
  next();
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
