/**
 * Google Calendar Event Creation Test Script
 * 
 * Tests the Google Calendar integration by creating a test event.
 * This will require OAuth authentication on first run.
 * 
 * Usage: node test-create-calendar-event.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const { CalendarConflictChecker } = require('../src/mcp/gmail');
const readline = require('readline');

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

async function testCalendar() {
  console.log('📅 Testing Google Calendar integration...\n');
  
  try {
    // Initialize calendar manager
    const calendarManager = new CalendarConflictChecker(logger);
    await calendarManager.init();
    console.log('✓ Calendar manager initialized\n');
    
    // Check if we need to authenticate
    const fs = require('fs');
    const path = require('path');
    const tokenPath = path.join(__dirname, '../credentials/google-oauth-token.json');
    
    if (!fs.existsSync(tokenPath)) {
      console.log('🔐 First time setup - OAuth authentication required...\n');
      
      // Get auth URL
      const authUrl = await calendarManager.gmailClient.authenticate();
      console.log('\n📋 Please follow these steps:');
      console.log('1. Open this URL in your browser:');
      console.log(authUrl);
      console.log('\n2. Authorize the application');
      console.log('3. Copy the authorization code from the URL after authorization');
      console.log('4. Paste it here:\n');
      
      // Get auth code from user
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const authCode = await new Promise(resolve => {
        rl.question('Enter authorization code: ', resolve);
      });
      rl.close();
      
      // Set auth code and save token
      await calendarManager.gmailClient.setAuthCode(authCode);
      console.log('\n✅ Authentication successful! Token saved.\n');
    } else {
      console.log('✓ Using existing authentication token\n');
    }
    
    // Create a test calendar event
    const testEvent = {
      title: 'Test Family Event - Calendar Hold',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      location: { address: 'Golden Gate Park, San Francisco, CA' },
      cost: 0,
      ageRange: { min: 2, max: 4 },
      description: 'This is a test calendar event to verify Google Calendar integration is working. This event can be deleted.',
      source: 'Test System'
    };
    
    console.log('📅 Creating test calendar event...');
    console.log(`Event: ${testEvent.title}`);
    console.log(`Date: ${testEvent.date.toLocaleDateString()} at ${testEvent.date.toLocaleTimeString()}`);
    console.log(`Location: ${testEvent.location.address}`);
    console.log(`Duration: 2 hours\n`);
    
    // Create the calendar event
    const result = await calendarManager.createCalendarEvent(testEvent);
    
    if (result && result.length > 0) {
      console.log('✅ Calendar event created successfully!');
      console.log(`📅 Event ID: ${result[0].eventId}`);
      if (result[0].htmlLink) {
        console.log(`🔗 View event: ${result[0].htmlLink}`);
      }
      console.log('\n📲 Check your Google Calendar to see the test event!');
      console.log('\nThe event should appear with:');
      console.log('- Title: "Family Event: Test Family Event - Calendar Hold"');
      console.log('- Reminders set for 1 week, 1 day, and 2 hours before');
      console.log('- Both parent emails invited as attendees');
    }
    
    console.log('\n✓ Calendar test completed successfully');
    
  } catch (error) {
    console.error('❌ Calendar test failed:', error.message);
    logger.error('Calendar test error:', error);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Try deleting credentials/google-oauth-token.json and running the test again to re-authenticate.');
    }
  }
}

testCalendar();