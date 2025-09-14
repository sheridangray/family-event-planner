const Database = require('./src/database');
const UnifiedNotificationService = require('./src/services/unified-notification');

// Mock logger
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${msg}`, ...args)
};

async function testEmailNotifications() {
  console.log('🧪 Testing Email Notification System\n');
  
  try {
    // Initialize database and notification service
    const database = new Database();
    await database.init();
    
    // Force email mode for testing
    process.env.FORCE_EMAIL_NOTIFICATIONS = 'true';
    
    const notificationService = new UnifiedNotificationService(logger, database);
    await notificationService.init();
    
    // Check status
    const status = notificationService.getStatus();
    console.log('📊 Notification Service Status:');
    console.log(`   - SMS Available: ${status.smsAvailable}`);
    console.log(`   - Email Available: ${status.emailAvailable}`);
    console.log(`   - Primary Method: ${status.primaryMethod}`);
    console.log(`   - Email Fallback: ${status.useEmailFallback}\n`);
    
    // Create a test event
    const testEvent = {
      id: `test-email-${Date.now()}`,
      source: 'Email Test',
      title: 'Family Science Workshop: Explore the Universe',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      location: { 
        address: 'California Academy of Sciences, 55 Music Concourse Dr, San Francisco, CA 94118' 
      },
      ageRange: { min: 3, max: 8 },
      cost: 0, // Free event
      description: 'Join us for an exciting hands-on science workshop designed for families! Kids will explore astronomy through interactive experiments and telescope observations.',
      registrationUrl: 'https://example.com/register/science-workshop',
      socialProof: {
        yelpRating: 4.7
      }
    };
    
    console.log('📧 Testing email notification for event:');
    console.log(`   - Title: ${testEvent.title}`);
    console.log(`   - Date: ${testEvent.date.toLocaleDateString()}`);
    console.log(`   - Cost: ${testEvent.cost === 0 ? 'FREE' : '$' + testEvent.cost}`);
    console.log(`   - Ages: ${testEvent.ageRange.min}-${testEvent.ageRange.max}\n`);
    
    // Send approval request
    const result = await notificationService.sendEventForApproval(testEvent);
    
    console.log('✅ Email notification sent successfully!');
    console.log(`   - Method: ${result.method}`);
    console.log(`   - Message ID: ${result.messageId}`);
    console.log(`   - Approval ID: ${result.approvalId}`);
    console.log(`   - Recipient: ${result.recipient}`);
    console.log(`   - Sent At: ${result.sentAt.toLocaleString()}\n`);
    
    // Test response parsing
    console.log('🧪 Testing email response parsing...\n');
    
    const testResponses = [
      'Yes',
      'NO',
      'yes, sounds great!',
      'no thanks',
      'maybe later',
      'paid',
      'cancel',
      'Sure, let\'s do it',
      'Not interested',
      'Hi there,\n\nYes, this looks great!\n\nBest regards,\nJoyce'
    ];
    
    for (const response of testResponses) {
      try {
        const emailClient = notificationService.emailManager.emailClient;
        const parsed = emailClient.parseEmailResponse(response);
        console.log(`Response: "${response.replace(/\n/g, '\\n')}"`);
        console.log(`   → Status: ${parsed.status} (${parsed.confidence} confidence)`);
        console.log(`   → Approved: ${parsed.approved}, Rejected: ${parsed.rejected}\n`);
      } catch (error) {
        console.error(`Error parsing response "${response}":`, error.message);
      }
    }
    
    // Test event with cost (payment required)
    const paidEvent = {
      ...testEvent,
      id: `test-paid-email-${Date.now()}`,
      title: 'Premium Family Cooking Class',
      cost: 45,
      description: 'Learn to make delicious pasta from scratch in this hands-on cooking class for families.'
    };
    
    console.log('💰 Testing paid event notification...');
    const paidResult = await notificationService.sendEventForApproval(paidEvent);
    console.log(`✅ Paid event notification sent (ID: ${paidResult.approvalId})\n`);
    
    // Show daily counts
    const counts = notificationService.getDailyEventCounts();
    console.log('📊 Daily Event Counts:');
    console.log(`   - SMS: ${counts.sms}`);
    console.log(`   - Email: ${counts.email}`);
    console.log(`   - Active Method: ${counts.activeMethod}\n`);
    
    console.log('🎉 Email notification test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check your email for the test notifications');
    console.log('   2. Try replying with "YES" or "NO" to test response handling');
    console.log('   3. Monitor the logs for any response processing');
    
    // Clean up
    await database.close();
    
  } catch (error) {
    console.error('\n💥 Email notification test failed:', error);
    console.error(error.stack);
  }
}

async function runTest() {
  try {
    await testEmailNotifications();
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  runTest();
}

module.exports = { testEmailNotifications };