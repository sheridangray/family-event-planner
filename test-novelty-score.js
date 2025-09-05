require('dotenv').config();

const EventScorer = require('./src/scoring/index');
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

async function testNoveltyScore() {
  const database = new Database(logger);
  const scorer = new EventScorer(logger, database);
  
  try {
    logger.info('Initializing database...');
    await database.init();
    
    logger.info('Testing novelty score calculation...');
    
    // Test event similar to the one that was failing
    const sampleEvent = {
      id: 'test-event-1',
      title: 'Hip Hop Dance Fitness Class',
      venue: 'Rae Studios',
      location_address: '123 Test St, San Francisco, CA',
      date: new Date(),
      minAge: 2,
      maxAge: 10,
      cost: 25,
      isRecurring: false
    };
    
    logger.info(`Testing novelty score for: ${sampleEvent.title}`);
    const noveltyScore = await scorer.calculateNoveltyScore(sampleEvent);
    logger.info(`Novelty score calculated successfully: ${noveltyScore}`);
    
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

testNoveltyScore().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});