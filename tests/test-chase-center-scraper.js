/**
 * Chase Center Scraper Test Script
 * 
 * Tests the Chase Center events scraper.
 * 
 * Usage: node test-chase-center-scraper.js
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const ChaseCenterScraper = require('../src/scrapers/chase-center');

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

async function testChaseCenterScraper() {
  console.log('🏀 Testing Chase Center scraper...\n');
  
  try {
    const scraper = new ChaseCenterScraper(logger);
    
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
      
      // Show event type distribution
      console.log('\n📈 Event Type Distribution:');
      const eventTypes = {};
      events.forEach(event => {
        let type = 'Other';
        if (event.title.toLowerCase().includes('warriors')) type = 'Warriors Game';
        else if (event.title.toLowerCase().includes('valkyries')) type = 'Valkyries Game';
        else if (event.title.toLowerCase().includes('fitness')) type = 'Fitness Class';
        else if (event.ageRange.min <= 12) type = 'Family Concert';
        else type = 'Concert/Show';
        
        eventTypes[type] = (eventTypes[type] || 0) + 1;
      });
      
      Object.entries(eventTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} events`);
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
      
      // Show upcoming vs far future events
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const soonEvents = events.filter(e => e.date <= oneWeekFromNow);
      const laterEvents = events.filter(e => e.date > oneWeekFromNow);
      
      console.log(`\n📅 Event Timing:`);
      console.log(`   This week: ${soonEvents.length} events`);
      console.log(`   Future: ${laterEvents.length} events`);
      
      if (soonEvents.length > 0) {
        console.log('\n🔜 Coming Up This Week:');
        soonEvents.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title} - ${event.date.toLocaleDateString()}`);
        });
      }
    }
    
    await scraper.closeBrowser();
    console.log('\n✅ Chase Center scraper test completed successfully');
    
  } catch (error) {
    console.error('❌ Chase Center scraper test failed:', error.message);
    logger.error('Chase Center scraper test error:', error);
  }
}

testChaseCenterScraper();