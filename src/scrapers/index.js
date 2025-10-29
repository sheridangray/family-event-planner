const SFRecParksScraper = require("./sf-rec-parks");
const SFLibraryScraper = require("./sf-library");
const CalAcademyScraper = require("./cal-academy");
const ChaseCenterScraper = require("./chase-center");
const FunCheapSFScraper = require("./funcheapsf");
const BayAreaKidFunScraper = require("./bayareakidfun");
const SanFranKidsOutAndAboutScraper = require("./sanfran-kidsoutandabout");
const YBGFestivalScraper = require("./ybgfestival");
const ExploratoriumScraper = require("./exploratorium");
const EventDeduplicator = require("../utils/event-deduplicator");
const EventFilter = require("../filters");

class ScraperManager {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.scrapers = [];
    this.deduplicator = new EventDeduplicator(logger, database);
    this.eventFilter = new EventFilter(logger, database);
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
      new ExploratoriumScraper(this.logger),
    ];
  }

  async scrapeAll(discoveryRunId = null) {
    const allRawEvents = [];

    // First, collect all events from all scrapers
    for (const scraper of this.scrapers) {
      try {
        this.logger.info(`Starting scrape for ${scraper.name}`);
        const events = await scraper.scrape();
        allRawEvents.push(...events);

        await scraper.closeBrowser();
        this.logger.info(
          `Completed scraping ${scraper.name}: ${events.length} events found`
        );
      } catch (error) {
        this.logger.error(`Error with scraper ${scraper.name}:`, error.message);
        await scraper.closeBrowser();
      }
    }

    this.logger.info(`Raw events collected: ${allRawEvents.length}`);

    // DEBUGGING: Deduplication disabled - commented out for debugging
    // const deduplicationResult = await this.deduplicator.deduplicateEvents(allRawEvents);
    // const { uniqueEvents, mergeInformation } = deduplicationResult;

    // Use raw events directly (no deduplication for debugging)
    const uniqueEvents = allRawEvents;
    const mergeInformation = [];

    // Save all events to database (no deduplication during debugging)
    const savedEvents = [];
    for (const event of uniqueEvents) {
      try {
        // Assign discovery run ID if provided
        if (discoveryRunId) {
          event.discovery_run_id = discoveryRunId;
        }

        const eventId = await this.database.saveEvent(event);
        if (eventId) {
          savedEvents.push(event);
          this.logger.info(
            `Saved event: ${event.title} on ${event.date}${
              event.sources ? ` (sources: ${event.sources.join(", ")})` : ""
            } [ID: ${eventId}]${
              discoveryRunId ? ` [Run: ${discoveryRunId}]` : ""
            }`
          );
        } else {
          this.logger.warn(
            `Event save returned no ID: ${event.title} on ${event.date} [Source: ${event.source}]`
          );
        }
      } catch (error) {
        this.logger.error(
          `Error saving event "${event.title}" from ${event.source}:`,
          {
            error: error.message,
            stack: error.stack,
            eventId: event.id,
            eventData: {
              title: event.title,
              date: event.date,
              source: event.source,
              location: event.location?.address || "No address",
              cost: event.cost,
              ageRange: event.ageRange,
            },
          }
        );
      }
    }

    // Record merge information after successful event saves
    for (const mergeInfo of mergeInformation) {
      try {
        const mergeId = await this.database.recordEventMerge(
          mergeInfo.primaryEventId,
          mergeInfo.mergedEvent,
          mergeInfo.similarityScore,
          mergeInfo.mergeType
        );

        if (mergeId) {
          this.logger.debug(
            `Recorded ${mergeInfo.mergeType} merge: "${
              mergeInfo.mergedEvent.title
            }" -> ${
              mergeInfo.primaryEventId
            } [Score: ${mergeInfo.similarityScore.toFixed(
              3
            )}, MergeID: ${mergeId}]`
          );
        } else {
          this.logger.debug(
            `Skipped recording ${mergeInfo.mergeType} merge for "${mergeInfo.mergedEvent.title}" - primary event ${mergeInfo.primaryEventId} not found in database`
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to record event merge in database:`, {
          error: error.message,
          primaryEventId: mergeInfo.primaryEventId,
          mergedEventTitle: mergeInfo.mergedEvent.title,
          mergedEventSource: mergeInfo.mergedEvent.source,
          similarityScore: mergeInfo.similarityScore,
          mergeType: mergeInfo.mergeType,
        });
      }
    }

    // Log deduplication statistics
    const stats = this.deduplicator.getStats();
    this.logger.info(
      `Deduplication complete: ${allRawEvents.length} raw -> ${uniqueEvents.length} unique -> ${savedEvents.length} saved`
    );
    this.logger.info(`Deduplication stats:`, stats);

    return savedEvents;
  }

  async scrapeSource(sourceName, discoveryRunId = null, options = {}) {
    const scraper = this.scrapers.find((s) => s.name === sourceName);
    if (!scraper) {
      throw new Error(`Scraper not found: ${sourceName}`);
    }

    try {
      this.logger.info(
        `Starting targeted scrape for ${scraper.name}${
          discoveryRunId ? ` (Discovery Run #${discoveryRunId})` : ""
        }`
      );

      // Determine daysToScrape based on options or scraper capability
      const daysToScrape = options.daysToScrape;

      // Cal Academy scraper supports multi-day scraping
      const rawEvents =
        scraper.name === "cal-academy" && daysToScrape !== undefined
          ? await scraper.scrape(daysToScrape)
          : await scraper.scrape();

      if (scraper.name === "cal-academy" && daysToScrape !== undefined) {
        this.logger.info(
          `Scraped ${scraper.name} for ${daysToScrape} days: ${rawEvents.length} events found`
        );
      }

      // Run filtering to get filter results for each event (if we have a discovery run)
      let eventsWithFilters = [];
      if (discoveryRunId && rawEvents.length > 0) {
        for (const event of rawEvents) {
          try {
            // Apply filters to capture detailed results for ALL events (not just passing ones)
            await this.eventFilter.evaluateAllEvents([event]);

            // Get the filter results that were attached to the event during filtering
            const filterResults = event.filterResults || {
              passed: false,
              reasons: ["No filter results captured"],
            };

            eventsWithFilters.push({
              event,
              filterResults,
            });
          } catch (error) {
            this.logger.warn(
              `Error filtering event for discovery log: ${event.title}:`,
              error.message
            );
            eventsWithFilters.push({
              event,
              filterResults: {
                passed: false,
                reasons: [`Filter error: ${error.message}`],
              },
            });
          }
        }

        // Save all discovered events to discovered_events table
        for (const { event, filterResults } of eventsWithFilters) {
          try {
            await this.database.saveDiscoveredEvent(
              discoveryRunId,
              scraper.name,
              event,
              false, // We'll mark as duplicate later
              null,
              filterResults
            );
          } catch (error) {
            this.logger.error(
              `Error saving discovered event "${event.title}":`,
              error.message
            );
          }
        }
      }

      // DEBUGGING: Deduplication disabled for single scraper - commented out for debugging
      // const deduplicationResult = await this.deduplicator.deduplicateEvents(rawEvents);
      // const { uniqueEvents, mergeInformation } = deduplicationResult;

      // Use raw events directly (no deduplication for debugging)
      const uniqueEvents = rawEvents;
      const mergeInformation = [];

      // Skip duplicate marking during debugging
      // if (discoveryRunId && mergeInformation.length > 0) {
      //   for (const mergeInfo of mergeInformation) {
      //     try {
      //       await this.database.query(`
      //         UPDATE discovered_events
      //         SET is_duplicate = true, duplicate_of = $1
      //         WHERE discovery_run_id = $2 AND event_id = $3
      //       `, [mergeInfo.primaryEventId, discoveryRunId, mergeInfo.mergedEvent.id]);
      //     } catch (error) {
      //       this.logger.warn(`Error marking event as duplicate in discovered_events: ${error.message}`);
      //     }
      //   }
      // }

      // Save only events that passed filters to main events table (for approval pipeline)
      const savedEvents = [];
      if (discoveryRunId && eventsWithFilters) {
        // Filter to only events that passed all filters
        const eventsPassedFilters = eventsWithFilters.filter(
          ({ filterResults }) => filterResults && filterResults.passed === true
        );

        this.logger.info(
          `${eventsPassedFilters.length} events passed filters out of ${eventsWithFilters.length} total events`
        );

        for (const { event, filterResults } of eventsPassedFilters) {
          try {
            // Assign discovery run ID if provided
            if (discoveryRunId) {
              event.discovery_run_id = discoveryRunId;
            }

            const eventId = await this.database.saveEvent(event);
            if (eventId) {
              savedEvents.push(event);
              this.logger.info(
                `Saved filtered event: ${event.title} on ${event.date} [ID: ${eventId}] [Run: ${discoveryRunId}] (passed filters)`
              );
            } else {
              this.logger.warn(
                `Event save returned no ID: ${event.title} on ${event.date} [Source: ${event.source}]`
              );
            }
          } catch (error) {
            this.logger.error(
              `Error saving filtered event "${event.title}" from ${event.source}:`,
              {
                error: error.message,
                stack: error.stack,
                eventId: event.id,
                eventData: {
                  title: event.title,
                  date: event.date,
                  source: event.source,
                  location: event.location?.address || "No address",
                  cost: event.cost,
                  ageRange: event.ageRange,
                },
              }
            );
          }
        }
      } else {
        // Fallback for when not using discovery run (save all events - legacy behavior)
        for (const event of uniqueEvents) {
          try {
            const eventId = await this.database.saveEvent(event);
            if (eventId) {
              savedEvents.push(event);
              this.logger.info(
                `Saved event: ${event.title} on ${event.date} [ID: ${eventId}] (legacy mode)`
              );
            }
          } catch (error) {
            this.logger.error(
              `Error saving event "${event.title}":`,
              error.message
            );
          }
        }
      }

      // Record merge information after successful event saves
      for (const mergeInfo of mergeInformation) {
        try {
          const mergeId = await this.database.recordEventMerge(
            mergeInfo.primaryEventId,
            mergeInfo.mergedEvent,
            mergeInfo.similarityScore,
            mergeInfo.mergeType
          );

          if (mergeId) {
            this.logger.debug(
              `Recorded ${mergeInfo.mergeType} merge: "${
                mergeInfo.mergedEvent.title
              }" -> ${
                mergeInfo.primaryEventId
              } [Score: ${mergeInfo.similarityScore.toFixed(
                3
              )}, MergeID: ${mergeId}]`
            );
          } else {
            this.logger.debug(
              `Skipped recording ${mergeInfo.mergeType} merge for "${mergeInfo.mergedEvent.title}" - primary event ${mergeInfo.primaryEventId} not found in database`
            );
          }
        } catch (error) {
          this.logger.warn(`Failed to record event merge in database:`, {
            error: error.message,
            primaryEventId: mergeInfo.primaryEventId,
            mergedEventTitle: mergeInfo.mergedEvent.title,
            mergedEventSource: mergeInfo.mergedEvent.source,
            similarityScore: mergeInfo.similarityScore,
            mergeType: mergeInfo.mergeType,
          });
        }
      }

      await scraper.closeBrowser();
      this.logger.info(
        `Completed scraping ${scraper.name}: ${rawEvents.length} raw -> ${uniqueEvents.length} unique -> ${savedEvents.length} saved`
      );
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
    this.logger.info("Deduplicator state reset");
  }
}

module.exports = ScraperManager;
