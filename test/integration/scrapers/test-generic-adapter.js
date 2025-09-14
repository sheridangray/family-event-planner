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

async function testGenericAdapter() {
  const database = new Database(logger);
  const automator = new RegistrationAutomator(logger, database);
  
  try {
    logger.info('Initializing database and automator...');
    await database.init();
    await automator.init();
    
    logger.info('Testing generic registration adapter...');
    
    // Test events with different complexity levels
    const testEvents = [
      {
        id: 'test-generic-simple-1',
        source: 'test',
        title: 'Simple Form Test Event',
        location_address: 'Test Location, San Francisco, CA',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        age_range_min: 2,
        age_range_max: 10,
        cost: 0,
        description: 'Testing generic adapter with a simple contact form.',
        // Using a simple form testing site
        registration_url: 'https://httpbin.org/forms/post'
      },
      {
        id: 'test-generic-complex-1',
        source: 'test',
        title: 'Complex Form Test Event',
        location_address: 'Test Location, San Francisco, CA',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        age_range_min: 2,
        age_range_max: 10,
        cost: 0,
        description: 'Testing generic adapter with a more complex form.',
        // Using a form that might have more complex fields
        registration_url: 'https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit'
      }
    ];
    
    for (const testEvent of testEvents) {
      logger.info(`Testing event: ${testEvent.title}`);
      logger.info(`Registration URL: ${testEvent.registration_url}`);
      
      try {
        // Test the registration process
        const result = await automator.registerForEvent(testEvent);
        
        logger.info(`Registration result for ${testEvent.title}:`);
        logger.info(JSON.stringify(result, null, 2));
        
        // Analyze the result
        if (result.success) {
          logger.info(`✅ SUCCESS: ${testEvent.title}`);
        } else {
          logger.info(`❌ FAILED: ${testEvent.title} - ${result.message}`);
        }
        
        logger.info(`Adapter used: ${result.adapterType || 'unknown'}`);
        logger.info(`Time taken: ${result.timeTaken || 0}ms`);
        logger.info('---');
        
      } catch (error) {
        logger.error(`Test failed for ${testEvent.title}:`, error.message);
      }
    }
    
    // Test adapter selection logic
    logger.info('Testing adapter selection...');
    
    const testUrls = [
      { url: 'https://www.calacademy.org/events', expected: 'generic' },
      { url: 'https://example.com/register', expected: 'generic' },
      { url: 'invalid-url', expected: 'generic' }
    ];
    
    for (const { url, expected } of testUrls) {
      const event = { registration_url: url };
      const adapter = automator.getAdapterForEvent(event);
      const actual = adapter.name.toLowerCase();
      
      logger.info(`URL: ${url}`);
      logger.info(`Expected adapter type: ${expected}, Got: ${actual}`);
      logger.info(`✅ Adapter selection ${actual.includes(expected) ? 'PASSED' : 'FAILED'}`);
    }
    
    logger.info('Generic adapter testing completed!');
    
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

testGenericAdapter().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});