const Database = require('./src/database');
const ScraperManager = require('./src/scrapers');
const EventDeduplicator = require('./src/utils/event-deduplicator');

// Mock logger
const logger = {
  info: console.log,
  debug: console.log,
  warn: console.warn,
  error: console.error
};

async function testIntegration() {
  console.log('🧪 Testing Event Deduplication Integration\n');
  
  // Initialize database
  const database = new Database();
  await database.init();
  
  // Create deduplicator with database
  const deduplicator = new EventDeduplicator(logger, database);
  
  // Test events with duplicates
  const testEvents = [
    {
      id: 'test-1',
      source: 'Exploratorium',
      title: 'Storytime Science for Kids: Movers and Shakers',
      date: new Date('2025-08-16T12:00:00'),
      location: { address: 'Pier 15, The Embarcadero, San Francisco, CA' },
      ageRange: { min: 3, max: 8 },
      cost: 0,
      description: 'Enjoy an engaging storybook read-aloud followed by a related activity.'
    },
    {
      id: 'test-2',
      source: 'YBG Festival',
      title: 'Storytime Science for Kids',
      date: new Date('2025-08-16T12:00:00'),
      location: { address: 'Exploratorium at Pier 15' },
      ageRange: { min: 2, max: 10 },
      cost: 0,
      description: 'Interactive storytime with science activities for children and families.'
    },
    {
      id: 'test-3',
      source: 'SF Library',
      title: 'Science Story Time',
      date: new Date('2025-08-16T12:30:00'),
      location: { address: 'Pier 15, Embarcadero' },
      ageRange: { min: 4, max: 8 },
      cost: 0,
      description: 'Story time with science themes and hands-on activities for young learners.'
    },
    {
      id: 'test-4',
      source: 'Cal Academy',
      title: 'Planetarium Show',
      date: new Date('2025-08-16T14:00:00'),
      location: { address: 'California Academy of Sciences, Golden Gate Park' },
      ageRange: { min: 5, max: 12 },
      cost: 15,
      description: 'Educational planetarium presentation about space exploration.'
    },
    {
      id: 'test-5',
      source: 'Exploratorium',
      title: 'Adventures in AI',
      date: new Date('2025-06-12T10:00:00'),
      location: { address: 'Pier 15, The Embarcadero, San Francisco, CA' },
      ageRange: { min: 8, max: 16 },
      cost: 0,
      description: 'Leap into the wild new world of artificial intelligence this summer.'
    },
    {
      id: 'test-6',
      source: 'FunCheapSF',
      title: 'AI Adventure Experience',
      date: new Date('2025-06-12T10:00:00'),
      location: { address: 'Exploratorium, Pier 15' },
      ageRange: { min: 6, max: 18 },
      cost: 0,
      description: 'Explore artificial intelligence through interactive exhibits and activities.'
    }
  ];
  
  console.log(`\n📥 Processing ${testEvents.length} test events...`);
  
  // Deduplicate events
  const uniqueEvents = await deduplicator.deduplicateEvents(testEvents);
  
  console.log(`\n📊 Deduplication Results:`);
  console.log(`- Input events: ${testEvents.length}`);
  console.log(`- Unique events: ${uniqueEvents.length}`);
  console.log(`- Duplicates removed: ${testEvents.length - uniqueEvents.length}`);
  
  // Save events to database
  console.log(`\n💾 Saving events to database...`);
  for (const event of uniqueEvents) {
    await database.saveEvent(event);
    console.log(`✅ Saved: "${event.title}" (sources: ${event.sources ? event.sources.join(', ') : event.source})`);
  }
  
  // Show detailed results
  console.log(`\n📋 Event Details:`);
  uniqueEvents.forEach((event, index) => {
    console.log(`\n--- Event ${index + 1} ---`);
    console.log(`Title: ${event.title}`);
    console.log(`Sources: ${event.sources ? event.sources.join(', ') : event.source}`);
    console.log(`Merge count: ${event.mergeCount || 1}`);
    console.log(`Date: ${event.date.toDateString()}`);
    console.log(`Location: ${event.location.address}`);
    if (event.alternateUrls && event.alternateUrls.length > 0) {
      console.log(`Alternate URLs: ${event.alternateUrls.length}`);
    }
  });
  
  // Check merge history for merged events
  console.log(`\n🔍 Checking merge history...`);
  for (const event of uniqueEvents) {
    if (event.mergeCount > 1) {
      const mergeHistory = await database.getEventMergeHistory(event.id);
      console.log(`\nMerge history for "${event.title}":`);
      mergeHistory.forEach(merge => {
        console.log(`  - Merged "${merge.mergedEventData.title}" from ${merge.mergedEventData.source} (similarity: ${merge.similarity_score?.toFixed(3) || 'N/A'})`);
      });
    }
  }
  
  // Get deduplication statistics
  const stats = deduplicator.getStats();
  console.log(`\n📈 Deduplication Statistics:`);
  console.log(`- Total unique events tracked: ${stats.totalUniqueEvents}`);
  console.log(`- Duplicates detected: ${stats.duplicatesDetected}`);
  console.log(`- Events by source:`, stats.eventsBySource);
  
  console.log(`\n✅ Integration test completed successfully!`);
  
  // Clean up
  await database.close();
}

async function runTest() {
  try {
    await testIntegration();
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    console.error(error.stack);
  }
}

runTest();