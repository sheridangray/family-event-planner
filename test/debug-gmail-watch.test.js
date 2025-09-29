#!/usr/bin/env node

/**
 * Gmail Watch Debug Tool
 * 
 * This script diagnoses Gmail watch configuration issues.
 * It checks if Gmail push notifications are properly set up.
 * 
 * TODO: Update to use the new unified GmailClient instead of manual OAuth setup
 * The current implementation uses manual OAuth2 setup which should be replaced
 * with the database-first approach from the unified GmailClient.
 */

require('dotenv').config();
const Database = require('../src/database');
const { GmailClient } = require('../src/mcp/gmail-client');

class GmailWatchDebugger {
  constructor() {
    this.db = null;
    this.oauth2Client = null;
    this.gmail = null;
  }

  async init() {
    this.db = new Database();
    await this.db.init();
    console.log('✅ Database connected');

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost'
    );

    // Load tokens for sheridan.gray@gmail.com
    const result = await this.db.query(`
      SELECT access_token, refresh_token, token_type, expiry_date
      FROM oauth_tokens ot
      JOIN users u ON ot.user_id = u.id
      WHERE u.email = $1 AND ot.provider = 'google'
    `, ['sheridan.gray@gmail.com']);

    if (result.rows.length === 0) {
      throw new Error('No OAuth tokens found for sheridan.gray@gmail.com');
    }

    const tokenData = result.rows[0];
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: parseInt(tokenData.expiry_date)
    };

    this.oauth2Client.setCredentials(tokens);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    console.log('✅ Gmail API client initialized');
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }

  async checkGmailWatchStatus() {
    console.log('\n🔍 Checking Gmail Watch Status...');
    console.log('=' .repeat(50));

    try {
      // This endpoint doesn't exist in Gmail API, but we can check for active watches
      // by trying to stop a watch (it will tell us if there's an active one)
      
      console.log('📧 Getting Gmail profile...');
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      console.log(`✅ Connected to Gmail for: ${profile.data.emailAddress}`);
      console.log(`📊 History ID: ${profile.data.historyId}`);

      return {
        success: true,
        email: profile.data.emailAddress,
        historyId: profile.data.historyId
      };
    } catch (error) {
      console.log(`❌ Gmail API error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async setupGmailWatch() {
    console.log('\n🔧 Setting Up Gmail Watch...');
    console.log('=' .repeat(50));

    const webhookUrl = 'https://family-event-planner-backend.onrender.com/api/webhooks/gmail/notifications';
    const projectId = 'family-event--planner-469218'; // Note the double dash
    const topicName = 'gmail-webhook-topic';
    const fullTopicName = `projects/${projectId}/topics/${topicName}`;

    console.log(`📡 Webhook URL: ${webhookUrl}`);
    console.log(`📋 Project ID: ${projectId}`);
    console.log(`📢 Topic: ${fullTopicName}`);

    try {
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: fullTopicName,
          labelIds: ['INBOX'],
          labelFilterAction: 'include'
        }
      };

      console.log('\n🚀 Creating Gmail watch...');
      const watchResponse = await this.gmail.users.watch(watchRequest);
      
      console.log('✅ Gmail watch created successfully!');
      console.log('📊 Watch details:', {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)).toLocaleString()
      });

      return {
        success: true,
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration
      };

    } catch (error) {
      console.log(`❌ Failed to create Gmail watch: ${error.message}`);
      
      if (error.message.includes('topicName')) {
        console.log('\n💡 DIAGNOSIS: Pub/Sub topic issue');
        console.log('   The Pub/Sub topic might not exist or have wrong permissions');
      } else if (error.message.includes('permission')) {
        console.log('\n💡 DIAGNOSIS: Permission issue');
        console.log('   Gmail API might not have permission to publish to Pub/Sub topic');
      } else if (error.message.includes('quota')) {
        console.log('\n💡 DIAGNOSIS: Quota issue');
        console.log('   Gmail API quota might be exceeded');
      }

      return { success: false, error: error.message };
    }
  }

  async stopGmailWatch() {
    console.log('\n🛑 Stopping Existing Gmail Watch...');
    console.log('=' .repeat(50));

    try {
      await this.gmail.users.stop({ userId: 'me' });
      console.log('✅ Gmail watch stopped successfully');
      return { success: true };
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('No push subscription')) {
        console.log('ℹ️  No active Gmail watch found (this is normal)');
        return { success: true, message: 'No active watch' };
      } else {
        console.log(`❌ Failed to stop Gmail watch: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }

  async testPubSubTopic() {
    console.log('\n🔍 Testing Pub/Sub Topic Access...');
    console.log('=' .repeat(50));
    
    console.log('⚠️  Cannot test Pub/Sub topic without service account credentials');
    console.log('   This requires Google Cloud credentials to be configured');
    
    return { success: false, message: 'Requires service account credentials' };
  }

  async runFullDiagnostic() {
    console.log('🔍 Gmail Watch Diagnostic Tool');
    console.log('📅 ' + new Date().toLocaleString());
    console.log('=' .repeat(60));

    const results = {
      timestamp: new Date().toISOString(),
      gmailStatus: null,
      stopWatch: null,
      setupWatch: null,
      pubsubTest: null
    };

    try {
      // Step 1: Check Gmail API access
      results.gmailStatus = await this.checkGmailWatchStatus();

      // Step 2: Stop any existing watch
      results.stopWatch = await this.stopGmailWatch();

      // Step 3: Set up new watch
      results.setupWatch = await this.setupGmailWatch();

      // Step 4: Test Pub/Sub (limited without service account)
      results.pubsubTest = await this.testPubSubTopic();

      // Summary
      console.log('\n📋 DIAGNOSTIC SUMMARY');
      console.log('=' .repeat(60));
      
      if (results.gmailStatus.success) {
        console.log('✅ Gmail API access: Working');
      } else {
        console.log('❌ Gmail API access: Failed');
      }

      if (results.setupWatch.success) {
        console.log('✅ Gmail watch setup: Successful');
        console.log(`   Expires: ${new Date(parseInt(results.setupWatch.expiration)).toLocaleString()}`);
      } else {
        console.log('❌ Gmail watch setup: Failed');
      }

      if (results.setupWatch.success) {
        console.log('\n🎉 Gmail watch is now active!');
        console.log('   Try replying to an email now and check your Render logs');
        console.log('   Look for: "🔔 Gmail webhook endpoint hit!"');
      } else {
        console.log('\n❌ Gmail watch setup failed');
        console.log('   Issue: ' + results.setupWatch.error);
        this.provideTroubleshootingSteps(results.setupWatch.error);
      }

    } catch (error) {
      console.error('\n💥 Diagnostic failed:', error.message);
      results.error = error.message;
    }

    // Save results
    const fs = require('fs');
    const resultsFile = `test/gmail-watch-debug-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);

    return results;
  }

  provideTroubleshootingSteps(error) {
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('');
    
    if (error.includes('topicName') || error.includes('topic')) {
      console.log('1. 📢 Create Pub/Sub Topic:');
      console.log('   - Go to Google Cloud Console > Pub/Sub');
      console.log('   - Create topic: gmail-webhook-topic');
      console.log('   - Project: family-event--planner-469218');
      console.log('');
      console.log('2. 🔐 Set Topic Permissions:');
      console.log('   - Add principal: gmail-api-push@system.gserviceaccount.com');
      console.log('   - Role: Pub/Sub Publisher');
    }
    
    if (error.includes('permission') || error.includes('Permission')) {
      console.log('3. 📋 Create Pub/Sub Subscription:');
      console.log('   - Subscription name: gmail-webhook-subscription');
      console.log('   - Endpoint: https://family-event-planner-backend.onrender.com/api/webhooks/gmail/notifications');
      console.log('   - Enable authentication');
      console.log('   - Service account: gmail-webhook-auth@family-event--planner-469218.iam.gserviceaccount.com');
    }

    console.log('');
    console.log('4. 🔄 After fixing the above, run this script again');
  }
}

// Main execution
async function main() {
  const watchDebugger = new GmailWatchDebugger();
  
  try {
    await watchDebugger.init();
    const results = await watchDebugger.runFullDiagnostic();
    
    process.exit(results.setupWatch && results.setupWatch.success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  } finally {
    await watchDebugger.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GmailWatchDebugger };