const Database = require('./src/database');
const ScraperManager = require('./src/scrapers');

// Mock logger
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${msg}`, ...args)
};

async function demonstrateDeduplication() {
  console.log('🎯 Event Deduplication System Demo\n');
  
  // Initialize database and scraper manager
  const database = new Database();
  await database.init();
  
  const scraperManager = new ScraperManager(logger, database);
  
  console.log('📡 Available scrapers:');
  scraperManager.scrapers.forEach(scraper => {
    console.log(`   - ${scraper.name}`);
  });
  
  console.log('\n🚀 Testing deduplication with YBG Festival and Exploratorium scrapers...\n');
  
  // Test specific scrapers that might have overlapping events
  const testSources = ['YBG Festival', 'Exploratorium'];
  
  let totalRawEvents = 0;
  let totalUniqueEvents = 0;
  
  for (const sourceName of testSources) {
    try {
      console.log(`\n🔄 Scraping ${sourceName}...`);
      const events = await scraperManager.scrapeSource(sourceName);
      totalUniqueEvents += events.length;
      
      console.log(`✅ ${sourceName}: Found ${events.length} unique events after deduplication`);
      
      // Show first few events
      events.slice(0, 3).forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.title} (${event.sources ? event.sources.join(', ') : event.source})`);
      });
      
    } catch (error) {
      console.error(`❌ Error scraping ${sourceName}:`, error.message);
    }
  }
  
  // Show deduplication statistics
  const stats = scraperManager.getDeduplicationStats();
  console.log(`\n📊 Final Deduplication Statistics:`);
  console.log(`   - Total unique events: ${stats.totalUniqueEvents}`);
  console.log(`   - Duplicates detected: ${stats.duplicatesDetected}`);
  console.log(`   - Events by source:`, stats.eventsBySource);
  
  // Get some events to show merge examples
  const discoveredEvents = await database.getEventsByStatus('discovered');
  const mergedEvents = discoveredEvents.filter(e => {
    try {
      const sources = JSON.parse(e.sources || '[]');
      return sources.length > 1;
    } catch {
      return false;
    }
  });
  
  if (mergedEvents.length > 0) {
    console.log(`\n🔗 Examples of merged events:`);
    mergedEvents.slice(0, 3).forEach((event, index) => {
      const sources = JSON.parse(event.sources || '[]');
      console.log(`   ${index + 1}. "${event.title}" (merged from: ${sources.join(', ')})`);
    });
  }
  
  console.log('\n💡 Benefits of deduplication:');
  console.log('   ✅ Eliminates duplicate SMS notifications');
  console.log('   ✅ Combines information from multiple sources');
  console.log('   ✅ Reduces database bloat');
  console.log('   ✅ Improves recommendation quality');
  console.log('   ✅ Provides comprehensive event details');
  
  console.log('\n🎉 Deduplication demo completed successfully!');
  
  // Clean up
  await scraperManager.cleanup();
  await database.close();
}

async function runDemo() {
  try {
    await demonstrateDeduplication();
  } catch (error) {
    console.error('\n💥 Demo failed:', error);
    console.error(error.stack);
  }
}

runDemo();