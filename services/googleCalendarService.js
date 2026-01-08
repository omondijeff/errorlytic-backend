const { google } = require("googleapis");
const User = require("../models/User");
const Organization = require("../models/Organization");

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:7337/api/v1/auth/google/calendar/callback"
    );
  }

  /**
   * Generate OAuth URL for user to authorize Google Calendar access
   * @param {string} userId - User ID for state parameter
   * @returns {string} Authorization URL
   */
  generateAuthUrl(userId) {
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: userId, // Pass userId in state to identify user after redirect
      prompt: "consent", // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens and save to user
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Token data
   */
  async handleAuthCallback(code, userId) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Save tokens to user
      await User.findByIdAndUpdate(userId, {
        "googleCalendar.accessToken": tokens.access_token,
        "googleCalendar.refreshToken": tokens.refresh_token,
        "googleCalendar.isConnected": true,
      });

      return {
        success: true,
        message: "Google Calendar connected successfully",
      };
    } catch (error) {
      console.error("OAuth callback error:", error);
      throw new Error("Failed to connect Google Calendar");
    }
  }

  /**
   * Get authenticated calendar client for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Calendar client
   */
  async getCalendarClient(userId) {
    const user = await User.findById(userId);

    if (!user || !user.googleCalendar.isConnected) {
      throw new Error("Google Calendar not connected");
    }

    this.oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken,
    });

    // Handle token refresh
    this.oauth2Client.on("tokens", async (tokens) => {
      if (tokens.refresh_token) {
        await User.findByIdAndUpdate(userId, {
          "googleCalendar.accessToken": tokens.access_token,
          "googleCalendar.refreshToken": tokens.refresh_token,
        });
      } else {
        await User.findByIdAndUpdate(userId, {
          "googleCalendar.accessToken": tokens.access_token,
        });
      }
    });

    return google.calendar({ version: "v3", auth: this.oauth2Client });
  }

  /**
   * Create calendar event for booking
   * @param {Object} booking - Booking object
   * @param {string} garageId - Garage organization ID
   * @returns {Promise<Object>} Created event
   */
  async createCalendarEvent(booking, garageId) {
    try {
      // Get garage settings
      const garage = await Organization.findById(garageId);
      
      if (!garage || !garage.bookingSettings.googleCalendarId) {
        console.log("Garage calendar not configured, skipping event creation");
        return null;
      }

      // Get garage admin user with calendar access
      const garageAdmin = await User.findOne({
        orgId: garageId,
        role: { $in: ["garage_admin", "garage_user"] },
        "googleCalendar.isConnected": true,
      });

      if (!garageAdmin) {
        console.log("No garage user with Google Calendar connected");
        return null;
      }

      const calendar = await this.getCalendarClient(garageAdmin._id);

      // Populate booking references for event details
      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      const endTime = new Date(
        booking.scheduledDate.getTime() + booking.duration * 60000
      );

      const event = {
        summary: `${booking.serviceType.toUpperCase()} - ${booking.vehicleId.make} ${booking.vehicleId.model}`,
        description: `
Service Type: ${booking.serviceType}
Vehicle: ${booking.vehicleId.year} ${booking.vehicleId.make} ${booking.vehicleId.model}
Plate: ${booking.vehicleId.plate}
Client: ${booking.clientId.profile.name} (${booking.clientId.email})
Notes: ${booking.notes || "N/A"}
        `.trim(),
        start: {
          dateTime: booking.scheduledDate.toISOString(),
          timeZone: "Africa/Nairobi", // TODO: Make this configurable
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Africa/Nairobi",
        },
        attendees: [
          { email: booking.clientId.email },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 60 }, // 1 hour before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: garage.bookingSettings.googleCalendarId,
        resource: event,
        sendUpdates: "all", // Send email notifications to attendees
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Create calendar event error:", error);
      // Don't throw - calendar sync is optional
      return null;
    }
  }

  /**
   * Update calendar event
   * @param {string} eventId - Google Calendar event ID
   * @param {Object} booking - Updated booking object
   * @param {string} garageId - Garage organization ID
   * @returns {Promise<Object>} Updated event
   */
  async updateCalendarEvent(eventId, booking, garageId) {
    try {
      const garage = await Organization.findById(garageId);
      
      if (!garage || !garage.bookingSettings.googleCalendarId) {
        return null;
      }

      const garageAdmin = await User.findOne({
        orgId: garageId,
        role: { $in: ["garage_admin", "garage_user"] },
        "googleCalendar.isConnected": true,
      });

      if (!garageAdmin) {
        return null;
      }

      const calendar = await this.getCalendarClient(garageAdmin._id);

      await booking.populate([
        { path: "clientId", select: "email profile" },
        { path: "vehicleId", select: "make model year plate" },
      ]);

      const endTime = new Date(
        booking.scheduledDate.getTime() + booking.duration * 60000
      );

      const event = {
        summary: `${booking.serviceType.toUpperCase()} - ${booking.vehicleId.make} ${booking.vehicleId.model}`,
        description: `
Service Type: ${booking.serviceType}
Vehicle: ${booking.vehicleId.year} ${booking.vehicleId.make} ${booking.vehicleId.model}
Plate: ${booking.vehicleId.plate}
Client: ${booking.clientId.profile.name} (${booking.clientId.email})
Status: ${booking.status}
Notes: ${booking.notes || "N/A"}
        `.trim(),
        start: {
          dateTime: booking.scheduledDate.toISOString(),
          timeZone: "Africa/Nairobi",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Africa/Nairobi",
        },
      };

      const response = await calendar.events.update({
        calendarId: garage.bookingSettings.googleCalendarId,
        eventId: eventId,
        resource: event,
        sendUpdates: "all",
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Update calendar event error:", error);
      return null;
    }
  }

  /**
   * Delete calendar event
   * @param {string} eventId - Google Calendar event ID
   * @param {string} garageId - Garage organization ID
   * @returns {Promise<Object>} Result
   */
  async deleteCalendarEvent(eventId, garageId) {
    try {
      const garage = await Organization.findById(garageId);
      
      if (!garage || !garage.bookingSettings.googleCalendarId) {
        return null;
      }

      const garageAdmin = await User.findOne({
        orgId: garageId,
        role: { $in: ["garage_admin", "garage_user"] },
        "googleCalendar.isConnected": true,
      });

      if (!garageAdmin) {
        return null;
      }

      const calendar = await this.getCalendarClient(garageAdmin._id);

      await calendar.events.delete({
        calendarId: garage.bookingSettings.googleCalendarId,
        eventId: eventId,
        sendUpdates: "all",
      });

      return {
        success: true,
        message: "Calendar event deleted",
      };
    } catch (error) {
      console.error("Delete calendar event error:", error);
      return null;
    }
  }

  /**
   * Sync booking to calendar (create or update)
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Sync result
   */
  async syncBookingToCalendar(booking) {
    try {
      if (booking.status === "cancelled") {
        // Delete event if booking is cancelled
        if (booking.googleCalendarEventId) {
          await this.deleteCalendarEvent(
            booking.googleCalendarEventId,
            booking.garageId
          );
        }
        return { success: true, action: "deleted" };
      }

      if (booking.googleCalendarEventId) {
        // Update existing event
        await this.updateCalendarEvent(
          booking.googleCalendarEventId,
          booking,
          booking.garageId
        );
        return { success: true, action: "updated" };
      } else {
        // Create new event
        const result = await this.createCalendarEvent(
          booking,
          booking.garageId
        );
        
        if (result && result.eventId) {
          // Save event ID to booking
          booking.googleCalendarEventId = result.eventId;
          await booking.save();
        }
        
        return { success: true, action: "created", eventId: result?.eventId };
      }
    } catch (error) {
      console.error("Sync booking to calendar error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect Google Calendar for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async disconnectCalendar(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        "googleCalendar.accessToken": null,
        "googleCalendar.refreshToken": null,
        "googleCalendar.calendarId": null,
        "googleCalendar.isConnected": false,
      });

      return {
        success: true,
        message: "Google Calendar disconnected",
      };
    } catch (error) {
      console.error("Disconnect calendar error:", error);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
