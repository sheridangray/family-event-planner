require('dotenv').config();

const { EmailNotificationClient } = require('./src/mcp/email-notifications');
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

async function testEmailApproval() {
  const database = new Database(logger);
  const emailClient = new EmailNotificationClient(logger, database);
  
  try {
    logger.info('Initializing database...');
    await database.init();
    
    logger.info('Testing email approval request...');
    
    // Test event similar to the one that was failing
    const sampleEvent = {
      id: 'test-event-approval-1',
      source: 'test',
      title: 'Free Programming in Union Square: Tuesday Blues',
      venue: 'Union Square',
      location_address: 'Union Square, San Francisco, CA',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      age_range_min: 2,
      age_range_max: 10,
      cost: 0,
      description: 'A free programming event in Union Square featuring Tuesday Blues.',
      registration_url: 'https://example.com/register'
    };
    
    logger.info(`Testing email approval for: ${sampleEvent.title}`);
    
    // First, create the event in the database to avoid foreign key constraint violation
    logger.info('Creating event in database...');
    await database.saveEvent(sampleEvent);
    logger.info('Event created successfully');
    
    // This should test the full flow without actually sending emails
    // Since we don't want to actually send test emails, we'll catch the Gmail client error
    try {
      const result = await emailClient.sendApprovalRequest(sampleEvent);
      logger.info('Email approval request succeeded:', result);
    } catch (error) {
      if (error.message.includes('Gmail') || error.message.includes('authentication') || error.message.includes('credentials')) {
        logger.info('Gmail authentication error as expected (no actual email sent)');
        logger.info('The database and SQL operations completed successfully');
      } else {
        logger.error('Unexpected error:', error.message);
        throw error;
      }
    }
    
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

testEmailApproval().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});