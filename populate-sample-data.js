require('dotenv').config();

const Database = require('./src/database/index');
const winston = require('winston');
const CalAcademyScraper = require('./src/scrapers/cal-academy');
const SFRecParksScraper = require('./src/scrapers/sf-rec-parks');
const ExploraoriumScraper = require('./src/scrapers/exploratorium');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function populateEventData() {
  const database = new Database(logger);
  
  try {
    console.log('Initializing database...');
    await database.init();
    
    console.log('Running scrapers to populate event data for analysis...');
    
    const scrapers = [
      new CalAcademyScraper(logger),
      new SFRecParksScraper(logger), 
      new ExploraoriumScraper(logger)
    ];
    
    let totalEvents = 0;
    let totalApproved = 0;
    
    for (const scraper of scrapers) {
      console.log(`\n--- Running ${scraper.name} ---`);
      try {
        const events = await scraper.scrape();
        console.log(`${scraper.name}: Found ${events.length} events`);
        
        let approved = 0;
        for (const event of events) {
          await database.saveEvent(event);
          
          // Simulate some approved events for analysis
          if (Math.random() < 0.25) { // 25% approval rate simulation
            await database.updateEventStatus(event.id, 'approved');
            approved++;
          }
        }
        
        console.log(`${scraper.name}: ${approved}/${events.length} events marked as approved`);
        totalEvents += events.length;
        totalApproved += approved;
        
      } catch (error) {
        console.log(`${scraper.name} failed: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`• Total events saved: ${totalEvents}`);
    console.log(`• Total approved events: ${totalApproved}`);
    console.log(`• Approval rate: ${((totalApproved / totalEvents) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error populating data:', error.message);
  } finally {
    if (database.postgres && database.postgres.pool) {
      await database.postgres.pool.end();
    }
  }
}

populateEventData().catch(console.error);