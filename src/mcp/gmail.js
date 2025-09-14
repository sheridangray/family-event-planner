const { config } = require('../config');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GmailMCPClient {
  constructor(logger) {
    this.logger = logger;
    this.auth = null;
    this.calendar = null;
  }

  async init() {
    try {
      this.logger.info('Initializing Gmail MCP client...');
      
      if (!config.gmail.mcpCredentials) {
        throw new Error('Gmail MCP credentials not configured');
      }
      
      let credentials;
      
      // Check if mcpCredentials is already a JSON object (from environment variable)
      if (typeof config.gmail.mcpCredentials === 'object') {
        credentials = config.gmail.mcpCredentials;
        this.logger.debug('Using Gmail credentials from environment variable');
      } else {
        // Load credentials from file path
        const credentialsPath = config.gmail.mcpCredentials;
        if (!fs.existsSync(credentialsPath)) {
          // Try to parse as JSON string if file doesn't exist
          try {
            credentials = JSON.parse(credentialsPath);
            this.logger.debug('Parsed Gmail credentials from JSON string');
          } catch (parseError) {
            throw new Error(`Gmail credentials file not found: ${credentialsPath}`);
          }
        } else {
          credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
          this.logger.debug('Loaded Gmail credentials from file');
        }
      }
      
      // Create OAuth2 client
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      
      // Set up Calendar and Gmail APIs
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      // Load OAuth token from local file or Render secret file
      let tokenLoaded = false;
      
      // First try local development path
      const tokenPath = path.join(__dirname, '../../credentials/google-oauth-token.json');
      if (fs.existsSync(tokenPath)) {
        try {
          const token = fs.readFileSync(tokenPath, 'utf8');
          this.auth.setCredentials(JSON.parse(token));
          this.logger.info('Gmail MCP client initialized with local token file');
          tokenLoaded = true;
        } catch (error) {
          this.logger.warn('Error loading local token file:', error.message);
        }
      }
      
      // If no local token, try Render secret file path (production)
      if (!tokenLoaded && process.env.NODE_ENV === 'production') {
        const renderTokenPath = '/etc/secrets/google-oauth-token.json';
        if (fs.existsSync(renderTokenPath)) {
          try {
            const token = fs.readFileSync(renderTokenPath, 'utf8');
            this.auth.setCredentials(JSON.parse(token));
            this.logger.info('Gmail MCP client initialized with Render secret token');
            tokenLoaded = true;
          } catch (error) {
            this.logger.warn('Error loading Render secret token:', error.message);
          }
        }
      }
      
      if (!tokenLoaded) {
        this.logger.warn('No OAuth token found. Calendar access will require authentication.');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Gmail MCP client:', error.message);
      throw error;
    }
  }

  async authenticate() {
    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly'
      ]
    });
    
    this.logger.info('Authorize this app by visiting this URL:');
    this.logger.info('[OAuth URL generated - contains sensitive client_id]');
    
    return authUrl;
  }

  async setAuthCode(code) {
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      
      // Save token to file for future use
      const tokenPath = path.join(__dirname, '../../credentials/google-oauth-token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));
      
      this.logger.info('Token saved successfully');
      return true;
    } catch (error) {
      this.logger.error('Error setting auth code:', error.message);
      throw error;
    }
  }

  async checkCalendarConflicts(eventDate, durationMinutes = 120) {
    try {
      const eventStart = new Date(eventDate);
      const eventEnd = new Date(eventStart.getTime() + (durationMinutes * 60 * 1000));
      
      const bufferMinutes = 30;
      const checkStart = new Date(eventStart.getTime() - (bufferMinutes * 60 * 1000));
      const checkEnd = new Date(eventEnd.getTime() + (bufferMinutes * 60 * 1000));
      
      // Check both calendars with enhanced error handling using Promise.allSettled
      const calendarChecks = await Promise.allSettled([
        this.checkSingleCalendar(config.gmail.parent1Email, checkStart, checkEnd),
        this.checkSingleCalendar(config.gmail.parent2Email, checkStart, checkEnd)
      ]);
      
      const joyceResult = calendarChecks[0];
      const sheridanResult = calendarChecks[1];
      
      let joyceConflicts = [];
      let sheridanConflicts = [];
      let warnings = [];
      
      // Handle Joyce's calendar result (blocking conflicts)
      if (joyceResult.status === 'fulfilled') {
        joyceConflicts = joyceResult.value;
      } else {
        const error = joyceResult.reason;
        this.logger.warn(`Joyce's calendar check failed: ${error.message}`);
        warnings.push(`Joyce's calendar unavailable (${error.message})`);
      }
      
      // Handle Sheridan's calendar result (warning conflicts)
      if (sheridanResult.status === 'fulfilled') {
        sheridanConflicts = sheridanResult.value;
      } else {
        const error = sheridanResult.reason;
        this.logger.warn(`Sheridan's calendar check failed: ${error.message}`);
        warnings.push(`Sheridan's calendar unavailable (${error.message})`);
      }
      
      // Only Joyce's conflicts block the event
      const hasBlockingConflict = joyceConflicts.length > 0;
      const hasWarningConflict = sheridanConflicts.length > 0;
      
      if (hasBlockingConflict) {
        this.logger.info(`❌ Event BLOCKED - Joyce has ${joyceConflicts.length} calendar conflict(s) for ${eventDate}`);
        joyceConflicts.forEach(conflict => {
          this.logger.debug(`  Conflict: "${conflict.title}" (${conflict.start} - ${conflict.end})`);
        });
      }
      
      if (hasWarningConflict) {
        this.logger.warn(`⚠️  Event WARNING - Sheridan has ${sheridanConflicts.length} calendar conflict(s) for ${eventDate}`);
        sheridanConflicts.forEach(conflict => {
          this.logger.debug(`  Conflict: "${conflict.title}" (${conflict.start} - ${conflict.end})`);
        });
      }
      
      if (warnings.length > 0) {
        this.logger.warn(`Calendar accessibility issues: ${warnings.join(', ')}`);
      }
      
      return {
        hasConflict: hasBlockingConflict, // Only Joyce's conflicts block
        hasWarning: hasWarningConflict,   // Sheridan's conflicts warn
        blockingConflicts: joyceConflicts,
        warningConflicts: sheridanConflicts,
        conflicts: [...joyceConflicts, ...sheridanConflicts], // All conflicts for reference
        warnings,
        calendarAccessible: {
          joyce: joyceResult.status === 'fulfilled',
          sheridan: sheridanResult.status === 'fulfilled'
        },
        checkedTimeRange: {
          start: checkStart,
          end: checkEnd
        }
      };
      
    } catch (error) {
      this.logger.error(`Calendar conflict check failed completely for ${eventDate}:`, error.message);
      
      return {
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: [`Calendar system completely unavailable: ${error.message}`],
        calendarAccessible: {
          joyce: false,
          sheridan: false
        },
        error: error.message,
        summary: 'Calendar check failed - proceeding with caution'
      };
    }
  }

  async checkSingleCalendar(email, startTime, endTime) {
    try {
      this.logger.debug(`Checking calendar for ${email} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      const timeMin = startTime.toISOString();
      const timeMax = endTime.toISOString();
      
      const events = await this.getCalendarEvents(email, timeMin, timeMax);
      
      const conflicts = events.filter(event => {
        if (!event.start || !event.end) return false;
        
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        
        const hasTimeOverlap = (
          eventStart < endTime && eventEnd > startTime
        );
        
        const isAllDay = !event.start.dateTime;
        
        return hasTimeOverlap && !isAllDay;
      });
      
      return conflicts.map(event => ({
        email,
        title: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        isAllDay: !event.start.dateTime
      }));
      
    } catch (error) {
      this.logger.error(`Error checking calendar for ${email}:`, error.message);
      return [];
    }
  }

  async getCalendarEvents(email, timeMin, timeMax, retryCount = 0) {
    try {
      this.logger.debug(`Fetching calendar events for ${email} from ${timeMin} to ${timeMax}`);
      
      // Determine which calendar to access
      let calendarId = 'primary';
      
      // If checking a specific email that's not the authenticated user, we might need to access their calendar
      // For now, we'll use 'primary' and rely on shared calendar access or delegation
      if (email !== config.gmail.parent1Email && email !== config.gmail.parent2Email) {
        this.logger.warn(`Unknown email ${email}, using primary calendar`);
      }
      
      // If checking Joyce's calendar and it's not the primary authenticated account
      if (email === config.gmail.parent1Email && email !== process.env.PARENT1_EMAIL) {
        // Try to access Joyce's calendar directly if shared
        calendarId = email;
      }
      
      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
        fields: 'items(id,summary,start,end,status)'
      });
      
      const events = response.data.items || [];
      
      // Filter out cancelled events
      const activeEvents = events.filter(event => event.status !== 'cancelled');
      
      this.logger.debug(`Found ${activeEvents.length} active events for ${email}`);
      
      return activeEvents;
      
    } catch (error) {
      // Handle automatic token refresh for invalid_grant errors
      if (error.message.includes('invalid_grant') && retryCount === 0) {
        this.logger.warn(`Token expired for ${email}, attempting automatic refresh...`);
        try {
          await this.refreshToken();
          this.logger.info(`Token refreshed successfully, retrying calendar request for ${email}`);
          return await this.getCalendarEvents(email, timeMin, timeMax, retryCount + 1);
        } catch (refreshError) {
          this.logger.error(`Token refresh failed for ${email}:`, refreshError.message);
          // Fall through to original error handling
        }
      }
      
      // Handle specific API errors with detailed logging
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack?.split('\n')[0] // First line of stack trace
      };
      
      if (error.code === 403) {
        this.logger.warn(`No access to calendar for ${email}:`, errorDetails);
      } else if (error.code === 404) {
        this.logger.warn(`Calendar not found for ${email}:`, errorDetails);
      } else if (error.code === 401 || error.message.includes('invalid_grant')) {
        this.logger.error(`Authentication failed for calendar access:`, errorDetails);
      } else {
        this.logger.error(`Error fetching calendar events for ${email}:`, errorDetails);
      }
      
      return [];
    }
  }

  async createCalendarEvent(eventData, retryCount = 0) {
    try {
      this.logger.info(`Creating calendar event: ${eventData.title}`);
      
      const calendarEvent = {
        summary: `Family Event: ${eventData.title}`,
        description: this.buildEventDescription(eventData),
        location: eventData.location?.address || '',
        start: {
          dateTime: new Date(eventData.date).toISOString(),
          timeZone: 'America/Los_Angeles'
        },
        end: {
          dateTime: new Date(new Date(eventData.date).getTime() + (2 * 60 * 60 * 1000)).toISOString(),
          timeZone: 'America/Los_Angeles'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10080 }, // 1 week
            { method: 'popup', minutes: 1440 },  // 1 day
            { method: 'popup', minutes: 120 }    // 2 hours
          ]
        },
        attendees: [
          { email: config.gmail.parent1Email },
          { email: config.gmail.parent2Email }
        ]
      };
      
      // Create event in primary calendar
      const event = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: calendarEvent,
      });
      
      this.logger.info(`Successfully created calendar event with ID: ${event.data.id}`);
      return [{
        email: 'primary',
        eventId: event.data.id,
        htmlLink: event.data.htmlLink
      }];
      
    } catch (error) {
      // Handle automatic token refresh for invalid_grant errors
      if (error.message.includes('invalid_grant') && retryCount === 0) {
        this.logger.warn(`Token expired while creating calendar event, attempting automatic refresh...`);
        try {
          await this.refreshToken();
          this.logger.info(`Token refreshed successfully, retrying calendar event creation`);
          return await this.createCalendarEvent(eventData, retryCount + 1);
        } catch (refreshError) {
          this.logger.error(`Token refresh failed during calendar creation:`, refreshError.message);
          // Fall through to original error handling
        }
      }
      
      this.logger.error(`Error creating calendar event for ${eventData.title}:`, error.message);
      throw error;
    }
  }


  buildEventDescription(eventData) {
    let description = eventData.description || '';
    
    description += '\n\n--- Event Details ---\n';
    description += `Source: ${eventData.source}\n`;
    description += `Ages: ${eventData.ageRange?.min || 0}-${eventData.ageRange?.max || 18}\n`;
    description += `Cost: ${eventData.cost ? '$' + eventData.cost : 'Free'}\n`;
    
    if (eventData.registrationUrl) {
      description += `Registration: ${eventData.registrationUrl}\n`;
    }
    
    description += '\n🎉 This is a new adventure for our family!\n';
    description += '\n📝 What to bring:\n- Water bottles\n- Snacks\n- Camera\n- Comfortable shoes\n';
    
    if (eventData.cost > 0) {
      description += '\n💰 Remember: This is a PAID event\n';
    }
    
    description += '\n🤖 Generated with Family Event Planner';
    
    return description;
  }

  async refreshToken() {
    try {
      this.logger.info('Attempting to refresh Google API token...');
      
      if (!this.auth) {
        throw new Error('OAuth client not initialized');
      }
      
      const { credentials: newTokens } = await this.auth.refreshAccessToken();
      this.auth.setCredentials(newTokens);
      
      // Save refreshed tokens to file for persistence
      await this.saveTokens(newTokens);
      
      this.logger.info('Google API token refreshed successfully');
      return true;
      
    } catch (error) {
      this.logger.error('Token refresh failed:', error.message);
      
      if (error.message.includes('invalid_grant')) {
        this.logger.error('Refresh token expired - manual re-authentication required');
      }
      
      throw error;
    }
  }

  async saveTokens(tokens) {
    try {
      // Save to local development path
      const tokenPath = path.join(__dirname, '../../credentials/google-oauth-token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
      
      // In production, also save to Render secret file location if it exists
      if (process.env.NODE_ENV === 'production') {
        const renderTokenPath = '/etc/secrets/google-oauth-token.json';
        try {
          fs.writeFileSync(renderTokenPath, JSON.stringify(tokens, null, 2));
          this.logger.info('Tokens saved to both local and production paths');
        } catch (error) {
          this.logger.warn('Could not save to production path (expected if not writable):', error.message);
        }
      }
      
    } catch (error) {
      this.logger.error('Error saving refreshed tokens:', error.message);
      throw error;
    }
  }

  async sendEmail(to, subject, body, options = {}, retryCount = 0) {
    try {
      this.logger.info(`Sending email to ${Array.isArray(to) ? to.join(', ') : to}: ${subject}`);
      
      if (!this.auth || !this.gmail) {
        throw new Error('Gmail client not initialized. Call init() first.');
      }

      // Ensure to is an array
      const recipients = Array.isArray(to) ? to : [to];
      
      // Create email message
      const message = this.createEmailMessage(recipients, subject, body, options);
      
      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });
      
      this.logger.info(`Email sent successfully, message ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
        recipients: recipients
      };
      
    } catch (error) {
      // Handle automatic token refresh for invalid_grant errors
      if (error.message.includes('invalid_grant') && retryCount === 0) {
        this.logger.warn(`Token expired while sending email, attempting automatic refresh...`);
        try {
          await this.refreshToken();
          this.logger.info(`Token refreshed successfully, retrying email send`);
          return await this.sendEmail(to, subject, body, options, retryCount + 1);
        } catch (refreshError) {
          this.logger.error(`Token refresh failed during email send:`, refreshError.message);
          // Fall through to original error handling
        }
      }
      
      this.logger.error(`Error sending email to ${Array.isArray(to) ? to.join(', ') : to}:`, error.message);
      
      if (error.code === 401 || error.message.includes('invalid_grant')) {
        this.logger.error('Gmail authentication failed. Token may have expired.');
      } else if (error.code === 403) {
        this.logger.error('Gmail API access denied. Check scopes and permissions.');
      }
      
      return {
        success: false,
        error: error.message,
        recipients: Array.isArray(to) ? to : [to]
      };
    }
  }

  createEmailMessage(to, subject, body, options = {}) {
    // Create RFC2822 email message
    const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
    
    let message = [
      `To: ${to.join(', ')}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body, 'utf-8').toString('base64'),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(this.convertTextToHtml(body), 'utf-8').toString('base64'),
      '',
      `--${boundary}--`
    ].join('\n');

    // Encode the message in base64url format
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  convertTextToHtml(text) {
    // Convert plain text to basic HTML
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/===\s*(.*?)\s*===/g, '<h3>$1</h3>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  }

  async sendDailyReport(reportContent, recipients = []) {
    try {
      if (recipients.length === 0) {
        // Use default recipients from config
        recipients = [
          config.gmail.parent1Email,
          config.gmail.parent2Email
        ].filter(Boolean);
      }
      
      if (recipients.length === 0) {
        throw new Error('No email recipients configured for daily reports');
      }

      const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const subject = `🎉 Family Event Planner Daily Report - ${today}`;
      
      const emailBody = `Hi Joyce and Sheridan!

Here's your daily family event activity report:

${reportContent}

This automated report helps you stay informed about:
- New events discovered for Apollo (4) and Athena (2)  
- Registration successes and any issues
- System health and performance
- Upcoming events and calendar synchronization

Questions or feedback? Just reply to this email!

Best regards,
🤖 Family Event Planner`;

      return await this.sendEmail(recipients, subject, emailBody);
      
    } catch (error) {
      this.logger.error('Error sending daily report email:', error.message);
      return {
        success: false,
        error: error.message,
        recipients: recipients
      };
    }
  }
}

class CalendarConflictChecker {
  constructor(logger) {
    this.logger = logger;
    this.gmailClient = new GmailMCPClient(logger);
  }

  async init() {
    await this.gmailClient.init();
  }

  async hasConflict(eventDate, durationMinutes = 120) {
    try {
      const result = await this.gmailClient.checkCalendarConflicts(eventDate, durationMinutes);
      return result.hasConflict;
    } catch (error) {
      this.logger.warn(`Error checking calendar conflict for ${eventDate}:`, error.message);
      return false;
    }
  }

  async getConflictDetails(eventDate, durationMinutes = 120) {
    return await this.gmailClient.checkCalendarConflicts(eventDate, durationMinutes);
  }

  async createCalendarEvent(eventData) {
    return await this.gmailClient.createCalendarEvent(eventData);
  }
}

module.exports = { GmailMCPClient, CalendarConflictChecker };