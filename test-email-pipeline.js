require('dotenv').config();
const winston = require('winston');
const Database = require('./src/database');
const UnifiedNotificationService = require('./src/services/unified-notification');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testEmailPipeline() {
  try {
    console.log('🔍 Testing complete email notification pipeline...\n');
    
    const database = new Database();
    await database.init();
    
    // Check if we have any discovered events
    const discoveredEvents = await database.getEventsByStatus('discovered');
    console.log(`📋 Discovered events: ${discoveredEvents.length}`);
    
    // Check proposed events (sent for approval)
    const proposedEvents = await database.getEventsByStatus('proposed');
    console.log(`📤 Proposed events: ${proposedEvents.length}`);
    
    if (proposedEvents.length > 0) {
      console.log('\n✅ Events already proposed:');
      proposedEvents.forEach((event, i) => {
        console.log(`   ${i + 1}. ${event.title} (${new Date(event.date).toLocaleDateString()})`);
      });
    }
    
    // Test unified notification service initialization
    console.log('\n🧪 Testing UnifiedNotificationService...');
    try {
      const unifiedNotifications = new UnifiedNotificationService(logger, database);
      await unifiedNotifications.init();
      console.log('✅ UnifiedNotificationService initialized successfully');
      
      // Check if it can send events
      const status = unifiedNotifications.getStatus();
      console.log('📊 Service status:', status);
      
      // Test with a simple event
      if (discoveredEvents.length > 0) {
        console.log('\n📧 Testing email sending capability...');
        const testEvent = discoveredEvents[0];
        
        console.log(`Testing with: ${testEvent.title}`);
        console.log(`Date: ${new Date(testEvent.date).toLocaleDateString()}`);
        
        try {
          const canSend = await unifiedNotifications.shouldSendEvent();
          console.log(`✅ Can send events: ${canSend}`);
          
          if (canSend) {
            console.log('🚀 Attempting to send test approval email...');
            // Convert database format to expected format
            const eventForApproval = {
              ...testEvent,
              ageRange: {
                min: testEvent.age_range_min || 0,
                max: testEvent.age_range_max || 18
              },
              location: {
                address: testEvent.location || 'TBD'
              }
            };
            
            const result = await unifiedNotifications.sendEventForApproval(eventForApproval);
            console.log('📧 Email send result:', result);
          }
        } catch (emailError) {
          console.error('❌ Email sending failed:', emailError.message);
        }
      }
      
    } catch (serviceError) {
      console.error('❌ UnifiedNotificationService failed:', serviceError.message);
      console.error('Stack:', serviceError.stack);
    }
    
    await database.close();
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEmailPipeline();