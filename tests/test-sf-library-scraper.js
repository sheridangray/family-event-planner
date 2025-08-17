/**
 * SF Library Scraper Test Script
 * 
 * Tests the SF Library events scraper to verify it can extract events properly.
 * 
 * Usage: node test-sf-library-scraper.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const SFLibraryScraper = require('../src/scrapers/sf-library');

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

async function testSFLibraryScraper() {
  console.log('📚 Testing SF Library scraper...\n');
  
  try {
    const scraper = new SFLibraryScraper(logger);
    
    console.log(`🔍 Scraping: ${scraper.url}`);
    console.log('⏳ This may take a moment...\n');
    
    const events = await scraper.scrape();
    
    console.log(`\n📊 Results Summary:`);
    console.log(`Total events found: ${events.length}`);
    
    if (events.length > 0) {
      console.log('\n📋 Sample Events:');
      
      // Show first 5 events with details
      events.slice(0, 5).forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   📅 Date: ${event.date}`);
        console.log(`   📍 Location: ${event.location.address}`);
        console.log(`   👶 Age Range: ${event.ageRange.min}-${event.ageRange.max} years`);
        console.log(`   💰 Cost: $${event.cost}`);
        console.log(`   🔗 URL: ${event.registrationUrl}`);
        if (event.description) {
          console.log(`   📝 Audience: ${event.description}`);
        }
      });
      
      // Show age range distribution
      console.log('\n📈 Age Range Distribution:');
      const ageRanges = {};
      events.forEach(event => {
        const range = `${event.ageRange.min}-${event.ageRange.max}`;
        ageRanges[range] = (ageRanges[range] || 0) + 1;
      });
      
      Object.entries(ageRanges).forEach(([range, count]) => {
        console.log(`   ${range} years: ${count} events`);
      });
      
      // Show location distribution
      console.log('\n📍 Location Distribution:');
      const locations = {};
      events.forEach(event => {
        const loc = event.location.address || 'Unknown';
        locations[loc] = (locations[loc] || 0) + 1;
      });
      
      Object.entries(locations)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([location, count]) => {
          console.log(`   ${location}: ${count} events`);
        });
      
      // Filter for our target age range (2-4 years)
      const targetEvents = events.filter(event => 
        event.ageRange.min <= 4 && event.ageRange.max >= 2
      );
      
      console.log(`\n🎯 Events suitable for ages 2-4: ${targetEvents.length}`);
      
      if (targetEvents.length > 0) {
        console.log('\n👶 Target Age Events:');
        targetEvents.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title} (${event.ageRange.min}-${event.ageRange.max} years)`);
        });
      }
    }
    
    await scraper.closeBrowser();
    console.log('\n✅ SF Library scraper test completed successfully');
    
  } catch (error) {
    console.error('❌ SF Library scraper test failed:', error.message);
    logger.error('SF Library scraper test error:', error);
  }
}

testSFLibraryScraper();