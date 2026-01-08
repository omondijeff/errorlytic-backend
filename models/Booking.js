const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // For public/walk-in bookings where client doesn't have an account
    clientInfo: {
      name: String,
      email: String,
      phone: String,
    },
    // For walk-in bookings where vehicle is not registered
    vehicleInfo: {
      make: String,
      model: String,
      year: Number,
      plate: String,
    },
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },
    serviceType: {
      type: String,
      enum: ["inspection", "repair", "maintenance", "diagnostic"],
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      default: 60,
      min: 15,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    garageNotes: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    googleCalendarEventId: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    source: {
      type: String,
      enum: ["app", "public_booking", "walk_in"],
      default: "app",
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    confirmedAt: {
      type: Date,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis",
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
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
bookingSchema.index({ clientId: 1, scheduledDate: -1 });
bookingSchema.index({ garageId: 1, scheduledDate: -1 });
bookingSchema.index({ status: 1, scheduledDate: 1 });
bookingSchema.index({ vehicleId: 1 });
bookingSchema.index({ googleCalendarEventId: 1 });

// Virtual for checking if booking is upcoming
bookingSchema.virtual("isUpcoming").get(function () {
  return this.scheduledDate > new Date() && this.status !== "cancelled";
});

// Virtual for checking if booking is past
bookingSchema.virtual("isPast").get(function () {
  return this.scheduledDate < new Date();
});

module.exports = mongoose.model("Booking", bookingSchema);
