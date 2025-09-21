const ScraperManager = require('../../src/scrapers');
const Database = require('../../src/database');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()]
});

async function testBayAreaKidFunFiltering() {
  const database = new Database();
  await database.init();
  
  const scraperManager = new ScraperManager(logger, database);
  
  // Create a test discovery run
  const discoveryRunId = await database.createDiscoveryRun();
  console.log('Created discovery run:', discoveryRunId);
  
  // Test Bay Area Kid Fun scraper specifically
  try {
    const events = await scraperManager.scrapeSource('bayareakidfun', discoveryRunId);
    console.log('Scraped', events.length, 'events');
    
    // Check what got saved to discovered_events
    const result = await database.postgres.pool.query(`
      SELECT 
        event_title,
        filter_results ->> 'passed' as passed_filters,
        filter_results ->> 'reasons' as filter_reasons,
        event_date
      FROM discovered_events 
      WHERE discovery_run_id = $1 AND scraper_name = 'bayareakidfun'
      ORDER BY event_date
    `, [discoveryRunId]);
    
    console.log('\nEvents saved to discovered_events:');
    result.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.event_title}`);
      console.log(`   Date: ${row.event_date}`);
      console.log(`   Passed: ${row.passed_filters}`);
      console.log(`   Reasons: ${row.filter_reasons}`);
      console.log('');
    });
    
    // Check scraper stats
    const statsResult = await database.postgres.pool.query(`
      SELECT 
        ss.events_found,
        s.display_name,
        ss.success,
        ss.error_message
      FROM scraper_stats ss
      JOIN scrapers s ON s.id = ss.scraper_id
      WHERE ss.discovery_run_id = $1 AND s.name = 'bayareakidfun'
    `, [discoveryRunId]);
    
    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      console.log(`Scraper found: ${stats.events_found} events`);
      console.log(`Saved to discovered_events: ${result.rows.length} events`);
      console.log(`Events lost in filtering: ${stats.events_found - result.rows.length}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await database.close();
  }
}

if (require.main === module) {
  testBayAreaKidFunFiltering();
}

module.exports = { testBayAreaKidFunFiltering };