require('dotenv').config();
const winston = require('winston');
const { config } = require('./src/config');
const Database = require('./src/database');
const EventFilter = require('./src/filters');

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

async function debugFiltering() {
  try {
    console.log('🔍 Debugging event filtering...\n');
    
    // Initialize components
    const database = new Database();
    await database.init();
    
    const eventFilter = new EventFilter(logger, database);
    
    // Get recent events from database
    const events = await database.getEventsByStatus('discovered');
    console.log(`📋 Found ${events.length} discovered events in database\n`);
    
    if (events.length === 0) {
      console.log('❌ No discovered events found. Run event discovery first.');
      return;
    }
    
    // Test each filter individually on first 5 events
    const testEvents = events.slice(0, 5);
    
    console.log('🧪 Testing filtering criteria on sample events:\n');
    console.log('Current config:');
    console.log('- MIN_ADVANCE_WEEKS:', config.preferences.minAdvanceWeeks);
    console.log('- MAX_ADVANCE_MONTHS:', config.preferences.maxAdvanceMonths);
    console.log('- MAX_COST_PER_EVENT:', config.preferences.maxCostPerEvent);
    console.log('- WEEKDAY_EARLIEST_TIME:', config.schedule.weekdayEarliestTime);
    console.log('- WEEKEND_NAP_START/END:', config.schedule.weekendNapStart, '-', config.schedule.weekendNapEnd);
    console.log('- Child ages: 4, 2\n');
    
    // Get family demographics
    const familyService = eventFilter.familyService;
    const familyDemographics = await familyService.getFamilyDemographics();
    console.log('👨‍👩‍👧‍👦 Family:', familyDemographics.childAges.join(', '), 'years old\n');
    
    for (let i = 0; i < testEvents.length; i++) {
      const event = testEvents[i];
      console.log(`--- Event ${i + 1}: ${event.title} ---`);
      console.log(`📅 Date: ${event.date}`);
      console.log(`👶 Age Range: ${event.age_range_min || 0}-${event.age_range_max || 18}`);
      console.log(`💰 Cost: $${event.cost || 0}`);
      
      // Convert database format to filter format
      const filterEvent = {
        ...event,
        ageRange: {
          min: event.age_range_min || 0,
          max: event.age_range_max || 18
        }
      };
      
      // Test individual filters
      const ageOk = eventFilter.isAgeAppropriate(filterEvent, familyDemographics);
      const timeOk = eventFilter.isWithinTimeRange(filterEvent);
      const scheduleOk = eventFilter.isScheduleCompatible(filterEvent);
      const budgetOk = eventFilter.isWithinBudget(filterEvent);
      const capacityOk = eventFilter.hasAvailableCapacity(filterEvent);
      const noveltyOk = eventFilter.isNotPreviouslyAttended(filterEvent);
      
      console.log(`✅ Age appropriate: ${ageOk}`);
      console.log(`✅ Within time range: ${timeOk}`);
      console.log(`✅ Schedule compatible: ${scheduleOk}`);
      console.log(`✅ Within budget: ${budgetOk}`);
      console.log(`✅ Has capacity: ${capacityOk}`);
      console.log(`✅ Not previously attended: ${noveltyOk}`);
      
      const passesAll = ageOk && timeOk && scheduleOk && budgetOk && capacityOk && noveltyOk;
      console.log(`🏆 Overall passes: ${passesAll ? '✅ YES' : '❌ NO'}`);
      console.log('');
    }
    
    await database.close();
    
  } catch (error) {
    logger.error('Debugging failed:', error.message);
    logger.error('Stack:', error.stack);
  }
}

debugFiltering();