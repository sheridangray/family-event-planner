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

async function testAutoRegistration() {
  const database = new Database(logger);
  const orchestrator = new RegistrationOrchestrator(logger, database);
  
  try {
    logger.info('Initializing database and orchestrator...');
    await database.init();
    await orchestrator.init();
    
    logger.info('Testing auto-registration workflow...');
    
    // Create a test free event
    const testEvent = {
      id: 'test-auto-registration-1',
      source: 'test',
      title: 'Test Auto Registration Event',
      location_address: 'Test Location, San Francisco, CA',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      age_range_min: 2,
      age_range_max: 10,
      cost: 0, // FREE event for testing
      description: 'A test event to verify auto-registration workflow.',
      registration_url: 'https://example.com/register-test-event',
      registrationUrl: 'https://example.com/register-test-event' // Backup field
    };
    
    logger.info('Creating test event in database...');
    await database.saveEvent(testEvent);
    await database.updateEventStatus(testEvent.id, 'approved');
    
    // Create a test approval record
    const approvalId = await database.saveSMSApproval(
      testEvent.id,
      'test@example.com',
      'Test approval for auto-registration'
    );
    
    logger.info(`Created test event ${testEvent.id} with approval ID ${approvalId}`);
    
    // Test the auto-registration workflow
    logger.info('Triggering auto-registration...');
    const result = await orchestrator.processAutoRegistration(testEvent.id, approvalId);
    
    logger.info('Auto-registration result:', JSON.stringify(result, null, 2));
    
    // Check final event status
    const finalEvent = await database.getEventById(testEvent.id);
    logger.info(`Final event status: ${finalEvent.status}`);
    
    logger.info('Test completed successfully!');
    
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

testAutoRegistration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});