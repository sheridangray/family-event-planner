const YBGFestivalScraper = require('./src/scrapers/ybgfestival');

// Mock logger
const logger = {
  info: console.log,
  debug: console.log,
  warn: console.warn,
  error: console.error
};

async function testYBGFestival() {
  console.log('Testing YBG Festival scraper...');
  
  const scraper = new YBGFestivalScraper(logger);
  
  try {
    const events = await scraper.scrape();
    
    console.log(`\nFound ${events.length} events:`);
    
    events.forEach((event, index) => {
      console.log(`\n--- Event ${index + 1} ---`);
      console.log(`Title: ${event.title}`);
      console.log(`Date: ${event.date}`);
      console.log(`Location: ${event.location.address}`);
      console.log(`Age Range: ${event.ageRange.min}-${event.ageRange.max}`);
      console.log(`Cost: $${event.cost}`);
      console.log(`Description: ${event.description.substring(0, 100)}...`);
      console.log(`URL: ${event.registrationUrl}`);
      if (event.imageUrl) {
        console.log(`Image: ${event.imageUrl}`);
      }
    });
    
  } catch (error) {
    console.error('Error testing scraper:', error);
  } finally {
    await scraper.closeBrowser();
  }
}

testYBGFestival();