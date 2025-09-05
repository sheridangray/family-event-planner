require('dotenv').config();

const RegistrationOrchestrator = require('./src/services/registration-orchestrator');
const Database = require('./src/database/index');
const winston = require('winston');

// Set up logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testRealRegistration() {
  const database = new Database(logger);
  const orchestrator = new RegistrationOrchestrator(logger, database);
  
  try {
    logger.info('Initializing database and orchestrator...');
    await database.init();
    await orchestrator.init();
    
    logger.info('Testing real registration workflow...');
    
    // Create a test event with a real Cal Academy URL (this should fail gracefully)
    const testEvent = {
      id: 'test-real-registration-1',
      source: 'cal-academy',
      title: 'Cal Academy Test Registration Event',
      location_address: 'California Academy of Sciences, San Francisco, CA',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      age_range_min: 2,
      age_range_max: 10,
      cost: 0, // FREE event for testing
      description: 'A test event to verify auto-registration with real Cal Academy URL.',
      registration_url: 'https://www.calacademy.org/events',
    };
    
    logger.info('Creating test event in database...');
    await database.saveEvent(testEvent);
    await database.updateEventStatus(testEvent.id, 'approved');
    
    // Create a test approval record
    const approvalId = await database.saveSMSApproval(
      testEvent.id,
      'test@example.com',
      'Test approval for real registration test'
    );
    
    logger.info(`Created test event ${testEvent.id} with approval ID ${approvalId}`);
    
    // Test the auto-registration workflow
    logger.info('Triggering auto-registration with real URL...');
    const result = await orchestrator.processAutoRegistration(testEvent.id, approvalId);
    
    logger.info('Auto-registration result:', JSON.stringify(result, null, 2));
    
    // Check final event status
    const finalEvent = await database.getEventById(testEvent.id);
    logger.info(`Final event status: ${finalEvent.status}`);
    
    // Check registration record
    const registrations = await database.getRegistrationHistory(testEvent.id);
    logger.info(`Registration records:`, JSON.stringify(registrations, null, 2));
    
    logger.info('Real registration test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    // Clean up
    if (database.postgres && database.postgres.pool) {
      await database.postgres.pool.end();
    }
    process.exit(0);
  }
}

testRealRegistration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});