#!/usr/bin/env node

/**
 * Find Next Calendar Event Test
 * 
 * This test finds the next upcoming event in the authenticated user's calendar.
 * It uses the production OAuth tokens to access Google Calendar API.
 */

require('dotenv').config();
const Database = require('../src/database');
const { google } = require('googleapis');

class NextEventFinder {
  constructor() {
    this.db = null;
    this.oauth2Client = null;
  }

  async init() {
    this.db = new Database();
    await this.db.init();
    console.log('✅ Database connected');

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost' // Redirect URI
    );
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }

  /**
   * Load OAuth tokens for a specified user email
   */
  async loadUserTokens(email = 'sheridan.gray@gmail.com') {
    console.log(`\n🔍 Loading OAuth tokens for ${email}...`);
    
    const result = await this.db.query(`
      SELECT 
        u.email,
        u.role,
        ot.access_token,
        ot.refresh_token,
        ot.token_type,
        ot.scope,
        ot.expiry_date,
        ot.created_at,
        ot.updated_at
      FROM users u 
      JOIN oauth_tokens ot ON u.id = ot.user_id 
      WHERE u.email = $1 AND ot.provider = 'google'
    `, [email]);

    if (result.rows.length === 0) {
      throw new Error(`No OAuth tokens found for ${email}`);
    }

    const tokenData = result.rows[0];
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      expiry_date: parseInt(tokenData.expiry_date)
    };

    console.log('📋 User Information:');
    console.log(`   Email: ${tokenData.email}`);
    console.log(`   Role: ${tokenData.role}`);
    console.log(`   Token created: ${tokenData.created_at}`);
    console.log(`   Token updated: ${tokenData.updated_at}`);

    // Check token expiry
    const now = Date.now();
    const isExpired = now > tokenData.expiry_date;
    const expiresIn = Math.round((tokenData.expiry_date - now) / (1000 * 60 * 60));
    
    console.log('⏰ Token Status:');
    console.log(`   Expires: ${new Date(tokenData.expiry_date).toLocaleString()}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    if (!isExpired) {
      console.log(`   Hours remaining: ${expiresIn}`);
    }

    return tokens;
  }

  /**
   * Find the next upcoming event in the user's calendar
   */
  async findNextEvent() {
    console.log('\n📅 Finding next upcoming event...');
    
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const now = new Date();
      const timeMin = now.toISOString();
      
      console.log(`   🔍 Searching for events after: ${now.toLocaleString()}`);
      
      // Get upcoming events from primary calendar
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin,
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log(`   📊 Found ${events.length} upcoming events`);

      if (events.length === 0) {
        console.log('   📭 No upcoming events found in primary calendar');
        return null;
      }

      // Get the very next event
      const nextEvent = events[0];
      const startTime = nextEvent.start?.dateTime || nextEvent.start?.date;
      const endTime = nextEvent.end?.dateTime || nextEvent.end?.date;
      
      console.log('\n🎯 NEXT EVENT FOUND:');
      console.log('=' .repeat(50));
      console.log(`📝 Title: ${nextEvent.summary || 'Untitled'}`);
      console.log(`📅 Start: ${new Date(startTime).toLocaleString()}`);
      console.log(`🏁 End: ${new Date(endTime).toLocaleString()}`);
      
      if (nextEvent.location) {
        console.log(`📍 Location: ${nextEvent.location}`);
      }
      
      if (nextEvent.description) {
        const description = nextEvent.description.substring(0, 200);
        console.log(`📄 Description: ${description}${nextEvent.description.length > 200 ? '...' : ''}`);
      }

      if (nextEvent.attendees && nextEvent.attendees.length > 0) {
        console.log(`👥 Attendees: ${nextEvent.attendees.length}`);
        nextEvent.attendees.forEach(attendee => {
          const status = attendee.responseStatus || 'needsAction';
          const emoji = {
            accepted: '✅',
            declined: '❌', 
            tentative: '❓',
            needsAction: '⏳'
          }[status] || '❓';
          console.log(`   ${emoji} ${attendee.email} (${status})`);
        });
      }

      // Calculate time until event
      const eventStart = new Date(startTime);
      const timeDiff = eventStart.getTime() - now.getTime();
      const daysUntil = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hoursUntil = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\n⏰ Time Until Event:`);
      if (daysUntil > 0) {
        console.log(`   ${daysUntil} days, ${hoursUntil} hours, ${minutesUntil} minutes`);
      } else if (hoursUntil > 0) {
        console.log(`   ${hoursUntil} hours, ${minutesUntil} minutes`);
      } else {
        console.log(`   ${minutesUntil} minutes`);
      }

      // Show additional context from other upcoming events
      if (events.length > 1) {
        console.log(`\n📋 Next ${Math.min(5, events.length - 1)} Events After That:`);
        events.slice(1, 6).forEach((event, index) => {
          const start = event.start?.dateTime || event.start?.date;
          console.log(`   ${index + 2}. ${event.summary || 'Untitled'} - ${new Date(start).toLocaleString()}`);
        });
      }

      return {
        success: true,
        nextEvent: {
          title: nextEvent.summary,
          start: startTime,
          end: endTime,
          location: nextEvent.location,
          description: nextEvent.description,
          attendees: nextEvent.attendees,
          id: nextEvent.id,
          htmlLink: nextEvent.htmlLink
        },
        upcomingEvents: events.slice(1, 6).map(event => ({
          title: event.summary,
          start: event.start?.dateTime || event.start?.date,
          id: event.id
        }))
      };

    } catch (error) {
      console.log(`   ❌ Calendar API Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run the complete next event finder
   */
  async run(email = 'sheridan.gray@gmail.com') {
    console.log(`🚀 Finding Next Calendar Event for ${email}`);
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));

    const results = {
      timestamp: new Date().toISOString(),
      user: email,
      success: false,
      nextEvent: null,
      error: null
    };

    try {
      // 1. Load OAuth tokens
      const tokens = await this.loadUserTokens(email);
      
      // 2. Configure OAuth client
      this.oauth2Client.setCredentials(tokens);
      console.log('✅ OAuth2 client configured with tokens');

      // 3. Find next event
      const eventResult = await this.findNextEvent();
      
      results.success = eventResult.success;
      results.nextEvent = eventResult.nextEvent;
      results.upcomingEvents = eventResult.upcomingEvents;
      results.error = eventResult.error;

      console.log('\n🎉 SEARCH COMPLETE!');
      console.log('=' .repeat(60));
      
      if (results.success && results.nextEvent) {
        console.log(`✅ Next event: "${results.nextEvent.title}" on ${new Date(results.nextEvent.start).toLocaleString()}`);
      } else {
        console.log('❌ No upcoming events found or error occurred');
      }

    } catch (error) {
      console.error(`\n❌ Test failed: ${error.message}`);
      results.error = error.message;
    }

    return results;
  }
}

// Main execution
async function main() {
  const email = process.argv[2] || 'sheridan.gray@gmail.com';
  const finder = new NextEventFinder();
  
  try {
    await finder.init();
    const results = await finder.run(email);
    
    // Save results to file
    const fs = require('fs');
    const emailSafe = email.replace(/[^a-zA-Z0-9]/g, '-');
    const resultsFile = `test/next-event-results-${emailSafe}-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
    process.exit(results.success ? 0 : 1);
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    await finder.close();
  }
}

// Usage instructions
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Find Next Calendar Event Test

Usage:
  node test/find-next-event.test.js [email]

Examples:
  node test/find-next-event.test.js                           # Default: sheridan.gray@gmail.com
  node test/find-next-event.test.js sheridan.gray@gmail.com   # Sheridan's calendar
  node test/find-next-event.test.js joyce.yan.zhang@gmail.com # Joyce's calendar

This test will:
✅ Connect to the specified user's authenticated Google Calendar
✅ Find their next upcoming event
✅ Show event details (title, time, location, attendees)
✅ Calculate time until the event
✅ List additional upcoming events
✅ Save results to JSON file

Requirements:
- User must have authenticated with Google OAuth in production
- OAuth tokens must be stored in the database
- Valid Google Calendar API access for the specified user
    `);
    process.exit(0);
  }
  
  main().catch(console.error);
}

module.exports = { NextEventFinder };