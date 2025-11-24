const express = require("express");
const { google } = require("googleapis");
const { authenticateMobileJWT } = require("../middleware/auth");

/**
 * Create calendar router for Google Calendar integration
 * @param {Object} database - Database instance
 * @param {Object} logger - Logger instance
 * @returns {express.Router} Express router
 */
function createCalendarRouter(database, logger) {
  const router = express.Router();

  // All routes require authentication
  router.use(authenticateMobileJWT);

  /**
   * POST /api/calendar/connect
   * Store user's calendar OAuth tokens
   */
  router.post("/connect", async (req, res) => {
    try {
      const userId = req.user.id;
      const { access_token, refresh_token, expires_at, scope } = req.body;

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: "Missing access_token",
        });
      }

      logger.info(`Storing calendar tokens for user ${userId}`);

      // Store tokens in database
      await database.postgres.saveOAuthToken(
        userId,
        "google_calendar",
        access_token,
        refresh_token || null,
        "Bearer",
        scope || "",
        expires_at ? new Date(expires_at * 1000) : null
      );

      logger.info(`✅ Calendar connected for user ${userId}`);

      res.json({
        success: true,
        message: "Calendar connected successfully",
      });
    } catch (error) {
      logger.error("Error connecting calendar:", error);
      res.status(500).json({
        success: false,
        error: "Failed to connect calendar",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/calendar/disconnect
   * Remove user's calendar OAuth tokens
   */
  router.delete("/disconnect", async (req, res) => {
    try {
      const userId = req.user.id;

      logger.info(`Disconnecting calendar for user ${userId}`);

      await database.postgres.deleteOAuthToken(userId, "google_calendar");

      logger.info(`✅ Calendar disconnected for user ${userId}`);

      res.json({
        success: true,
        message: "Calendar disconnected successfully",
      });
    } catch (error) {
      logger.error("Error disconnecting calendar:", error);
      res.status(500).json({
        success: false,
        error: "Failed to disconnect calendar",
      });
    }
  });

  /**
   * GET /api/calendar/events
   * Fetch upcoming calendar events
   */
  router.get("/events", async (req, res) => {
    try {
      const userId = req.user.id;
      const days = parseInt(req.query.days) || 30;

      logger.info(
        `Fetching calendar events for user ${userId} (next ${days} days)`
      );

      // Get user's OAuth token
      const tokenData = await database.postgres.getOAuthToken(
        userId,
        "google_calendar"
      );

      if (!tokenData) {
        logger.warn(`Calendar not connected for user ${userId}`);
        return res.status(404).json({
          success: false,
          error: "Calendar not connected",
          needsAuth: true,
        });
      }

      // Check if token is expired
      if (
        tokenData.expiry_date &&
        new Date(tokenData.expiry_date) < new Date()
      ) {
        logger.warn(`Calendar token expired for user ${userId}`);
        return res.status(401).json({
          success: false,
          error: "Calendar authorization expired",
          needsReauth: true,
        });
      }

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      });

      // Initialize Calendar API
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Calculate date range
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      logger.info(`Querying Google Calendar API for user ${userId}`);

      // Fetch events
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: futureDate.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items.map((event) => ({
        id: event.id,
        summary: event.summary || "Untitled Event",
        description: event.description || null,
        location: event.location || null,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        htmlLink: event.htmlLink || null,
      }));

      logger.info(
        `✅ Fetched ${events.length} calendar events for user ${userId}`
      );

      res.json({
        success: true,
        events,
        count: events.length,
      });
    } catch (error) {
      logger.error("Error fetching calendar events:", error);

      // Handle Google API errors
      if (error.code === 401 || error.message?.includes("invalid_grant")) {
        return res.status(401).json({
          success: false,
          error: "Calendar authorization expired",
          needsReauth: true,
        });
      }

      if (error.code === 403) {
        return res.status(403).json({
          success: false,
          error: "Calendar access forbidden. Please reconnect.",
          needsReauth: true,
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to fetch calendar events",
        message: error.message,
      });
    }
  });

  /**
   * POST /api/calendar/events
   * Create a new calendar event
   */
  router.post("/events", async (req, res) => {
    try {
      const userId = req.user.id;
      const { summary, description, location, start, end } = req.body;

      if (!summary || !start || !end) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: summary, start, end",
        });
      }

      logger.info(`Creating calendar event for user ${userId}: ${summary}`);

      // Get user's OAuth token
      const tokenData = await database.postgres.getOAuthToken(
        userId,
        "google_calendar"
      );

      if (!tokenData) {
        return res.status(404).json({
          success: false,
          error: "Calendar not connected",
          needsAuth: true,
        });
      }

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      });

      // Initialize Calendar API
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Create event
      const event = {
        summary,
        description: description || null,
        location: location || null,
        start: {
          dateTime: start,
          timeZone: "America/Los_Angeles",
        },
        end: {
          dateTime: end,
          timeZone: "America/Los_Angeles",
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
      });

      logger.info(
        `✅ Created calendar event for user ${userId}: ${response.data.id}`
      );

      res.json({
        success: true,
        event: {
          id: response.data.id,
          summary: response.data.summary,
          htmlLink: response.data.htmlLink,
        },
      });
    } catch (error) {
      logger.error("Error creating calendar event:", error);

      if (error.code === 401) {
        return res.status(401).json({
          success: false,
          error: "Calendar authorization expired",
          needsReauth: true,
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to create calendar event",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/calendar/status
   * Check if user has calendar connected
   */
  router.get("/status", async (req, res) => {
    try {
      const userId = req.user.id;
      const tokenData = await database.postgres.getOAuthToken(
        userId,
        "google_calendar"
      );

      const connected = !!tokenData;
      const expired =
        tokenData?.expiry_date && new Date(tokenData.expiry_date) < new Date();

      res.json({
        success: true,
        connected,
        expired: expired || false,
        expires_at: tokenData?.expiry_date || null,
      });
    } catch (error) {
      logger.error("Error checking calendar status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check calendar status",
      });
    }
  });

  return router;
}

module.exports = createCalendarRouter;
