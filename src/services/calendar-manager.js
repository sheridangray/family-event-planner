const { google } = require('googleapis');
const { config } = require('../config');

class CalendarManager {
  constructor(logger) {
    this.logger = logger;
    this.calendar = null;
    this.calendarId = null;
  }

  async init() {
    try {
      // Initialize Google Calendar API using OAuth credentials
      let auth;
      
      if (process.env.MCP_GMAIL_CREDENTIALS_JSON) {
        // Use OAuth credentials from MCP_GMAIL_CREDENTIALS_JSON
        const credentials = JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        
        // Load OAuth token
        const fs = require('fs');
        const path = require('path');
        let tokenLoaded = false;
        
        // Try local development token path first
        const tokenPath = path.join(__dirname, '../../credentials/google-oauth-token.json');
        if (fs.existsSync(tokenPath)) {
          try {
            const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            auth.setCredentials(token);
            this.logger.info('Calendar manager loaded OAuth token from local file');
            tokenLoaded = true;
          } catch (error) {
            this.logger.warn('Error loading local OAuth token:', error.message);
          }
        }
        
        // Try production token paths if local failed
        if (!tokenLoaded && process.env.NODE_ENV === 'production') {
          const renderTokenPath = '/etc/secrets/google-oauth-token.json';
          if (fs.existsSync(renderTokenPath)) {
            try {
              const token = JSON.parse(fs.readFileSync(renderTokenPath, 'utf8'));
              auth.setCredentials(token);
              this.logger.info('Calendar manager loaded OAuth token from Render secret');
              tokenLoaded = true;
            } catch (error) {
              this.logger.warn('Error loading Render OAuth token:', error.message);
            }
          }
        }
        
        // Try environment variable token as fallback
        if (!tokenLoaded && process.env.GOOGLE_OAUTH_TOKEN) {
          try {
            const token = JSON.parse(process.env.GOOGLE_OAUTH_TOKEN);
            auth.setCredentials(token);
            this.logger.info('Calendar manager loaded OAuth token from environment variable');
            tokenLoaded = true;
          } catch (error) {
            this.logger.warn('Error loading OAuth token from environment:', error.message);
          }
        }
        
        if (!tokenLoaded) {
          throw new Error('OAuth token not found for calendar access');
        }
        
      } else if (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON) {
        // Fallback to service account if OAuth not available
        this.logger.warn('Falling back to service account credentials for calendar');
        const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Final fallback to standard Google credentials file
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
      } else {
        throw new Error('No Google Calendar credentials found. Need MCP_GMAIL_CREDENTIALS_JSON, GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS');
      }

      this.calendar = google.calendar({ version: 'v3', auth });
      this.calendarId = 'primary'; // Always use primary calendar with OAuth
      
      this.logger.info(`Calendar manager initialized successfully with OAuth credentials on primary calendar`);
    } catch (error) {
      this.logger.warn('Calendar integration not available:', error.message);
      this.logger.warn('Calendar events will not be automatically created');
      this.calendar = null;
    }
  }

  /**
   * Create calendar event for successful registration
   */
  async createEventForRegistration(event, registrationResult) {
    if (!this.calendar) {
      this.logger.debug('Calendar integration not available - skipping event creation');
      return { success: false, reason: 'calendar_not_available' };
    }

    try {
      this.logger.info(`Creating calendar event for: ${event.title}`);
      
      const calendarEvent = this.buildCalendarEvent(event, registrationResult);
      
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: calendarEvent,
        sendUpdates: 'all'
      });

      this.logger.info(`Calendar event created with ID: ${response.data.id}`);
      
      return {
        success: true,
        calendarEventId: response.data.id,
        eventLink: response.data.htmlLink
      };

    } catch (error) {
      this.logger.error('Failed to create calendar event:', error.message);
      return { 
        success: false, 
        error: error.message,
        reason: 'creation_failed'
      };
    }
  }

  /**
   * Build calendar event object from registration data
   */
  buildCalendarEvent(event, registrationResult) {
    const eventDate = new Date(event.date);
    const eventEndDate = this.calculateEventEndTime(eventDate, event);
    
    const calendarEvent = {
      summary: event.title,
      location: event.location_address,
      description: this.buildEventDescription(event, registrationResult),
      start: {
        dateTime: eventDate.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: eventEndDate.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      attendees: this.getAttendees(),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 2 * 60 },  // 2 hours before
          { method: 'popup', minutes: 30 }       // 30 minutes before
        ]
      },
      colorId: this.getEventColor(event),
      visibility: 'private'
    };

    // Add confirmation number to description if available
    if (registrationResult.confirmationNumber) {
      calendarEvent.description += `\n\n🎫 Confirmation: ${registrationResult.confirmationNumber}`;
    }

    return calendarEvent;
  }

  /**
   * Build comprehensive event description
   */
  buildEventDescription(event, registrationResult) {
    let description = '';

    // Event basics
    if (event.description) {
      description += `${event.description}\n\n`;
    }

    // Registration info
    description += `📝 REGISTRATION DETAILS:\n`;
    description += `• Status: ✅ Registered automatically\n`;
    description += `• Method: ${registrationResult.adapterType || 'Automated'}\n`;
    
    if (registrationResult.confirmationNumber) {
      description += `• Confirmation: ${registrationResult.confirmationNumber}\n`;
    }
    
    description += `\n`;

    // Event logistics
    description += `📍 LOCATION & TIME:\n`;
    description += `• Address: ${event.location_address}\n`;
    
    if (event.start_time) {
      description += `• Start Time: ${event.start_time}\n`;
    }
    
    if (event.end_time) {
      description += `• End Time: ${event.end_time}\n`;
    }

    description += `\n`;

    // Cost information
    description += `💰 COST:\n`;
    description += event.cost === 0 ? `• FREE Event! 🎉\n` : `• $${event.cost}\n`;
    description += `\n`;

    // Family preparation
    description += `👨‍👩‍👧‍👦 FAMILY INFO:\n`;
    description += `• Arrival: Plan to arrive 10-15 minutes early\n`;
    description += `• What to Bring: Check event website for specific requirements\n`;
    description += `• Parking: Check venue website for parking info\n`;
    description += `\n`;

    // Contact and links
    if (event.registration_url || event.registrationUrl) {
      description += `🔗 LINKS:\n`;
      description += `• Registration: ${event.registration_url || event.registrationUrl}\n`;
      description += `\n`;
    }

    // Source information
    description += `📊 EVENT SOURCE:\n`;
    description += `• Source: ${event.source}\n`;
    description += `• Event ID: ${event.id}\n`;
    
    description += `\n🤖 Automatically added by Family Event Planner`;

    return description;
  }

  /**
   * Calculate event end time based on available information
   */
  calculateEventEndTime(startDate, event) {
    // If we have an explicit end time, use it
    if (event.end_time) {
      const endDate = new Date(event.date);
      const [hours, minutes] = event.end_time.split(':').map(Number);
      endDate.setHours(hours, minutes, 0, 0);
      return endDate;
    }

    // Estimate duration based on event type and source
    let estimatedDurationHours = 2; // Default 2 hours

    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    
    // Adjust duration based on event keywords (check description first for priority)
    if (description.includes('all day')) {
      estimatedDurationHours = 6;
    } else if (title.includes('story') || title.includes('reading')) {
      estimatedDurationHours = 0.5;
    } else if (title.includes('workshop') || title.includes('class')) {
      estimatedDurationHours = 1.5;
    } else if (title.includes('movie') || title.includes('film')) {
      estimatedDurationHours = 2.5;
    } else if (title.includes('festival') || title.includes('fair')) {
      estimatedDurationHours = 4;
    } else if (title.includes('tour')) {
      estimatedDurationHours = 1;
    }

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + estimatedDurationHours);
    return endDate;
  }

  /**
   * Get attendees list from family configuration
   */
  getAttendees() {
    const attendees = [];
    
    if (config.gmail?.parent1Email) {
      attendees.push({ email: config.gmail.parent1Email });
    }
    
    if (config.gmail?.parent2Email && config.gmail.parent2Email !== config.gmail.parent1Email) {
      attendees.push({ email: config.gmail.parent2Email });
    }
    
    return attendees;
  }

  /**
   * Get appropriate calendar color for event type
   */
  getEventColor(event) {
    const title = event.title.toLowerCase();
    const source = event.source.toLowerCase();
    
    // Color coding system:
    // 1: Blue (default)
    // 2: Green (free events)
    // 3: Purple (educational)
    // 4: Red (important/ticketed)
    // 5: Yellow (outdoor/sports)
    // 6: Orange (arts/culture)
    // 7: Turquoise (community)
    // 8: Gray (other)
    
    if (event.cost === 0) {
      if (title.includes('museum') || title.includes('library') || title.includes('educational') || 
          source.includes('library') || source.includes('academy')) {
        return '3'; // Purple for educational
      } else if (title.includes('outdoor') || title.includes('park') || title.includes('nature') ||
                 source.includes('rec') || source.includes('park')) {
        return '5'; // Yellow for outdoor
      } else if (title.includes('art') || title.includes('music') || title.includes('theater') ||
                 source.includes('exploratorium')) {
        return '6'; // Orange for arts/culture
      } else {
        return '2'; // Green for free events
      }
    } else {
      return '4'; // Red for paid events
    }
  }

  /**
   * Update existing calendar event
   */
  async updateCalendarEvent(calendarEventId, event, registrationResult) {
    if (!this.calendar) {
      return { success: false, reason: 'calendar_not_available' };
    }

    try {
      const calendarEvent = this.buildCalendarEvent(event, registrationResult);
      
      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: calendarEventId,
        resource: calendarEvent
      });

      this.logger.info(`Calendar event updated: ${calendarEventId}`);
      
      return {
        success: true,
        calendarEventId: response.data.id,
        eventLink: response.data.htmlLink
      };

    } catch (error) {
      this.logger.error('Failed to update calendar event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel calendar event (when registration is cancelled)
   */
  async cancelCalendarEvent(calendarEventId, reason) {
    if (!this.calendar) {
      return { success: false, reason: 'calendar_not_available' };
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: calendarEventId,
        sendUpdates: 'all'
      });

      this.logger.info(`Calendar event cancelled: ${calendarEventId} (${reason})`);
      return { success: true };

    } catch (error) {
      this.logger.error('Failed to cancel calendar event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate calendar event URL for manual addition
   */
  generateCalendarUrl(event) {
    try {
      const eventDate = new Date(event.date);
      const endDate = this.calculateEventEndTime(eventDate, event);
      
      // Format dates for Google Calendar URL
      const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${formatDate(eventDate)}/${formatDate(endDate)}`,
        location: event.location_address,
        details: this.buildEventDescription(event, { adapterType: 'Manual' })
      });

      return `https://calendar.google.com/calendar/render?${params.toString()}`;

    } catch (error) {
      this.logger.error('Failed to generate calendar URL:', error.message);
      return null;
    }
  }

  /**
   * Create placeholder calendar event for manual registration
   */
  async createPlaceholderEvent(event) {
    if (!this.calendar) {
      this.logger.debug('Calendar integration not available - skipping placeholder creation');
      return { success: false, reason: 'calendar_not_available' };
    }

    try {
      this.logger.info(`Creating placeholder calendar event for: ${event.title}`);
      this.logger.debug(`Calendar available: ${!!this.calendar}, Calendar ID: ${this.calendarId}`);
      this.logger.debug(`Event object:`, { 
        id: event.id, 
        title: event.title, 
        date: event.date,
        location_address: event.location_address 
      });
      
      let calendarEvent;
      try {
        calendarEvent = this.buildPlaceholderCalendarEvent(event);
        this.logger.debug(`Built calendar event - summary: ${calendarEvent?.summary}, start: ${calendarEvent?.start?.dateTime}`);
        if (!calendarEvent || !calendarEvent.summary) {
          this.logger.error(`Calendar event is empty or missing required fields:`, calendarEvent);
        }
      } catch (buildError) {
        this.logger.error(`Error building calendar event:`, buildError.message, { stack: buildError.stack });
        throw buildError;
      }
      
      this.logger.debug(`Calling Google Calendar API with calendarId: ${this.calendarId}`);
      this.logger.debug(`Calling Google Calendar API:`, {
        calendarId: this.calendarId,
        summary: calendarEvent.summary,
        start: calendarEvent.start.dateTime,
        end: calendarEvent.end.dateTime,
        location: calendarEvent.location
      });
      
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: calendarEvent
      });
      
      this.logger.debug(`Google Calendar API success - Event ID: ${response.data.id}`);
      this.logger.debug(`Google Calendar API response received successfully`);

      this.logger.info(`Placeholder calendar event created with ID: ${response.data.id}`);
      
      return {
        success: true,
        calendarEventId: response.data.id,
        eventLink: response.data.htmlLink
      };

    } catch (error) {
      this.logger.error('Failed to create placeholder calendar event:', error.message);
      this.logger.error('Full error object:', JSON.stringify(error, null, 2));
      this.logger.error('Error details:', { 
        stack: error.stack,
        eventTitle: event.title,
        eventId: event.id,
        eventDate: event.date,
        calendarAvailable: !!this.calendar,
        calendarId: this.calendarId,
        errorCode: error.code,
        errorStatus: error.status,
        errorData: error.response?.data,
        googleApiError: error.errors
      });
      return { 
        success: false, 
        error: error.message,
        reason: 'creation_failed'
      };
    }
  }

  /**
   * Build placeholder calendar event object
   */
  buildPlaceholderCalendarEvent(event) {
    this.logger.debug(`Building placeholder event - input date: ${event.date}`);
    const eventDate = new Date(event.date);
    if (isNaN(eventDate.getTime())) {
      throw new Error(`Invalid event date: ${event.date}`);
    }
    this.logger.debug(`Parsed event date: ${eventDate.toISOString()}`);
    
    const eventEndDate = this.calculateEventEndTime(eventDate, event);
    this.logger.debug(`Calculated end date: ${eventEndDate.toISOString()}`);
    
    const calendarEvent = {
      summary: `📋 PLACEHOLDER: ${event.title}`,
      location: event.location_address,
      description: (() => {
        try {
          const desc = this.buildPlaceholderDescription(event);
          this.logger.debug(`Description length: ${desc?.length || 0}`);
          return desc;
        } catch (err) {
          this.logger.error(`Error building description:`, err.message);
          return `Placeholder for ${event.title}`;
        }
      })(),
      start: {
        dateTime: eventDate.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: eventEndDate.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      attendees: this.getAttendees(),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 2 * 60 }   // 2 hours before
        ]
      },
      colorId: '8', // Gray color for placeholders
      visibility: 'private', 
      transparency: 'transparent', // Shows as "free" time
      extendedProperties: {
        private: {
          isPlaceholder: 'true',
          originalEventId: event.id.toString(),
          monitoringEnabled: 'true',
          createdBy: 'family-event-planner'
        }
      }
    };

    return calendarEvent;
  }

  /**
   * Build placeholder event description
   */
  buildPlaceholderDescription(event) {
    return `🔄 MANUAL REGISTRATION REQUIRED

📋 TO-DO: Register at: ${event.registrationUrl || event.registration_url || 'Check event website'}

REGISTRATION CHECKLIST:
☐ Visit registration website
☐ Complete registration form  
☐ Receive confirmation email

📍 Event Details:
• ${event.description || 'No description provided'}
• Cost: ${event.cost === 0 ? 'FREE' : `$${event.cost}`}
• Source: ${event.source}

ℹ️ This placeholder will be automatically removed when you complete registration and a duplicate event is detected in your calendar.

🤖 Created by Family Event Planner`;
  }

  /**
   * Generate calendar statistics
   */
  async getCalendarStats() {
    if (!this.calendar) {
      return { available: false, reason: 'calendar_not_available' };
    }

    try {
      // Get events from the last month that were created by this system
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: oneMonthAgo.toISOString(),
        q: 'Family Event Planner',
        maxResults: 100
      });

      const events = response.data.items || [];
      const totalEvents = events.length;
      const upcomingEvents = events.filter(e => new Date(e.start.dateTime) > new Date()).length;

      return {
        available: true,
        totalEventsCreated: totalEvents,
        upcomingEvents: upcomingEvents,
        lastCreated: events.length > 0 ? events[0].created : null
      };

    } catch (error) {
      this.logger.error('Failed to get calendar stats:', error.message);
      return { available: false, error: error.message };
    }
  }

  /**
   * Skip calendar sharing since we're using OAuth on primary calendar
   * Events will be created directly on the authenticated user's calendar with attendees
   */
  async ensureCalendarSharing() {
    this.logger.info('Calendar sharing skipped - using OAuth on primary calendar with attendees');
    return;
  }
}

module.exports = CalendarManager;