/**
 * Google Calendar Reader Script
 * 
 * Reads events from Google Calendar for a specific date and time.
 * 
 * Usage: node test-read-calendar.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const { CalendarConflictChecker } = require('../src/mcp/gmail');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function readCalendarEvent() {
  console.log('📅 Reading Google Calendar events...\n');
  
  try {
    // Initialize calendar manager
    const calendarManager = new CalendarConflictChecker(logger);
    await calendarManager.init();
    console.log('✓ Calendar manager initialized\n');
    
    // Define the target date: Tuesday, August 12, 2025 at 6:00 PM PT
    const targetDate = new Date('2025-08-12T18:00:00-07:00'); // 6 PM Pacific Time
    const startOfDay = new Date('2025-08-12T00:00:00-07:00');
    const endOfDay = new Date('2025-08-12T23:59:59-07:00');
    
    console.log(`🔍 Looking for events on ${targetDate.toLocaleDateString()} around ${targetDate.toLocaleTimeString()}...\n`);
    
    // Get all events for that day using the Google Calendar API directly
    const calendar = calendarManager.gmailClient.calendar;
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    console.log(`📋 Found ${events.length} events on August 12, 2025:\n`);
    
    if (events.length === 0) {
      console.log('No events found on that date.');
      return;
    }
    
    // Display all events for the day
    events.forEach((event, index) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      const startTime = new Date(start);
      const endTime = new Date(end);
      
      console.log(`${index + 1}. "${event.summary}"`);
      console.log(`   Time: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
      console.log(`   Location: ${event.location || 'No location specified'}`);
      if (event.description) {
        console.log(`   Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });
    
    // Look specifically for events around 6:00 PM
    const targetHour = 18; // 6 PM in 24-hour format
    const eventsNear6PM = events.filter(event => {
      const start = event.start.dateTime || event.start.date;
      const eventTime = new Date(start);
      const eventHour = eventTime.getHours();
      
      // Check if event is within 2 hours of 6 PM (4 PM to 8 PM)
      return Math.abs(eventHour - targetHour) <= 2;
    });
    
    if (eventsNear6PM.length > 0) {
      console.log('🎯 Events around 6:00 PM PT:');
      eventsNear6PM.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const startTime = new Date(start);
        console.log(`📅 "${event.summary}" at ${startTime.toLocaleTimeString()}`);
      });
    } else {
      console.log('🔍 No events found specifically around 6:00 PM PT on that date.');
    }
    
  } catch (error) {
    console.error('❌ Calendar reading failed:', error.message);
    logger.error('Calendar reading error:', error);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Try deleting credentials/google-oauth-token.json and running auth-google.js again to re-authenticate.');
    }
  }
}

readCalendarEvent();