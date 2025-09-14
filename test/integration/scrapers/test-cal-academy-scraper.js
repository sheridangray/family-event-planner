/**
 * Cal Academy Scraper Test Script
 * 
 * Tests the California Academy of Sciences events scraper.
 * 
 * Usage: node test-cal-academy-scraper.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const CalAcademyScraper = require('../src/scrapers/cal-academy');

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

async function testCalAcademyScraper() {
  console.log('🔬 Testing Cal Academy scraper...\n');
  
  try {
    const scraper = new CalAcademyScraper(logger);
    
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
        console.log(`   🔄 Recurring: ${event.isRecurring}`);
        if (event.description) {
          console.log(`   📝 Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`);
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
      
      // Show cost distribution
      console.log('\n💰 Cost Distribution:');
      const costs = {};
      events.forEach(event => {
        const cost = `$${event.cost}`;
        costs[cost] = (costs[cost] || 0) + 1;
      });
      
      Object.entries(costs)
        .sort(([,a], [,b]) => b - a)
        .forEach(([cost, count]) => {
          console.log(`   ${cost}: ${count} events`);
        });
      
      // Filter for our target age range (2-4 years)
      const targetEvents = events.filter(event => 
        event.ageRange.min <= 4 && event.ageRange.max >= 2
      );
      
      console.log(`\n🎯 Events suitable for ages 2-4: ${targetEvents.length}`);
      
      if (targetEvents.length > 0) {
        console.log('\n👶 Target Age Events:');
        targetEvents.slice(0, 5).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title} (${event.ageRange.min}-${event.ageRange.max} years) - $${event.cost}`);
        });
      }
      
      // Show recurring vs one-time events
      const recurringEvents = events.filter(e => e.isRecurring);
      const oneTimeEvents = events.filter(e => !e.isRecurring);
      
      console.log(`\n🔄 Event Types:`);
      console.log(`   Recurring events: ${recurringEvents.length}`);
      console.log(`   One-time events: ${oneTimeEvents.length}`);
      
      if (recurringEvents.length > 0) {
        console.log('\n📅 Sample Recurring Events:');
        recurringEvents.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title}`);
        });
      }
    }
    
    await scraper.closeBrowser();
    console.log('\n✅ Cal Academy scraper test completed successfully');
    
  } catch (error) {
    console.error('❌ Cal Academy scraper test failed:', error.message);
    logger.error('Cal Academy scraper test error:', error);
  }
}

testCalAcademyScraper();