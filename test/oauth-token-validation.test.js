#!/usr/bin/env node

/**
 * OAuth Token Validation Test
 * 
 * Tests if stored OAuth tokens for a given user ID are valid and functional.
 * This validates the database-driven OAuth system by:
 * 1. Loading tokens from the oauth_tokens table
 * 2. Testing Gmail API access
 * 3. Testing Calendar API access  
 * 4. Checking token expiry and refresh capability
 */

require('dotenv').config();
const Database = require('../src/database');
const { google } = require('googleapis');

class OAuthTokenValidator {
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
   * Load OAuth tokens for a specific user from database
   */
  async loadUserTokens(userId) {
    console.log(`\n🔍 Loading OAuth tokens for user ID: ${userId}`);
    
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
      WHERE u.id = $1 AND ot.provider = 'google'
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error(`No OAuth tokens found for user ID ${userId}`);
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
    console.log(`   Token Type: ${tokenData.token_type}`);
    console.log(`   Scopes: ${tokenData.scope?.split(' ').join(', ')}`);
    console.log(`   Created: ${tokenData.created_at}`);
    console.log(`   Updated: ${tokenData.updated_at}`);

    // Check token expiry
    const now = Date.now();
    const isExpired = now > tokenData.expiry_date;
    const expiresIn = Math.round((tokenData.expiry_date - now) / (1000 * 60 * 60 * 24));
    
    console.log('⏰ Token Expiry:');
    console.log(`   Expires: ${new Date(tokenData.expiry_date).toLocaleString()}`);
    console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    if (!isExpired) {
      console.log(`   Days remaining: ${expiresIn}`);
    }

    return { tokens, user: tokenData };
  }

  /**
   * Configure OAuth2 client with tokens
   */
  setTokens(tokens) {
    this.oauth2Client.setCredentials(tokens);
    console.log('✅ OAuth2 client configured with tokens');
  }

  /**
   * Test Gmail API access
   */
  async testGmailAccess() {
    console.log('\n📧 Testing Gmail API Access...');
    
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      // Test: Get user profile
      console.log('   Testing: Get user profile...');
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`   ✅ Profile retrieved: ${profile.data.emailAddress}`);
      console.log(`   📊 Total messages: ${profile.data.messagesTotal}`);
      console.log(`   📊 Total threads: ${profile.data.threadsTotal}`);

      // Test: List recent messages (last 5)
      console.log('   Testing: List recent messages...');
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: 'in:inbox'
      });
      console.log(`   ✅ Retrieved ${messages.data.messages?.length || 0} recent messages`);

      // Test: Get a specific message (if available)
      if (messages.data.messages && messages.data.messages.length > 0) {
        const messageId = messages.data.messages[0].id;
        console.log('   Testing: Get specific message...');
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'metadata'
        });
        console.log(`   ✅ Message retrieved: ${message.data.snippet?.substring(0, 50)}...`);
      }

      return { success: true, profile: profile.data };
    } catch (error) {
      console.log(`   ❌ Gmail API Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test Calendar API access
   */
  async testCalendarAccess() {
    console.log('\n📅 Testing Calendar API Access...');
    
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      // Test: List calendars
      console.log('   Testing: List calendars...');
      const calendars = await calendar.calendarList.list();
      console.log(`   ✅ Found ${calendars.data.items?.length || 0} calendars`);
      
      if (calendars.data.items) {
        calendars.data.items.forEach((cal, index) => {
          console.log(`   📅 ${index + 1}. ${cal.summary} (${cal.id})`);
        });
      }

      // Test: Get primary calendar events (next 5)
      console.log('   Testing: Get upcoming events...');
      const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const eventCount = events.data.items?.length || 0;
      console.log(`   ✅ Found ${eventCount} upcoming events`);
      
      if (events.data.items) {
        events.data.items.forEach((event, index) => {
          const start = event.start?.dateTime || event.start?.date;
          console.log(`   📝 ${index + 1}. ${event.summary} (${start})`);
        });
      }

      return { success: true, calendars: calendars.data.items, events: events.data.items };
    } catch (error) {
      console.log(`   ❌ Calendar API Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test token refresh capability
   */
  async testTokenRefresh() {
    console.log('\n🔄 Testing Token Refresh...');
    
    try {
      // Force refresh the access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      console.log('   ✅ Token refresh successful');
      console.log(`   📝 New access token (first 20 chars): ${credentials.access_token?.substring(0, 20)}...`);
      console.log(`   ⏰ New expiry: ${new Date(credentials.expiry_date).toLocaleString()}`);

      return { success: true, credentials };
    } catch (error) {
      console.log(`   ❌ Token Refresh Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update tokens in database
   */
  async updateTokensInDatabase(userId, newCredentials) {
    console.log('\n💾 Updating tokens in database...');
    
    try {
      await this.db.query(`
        UPDATE oauth_tokens 
        SET 
          access_token = $1,
          expiry_date = $2,
          updated_at = NOW()
        WHERE user_id = $3 AND provider = 'google'
      `, [
        newCredentials.access_token,
        newCredentials.expiry_date.toString(),
        userId
      ]);
      
      console.log('   ✅ Database updated with new tokens');
      return { success: true };
    } catch (error) {
      console.log(`   ❌ Database Update Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run comprehensive validation test
   */
  async validateUser(userId) {
    console.log(`\n🚀 Starting OAuth validation for User ID: ${userId}`);
    console.log('=' .repeat(60));

    const results = {
      userId,
      timestamp: new Date().toISOString(),
      tokens: null,
      user: null,
      gmail: null,
      calendar: null,
      refresh: null,
      overall: false
    };

    try {
      // 1. Load tokens from database
      const { tokens, user } = await this.loadUserTokens(userId);
      results.tokens = { loaded: true };
      results.user = user;

      // 2. Configure OAuth client
      this.setTokens(tokens);

      // 3. Test Gmail API
      results.gmail = await this.testGmailAccess();

      // 4. Test Calendar API
      results.calendar = await this.testCalendarAccess();

      // 5. Test token refresh
      results.refresh = await this.testTokenRefresh();

      // 6. Update database with refreshed tokens (if refresh succeeded)
      if (results.refresh.success) {
        await this.updateTokensInDatabase(userId, results.refresh.credentials);
      }

      // 7. Calculate overall success
      results.overall = results.gmail.success && results.calendar.success;

      console.log('\n📊 VALIDATION SUMMARY');
      console.log('=' .repeat(60));
      console.log(`👤 User: ${user.email} (${user.role})`);
      console.log(`📧 Gmail API: ${results.gmail.success ? '✅ Working' : '❌ Failed'}`);
      console.log(`📅 Calendar API: ${results.calendar.success ? '✅ Working' : '❌ Failed'}`);
      console.log(`🔄 Token Refresh: ${results.refresh.success ? '✅ Working' : '❌ Failed'}`);
      console.log(`🎯 Overall Status: ${results.overall ? '✅ VALID AUTHENTICATION' : '❌ AUTHENTICATION ISSUES'}`);

    } catch (error) {
      console.error(`\n❌ Validation failed: ${error.message}`);
      results.error = error.message;
    }

    return results;
  }
}

// Main execution
async function main() {
  const userId = process.argv[2] || '1'; // Default to user ID 1 (Sheridan)
  
  console.log('🔐 OAuth Token Validation Test');
  console.log(`📅 ${new Date().toLocaleString()}`);
  
  const validator = new OAuthTokenValidator();
  
  try {
    await validator.init();
    const results = await validator.validateUser(parseInt(userId));
    
    // Save results to file
    const fs = require('fs');
    const resultsFile = `test/oauth-validation-results-user-${userId}-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
    process.exit(results.overall ? 0 : 1);
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    await validator.close();
  }
}

// Usage instructions
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
OAuth Token Validation Test

Usage:
  node test/oauth-token-validation.test.js [userId]

Examples:
  node test/oauth-token-validation.test.js       # Test user ID 1 (default)
  node test/oauth-token-validation.test.js 2     # Test user ID 2 (Joyce)
  node test/oauth-token-validation.test.js 1     # Test user ID 1 (Sheridan)

This test will:
✅ Load OAuth tokens from database
✅ Test Gmail API access
✅ Test Calendar API access  
✅ Test token refresh capability
✅ Update database with new tokens
✅ Generate detailed validation report
    `);
    process.exit(0);
  }
  
  main().catch(console.error);
}

module.exports = { OAuthTokenValidator };