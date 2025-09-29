/**
 * Simple Google OAuth Authentication Script
 * 
 * This script will authenticate and save the token for calendar access.
 */

require('dotenv').config({ path: '../.env' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function authenticate() {
  console.log('🔐 Setting up Google Calendar authentication...\n');
  
  try {
    // Load credentials
    const credentialsPath = process.env.MCP_GMAIL_CREDENTIALS_JSON || './gmail-credentials.json';
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Create OAuth2 client
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Get authorization code from environment variable
    const authCode = process.env.GOOGLE_AUTH_CODE;
    
    if (!authCode || authCode === 'REMOVED_FOR_SECURITY') {
      throw new Error('GOOGLE_AUTH_CODE not set in .env file. Please add it temporarily for authentication.');
    }
    
    console.log('📝 Processing authorization code...');
    
    // Get token
    const { tokens } = await auth.getToken(authCode);
    auth.setCredentials(tokens);
    
    // Save token
    const tokenPath = path.join(__dirname, '../credentials/google-oauth-token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Token saved successfully to credentials/google-oauth-token.json');
    console.log('✅ Google Calendar authentication complete!\n');
    
    // Test the authentication by listing calendars
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarList = await calendar.calendarList.list();
    
    console.log('📅 Available calendars:');
    calendarList.data.items.forEach(cal => {
      console.log(`- ${cal.summary} (${cal.id})`);
    });
    
    console.log('\n🎉 Ready to read calendar events!');
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 The authorization code may have expired. Please get a new one.');
      console.log('Run the OAuth flow again to get a fresh authorization code.');
    }
  }
}

authenticate();