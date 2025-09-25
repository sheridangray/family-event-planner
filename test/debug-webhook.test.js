#!/usr/bin/env node

/**
 * Gmail Pub/Sub Webhook Debug Test
 * 
 * This script helps diagnose issues with Gmail Pub/Sub webhook delivery.
 * It performs comprehensive testing of the webhook endpoint.
 */

require('dotenv').config();
const axios = require('axios');

class WebhookDebugger {
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'https://family-event-planner-backend.onrender.com';
    this.webhookUrl = `${this.baseUrl}/api/webhooks/gmail/notifications`;
    this.healthUrl = `${this.baseUrl}/api/webhooks/gmail/health`;
  }

  async runAllTests() {
    console.log('🔍 Gmail Pub/Sub Webhook Debugging Tool');
    console.log('=' .repeat(50));
    console.log(`Backend URL: ${this.baseUrl}`);
    console.log(`Webhook URL: ${this.webhookUrl}`);
    console.log(`Health URL: ${this.healthUrl}`);
    console.log('');

    const results = {
      healthCheck: null,
      basicConnectivity: null,
      webhookEndpoint: null,
      authenticationTest: null,
      mockPubSubTest: null
    };

    // Test 1: Health Check
    console.log('🏥 Test 1: Health Check');
    console.log('-'.repeat(30));
    try {
      const response = await axios.get(this.healthUrl, { timeout: 10000 });
      console.log('✅ Health check passed');
      console.log('📊 Response:', response.data);
      results.healthCheck = { success: true, data: response.data };
    } catch (error) {
      console.log('❌ Health check failed');
      console.log('📍 Error:', error.message);
      if (error.response) {
        console.log('📄 Response status:', error.response.status);
        console.log('📄 Response data:', error.response.data);
      }
      results.healthCheck = { success: false, error: error.message };
    }
    console.log('');

    // Test 2: Basic Connectivity
    console.log('🌐 Test 2: Basic Backend Connectivity');
    console.log('-'.repeat(30));
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 10000 });
      console.log('✅ Backend is reachable');
      console.log('📊 Response:', response.data);
      results.basicConnectivity = { success: true, data: response.data };
    } catch (error) {
      console.log('❌ Backend connectivity failed');
      console.log('📍 Error:', error.message);
      results.basicConnectivity = { success: false, error: error.message };
    }
    console.log('');

    // Test 3: Webhook Endpoint Test
    console.log('📡 Test 3: Webhook Endpoint POST Test');
    console.log('-'.repeat(30));
    try {
      const response = await axios.post(this.webhookUrl, 
        { test: 'debug' },
        { 
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      console.log('✅ Webhook endpoint accepts POST requests');
      console.log('📊 Response:', response.data);
      results.webhookEndpoint = { success: true, data: response.data };
    } catch (error) {
      console.log('❌ Webhook POST test failed');
      console.log('📍 Error:', error.message);
      if (error.response) {
        console.log('📄 Response status:', error.response.status);
        console.log('📄 Response data:', error.response.data);
      }
      results.webhookEndpoint = { success: false, error: error.message, status: error.response?.status };
    }
    console.log('');

    // Test 4: Authentication Test
    console.log('🔐 Test 4: Authentication Test');
    console.log('-'.repeat(30));
    try {
      const mockJwtToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNoZXJpZGFuLmdyYXlAZ21haWwuY29tIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwiYXVkIjoiaHR0cHM6Ly9mYW1pbHktZXZlbnQtcGxhbm5lci1iYWNrZW5kLm9ucmVuZGVyLmNvbS9hcGkvd2ViaG9va3MvZ21haWwvbm90aWZpY2F0aW9ucyIsImV4cCI6OTk5OTk5OTk5OX0.fake';
      
      const response = await axios.post(this.webhookUrl, 
        { message: { data: Buffer.from('{"test": "auth"}').toString('base64') } },
        { 
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': mockJwtToken
          }
        }
      );
      console.log('✅ Webhook accepts authenticated requests');
      console.log('📊 Response:', response.data);
      results.authenticationTest = { success: true, data: response.data };
    } catch (error) {
      console.log('❌ Authentication test failed');
      console.log('📍 Error:', error.message);
      if (error.response) {
        console.log('📄 Response status:', error.response.status);
        console.log('📄 Response data:', error.response.data);
      }
      results.authenticationTest = { success: false, error: error.message, status: error.response?.status };
    }
    console.log('');

    // Test 5: Mock Pub/Sub Message Test
    console.log('📫 Test 5: Mock Pub/Sub Message Test');
    console.log('-'.repeat(30));
    try {
      const mockPubSubMessage = {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: 'sheridan.gray@gmail.com',
            historyId: '12345'
          })).toString('base64'),
          messageId: 'test-message-id',
          publishTime: new Date().toISOString()
        },
        subscription: 'test-subscription'
      };

      const response = await axios.post(this.webhookUrl, 
        mockPubSubMessage,
        { 
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Mock Pub/Sub message processed');
      console.log('📊 Response:', response.data);
      results.mockPubSubTest = { success: true, data: response.data };
    } catch (error) {
      console.log('❌ Mock Pub/Sub message test failed');
      console.log('📍 Error:', error.message);
      if (error.response) {
        console.log('📄 Response status:', error.response.status);
        console.log('📄 Response data:', error.response.data);
      }
      results.mockPubSubTest = { success: false, error: error.message, status: error.response?.status };
    }
    console.log('');

    // Summary
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(50));
    const tests = [
      { name: 'Health Check', result: results.healthCheck },
      { name: 'Basic Connectivity', result: results.basicConnectivity },
      { name: 'Webhook Endpoint', result: results.webhookEndpoint },
      { name: 'Authentication', result: results.authenticationTest },
      { name: 'Mock Pub/Sub', result: results.mockPubSubTest }
    ];

    tests.forEach(test => {
      const status = test.result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedTests = tests.filter(t => t.result.success).length;
    console.log('');
    console.log(`Overall: ${passedTests}/${tests.length} tests passed`);

    if (passedTests < tests.length) {
      console.log('');
      console.log('🔧 DEBUGGING SUGGESTIONS:');
      
      if (!results.healthCheck.success) {
        console.log('• Health check failed - webhook service may not be running');
      }
      
      if (!results.basicConnectivity.success) {
        console.log('• Backend not reachable - check URL and deployment status');
      }
      
      if (!results.webhookEndpoint.success) {
        console.log('• Webhook endpoint not responding - check routing and middleware');
      }
      
      if (!results.authenticationTest.success) {
        console.log('• Authentication failing - check JWT validation logic');
      }
      
      if (!results.mockPubSubTest.success) {
        console.log('• Pub/Sub message processing failed - check message parsing');
      }
    }

    // Save results
    const fs = require('fs');
    const resultsFile = `test/webhook-debug-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log('');
    console.log(`📁 Results saved to: ${resultsFile}`);

    return results;
  }

  async testGooglePubSubDelivery() {
    console.log('');
    console.log('🔔 GOOGLE PUB/SUB DELIVERY TEST');
    console.log('=' .repeat(50));
    console.log('To test actual Google Pub/Sub delivery:');
    console.log('');
    console.log('1. Send yourself a test email from another account');
    console.log('2. Watch production logs for webhook activity');
    console.log('3. Check if Gmail watch is properly configured:');
    console.log('');
    console.log('   Gmail API Console > Library > Gmail API');
    console.log('   - Check quotas and usage');
    console.log('   - Verify Pub/Sub topic exists');
    console.log('   - Confirm subscription is active');
    console.log('');
    console.log('4. Verify your webhook configuration:');
    console.log(`   - Endpoint: ${this.webhookUrl}`);
    console.log('   - Authentication: Enabled');
    console.log('   - Service Account: gmail-webhook-auth@family-event--planner-469218.iam.gserviceaccount.com');
    console.log(`   - Audience: ${this.webhookUrl}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Gmail Pub/Sub Webhook Debug Tests...');
  console.log('');
  
  const webhookDebugger = new WebhookDebugger();
  
  try {
    const results = await webhookDebugger.runAllTests();
    await webhookDebugger.testGooglePubSubDelivery();
    
    process.exit(results.healthCheck && results.webhookEndpoint ? 0 : 1);
  } catch (error) {
    console.error('💥 Debug test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { WebhookDebugger };