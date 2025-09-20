require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

/**
 * Test OAuth calendar event creation directly on personal calendar
 * This test creates a calendar event using OAuth credentials for today at 5:00 PM
 */
async function testOAuthCalendarCreation() {
  console.log('🗓️  Testing OAuth calendar event creation...');
  
  try {
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production') {
      console.log('❌ This test only runs in development mode');
      return { success: false, error: 'Production mode not allowed' };
    }

    // Load OAuth credentials from MCP_GMAIL_CREDENTIALS_JSON
    if (!process.env.MCP_GMAIL_CREDENTIALS_JSON) {
      console.log('❌ MCP_GMAIL_CREDENTIALS_JSON not found in environment');
      return { success: false, error: 'OAuth credentials not found' };
    }

    const credentials = JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON);
    console.log('✅ OAuth credentials loaded');

    // Load OAuth token
    const tokenPath = path.join(__dirname, '../../../credentials/google-oauth-token.json');
    if (!fs.existsSync(tokenPath)) {
      console.log('❌ OAuth token not found at:', tokenPath);
      console.log('💡 Run the Gmail MCP setup first to generate OAuth token');
      return { success: false, error: 'OAuth token not found' };
    }

    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('✅ OAuth token loaded');

    // Set up OAuth2 client
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(token);
    console.log('✅ OAuth2 client configured');

    // Create calendar API client
    const calendar = google.calendar({ version: 'v3', auth });
    console.log('✅ Calendar API client created');

    // Create event for today at 5:00 PM
    const today = new Date();
    const eventStart = new Date(today);
    eventStart.setHours(17, 0, 0, 0); // 5:00 PM today
    
    const eventEnd = new Date(eventStart);
    eventEnd.setHours(18, 0, 0, 0); // 6:00 PM today

    const event = {
      summary: 'Test Event - Calendar Creation Test',
      description: 'This is a test event created via OAuth to verify calendar integration works.\n\n🤖 Created by Family Event Planner test',
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      attendees: [
        { email: 'sheridan.gray@gmail.com' }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 }
        ]
      }
    };

    console.log(`📅 Creating event for: ${eventStart.toLocaleString()}`);
    console.log(`📧 Attendee: sheridan.gray@gmail.com`);

    // Create the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    console.log('🎉 SUCCESS! Calendar event created');
    console.log(`📅 Event ID: ${response.data.id}`);
    console.log(`🔗 Event link: ${response.data.htmlLink}`);
    console.log(`📍 Check your Google Calendar for today at 5:00 PM`);
    
    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      eventTime: eventStart.toLocaleString()
    };

  } catch (error) {
    console.log('❌ Error creating calendar event:', error.message);
    console.log('📍 Error details:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test if called directly
if (require.main === module) {
  testOAuthCalendarCreation()
    .then(result => {
      if (result.success) {
        console.log('✅ Test completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = testOAuthCalendarCreation;