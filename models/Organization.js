const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["garage", "insurer"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      enum: ["KES", "UGX", "TZS", "USD"],
      default: "KES",
    },
    settings: {
      laborRatePerHour: {
        type: Number,
        default: 1500, // Default in cents (minor units)
        min: 0,
      },
      taxRatePct: {
        type: Number,
        default: 16, // 16% VAT
        min: 0,
        max: 100,
      },
      defaultMarkupPct: {
        type: Number,
        default: 10, // 10% markup
        min: 0,
        max: 100,
      },
    },
    bookingSettings: {
      enabled: {
        type: Boolean,
        default: true,
      },
      googleCalendarId: {
        type: String,
        trim: true,
      },
      workingHours: {
        monday: { start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } },
        tuesday: { start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } },
        wednesday: { start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } },
        thursday: { start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } },
        friday: { start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } },
        saturday: { start: { type: String, default: "08:00" }, end: { type: String, default: "13:00" } },
        sunday: { start: { type: String, default: "" }, end: { type: String, default: "" } },
      },
      slotDuration: {
        type: Number,
        default: 60, // minutes
        min: 15,
      },
      bufferTime: {
        type: Number,
        default: 15, // minutes between bookings
        min: 0,
      },
      advanceBookingDays: {
        type: Number,
        default: 30, // how far in advance clients can book
        min: 1,
      },
    },
    plan: {
      tier: {
        type: String,
        enum: ["pro", "enterprise"],
        default: "pro",
      },
      status: {
        type: String,
        enum: ["active", "trial", "canceled"],
        default: "trial",
      },
    },
    contact: {
      email: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
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
organizationSchema.index({ type: 1 });
organizationSchema.index({ name: "text" });
organizationSchema.index({ country: 1 });
organizationSchema.index({ "plan.tier": 1, "plan.status": 1 });

module.exports = mongoose.model("Organization", organizationSchema);
