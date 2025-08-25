const { google } = require('googleapis');
const { GmailMCPClient } = require('./src/mcp/gmail');

// Mock logger
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${msg}`, ...args)
};

async function setupGmailWebhooks() {
  console.log('🔔 Setting up Gmail Push Notifications (Webhooks)\n');
  
  try {
    // Initialize Gmail client
    const gmailClient = new GmailMCPClient(logger);
    await gmailClient.init();
    
    console.log('📋 Gmail Push Notifications Setup Requirements:');
    console.log('\n1. **Google Cloud Pub/Sub Topic**');
    console.log('   - Create a Pub/Sub topic in Google Cloud Console');
    console.log('   - Topic will receive Gmail notifications');
    console.log('   - Name suggestion: "gmail-notifications"');
    
    console.log('\n2. **Service Account & Permissions**');
    console.log('   - Gmail API needs permission to publish to Pub/Sub');
    console.log('   - Your app needs permission to receive from Pub/Sub');
    
    console.log('\n3. **Webhook Endpoint**');
    console.log('   - HTTP endpoint to receive Pub/Sub notifications');
    console.log('   - Must be publicly accessible (ngrok for dev)');
    console.log('   - Will process email replies automatically');
    
    console.log('\n🚀 **Ready to proceed?** Here are the next steps:\n');
    
    // Check current Gmail setup
    console.log('✅ Gmail API client initialized');
    console.log(`✅ Authentication working`);
    
    // Guide user through setup
    console.log('\n**STEP 1: Create Pub/Sub Topic**');
    console.log('1. Go to Google Cloud Console: https://console.cloud.google.com');
    console.log('2. Navigate to Pub/Sub > Topics');
    console.log('3. Create new topic: "gmail-notifications"');
    console.log('4. Note your Project ID');
    
    console.log('\n**STEP 2: Set Gmail Permissions**');
    console.log('1. Go to IAM & Admin > Service Accounts');
    console.log('2. Find your Gmail service account (or use default)');
    console.log('3. Add role: "Pub/Sub Publisher"');
    
    console.log('\n**STEP 3: Configure Environment**');
    console.log('Add to your .env file:');
    console.log('   GOOGLE_CLOUD_PROJECT_ID=your-project-id');
    console.log('   PUBSUB_TOPIC_NAME=gmail-notifications');
    console.log('   WEBHOOK_BASE_URL=https://your-domain.com (or ngrok URL)');
    
    console.log('\n**STEP 4: Run webhook setup**');
    console.log('   node setup-gmail-webhooks.js --configure');
    
    // Check if they want to configure now
    if (process.argv.includes('--configure')) {
      await configureWebhooks(gmailClient);
    } else {
      console.log('\n💡 Run with --configure flag after completing steps 1-3 above');
    }
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure Gmail API is enabled');
    console.error('2. Check authentication token');
    console.error('3. Verify Google Cloud project access');
  }
}

async function configureWebhooks(gmailClient) {
  console.log('\n🔧 Configuring Gmail Push Notifications...');
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const topicName = process.env.PUBSUB_TOPIC_NAME || 'gmail-notifications';
  const webhookUrl = process.env.WEBHOOK_BASE_URL;
  
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable required');
  }
  
  if (!webhookUrl) {
    throw new Error('WEBHOOK_BASE_URL environment variable required');
  }
  
  console.log(`📡 Project ID: ${projectId}`);
  console.log(`📢 Topic: ${topicName}`);
  console.log(`🌐 Webhook URL: ${webhookUrl}`);
  
  try {
    // Set up Gmail watch request
    const topicResource = `projects/${projectId}/topics/${topicName}`;
    
    console.log('\n📧 Setting up Gmail watch request...');
    
    const watchRequest = {
      userId: 'me',
      requestBody: {
        topicName: topicResource,
        labelIds: ['INBOX'],
        labelFilterAction: 'include'
      }
    };
    
    const response = await gmailClient.gmail.users.watch(watchRequest);
    
    console.log('✅ Gmail watch request successful!');
    console.log(`   History ID: ${response.data.historyId}`);
    console.log(`   Expiration: ${new Date(parseInt(response.data.expiration))}`);
    
    // Store the history ID for processing
    const fs = require('fs');
    const historyData = {
      historyId: response.data.historyId,
      expiration: response.data.expiration,
      topicName: topicResource,
      setupDate: new Date().toISOString()
    };
    
    fs.writeFileSync('./gmail-watch-history.json', JSON.stringify(historyData, null, 2));
    console.log('💾 Watch history saved to gmail-watch-history.json');
    
    console.log('\n🎉 Gmail Push Notifications configured successfully!');
    console.log('\nNext step: Set up your webhook endpoint to receive notifications');
    
  } catch (error) {
    console.error('❌ Failed to configure Gmail watch:', error.message);
    
    if (error.code === 400) {
      console.error('\n🔍 Common issues:');
      console.error('1. Pub/Sub topic doesn\'t exist');
      console.error('2. Gmail API lacks Pub/Sub publish permissions');
      console.error('3. Invalid project ID or topic name');
    }
    
    throw error;
  }
}

async function testWebhookSetup() {
  console.log('🧪 Testing webhook configuration...\n');
  
  const fs = require('fs');
  
  if (!fs.existsSync('./gmail-watch-history.json')) {
    console.log('❌ No watch history found. Run setup first.');
    return;
  }
  
  const history = JSON.parse(fs.readFileSync('./gmail-watch-history.json', 'utf8'));
  const expirationDate = new Date(parseInt(history.expiration));
  const now = new Date();
  
  console.log('📊 Current webhook status:');
  console.log(`   History ID: ${history.historyId}`);
  console.log(`   Topic: ${history.topicName}`);
  console.log(`   Expires: ${expirationDate.toLocaleString()}`);
  console.log(`   Status: ${expirationDate > now ? '✅ Active' : '❌ Expired'}`);
  
  if (expirationDate <= now) {
    console.log('\n⚠️  Watch request expired. Run setup again with --configure');
  } else {
    const hoursRemaining = Math.floor((expirationDate - now) / (1000 * 60 * 60));
    console.log(`   Time remaining: ~${hoursRemaining} hours`);
  }
}

if (require.main === module) {
  if (process.argv.includes('--test')) {
    testWebhookSetup();
  } else {
    setupGmailWebhooks();
  }
}

module.exports = { setupGmailWebhooks, configureWebhooks, testWebhookSetup };