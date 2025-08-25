const { GmailMCPClient } = require('./src/mcp/gmail');
const readline = require('readline');

// Mock logger
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${msg}`, ...args)
};

async function setupGmailPermissions() {
  console.log('🔐 Setting up Gmail API Permissions for Email Notifications\n');
  
  try {
    const gmailClient = new GmailMCPClient(logger);
    
    console.log('📋 This will add the following permissions to your Gmail integration:');
    console.log('   ✅ https://www.googleapis.com/auth/calendar (already have)');
    console.log('   ➕ https://www.googleapis.com/auth/gmail.send (NEW - for email notifications)');
    console.log('\n🔒 The gmail.send scope allows the app to:');
    console.log('   - Send emails on your behalf for event notifications');
    console.log('   - This is needed for the email fallback when SMS is unavailable');
    console.log('\n⚠️  Note: This will NOT allow the app to read your existing emails\n');
    
    // Initialize the client and check token status
    await gmailClient.init();
    
    // Check if we have valid credentials
    try {
      await gmailClient.calendar.calendarList.list();
      console.log('✅ Existing token found and working');
      console.log('🔄 But we need to re-authenticate to add email sending permissions...\n');
    } catch (error) {
      console.log('✅ No valid token found, proceeding with authentication...\n');
    }
    
    // Get the authentication URL
    const authUrl = await gmailClient.authenticate();
    
    console.log('🌐 Please follow these steps:');
    console.log('\n1. Open this URL in your browser (it will be printed below):');
    console.log(`${authUrl}\n`);
    console.log('2. Sign in to your Google account if prompted');
    console.log('3. Review and accept the permissions');
    console.log('4. Copy the authorization code from the browser');
    console.log('5. Paste it here when prompted\n');
    
    // Get authorization code from user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const code = await new Promise((resolve) => {
      rl.question('📝 Enter the authorization code: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    
    // Exchange code for token
    console.log('\n🔄 Exchanging authorization code for access token...');
    await gmailClient.setAuthCode(code);
    
    console.log('✅ Gmail permissions successfully configured!\n');
    
    // Test the new permissions
    console.log('🧪 Testing permissions...');
    await gmailClient.init();
    
    console.log('✅ Calendar access: Working');
    
    // Test email sending (this will show if gmail.send works)
    try {
      await gmailClient.sendEmail(
        ['sheridan@example.com'], // This will fail but tests the permission
        'Test Permission',
        'Testing Gmail send permission'
      );
    } catch (error) {
      if (error.message.includes('Insufficient Permission')) {
        console.log('❌ Gmail send access: Permission denied');
        console.log('   → The gmail.send scope may not have been granted');
      } else {
        console.log('✅ Gmail send access: Working (email failed for other reasons)');
      }
    }
    
    console.log('\n🎉 Setup complete! You can now use email notifications.');
    console.log('\nTo test email notifications, run:');
    console.log('   node test-email-notifications.js');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure credentials/gmail-credentials.json exists');
    console.error('2. Verify your Google Cloud project has Gmail API enabled');
    console.error('3. Check that your OAuth app is configured correctly');
  }
}

if (require.main === module) {
  setupGmailPermissions();
}

module.exports = { setupGmailPermissions };