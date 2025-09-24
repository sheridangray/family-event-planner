/**
 * Process Google OAuth Authorization Code
 * Run this script with the authorization code to complete authentication
 * Usage: node process-auth-code.js [AUTHORIZATION_CODE]
 */

require('dotenv').config({ path: '../../.env' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function processAuthCode() {
  console.log('🔐 Processing Google OAuth authorization code...\n');
  
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.error('❌ Please provide the authorization code as an argument');
    console.log('Usage: node process-auth-code.js [AUTHORIZATION_CODE]');
    process.exit(1);
  }
  
  try {
    // Load credentials from MCP_GMAIL_CREDENTIALS_JSON
    if (!process.env.MCP_GMAIL_CREDENTIALS_JSON) {
      throw new Error('MCP_GMAIL_CREDENTIALS_JSON not found in environment variables');
    }
    
    const credentials = JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    
    // Create OAuth2 client
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    console.log('📝 Exchanging authorization code for tokens...');
    
    // Get tokens
    const { tokens } = await auth.getToken(authCode);
    auth.setCredentials(tokens);
    
    console.log('✅ Tokens received successfully');
    console.log('Access token expires:', new Date(tokens.expiry_date));
    console.log('Refresh token available:', !!tokens.refresh_token);
    
    // Save tokens to the credentials file
    const tokenPath = path.join(__dirname, '../../credentials/google-oauth-token.json');
    
    // Create credentials directory if it doesn't exist
    const credentialsDir = path.dirname(tokenPath);
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    console.log('💾 Tokens saved to:', tokenPath);
    
    // Test the authentication by listing calendars
    console.log('\n🧪 Testing authentication...');
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarList = await calendar.calendarList.list();
    
    console.log('📅 Available calendars for sheridan.gray@gmail.com:');
    calendarList.data.items.forEach(cal => {
      console.log(`   - ${cal.summary} (${cal.id})`);
    });
    
    // Test Gmail access
    const gmail = google.gmail({ version: 'v1', auth });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`📧 Gmail access confirmed for: ${profile.data.emailAddress}`);
    
    console.log('\n🎉 OAuth authentication completed successfully!');
    console.log('✅ The MCP health check should now show Gmail/Calendar services as healthy');
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 The authorization code may have expired or been used already.');
      console.log('Please run generate-auth-url.js again to get a fresh code.');
    }
  }
}

processAuthCode();