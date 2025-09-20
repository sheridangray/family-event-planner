require('dotenv').config();
const CalendarManager = require('../../../src/services/calendar-manager');

/**
 * Test CalendarManager with OAuth credentials
 * This test initializes the CalendarManager and creates a test placeholder event
 */
async function testCalendarManagerOAuth() {
  console.log('🗓️  Testing CalendarManager with OAuth credentials...');
  
  try {
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production') {
      console.log('❌ This test only runs in development mode');
      return { success: false, error: 'Production mode not allowed' };
    }

    // Mock logger
    const logger = {
      info: (msg) => console.log(`ℹ️  ${msg}`),
      warn: (msg) => console.log(`⚠️  ${msg}`),
      error: (msg) => console.log(`❌ ${msg}`),
      debug: (msg) => console.log(`🔍 ${msg}`)
    };

    // Create CalendarManager instance
    const calendarManager = new CalendarManager(logger);
    console.log('✅ CalendarManager instance created');

    // Initialize the calendar manager
    await calendarManager.init();
    console.log('✅ CalendarManager initialized');

    if (!calendarManager.calendar) {
      console.log('❌ Calendar API not available');
      return { success: false, error: 'Calendar API not initialized' };
    }

    // Create a test event object
    const testEvent = {
      id: 999,
      title: 'Test OAuth Calendar Event',
      description: 'Testing OAuth calendar integration',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      location_address: '123 Test Street, San Francisco, CA',
      cost: 0,
      source: 'test',
      registrationUrl: 'https://test.example.com'
    };

    console.log(`📅 Creating placeholder event for: ${testEvent.title}`);
    console.log(`📍 Event date: ${new Date(testEvent.date).toLocaleString()}`);

    // Create placeholder calendar event
    const result = await calendarManager.createPlaceholderEvent(testEvent);

    if (result.success) {
      console.log('🎉 SUCCESS! Placeholder calendar event created');
      console.log(`📅 Event ID: ${result.calendarEventId}`);
      console.log(`🔗 Event link: ${result.eventLink}`);
      console.log(`📍 Check your Google Calendar for the placeholder event`);
    } else {
      console.log('❌ Failed to create placeholder event');
      console.log(`❌ Error: ${result.error}`);
      return { success: false, error: result.error };
    }
    
    return {
      success: true,
      eventId: result.calendarEventId,
      eventLink: result.eventLink,
      eventTime: new Date(testEvent.date).toLocaleString()
    };

  } catch (error) {
    console.log('❌ Error testing CalendarManager:', error.message);
    console.log('📍 Error details:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test if called directly
if (require.main === module) {
  testCalendarManagerOAuth()
    .then(result => {
      if (result.success) {
        console.log('✅ CalendarManager OAuth test completed successfully');
        process.exit(0);
      } else {
        console.log('❌ CalendarManager OAuth test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = testCalendarManagerOAuth;