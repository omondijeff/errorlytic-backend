const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const Metering = require("../models/Metering");
const googleCalendarService = require("./googleCalendarService");

class BookingService {
  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @param {string} userId - User ID creating the booking
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(bookingData, userId) {
    try {
      const {
        garageId,
        vehicleId,
        serviceType,
        scheduledDate,
        duration = 60,
        notes,
        quotationId,
        analysisId,
      } = bookingData;

      // Validate vehicle exists and belongs to user
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      // Validate garage exists
      const garage = await Organization.findById(garageId);
      if (!garage || garage.type !== "garage") {
        throw new Error("Invalid garage");
      }

      // Check for conflicting bookings
      const conflictingBooking = await this.checkBookingConflict(
        garageId,
        scheduledDate,
        duration
      );

      if (conflictingBooking) {
        throw new Error(
          "This time slot is already booked. Please choose a different time."
        );
      }

      // Create booking
      const booking = new Booking({
        clientId: bookingData.clientId || userId,
        garageId,
        vehicleId,
        serviceType,
        scheduledDate: new Date(scheduledDate),
        duration,
        notes,
        quotationId,
        analysisId,
        createdBy: userId,
        status: bookingData.status || "pending",
      });

      await booking.save();

      // Populate references
      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "garageId", select: "name contact" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: garageId,
        action: "booking_created",
        target: {
          type: "booking",
          id: booking._id,
          garageId,
          scheduledDate,
        },
      });

      // Record metering
      await Metering.create({
        orgId: garageId,
        userId: userId,
        type: "booking",
        count: 1,
        period: new Date().toISOString().slice(0, 7),
      });

      // Sync to Google Calendar (async, don't block)
      googleCalendarService.syncBookingToCalendar(booking).catch((err) => {
        console.error("Calendar sync error:", err);
      });

      return {
        success: true,
        booking,
        message: "Booking created successfully",
      };
    } catch (error) {
      console.error("Create booking error:", error);
      throw error;
    }
  }

  /**
   * Check for booking conflicts
   * @param {string} garageId - Garage ID
   * @param {Date} scheduledDate - Scheduled date
   * @param {number} duration - Duration in minutes
   * @returns {Promise<Object|null>} Conflicting booking or null
   */
  async checkBookingConflict(garageId, scheduledDate, duration) {
    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const conflictingBooking = await Booking.findOne({
      garageId,
      status: { $in: ["pending", "confirmed", "in_progress"] },
      $or: [
        {
          // New booking starts during existing booking
          scheduledDate: { $lte: startTime },
          $expr: {
            $gte: [
              { $add: ["$scheduledDate", { $multiply: ["$duration", 60000] }] },
              startTime,
            ],
          },
        },
        {
          // New booking ends during existing booking
          scheduledDate: { $lte: endTime },
          $expr: {
            $gte: [
              { $add: ["$scheduledDate", { $multiply: ["$duration", 60000] }] },
              endTime,
            ],
          },
        },
        {
          // New booking completely overlaps existing booking
          scheduledDate: { $gte: startTime, $lte: endTime },
        },
      ],
    });

    return conflictingBooking;
  }

  /**
   * Get bookings with filtering
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} filters - Filters
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @returns {Promise<Object>} Paginated bookings
   */
  async getBookings(userId, orgId, filters = {}, page = 1, limit = 10) {
    try {
      let query = { isActive: true };

      // Apply role-based filtering
      if (orgId) {
        // Garage user - see all garage bookings
        query.garageId = orgId;
      } else {
        // Individual user - see only their bookings
        query.clientId = userId;
      }

      // Apply additional filters
      if (filters.status) query.status = filters.status;
      if (filters.serviceType) query.serviceType = filters.serviceType;
      if (filters.vehicleId) query.vehicleId = filters.vehicleId;
      if (filters.garageId) query.garageId = filters.garageId;

      // Date range filtering
      if (filters.startDate || filters.endDate) {
        query.scheduledDate = {};
        if (filters.startDate)
          query.scheduledDate.$gte = new Date(filters.startDate);
        if (filters.endDate)
          query.scheduledDate.$lte = new Date(filters.endDate);
      }

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { scheduledDate: -1 },
      };

      const bookings = await Booking.find(query, null, options)
        .populate("clientId", "email profile")
        .populate("garageId", "name contact")
        .populate("vehicleId", "make model year plate");

      const total = await Booking.countDocuments(query);

      return {
        success: true,
        bookings,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Get bookings error:", error);
      throw error;
    }
  }

  /**
   * Get single booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Booking data
   */
  async getBooking(bookingId, userId, orgId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate("clientId", "email profile")
        .populate("garageId", "name contact")
        .populate("vehicleId", "make model year plate vin")
        .populate("quotationId")
        .populate("analysisId");

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Check access permissions
      const hasAccess =
        booking.clientId._id.toString() === userId ||
        (orgId && booking.garageId._id.toString() === orgId);

      if (!hasAccess) {
        throw new Error("Access denied");
      }

      return {
        success: true,
        booking,
      };
    } catch (error) {
      console.error("Get booking error:", error);
      throw error;
    }
  }

  /**
   * Update booking
   * @param {string} bookingId - Booking ID
   * @param {Object} updates - Updates to apply
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Updated booking
   */
  async updateBooking(bookingId, updates, userId, orgId) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Check permissions
      const canUpdate =
        booking.createdBy.toString() === userId ||
        (orgId && booking.garageId.toString() === orgId);

      if (!canUpdate) {
        throw new Error("Access denied");
      }

      // Prevent updating certain fields
      delete updates.clientId;
      delete updates.createdBy;
      delete updates.googleCalendarEventId;

      // If rescheduling, check for conflicts
      if (updates.scheduledDate || updates.duration) {
        const newDate = updates.scheduledDate || booking.scheduledDate;
        const newDuration = updates.duration || booking.duration;

        const conflict = await this.checkBookingConflict(
          booking.garageId,
          newDate,
          newDuration
        );

        if (conflict && conflict._id.toString() !== bookingId) {
          throw new Error("Time slot conflict");
        }
      }

      Object.assign(booking, updates);
      await booking.save();

      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "garageId", select: "name contact" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "booking_updated",
        target: {
          type: "booking",
          id: bookingId,
          updates: Object.keys(updates),
        },
      });

      // Sync to Google Calendar (async, don't block)
      googleCalendarService.syncBookingToCalendar(booking).catch((err) => {
        console.error("Calendar sync error:", err);
      });

      return {
        success: true,
        booking,
        message: "Booking updated successfully",
      };
    } catch (error) {
      console.error("Update booking error:", error);
      throw error;
    }
  }

  /**
   * Confirm booking (garage only)
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Confirmed booking
   */
  async confirmBooking(bookingId, userId, orgId) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Only garage can confirm
      if (!orgId || booking.garageId.toString() !== orgId) {
        throw new Error("Only the garage can confirm bookings");
      }

      if (booking.status !== "pending") {
        throw new Error("Only pending bookings can be confirmed");
      }

      booking.status = "confirmed";
      booking.confirmedBy = userId;
      booking.confirmedAt = new Date();

      await booking.save();

      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "garageId", select: "name contact" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "booking_confirmed",
        target: {
          type: "booking",
          id: bookingId,
        },
      });

      // Sync to Google Calendar (async, don't block)
      googleCalendarService.syncBookingToCalendar(booking).catch((err) => {
        console.error("Calendar sync error:", err);
      });

      return {
        success: true,
        booking,
        message: "Booking confirmed successfully",
      };
    } catch (error) {
      console.error("Confirm booking error:", error);
      throw error;
    }
  }

  /**
   * Cancel booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled booking
   */
  async cancelBooking(bookingId, userId, reason) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Check permissions
      const canCancel =
        booking.clientId.toString() === userId ||
        booking.createdBy.toString() === userId;

      if (!canCancel) {
        throw new Error("Access denied");
      }

      if (booking.status === "cancelled") {
        throw new Error("Booking is already cancelled");
      }

      if (booking.status === "completed") {
        throw new Error("Cannot cancel completed booking");
      }

      booking.status = "cancelled";
      booking.cancellationReason = reason;
      booking.cancelledBy = userId;
      booking.cancelledAt = new Date();

      await booking.save();

      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "garageId", select: "name contact" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      // Log activity
      await AuditLog.create({
        actorId: userId,
        action: "booking_cancelled",
        target: {
          type: "booking",
          id: bookingId,
          reason,
        },
      });

      // Sync to Google Calendar (delete event, async, don't block)
      googleCalendarService.syncBookingToCalendar(booking).catch((err) => {
        console.error("Calendar sync error:", err);
      });

      return {
        success: true,
        booking,
        message: "Booking cancelled successfully",
      };
    } catch (error) {
      console.error("Cancel booking error:", error);
      throw error;
    }
  }

  /**
   * Get upcoming bookings
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Upcoming bookings
   */
  async getUpcomingBookings(userId, orgId) {
    try {
      let query = {
        isActive: true,
        scheduledDate: { $gte: new Date() },
        status: { $in: ["pending", "confirmed"] },
      };

      if (orgId) {
        query.garageId = orgId;
      } else {
        query.clientId = userId;
      }

      const bookings = await Booking.find(query)
        .sort({ scheduledDate: 1 })
        .limit(10)
        .populate("clientId", "email profile")
        .populate("garageId", "name contact")
        .populate("vehicleId", "make model year plate");

      return {
        success: true,
        bookings,
      };
    } catch (error) {
      console.error("Get upcoming bookings error:", error);
      throw error;
    }
  }

  /**
   * Get booking statistics (garage only)
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Statistics
   */
  async getBookingStatistics(orgId) {
    try {
      const query = { garageId: orgId, isActive: true };

      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        upcomingBookings,
      ] = await Promise.all([
        Booking.countDocuments(query),
        Booking.countDocuments({ ...query, status: "pending" }),
        Booking.countDocuments({ ...query, status: "confirmed" }),
        Booking.countDocuments({ ...query, status: "completed" }),
        Booking.countDocuments({ ...query, status: "cancelled" }),
        Booking.countDocuments({
          ...query,
          scheduledDate: { $gte: new Date() },
          status: { $in: ["pending", "confirmed"] },
        }),
      ]);

      return {
        success: true,
        statistics: {
          totalBookings,
          pendingBookings,
          confirmedBookings,
          completedBookings,
          cancelledBookings,
          upcomingBookings,
        },
      };
    } catch (error) {
      console.error("Get booking statistics error:", error);
      throw error;
    }
  }
}

module.exports = new BookingService();
