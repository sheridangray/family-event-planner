require('dotenv').config();
const winston = require('winston');
const { CalendarConflictChecker } = require('./src/mcp/gmail');

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

async function debugCalendar() {
  try {
    logger.info('Debugging calendar authentication...');
    
    const calendarManager = new CalendarConflictChecker(logger);
    await calendarManager.init();
    
    // Test calendar access with tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    logger.info(`Testing calendar access for ${tomorrow.toISOString()}`);
    
    const result = await calendarManager.getConflictDetails(tomorrow.toISOString(), 120);
    
    logger.info('Calendar test results:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    logger.error('Calendar debug failed:', error.message);
    logger.error('Stack:', error.stack);
    
    // Check if it's a specific auth error
    if (error.code) {
      logger.error('Error code:', error.code);
    }
    if (error.errors) {
      logger.error('API errors:', JSON.stringify(error.errors, null, 2));
    }
  }
}

debugCalendar();