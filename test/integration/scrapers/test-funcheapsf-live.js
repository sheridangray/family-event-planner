// Live test of FunCheapSF scraper to see actual events found
const FunCheapSFScraper = require('./src/scrapers/funcheapsf');

// Mock logger with more detailed output
const mockLogger = {
  info: (msg) => console.log(`📝 [INFO] ${msg}`),
  debug: (msg) => console.log(`🔍 [DEBUG] ${msg}`),
  warn: (msg) => console.log(`⚠️  [WARN] ${msg}`),
  error: (msg, err) => console.log(`❌ [ERROR] ${msg}`, err || '')
};

async function testLiveScraping() {
  console.log('🚀 Testing FunCheapSF scraper with live data...\n');
  
  try {
    const scraper = new FunCheapSFScraper(mockLogger);
    console.log(`Scraper: ${scraper.name}`);
    console.log(`Target URL: ${scraper.url}\n`);
    
    console.log('🔄 Starting scrape operation...');
    const events = await scraper.scrape();
    
    console.log(`\n📊 SCRAPING RESULTS:`);
    console.log(`Total events found: ${events.length}`);
    
    if (events.length > 0) {
      console.log('\n🎉 FAMILY EVENTS DISCOVERED:');
      console.log('=' .repeat(60));
      
      events.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   📅 Date: ${event.date}`);
        console.log(`   📍 Location: ${event.location.address}`);
        console.log(`   💰 Cost: ${event.cost === 0 ? 'FREE' : '$' + event.cost}`);
        console.log(`   🎯 Age Range: ${event.ageRange.min}-${event.ageRange.max} years`);
        if (event.description) {
          const shortDesc = event.description.length > 100 
            ? event.description.substring(0, 100) + '...' 
            : event.description;
          console.log(`   📝 Description: ${shortDesc}`);
        }
        if (event.registrationUrl) {
          console.log(`   🔗 Registration: ${event.registrationUrl}`);
        }
        console.log(`   🆔 Event ID: ${event.id}`);
      });
      
      // Summary statistics
      console.log('\n📈 SUMMARY STATISTICS:');
      console.log('=' .repeat(40));
      const freeEvents = events.filter(e => e.cost === 0).length;
      const paidEvents = events.length - freeEvents;
      const apolloAppropriate = events.filter(e => e.ageRange.min <= 4 && e.ageRange.max >= 4).length;
      const athenaAppropriate = events.filter(e => e.ageRange.min <= 2 && e.ageRange.max >= 2).length;
      
      console.log(`Free events: ${freeEvents}`);
      console.log(`Paid events: ${paidEvents}`);
      console.log(`Appropriate for Apollo (4): ${apolloAppropriate}`);
      console.log(`Appropriate for Athena (2): ${athenaAppropriate}`);
      
    } else {
      console.log('\n❌ No family events found.');
      console.log('This could mean:');
      console.log('• The website structure has changed');
      console.log('• No family events are currently listed');
      console.log('• The site is blocking automated access');
      console.log('• Network connectivity issues');
    }
    
    // Clean up
    await scraper.closeBrowser();
    console.log('\n✅ Scraping test completed!');
    
  } catch (error) {
    console.error('\n💥 Scraping test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testLiveScraping().catch(console.error);