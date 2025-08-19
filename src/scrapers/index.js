const SFRecParksScraper = require('./sf-rec-parks');
const SFLibraryScraper = require('./sf-library');
const CalAcademyScraper = require('./cal-academy');
const ChaseCenterScraper = require('./chase-center');
const FunCheapSFScraper = require('./funcheapsf');
const BayAreaKidFunScraper = require('./bayareakidfun');
const SanFranKidsOutAndAboutScraper = require('./sanfran-kidsoutandabout');
const YBGFestivalScraper = require('./ybgfestival');
const ExploratoriumScraper = require('./exploratorium');

class ScraperManager {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.scrapers = [];
    this.initScrapers();
  }

  initScrapers() {
    this.scrapers = [
      new SFRecParksScraper(this.logger),
      new SFLibraryScraper(this.logger),
      new CalAcademyScraper(this.logger),
      new ChaseCenterScraper(this.logger),
      new FunCheapSFScraper(this.logger),
      new BayAreaKidFunScraper(this.logger),
      new SanFranKidsOutAndAboutScraper(this.logger),
      new YBGFestivalScraper(this.logger),
      new ExploratoriumScraper(this.logger)
    ];
  }

  async scrapeAll() {
    const allEvents = [];
    
    for (const scraper of this.scrapers) {
      try {
        this.logger.info(`Starting scrape for ${scraper.name}`);
        const events = await scraper.scrape();
        
        for (const event of events) {
          try {
            await this.database.saveEvent(event);
            allEvents.push(event);
            this.logger.info(`Saved event: ${event.title} on ${event.date}`);
          } catch (error) {
            this.logger.error(`Error saving event ${event.title}:`, error.message);
          }
        }
        
        await scraper.closeBrowser();
        this.logger.info(`Completed scraping ${scraper.name}: ${events.length} events found`);
        
      } catch (error) {
        this.logger.error(`Error with scraper ${scraper.name}:`, error.message);
        await scraper.closeBrowser();
      }
    }

    this.logger.info(`Total events discovered: ${allEvents.length}`);
    return allEvents;
  }

  async scrapeSource(sourceName) {
    const scraper = this.scrapers.find(s => s.name === sourceName);
    if (!scraper) {
      throw new Error(`Scraper not found: ${sourceName}`);
    }

    try {
      this.logger.info(`Starting targeted scrape for ${scraper.name}`);
      const events = await scraper.scrape();
      
      for (const event of events) {
        try {
          await this.database.saveEvent(event);
          this.logger.info(`Saved event: ${event.title} on ${event.date}`);
        } catch (error) {
          this.logger.error(`Error saving event ${event.title}:`, error.message);
        }
      }
      
      await scraper.closeBrowser();
      this.logger.info(`Completed scraping ${scraper.name}: ${events.length} events found`);
      return events;
      
    } catch (error) {
      this.logger.error(`Error with scraper ${scraper.name}:`, error.message);
      await scraper.closeBrowser();
      throw error;
    }
  }

  async cleanup() {
    for (const scraper of this.scrapers) {
      await scraper.closeBrowser();
    }
  }
}

module.exports = ScraperManager;