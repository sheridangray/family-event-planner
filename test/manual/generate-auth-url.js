/**
 * Generate Google OAuth Authentication URL
 * Run this script to get the URL for re-authenticating OAuth tokens
 */

require('dotenv').config({ path: '../../.env' });
const { google } = require('googleapis');

async function generateAuthUrl() {
  console.log('🔐 Generating Google OAuth authentication URL...\n');
  
  try {
    // Load credentials from MCP_GMAIL_CREDENTIALS_JSON
    if (!process.env.MCP_GMAIL_CREDENTIALS_JSON) {
      throw new Error('MCP_GMAIL_CREDENTIALS_JSON not found in environment variables');
    }
    
    const credentials = JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    
    // Create OAuth2 client
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Define scopes for Gmail and Calendar access
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    // Generate authorization URL
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',  // Important: gets refresh tokens
      scope: scopes,
      prompt: 'consent'        // Force consent screen to get refresh token
    });
    
    console.log('📋 Copy this URL and open it in your browser:');
    console.log('=' .repeat(80));
    console.log(authUrl);
    console.log('=' .repeat(80));
    console.log('\n📝 Steps to complete authentication:');
    console.log('1. Open the URL above in your browser');
    console.log('2. Sign in with sheridan.gray@gmail.com');
    console.log('3. Grant the requested permissions');
    console.log('4. Copy the authorization code from the redirect URL');
    console.log('5. Run: node test/manual/process-auth-code.js [CODE]');
    console.log('\n⚠️  Note: The authorization code expires quickly, so complete steps 4-5 immediately!');
    
  } catch (error) {
    console.error('❌ Error generating auth URL:', error.message);
  }
}

generateAuthUrl();