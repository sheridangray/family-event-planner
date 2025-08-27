require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { config } = require('./src/config');

async function refreshGoogleToken() {
  try {
    console.log('Refreshing Google OAuth token...');
    
    // Load credentials
    const credentialsPath = config.gmail.mcpCredentials;
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    
    // Load current token
    const tokenPath = path.join(__dirname, 'credentials/google-oauth-token.json');
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    
    // Create OAuth2 client
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(token);
    
    console.log('Current token expires:', new Date(token.expiry_date).toISOString());
    
    // Refresh the token
    const { credentials: newToken } = await auth.refreshAccessToken();
    
    console.log('New token expires:', new Date(newToken.expiry_date).toISOString());
    
    // Save the refreshed token
    fs.writeFileSync(tokenPath, JSON.stringify(newToken, null, 2));
    
    console.log('✅ Token refreshed and saved successfully!');
    console.log('📁 Upload this refreshed token to Render:');
    console.log(JSON.stringify(newToken));
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n🔄 Refresh token expired. You need to re-authenticate:');
      console.log('Run: node setup-gmail-webhooks.js --configure');
    }
  }
}

refreshGoogleToken();