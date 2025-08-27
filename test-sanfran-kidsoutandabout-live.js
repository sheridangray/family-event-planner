// Live test of San Francisco Kids Out and About scraper to see actual events found
const SanFranKidsOutAndAboutScraper = require('./src/scrapers/sanfran-kidsoutandabout');

// Mock logger with detailed output
const mockLogger = {
  info: (msg) => console.log(`📝 [INFO] ${msg}`),
  debug: (msg) => console.log(`🔍 [DEBUG] ${msg}`),
  warn: (msg) => console.log(`⚠️  [WARN] ${msg}`),
  error: (msg, err) => console.log(`❌ [ERROR] ${msg}`, err || '')
};

async function testLiveScraping() {
  console.log('🚀 Testing San Francisco Kids Out and About scraper with live data...\n');
  
  try {
    const scraper = new SanFranKidsOutAndAboutScraper(mockLogger);
    console.log(`Scraper: ${scraper.name}`);
    console.log(`Main URL: ${scraper.url}`);
    console.log(`Event List URL: ${scraper.eventListUrl}\n`);
    
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
        if (event.description && event.description !== event.title && event.description.length < 200) {
          console.log(`   📝 Description: ${event.description}`);
        } else if (event.description && event.description !== event.title) {
          const shortDesc = event.description.substring(0, 150) + '...';
          console.log(`   📝 Description: ${shortDesc}`);
        }
        if (event.registrationUrl) {
          console.log(`   🔗 Registration: ${event.registrationUrl}`);
        }
        console.log(`   🆔 Event ID: ${event.id.substring(0, 60)}...`);
      });
      
      // Summary statistics
      console.log('\n📈 SUMMARY STATISTICS:');
      console.log('=' .repeat(40));
      const freeEvents = events.filter(e => e.cost === 0).length;
      const paidEvents = events.length - freeEvents;
      const apolloAppropriate = events.filter(e => e.ageRange.min <= 4 && e.ageRange.max >= 4).length;
      const athenaAppropriate = events.filter(e => e.ageRange.min <= 2 && e.ageRange.max >= 2).length;
      const bothKidsAppropriate = events.filter(e => e.ageRange.min <= 2 && e.ageRange.max >= 4).length;
      const hasRegistrationUrl = events.filter(e => e.registrationUrl).length;
      
      console.log(`Free events: ${freeEvents}`);
      console.log(`Paid events: ${paidEvents}`);
      console.log(`Appropriate for Apollo (4): ${apolloAppropriate}`);
      console.log(`Appropriate for Athena (2): ${athenaAppropriate}`);
      console.log(`Perfect for both kids: ${bothKidsAppropriate}`);
      console.log(`Events with registration links: ${hasRegistrationUrl}`);
      
    } else {
      console.log('\n❌ No family events found.');
      console.log('This could mean:');
      console.log('• The website structure has changed');
      console.log('• No family events are currently listed');
      console.log('• The scraping selectors need adjustment');
      console.log('• Website may have anti-bot protection');
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