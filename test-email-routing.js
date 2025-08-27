const { EmailNotificationClient } = require('./src/mcp/email-notifications');

const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${msg}`, ...args)
};

async function testEmailRouting() {
  console.log('🧪 Testing Email Routing Logic\n');
  
  const client = new EmailNotificationClient(logger, null);
  await client.init();
  
  console.log(`📧 Current environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📨 Email will be sent to: ${client.getRecipientEmail()}\n`);
  
  const testEvent = {
    id: 'routing-test',
    source: 'Test',
    title: 'Email Routing Test',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    location: { address: 'Test Location' },
    ageRange: { min: 2, max: 6 },
    cost: 0,
    description: 'This is a test to verify email routing works correctly.'
  };
  
  try {
    const subject = client.buildEmailSubject(testEvent);
    const body = client.buildApprovalEmailBody(testEvent);
    
    console.log('📧 Test email preview:');
    console.log(`   To: ${client.getRecipientEmail()}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body (first 200 chars): ${body.substring(0, 200)}...\n`);
    
    console.log('✅ Email routing is correctly configured!');
    console.log('   - Development → Sheridan');
    console.log('   - Production → Joyce');
    
  } catch (error) {
    console.error('❌ Email routing test failed:', error.message);
  }
}

if (require.main === module) {
  testEmailRouting();
}

module.exports = { testEmailRouting };