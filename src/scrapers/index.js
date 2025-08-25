const SFRecParksScraper = require('./sf-rec-parks');
const SFLibraryScraper = require('./sf-library');
const CalAcademyScraper = require('./cal-academy');
const ChaseCenterScraper = require('./chase-center');
const FunCheapSFScraper = require('./funcheapsf');
const BayAreaKidFunScraper = require('./bayareakidfun');
const SanFranKidsOutAndAboutScraper = require('./sanfran-kidsoutandabout');
const YBGFestivalScraper = require('./ybgfestival');
const ExploratoriumScraper = require('./exploratorium');
const EventDeduplicator = require('../utils/event-deduplicator');

class ScraperManager {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.scrapers = [];
    this.deduplicator = new EventDeduplicator(logger, database);
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
    const allRawEvents = [];
    
    // First, collect all events from all scrapers
    for (const scraper of this.scrapers) {
      try {
        this.logger.info(`Starting scrape for ${scraper.name}`);
        const events = await scraper.scrape();
        allRawEvents.push(...events);
        
        await scraper.closeBrowser();
        this.logger.info(`Completed scraping ${scraper.name}: ${events.length} events found`);
        
      } catch (error) {
        this.logger.error(`Error with scraper ${scraper.name}:`, error.message);
        await scraper.closeBrowser();
      }
    }

    this.logger.info(`Raw events collected: ${allRawEvents.length}`);

    // Deduplicate all events
    const uniqueEvents = await this.deduplicator.deduplicateEvents(allRawEvents);
    
    // Save deduplicated events to database
    const savedEvents = [];
    for (const event of uniqueEvents) {
      try {
        await this.database.saveEvent(event);
        savedEvents.push(event);
        this.logger.info(`Saved event: ${event.title} on ${event.date}${event.sources ? ` (sources: ${event.sources.join(', ')})` : ''}`);
      } catch (error) {
        this.logger.error(`Error saving event ${event.title}:`, error.message);
      }
    }

    // Log deduplication statistics
    const stats = this.deduplicator.getStats();
    this.logger.info(`Deduplication complete: ${allRawEvents.length} raw -> ${uniqueEvents.length} unique -> ${savedEvents.length} saved`);
    this.logger.info(`Deduplication stats:`, stats);

    return savedEvents;
  }

  async scrapeSource(sourceName) {
    const scraper = this.scrapers.find(s => s.name === sourceName);
    if (!scraper) {
      throw new Error(`Scraper not found: ${sourceName}`);
    }

    try {
      this.logger.info(`Starting targeted scrape for ${scraper.name}`);
      const rawEvents = await scraper.scrape();
      
      // Deduplicate events from this source against existing events
      const uniqueEvents = await this.deduplicator.deduplicateEvents(rawEvents);
      
      // Save deduplicated events
      const savedEvents = [];
      for (const event of uniqueEvents) {
        try {
          await this.database.saveEvent(event);
          savedEvents.push(event);
          this.logger.info(`Saved event: ${event.title} on ${event.date}${event.sources ? ` (sources: ${event.sources.join(', ')})` : ''}`);
        } catch (error) {
          this.logger.error(`Error saving event ${event.title}:`, error.message);
        }
      }
      
      await scraper.closeBrowser();
      this.logger.info(`Completed scraping ${scraper.name}: ${rawEvents.length} raw -> ${uniqueEvents.length} unique -> ${savedEvents.length} saved`);
      return savedEvents;
      
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

  /**
   * Get deduplication statistics
   * @returns {Object} Deduplication statistics
   */
  getDeduplicationStats() {
    return this.deduplicator.getStats();
  }

  /**
   * Reset deduplicator state (useful for testing or periodic cleanup)
   */
  resetDeduplicator() {
    this.deduplicator.reset();
    this.logger.info('Deduplicator state reset');
  }
}

module.exports = ScraperManager;