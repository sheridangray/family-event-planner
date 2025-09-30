/**
 * Unified Gmail Client for Multi-User OAuth
 *
 * This replaces all singleton implementations with a clean, database-first approach:
 * - gmail-singleton.js (REPLACED)
 * - gmail-multi-user-singleton.js (REPLACED)
 * - CalendarConflictChecker duplicate code (INTEGRATED)
 *
 * Features:
 * - Database-first OAuth token management
 * - Multi-user support (Sheridan admin, Joyce user)
 * - Unified email and calendar operations
 * - Automatic token refresh
 * - Clean error handling
 */

const { config } = require("../config");
const { google } = require("googleapis");
const { Pool } = require("pg");

class GmailClient {
  constructor(logger, database = null) {
    this.logger = logger;
    this.database = database;
    this.auth = null;
    this.gmail = null;
    this.calendar = null;
    this.isInitialized = false;
    this.db = null;
  }

  /**
   * Initialize the Gmail client with Google credentials
   */
  async init() {
    try {
      this.logger.info("🚀 Initializing unified Gmail MCP client...");

      // Initialize database connection if not provided
      if (!this.database) {
        this._initializeDatabase();
      }

      // Get Google credentials
      const credentials = await this._getGoogleCredentials();

      // Create OAuth2 client
      const { client_secret, client_id, redirect_uris } = credentials.installed;

      // Use frontend OAuth callback URL if available, otherwise fall back to backend
      const frontendUrl =
        process.env.FRONTEND_URL || "https://sheridangray.com";
      const redirectUri = `${frontendUrl}/auth/oauth-callback`;

      this.logger.info(`🔍 FRONTEND_URL env var: ${process.env.FRONTEND_URL}`);
      this.logger.info(`🔍 Computed frontendUrl: ${frontendUrl}`);
      this.logger.info(`🔍 Computed redirectUri: ${redirectUri}`);
      this.logger.info(`🔗 Using OAuth redirect URI: ${redirectUri}`);
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirectUri);

      // Set up Gmail and Calendar APIs
      this.gmail = google.gmail({ version: "v1", auth: this.auth });
      this.calendar = google.calendar({ version: "v3", auth: this.auth });

      this.isInitialized = true;
      this.logger.info("✅ Unified Gmail client initialized successfully");

      return true;
    } catch (error) {
      this.logger.error("❌ Failed to initialize Gmail client:", error.message);
      throw error;
    }
  }

  /**
   * Get authenticated client for a specific user
   * @param {number} userId - User ID from users table
   * @returns {Promise<GmailClient>} Authenticated client instance
   */
  async getAuthenticatedClient(userId) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const tokens = await this._loadTokensFromDatabase(userId);
      this.auth.setCredentials(tokens);

      this.logger.debug(`✅ Gmail client authenticated for user ${userId}`);
      return this;
    } catch (error) {
      this.logger.error(
        `❌ Failed to authenticate user ${userId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Send email using authenticated user's account
   * @param {number} userId - User ID
   * @param {string|Array} to - Recipient email(s)
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(userId, to, subject, body, options = {}) {
    const client = await this.getAuthenticatedClient(userId);

    try {
      const recipients = Array.isArray(to) ? to : [to];
      this.logger.info(
        `📧 Sending email to ${recipients.join(", ")}: ${subject}`
      );

      const message = this._createEmailMessage(
        recipients,
        subject,
        body,
        options
      );

      const response = await client.gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: message },
      });

      this.logger.info(
        `✅ Email sent successfully, message ID: ${response.data.id}`
      );
      return {
        success: true,
        messageId: response.data.id,
        recipients: recipients,
      };
    } catch (error) {
      // Auto-retry with token refresh for auth errors
      if (error.message.includes("invalid_grant") || error.code === 401) {
        this.logger.warn("🔄 Token expired, attempting refresh...");
        await this._refreshTokens(userId);

        // Retry once
        const refreshedClient = await this.getAuthenticatedClient(userId);
        const message = this._createEmailMessage(
          Array.isArray(to) ? to : [to],
          subject,
          body,
          options
        );
        const response = await refreshedClient.gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: message },
        });

        return {
          success: true,
          messageId: response.data.id,
          recipients: Array.isArray(to) ? to : [to],
        };
      }

      this.logger.error(`❌ Error sending email:`, error.message);
      return {
        success: false,
        error: error.message,
        recipients: Array.isArray(to) ? to : [to],
      };
    }
  }

  /**
   * Check calendar conflicts for event scheduling
   * @param {number} userId - User ID
   * @param {string} eventDate - Event date/time
   * @param {number} durationMinutes - Event duration
   * @returns {Promise<Object>} Conflict check result
   */
  async checkCalendarConflicts(userId, eventDate, durationMinutes = 120) {
    const client = await this.getAuthenticatedClient(userId);

    try {
      const eventStart = new Date(eventDate);
      const eventEnd = new Date(
        eventStart.getTime() + durationMinutes * 60 * 1000
      );

      const bufferMinutes = 30;
      const checkStart = new Date(
        eventStart.getTime() - bufferMinutes * 60 * 1000
      );
      const checkEnd = new Date(eventEnd.getTime() + bufferMinutes * 60 * 1000);

      this.logger.debug(
        `📅 Checking calendar conflicts for user ${userId} from ${checkStart.toISOString()} to ${checkEnd.toISOString()}`
      );

      const events = await this._getCalendarEvents(
        client,
        checkStart,
        checkEnd
      );
      const conflicts = this._filterConflictingEvents(
        events,
        checkStart,
        checkEnd
      );

      const hasConflict = conflicts.length > 0;

      if (hasConflict) {
        this.logger.info(
          `❌ Found ${conflicts.length} calendar conflict(s) for user ${userId}`
        );
        conflicts.forEach((conflict) => {
          this.logger.debug(
            `  Conflict: "${conflict.title}" (${conflict.start} - ${conflict.end})`
          );
        });
      } else {
        this.logger.debug(`✅ No calendar conflicts found for user ${userId}`);
      }

      return {
        hasConflict,
        conflicts,
        checkedTimeRange: { start: checkStart, end: checkEnd },
        calendarAccessible: true,
      };
    } catch (error) {
      this.logger.error(
        `❌ Calendar conflict check failed for user ${userId}:`,
        error.message
      );

      return {
        hasConflict: false,
        conflicts: [],
        warnings: [`Calendar check failed: ${error.message}`],
        calendarAccessible: false,
        error: error.message,
      };
    }
  }

  /**
   * Create calendar event
   * @param {number} userId - User ID
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Calendar event creation result
   */
  async createCalendarEvent(userId, eventData) {
    const client = await this.getAuthenticatedClient(userId);

    try {
      this.logger.info(
        `📅 Creating calendar event for user ${userId}: ${eventData.title}`
      );

      const calendarEvent = {
        summary: `Family Event: ${eventData.title}`,
        description: this._buildEventDescription(eventData),
        location: eventData.location?.address || "",
        start: {
          dateTime: new Date(eventData.date).toISOString(),
          timeZone: "America/Los_Angeles",
        },
        end: {
          dateTime: new Date(
            new Date(eventData.date).getTime() + 2 * 60 * 60 * 1000
          ).toISOString(),
          timeZone: "America/Los_Angeles",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 10080 }, // 1 week
            { method: "popup", minutes: 1440 }, // 1 day
            { method: "popup", minutes: 120 }, // 2 hours
          ],
        },
      };

      const event = await client.calendar.events.insert({
        calendarId: "primary",
        resource: calendarEvent,
      });

      this.logger.info(`✅ Calendar event created with ID: ${event.data.id}`);
      return {
        success: true,
        eventId: event.data.id,
        htmlLink: event.data.htmlLink,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating calendar event:`, error.message);
      throw error;
    }
  }

  /**
   * Complete OAuth flow for a user
   * @param {number} userId - User ID
   * @param {string} email - User email
   * @param {string} authCode - OAuth authorization code
   * @returns {Promise<Object>} OAuth completion result
   */
  async completeOAuthFlow(userId, email, authCode) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      this.logger.info(
        `🔑 Completing OAuth flow for user ${userId} (${email})`
      );

      // Exchange authorization code for tokens
      const { tokens } = await this.auth.getToken(authCode);
      this.logger.debug(`Received tokens:`, Object.keys(tokens));

      // Save tokens to database
      await this._saveTokensToDatabase(userId, tokens);

      // Test the connection
      this.auth.setCredentials(tokens);
      const profile = await this.gmail.users.getProfile({ userId: "me" });

      this.logger.info(
        `✅ OAuth completed successfully for ${email}, profile: ${profile.data.emailAddress}`
      );

      return {
        success: true,
        email: profile.data.emailAddress,
        authenticated: true,
      };
    } catch (error) {
      this.logger.error(
        `❌ OAuth flow failed for user ${userId}:`,
        error.message
      );
      await this._logOAuthError(userId, "oauth_failed", error.message);
      throw error;
    }
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} email - User email for login hint
   * @returns {Promise<string>} OAuth authorization URL
   */
  async getAuthUrl(email = null) {
    if (!this.isInitialized) {
      await this.init();
    }

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ];

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      login_hint: email,
    });

    this.logger.info(`🔗 Generated OAuth URL for ${email || "default"}`);
    return authUrl;
  }

  /**
   * Check if a user is authenticated
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Authentication status
   */
  async isUserAuthenticated(userId) {
    try {
      const tokens = await this._loadTokensFromDatabase(userId);

      // Check if token is not expired (with 5 minute buffer)
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5 minutes
      const isValid = now < tokens.expiry_date - buffer;

      // If token is expired but we have a refresh token, try to refresh it
      if (!isValid && tokens.refresh_token) {
        this.logger.info(
          `🔄 Access token expired for user ${userId}, attempting auto-refresh...`
        );
        try {
          // Initialize client if needed
          if (!this.isInitialized) {
            await this.init();
          }

          // Set credentials and refresh
          this.auth.setCredentials(tokens);
          const { credentials: newTokens } = await this.auth.refreshAccessToken();
          await this._saveTokensToDatabase(userId, newTokens);

          this.logger.info(
            `✅ Successfully auto-refreshed tokens for user ${userId}`
          );
          return true;
        } catch (refreshError) {
          this.logger.error(
            `❌ Failed to auto-refresh tokens for user ${userId}:`,
            refreshError.message
          );
          return false;
        }
      }

      this.logger.debug(`🔍 User ${userId} authentication status: ${isValid}`);
      return isValid;
    } catch (error) {
      this.logger.debug(
        `🔍 User ${userId} not authenticated: ${error.message}`
      );
      return false;
    }
  }

  // ===== PRIVATE METHODS =====

  /**
   * Initialize database connection
   * @private
   */
  _initializeDatabase() {
    if (!this.db) {
      const connectionString =
        process.env.DATABASE_URL ||
        "postgresql://localhost:5432/family_event_planner";
      this.db = new Pool({
        connectionString,
        ssl: connectionString.includes("render.com")
          ? { rejectUnauthorized: false }
          : false,
      });
    }
  }

  /**
   * Get Google OAuth credentials
   * @private
   */
  async _getGoogleCredentials() {
    // Check if credentials are provided as JSON string in environment
    if (process.env.MCP_GMAIL_CREDENTIALS_JSON) {
      return JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON);
    }

    throw new Error(
      "Gmail MCP credentials not configured. Set MCP_GMAIL_CREDENTIALS_JSON environment variable."
    );
  }

  /**
   * Load OAuth tokens from database
   * @param {number} userId - User ID
   * @private
   */
  async _loadTokensFromDatabase(userId) {
    this._initializeDatabase();

    const result = await this.db.query(
      "SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = $2",
      [userId, "google"]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `No OAuth tokens found for user ${userId}. Please complete OAuth flow.`
      );
    }

    const row = result.rows[0];
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      token_type: row.token_type || "Bearer",
      scope: row.scope,
      expiry_date: row.expiry_date,
    };
  }

  /**
   * Save OAuth tokens to database
   * @param {number} userId - User ID
   * @param {Object} tokens - OAuth tokens
   * @private
   */
  async _saveTokensToDatabase(userId, tokens) {
    this._initializeDatabase();

    await this.db.query(
      `
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_type, scope, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = NOW()
    `,
      [
        userId,
        "google",
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type || "Bearer",
        tokens.scope,
        tokens.expiry_date,
      ]
    );

    // Log successful token update
    await this._logOAuthSuccess(userId, "token_updated");
    this.logger.info(`🔐 Saved OAuth tokens to database for user ${userId}`);
  }

  /**
   * Refresh OAuth tokens for a user
   * @param {number} userId - User ID
   * @private
   */
  async _refreshTokens(userId) {
    try {
      this.logger.info(`🔄 Refreshing tokens for user ${userId}...`);

      const { credentials: newTokens } = await this.auth.refreshAccessToken();
      await this._saveTokensToDatabase(userId, newTokens);

      this.logger.info(`✅ Tokens refreshed successfully for user ${userId}`);
      return newTokens;
    } catch (error) {
      this.logger.error(
        `❌ Token refresh failed for user ${userId}:`,
        error.message
      );
      await this._logOAuthError(userId, "token_refresh_failed", error.message);
      throw error;
    }
  }

  /**
   * Get calendar events for conflict checking
   * @param {Object} client - Authenticated client
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @private
   */
  async _getCalendarEvents(client, startTime, endTime) {
    const response = await client.calendar.events.list({
      calendarId: "primary",
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
      fields: "items(id,summary,start,end,status)",
    });

    const events = response.data.items || [];
    return events.filter((event) => event.status !== "cancelled");
  }

  /**
   * Filter events that conflict with the specified time range
   * @param {Array} events - Calendar events
   * @param {Date} startTime - Check start time
   * @param {Date} endTime - Check end time
   * @private
   */
  _filterConflictingEvents(events, startTime, endTime) {
    return events
      .filter((event) => {
        if (!event.start || !event.end) return false;

        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);

        const hasTimeOverlap = eventStart < endTime && eventEnd > startTime;
        const isAllDay = !event.start.dateTime;

        return hasTimeOverlap && !isAllDay;
      })
      .map((event) => ({
        title: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        isAllDay: !event.start.dateTime,
      }));
  }

  /**
   * Create RFC2822 email message
   * @param {Array} to - Recipients
   * @param {string} subject - Subject
   * @param {string} body - Body
   * @param {Object} options - Options
   * @private
   */
  _createEmailMessage(to, subject, body, options = {}) {
    const boundary = "boundary_" + Math.random().toString(36).substr(2, 9);

    let message = [
      `To: ${to.join(", ")}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString(
        "base64"
      )}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf-8").toString("base64"),
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(this._convertTextToHtml(body), "utf-8").toString("base64"),
      "",
      `--${boundary}--`,
    ].join("\n");

    // Encode in base64url format
    return Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * Convert plain text to HTML
   * @param {string} text - Plain text
   * @private
   */
  _convertTextToHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  /**
   * Build event description for calendar
   * @param {Object} eventData - Event data
   * @private
   */
  _buildEventDescription(eventData) {
    let description = eventData.description || "";

    description += "\n\n--- Event Details ---\n";
    description += `Source: ${eventData.source}\n`;
    description += `Ages: ${eventData.ageRange?.min || 0}-${
      eventData.ageRange?.max || 18
    }\n`;
    description += `Cost: ${eventData.cost ? "$" + eventData.cost : "Free"}\n`;

    if (eventData.registrationUrl) {
      description += `Registration: ${eventData.registrationUrl}\n`;
    }

    description += "\n🎉 This is a new adventure for our family!\n";
    description += "\n🤖 Generated with Family Event Planner";

    return description;
  }

  /**
   * Log successful OAuth operation
   * @param {number} userId - User ID
   * @param {string} action - Action name
   * @private
   */
  async _logOAuthSuccess(userId, action) {
    try {
      this._initializeDatabase();
      await this.db.query(
        `
        INSERT INTO oauth_audit_log (user_id, action, provider, success)
        VALUES ($1, $2, $3, $4)
      `,
        [userId, action, "google", true]
      );
    } catch (error) {
      // Silent fail on audit logging
      this.logger.warn("Failed to log OAuth success:", error.message);
    }
  }

  /**
   * Log OAuth error
   * @param {number} userId - User ID
   * @param {string} action - Action name
   * @param {string} errorMessage - Error message
   * @private
   */
  async _logOAuthError(userId, action, errorMessage) {
    try {
      this._initializeDatabase();
      await this.db.query(
        `
        INSERT INTO oauth_audit_log (user_id, action, provider, success, error_message)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [userId, action, "google", false, errorMessage]
      );
    } catch (error) {
      // Silent fail on audit logging
      this.logger.warn("Failed to log OAuth error:", error.message);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.db) {
      await this.db.end();
      this.db = null;
    }
  }
}

module.exports = { GmailClient };
