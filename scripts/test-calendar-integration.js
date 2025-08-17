#!/usr/bin/env node
require('dotenv').config();

const winston = require('winston');
const { CalendarConflictChecker } = require('../src/mcp/gmail');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

async function testCalendarIntegration() {
  const calendarChecker = new CalendarConflictChecker(logger);
  
  try {
    logger.info('🧪 Testing Calendar Integration...');
    
    // Initialize calendar client
    await calendarChecker.init();
    logger.info('✅ Calendar client initialized');
    
    // Test with a future date
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7); // 1 week from now
    
    logger.info(`🗓️  Testing conflict check for: ${testDate.toISOString()}`);
    
    // Test conflict checking
    const conflictDetails = await calendarChecker.getConflictDetails(testDate.toISOString());
    
    logger.info('📊 Conflict Check Results:');
    logger.info(`  - Has blocking conflict (Joyce): ${conflictDetails.hasConflict}`);
    logger.info(`  - Has warning conflict (Sheridan): ${conflictDetails.hasWarning}`);
    logger.info(`  - Total blocking conflicts: ${conflictDetails.blockingConflicts?.length || 0}`);
    logger.info(`  - Total warning conflicts: ${conflictDetails.warningConflicts?.length || 0}`);
    
    if (conflictDetails.blockingConflicts?.length > 0) {
      logger.info('❌ Blocking conflicts (Joyce):');
      conflictDetails.blockingConflicts.forEach(conflict => {
        logger.info(`    "${conflict.title}" (${conflict.start} - ${conflict.end})`);
      });
    }
    
    if (conflictDetails.warningConflicts?.length > 0) {
      logger.info('⚠️  Warning conflicts (Sheridan):');
      conflictDetails.warningConflicts.forEach(conflict => {
        logger.info(`    "${conflict.title}" (${conflict.start} - ${conflict.end})`);
      });
    }
    
    if (!conflictDetails.hasConflict && !conflictDetails.hasWarning) {
      logger.info('✅ No conflicts found - event would be approved');
    }
    
    // Test the simple hasConflict method used by filters
    const hasConflict = await calendarChecker.hasConflict(testDate.toISOString());
    logger.info(`🔍 Simple conflict check: ${hasConflict ? 'BLOCKED' : 'ALLOWED'}`);
    
    logger.info('🎉 Calendar integration test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Calendar integration test failed:', error.message);
    
    if (error.message.includes('credentials')) {
      logger.info('💡 Make sure your gmail-credentials.json file is properly configured');
    }
    
    if (error.message.includes('token')) {
      logger.info('💡 You may need to re-authenticate. Check the OAuth token setup.');
    }
    
    if (error.code === 401) {
      logger.info('💡 Authentication failed. The OAuth token may have expired.');
    }
    
    if (error.code === 403) {
      logger.info('💡 Permission denied. Make sure the calendar scope is enabled.');
    }
  }
}

testCalendarIntegration();