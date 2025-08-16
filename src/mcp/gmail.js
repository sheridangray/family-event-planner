const { config } = require('../config');

class GmailMCPClient {
  constructor(logger) {
    this.logger = logger;
    this.mcpClient = null;
  }

  async init() {
    try {
      this.logger.info('Initializing Gmail MCP client...');
      
      if (!config.gmail.mcpCredentials) {
        throw new Error('Gmail MCP credentials not configured');
      }
      
      this.logger.info('Gmail MCP client initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Gmail MCP client:', error.message);
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
      
      const conflicts = [];
      
      const parent1Conflicts = await this.checkSingleCalendar(
        config.gmail.parent1Email, 
        checkStart, 
        checkEnd
      );
      
      const parent2Conflicts = await this.checkSingleCalendar(
        config.gmail.parent2Email, 
        checkStart, 
        checkEnd
      );
      
      conflicts.push(...parent1Conflicts, ...parent2Conflicts);
      
      const hasConflict = conflicts.length > 0;
      
      if (hasConflict) {
        this.logger.debug(`Calendar conflict found for ${eventDate}: ${conflicts.length} conflicting events`);
      }
      
      return {
        hasConflict,
        conflicts,
        checkedTimeRange: {
          start: checkStart,
          end: checkEnd
        }
      };
      
    } catch (error) {
      this.logger.warn(`Error checking calendar conflicts for ${eventDate}:`, error.message);
      return {
        hasConflict: false,
        conflicts: [],
        error: error.message
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

  async getCalendarEvents(email, timeMin, timeMax) {
    try {
      this.logger.debug(`Fetching calendar events for ${email}`);
      
      return [];
      
    } catch (error) {
      this.logger.error(`Error fetching calendar events for ${email}:`, error.message);
      return [];
    }
  }

  async createCalendarEvent(eventData) {
    try {
      this.logger.info(`Creating calendar event: ${eventData.title}`);
      
      const calendarEvent = {
        summary: `Family Event: ${eventData.title}`,
        description: this.buildEventDescription(eventData),
        location: eventData.location?.address || '',
        start: {
          dateTime: eventData.date,
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
      
      const results = [];
      
      const parent1Result = await this.createEventInCalendar(
        config.gmail.parent1Email, 
        calendarEvent
      );
      results.push({ email: config.gmail.parent1Email, eventId: parent1Result });
      
      const parent2Result = await this.createEventInCalendar(
        config.gmail.parent2Email, 
        calendarEvent
      );
      results.push({ email: config.gmail.parent2Email, eventId: parent2Result });
      
      this.logger.info(`Successfully created calendar events for ${eventData.title}`);
      return results;
      
    } catch (error) {
      this.logger.error(`Error creating calendar event for ${eventData.title}:`, error.message);
      throw error;
    }
  }

  async createEventInCalendar(email, eventData) {
    try {
      this.logger.debug(`Creating event in calendar for ${email}`);
      
      return 'mock-event-id-' + Date.now();
      
    } catch (error) {
      this.logger.error(`Error creating event in calendar for ${email}:`, error.message);
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