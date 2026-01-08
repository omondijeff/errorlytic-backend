const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const bookingService = require("../services/bookingService");

const router = express.Router();

/**
 * @route   POST /api/v1/bookings
 * @desc    Create new booking
 * @access  Private
 */
router.post(
  "/",
  authMiddleware,
  [
    body("garageId").notEmpty().withMessage("Garage ID is required"),
    body("vehicleId").notEmpty().withMessage("Vehicle ID is required"),
    body("serviceType")
      .isIn(["inspection", "repair", "maintenance", "diagnostic"])
      .withMessage("Invalid service type"),
    body("scheduledDate")
      .isISO8601()
      .withMessage("Valid scheduled date is required"),
    body("duration")
      .optional()
      .isInt({ min: 15 })
      .withMessage("Duration must be at least 15 minutes"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Invalid input data",
        errors: errors.array(),
      });
    }

    try {
      const userId = req.user._id;
      const result = await bookingService.createBooking(req.body, userId);

      res.status(201).json({
        type: "booking_created",
        title: "Booking Created Successfully",
        detail: result.message,
        data: result.booking,
      });
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/bookings
 * @desc    Get bookings with filtering
 * @access  Private
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;
    const {
      page = 1,
      limit = 10,
      status,
      serviceType,
      vehicleId,
      garageId,
      startDate,
      endDate,
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (serviceType) filters.serviceType = serviceType;
    if (vehicleId) filters.vehicleId = vehicleId;
    if (garageId) filters.garageId = garageId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await bookingService.getBookings(
      userId,
      orgId,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      type: "bookings_retrieved",
      title: "Bookings Retrieved Successfully",
      data: result.bookings,
      meta: {
        total: result.total,
        page: result.page,
        pages: result.pages,
      },
    });
  } catch (error) {
    console.error("Error retrieving bookings:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/bookings/upcoming
 * @desc    Get upcoming bookings
 * @access  Private
 */
router.get("/upcoming", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await bookingService.getUpcomingBookings(userId, orgId);

    res.status(200).json({
      type: "upcoming_bookings_retrieved",
      title: "Upcoming Bookings Retrieved Successfully",
      data: result.bookings,
    });
  } catch (error) {
    console.error("Error retrieving upcoming bookings:", error);
    res.status(500).json({
      type: "internal_server_error",
      title: "Internal Server Error",
      detail: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/bookings/statistics
 * @desc    Get booking statistics (garage only)
 * @access  Private (Garage users only)
 */
router.get(
  "/statistics",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const orgId = req.user.orgId;

      if (!orgId) {
        return res.status(400).json({
          type: "bad_request",
          title: "Bad Request",
          detail: "Organization ID required",
        });
      }

      const result = await bookingService.getBookingStatistics(orgId);

      res.status(200).json({
        type: "booking_statistics",
        title: "Booking Statistics Retrieved Successfully",
        data: result.statistics,
      });
    } catch (error) {
      console.error("Error retrieving booking statistics:", error);
      res.status(500).json({
        type: "internal_server_error",
        title: "Internal Server Error",
        detail: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/bookings/:id
 * @desc    Get single booking
 * @access  Private
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const orgId = req.user.orgId;

    const result = await bookingService.getBooking(id, userId, orgId);

    res.status(200).json({
      type: "booking_retrieved",
      title: "Booking Retrieved Successfully",
      data: result.booking,
    });
  } catch (error) {
    console.error("Error retrieving booking:", error);
    const statusCode = error.message === "Access denied" ? 403 : 404;
    res.status(statusCode).json({
      type: error.message === "Access denied" ? "access_denied" : "not_found",
      title: error.message === "Access denied" ? "Access Denied" : "Not Found",
      detail: error.message,
    });
  }
});

/**
 * @route   PUT /api/v1/bookings/:id
 * @desc    Update booking
 * @access  Private
 */
router.put(
  "/:id",
  authMiddleware,
  [
    body("serviceType")
      .optional()
      .isIn(["inspection", "repair", "maintenance", "diagnostic"])
      .withMessage("Invalid service type"),
    body("scheduledDate")
      .optional()
      .isISO8601()
      .withMessage("Valid scheduled date required"),
    body("duration")
      .optional()
      .isInt({ min: 15 })
      .withMessage("Duration must be at least 15 minutes"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
    body("garageNotes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Garage notes must be less than 1000 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Invalid input data",
        errors: errors.array(),
      });
    }

    try {
      const { id } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await bookingService.updateBooking(
        id,
        req.body,
        userId,
        orgId
      );

      res.status(200).json({
        type: "booking_updated",
        title: "Booking Updated Successfully",
        detail: result.message,
        data: result.booking,
      });
    } catch (error) {
      console.error("Error updating booking:", error);
      const statusCode =
        error.message === "Access denied"
          ? 403
          : error.message === "Time slot conflict"
          ? 409
          : 500;
      res.status(statusCode).json({
        type: "error",
        title: "Error",
        detail: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/v1/bookings/:id/confirm
 * @desc    Confirm booking (garage only)
 * @access  Private (Garage users only)
 */
router.post(
  "/:id/confirm",
  authMiddleware,
  requireRole(["garage_user", "garage_admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const orgId = req.user.orgId;

      const result = await bookingService.confirmBooking(id, userId, orgId);

      res.status(200).json({
        type: "booking_confirmed",
        title: "Booking Confirmed Successfully",
        detail: result.message,
        data: result.booking,
      });
    } catch (error) {
      console.error("Error confirming booking:", error);
      const statusCode = error.message.includes("Only") ? 403 : 500;
      res.status(statusCode).json({
        type: "error",
        title: "Error",
        detail: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/v1/bookings/:id/cancel
 * @desc    Cancel booking
 * @access  Private
 */
router.post(
  "/:id/cancel",
  authMiddleware,
  [
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Reason must be less than 500 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Invalid input data",
        errors: errors.array(),
      });
    }

    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;

      const result = await bookingService.cancelBooking(id, userId, reason);

      res.status(200).json({
        type: "booking_cancelled",
        title: "Booking Cancelled Successfully",
        detail: result.message,
        data: result.booking,
      });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      const statusCode = error.message === "Access denied" ? 403 : 500;
      res.status(statusCode).json({
        type: "error",
        title: "Error",
        detail: error.message,
      });
    }
  }
);

module.exports = router;
