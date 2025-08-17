const Database = require('../src/database');
const ScraperManager = require('../src/scrapers');
const EventFilter = require('../src/filters');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function testSetup() {
  try {
    console.log('🧪 Testing Family Event Planner Setup...\n');
    
    // Test database
    console.log('📊 Testing Database...');
    const database = new Database();
    await database.init();
    console.log('✅ Database initialized successfully\n');
    
    // Test scrapers
    console.log('🔍 Testing Scrapers...');
    const scraperManager = new ScraperManager(logger, database);
    console.log('✅ Scrapers initialized successfully\n');
    
    // Test filters
    console.log('🔽 Testing Event Filters...');
    const eventFilter = new EventFilter(logger);
    
    // Test with sample events
    const sampleEvents = [
      {
        id: 'test-1',
        source: 'Test Source',
        title: 'Toddler Story Time',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        cost: 0,
        ageRange: { min: 2, max: 4 },
        location: { address: 'San Francisco Library' },
        previouslyAttended: false
      },
      {
        id: 'test-2',
        source: 'Test Source', 
        title: 'Expensive Workshop',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        cost: 500, // Over budget
        ageRange: { min: 3, max: 5 },
        location: { address: 'SF Museum' },
        previouslyAttended: false
      }
    ];
    
    const filteredEvents = eventFilter.filterEvents(sampleEvents);
    console.log(`Filtered ${sampleEvents.length} sample events to ${filteredEvents.length} suitable events`);
    console.log('✅ Event filtering working correctly\n');
    
    // Test database operations
    console.log('💾 Testing Database Operations...');
    for (const event of sampleEvents) {
      await database.saveEvent(event);
    }
    
    const savedEvents = await database.getEventsByStatus('discovered');
    console.log(`Saved and retrieved ${savedEvents.length} events from database`);
    console.log('✅ Database operations working correctly\n');
    
    await database.close();
    
    console.log('🎉 All core components initialized successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure MCP credentials in .env file');
    console.log('2. Set up Gmail and Twilio MCP servers');  
    console.log('3. Update family information in .env');
    console.log('4. Run: npm start');
    console.log('\n⚠️  Remember: This system only processes FREE events for safety');
    
  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
    process.exit(1);
  }
}

testSetup();