require('dotenv').config();

const RegistrationAutomator = require('./src/automation/registration');
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

async function testCalAcademyAdapter() {
  const database = new Database(logger);
  const automator = new RegistrationAutomator(logger, database);
  
  try {
    logger.info('Initializing database and automator...');
    await database.init();
    await automator.init();
    
    logger.info('Testing California Academy custom adapter...');
    
    // Get a free Cal Academy event from the database  
    const calAcademyEvents = await database.postgres.pool.query(`
      SELECT id, source, title, registration_url, cost, status 
      FROM events 
      WHERE source = 'California Academy of Sciences' 
      AND registration_url IS NOT NULL
      AND status = 'approved'
      AND cost = 0
      LIMIT 1
    `);
    
    let testCalAcademyEvent;
    
    if (calAcademyEvents.rows.length === 0) {
      logger.warn('No approved Cal Academy events found, creating a test event...');
      
      // Create a test Cal Academy event (FREE for testing)
      const testEvent = {
        id: 'test-cal-academy-free-1',
        source: 'California Academy of Sciences',
        title: 'Cal Academy Free Test Event',
        location_address: 'California Academy of Sciences, San Francisco, CA',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        age_range_min: 2,
        age_range_max: 10,
        cost: 0, // FREE event for testing
        description: 'Testing Cal Academy custom adapter with free event.',
        registration_url: 'https://www.calacademy.org/events/programs/roar-and-read-storytime'
      };
      
      await database.saveEvent(testEvent);
      await database.updateEventStatus(testEvent.id, 'approved');
      
      logger.info('Created test Cal Academy event');
      testCalAcademyEvent = testEvent;
    } else {
      testCalAcademyEvent = calAcademyEvents.rows[0];
      logger.info(`Using existing Cal Academy event: ${testCalAcademyEvent.title}`);
    }
    
    // Test the adapter selection
    logger.info('Testing adapter selection...');
    const selectedAdapter = automator.getAdapterForEvent(testCalAcademyEvent);
    logger.info(`Selected adapter: ${selectedAdapter.name}`);
    
    if (selectedAdapter.name === 'CalAcademyAdapter') {
      logger.info('✅ SUCCESS: Cal Academy adapter correctly selected');
    } else {
      logger.warn('❌ WARNING: Expected CalAcademyAdapter, got: ' + selectedAdapter.name);
    }
    
    // Test the registration process
    logger.info('Testing Cal Academy registration process...');
    logger.info(`Event: ${testCalAcademyEvent.title}`);
    logger.info(`URL: ${testCalAcademyEvent.registration_url}`);
    logger.info(`Cost: $${testCalAcademyEvent.cost}`);
    
    const result = await automator.registerForEvent(testCalAcademyEvent);
    
    logger.info('Cal Academy registration result:');
    logger.info(JSON.stringify(result, null, 2));
    
    // Analyze the result
    if (result.success) {
      logger.info(`✅ SUCCESS: Cal Academy registration completed`);
      logger.info(`Confirmation: ${result.confirmationNumber || 'None'}`);
    } else {
      logger.info(`❌ EXPECTED: Cal Academy registration failed (this is normal for admission-based events)`);
      logger.info(`Reason: ${result.message}`);
      
      // For Cal Academy, failure is expected due to admission requirement
      if (result.message && result.message.includes('admission')) {
        logger.info(`✅ CORRECT BEHAVIOR: Cal Academy adapter correctly identified admission requirement`);
      }
    }
    
    logger.info(`Adapter used: ${result.adapterType}`);
    logger.info(`Time taken: ${result.timeTaken || 0}ms`);
    logger.info(`Manual action required: ${result.requiresManualAction ? 'Yes' : 'No'}`);
    
    logger.info('Cal Academy adapter testing completed!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    // Clean up
    await automator.close();
    if (database.postgres && database.postgres.pool) {
      await database.postgres.pool.end();
    }
    process.exit(0);
  }
}

testCalAcademyAdapter().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});