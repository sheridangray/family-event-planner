require('dotenv').config();

const PreferenceLearningService = require('./src/services/preference-learning');
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

async function testPreferenceAnalysis() {
  const database = new Database(logger);
  const preferenceLearning = new PreferenceLearningService(logger, database);
  
  try {
    logger.info('Initializing database...');
    await database.init();
    
    logger.info('Testing preference analysis...');
    
    // Test direct preference analysis first
    logger.info('Testing analyzePreferences directly...');
    const preferences = await preferenceLearning.analyzePreferences();
    logger.info('Direct preference analysis completed:', JSON.stringify(preferences, null, 2));
    
    // Test getting preference score for a sample event
    const sampleEvent = {
      id: 'test-event-1',
      title: 'Sample Family Event',
      venue: 'Test Venue',
      category: 'family',
      cost: 25,
      date: new Date(),
      minAge: 2,
      maxAge: 10
    };
    
    const score = await preferenceLearning.getEventPreferenceScore(sampleEvent);
    logger.info(`Preference score calculated: ${score}`);
    
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

testPreferenceAnalysis().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});