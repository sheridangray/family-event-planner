/**
 * SMS Test Script
 * 
 * Tests the actual Twilio SMS functionality by sending a test message.
 * 
 * Usage: node test-sms.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const { SMSApprovalManager } = require('../src/mcp/twilio');
const Database = require('../src/database');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testSMS() {
  console.log('🔔 Testing Twilio SMS functionality...\n');
  
  try {
    // Initialize database (required for SMS manager)
    const database = new Database();
    await database.init();
    console.log('✓ Database initialized\n');
    
    // Initialize SMS manager
    const smsManager = new SMSApprovalManager(logger, database);
    await smsManager.init();
    console.log('✓ SMS manager initialized\n');
    
    // Create a test event for approval
    const testEvent = {
      id: 'test-event-' + Date.now(),
      title: 'Test Family Event',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      location: { address: 'Golden Gate Park, San Francisco, CA' },
      cost: 0, // Free event
      ageRange: { min: 2, max: 4 },
      description: 'This is a test event to verify SMS functionality is working.',
      source: 'Test System'
    };
    
    // First, let's try a very simple test message
    console.log('📱 Sending simple test SMS...');
    
    // Test with direct SMS first
    const simpleMessage = "Test message from Family Event Planner. Reply YES if you receive this.";
    console.log(`Message: ${simpleMessage}\n`);
    
    const messageId = await smsManager.twilioClient.sendSMS('+12063909727', simpleMessage);
    
    if (messageId) {
      console.log('✅ Simple SMS sent successfully!');
      console.log(`📨 Message ID: ${messageId}`);
      console.log('\n📲 Check your phone for the simple test message!');
    }
    
    console.log('\n✓ Simple SMS test completed successfully');
    
    await database.close();
    console.log('\n✓ Test completed');
    
  } catch (error) {
    console.error('❌ SMS test failed:', error.message);
    logger.error('SMS test error:', error);
  }
}

testSMS();