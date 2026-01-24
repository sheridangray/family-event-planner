/**
 * Discovery Orchestrator - Coordinates Event Discovery Pipeline
 * 
 * Manages the full discovery flow:
 * 1. Fetch from all sources (SERP, Eventbrite, newsletters)
 * 2. Extract event data using LLM
 * 3. Filter and score events
 * 4. Save to database
 */

const { SerpSource, EventbriteSource, NewsletterSource } = require('./sources');
const { LLMExtractor, ProbabilisticFilter } = require('./processing');
const axios = require('axios');

class DiscoveryOrchestrator {
  constructor(logger, database, config = {}) {
    this.logger = logger;
    this.database = database;
    
    // Initialize sources
    this.serpSource = new SerpSource(logger, config);
    this.eventbriteSource = new EventbriteSource(logger, config);
    this.newsletterSource = new NewsletterSource(logger, database, config);
    
    // Initialize processors
    this.extractor = new LLMExtractor(logger, config);
    this.filter = new ProbabilisticFilter(logger, database, config);
    
    // Configuration
    // Note: Eventbrite API was deprecated in 2019, disabled by default
    // Eventbrite events can still be found via SERP + LLM extraction
    this.config = {
      location: config.location || 'San Francisco, CA',
      radiusMiles: config.radiusMiles || 25,
      daysAhead: config.daysAhead || 14,
      ageMin: config.ageMin,
      ageMax: config.ageMax,
      enableSerp: config.enableSerp !== false,
      enableEventbrite: config.enableEventbrite === true, // Disabled by default (API deprecated)
      enableNewsletters: config.enableNewsletters !== false,
      ...config
    };
  }

  /**
   * Run full discovery pipeline
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Discovery results
   */
  async discover(options = {}) {
    const runConfig = { ...this.config, ...options };
    
    console.log('🚀 [Discovery] ========== STARTING DISCOVERY ==========');
    console.log('🚀 [Discovery] Config:', JSON.stringify(runConfig, null, 2));
    console.log('🚀 [Discovery] Sources enabled:', {
      serp: runConfig.enableSerp,
      eventbrite: runConfig.enableEventbrite,
      newsletters: runConfig.enableNewsletters
    });
    
    const runId = await this.startDiscoveryRun(options.triggerType || 'manual', runConfig);
    
    console.log('🚀 [Discovery] Run ID:', runId);
    this.logger.info(`Starting discovery run ${runId}`);
    
    const results = {
      runId,
      eventsFound: 0,
      eventsSaved: 0,
      bySource: {},
      errors: []
    };

    try {
      // Step 1: Fetch from all sources in parallel
      console.log('📡 [Discovery] Step 1: Fetching from sources...');
      
      const [serpResults, eventbriteResults, newsletterResults] = await Promise.all([
        runConfig.enableSerp ? this.fetchSerp(runConfig) : [],
        runConfig.enableEventbrite ? this.fetchEventbrite(runConfig) : [],
        runConfig.enableNewsletters ? this.fetchNewsletters(runConfig) : []
      ]);

      console.log('📊 [Discovery] Source results:');
      console.log('   - SERP:', serpResults.length, 'results');
      console.log('   - Eventbrite:', eventbriteResults.length, 'events');
      console.log('   - Newsletters:', newsletterResults.length, 'emails');
      
      results.bySource.serp = serpResults.length;
      results.bySource.eventbrite = eventbriteResults.length;
      results.bySource.newsletter = newsletterResults.length;

      // Step 2: Process SERP results (need LLM extraction)
      console.log('🤖 [Discovery] Step 2: Processing SERP results with LLM...');
      const processedSerp = await this.processSerp(serpResults);
      console.log('🤖 [Discovery] SERP LLM extracted:', processedSerp.length, 'events');
      
      // Step 3: Process newsletters (need LLM extraction)
      console.log('📧 [Discovery] Step 3: Processing newsletters with LLM...');
      const processedNewsletters = await this.processNewsletters(newsletterResults);
      console.log('📧 [Discovery] Newsletter LLM extracted:', processedNewsletters.length, 'events');
      
      // Eventbrite already has structured data
      const allEvents = [
        ...processedSerp,
        ...eventbriteResults,
        ...processedNewsletters
      ];

      console.log('📦 [Discovery] Total events before dedup:', allEvents.length);
      results.eventsFound = allEvents.length;
      this.logger.info(`Total events found: ${allEvents.length}`);

      // Step 4: Deduplicate
      console.log('🔄 [Discovery] Step 4: Deduplicating...');
      const deduplicated = this.deduplicate(allEvents);
      console.log('🔄 [Discovery] After deduplication:', deduplicated.length, 'events');
      this.logger.info(`After deduplication: ${deduplicated.length}`);

      // Step 5: Filter and score
      console.log('🎯 [Discovery] Step 5: Filtering and scoring...');
      const filtered = await this.filter.filter(deduplicated, {
        userId: options.userId
      });
      console.log('🎯 [Discovery] After filtering:', filtered.length, 'events');
      this.logger.info(`After filtering: ${filtered.length}`);

      // Step 6: Save to database
      console.log('💾 [Discovery] Step 6: Saving to database...');
      for (const event of filtered) {
        try {
          const eventId = await this.saveEvent(event);
          console.log('💾 [Discovery] Saved event:', event.title, '(ID:', eventId, ')');
          results.eventsSaved++;
        } catch (error) {
          console.log('❌ [Discovery] Failed to save:', event.title, '-', error.message);
          results.errors.push(`Save failed for "${event.title}": ${error.message}`);
        }
      }

      // Complete the run
      await this.completeDiscoveryRun(runId, results);
      
      console.log('✅ [Discovery] ========== DISCOVERY COMPLETE ==========');
      console.log('✅ [Discovery] Results:', JSON.stringify(results, null, 2));
      this.logger.info(`Discovery complete: ${results.eventsSaved} events saved`);
      return results;

    } catch (error) {
      this.logger.error('Discovery failed:', error.message);
      await this.failDiscoveryRun(runId, error.message);
      throw error;
    }
  }

  /**
   * Fetch from SERP source
   */
  async fetchSerp(config) {
    try {
      const results = await this.serpSource.search(config);
      this.logger.info(`SERP returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error('SERP fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from Eventbrite source
   */
  async fetchEventbrite(config) {
    try {
      const results = await this.eventbriteSource.search(config);
      this.logger.info(`Eventbrite returned ${results.length} events`);
      return results;
    } catch (error) {
      this.logger.error('Eventbrite fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch from newsletter source
   */
  async fetchNewsletters(config) {
    try {
      const results = await this.newsletterSource.search(config);
      this.logger.info(`Newsletters returned ${results.length} emails`);
      return results;
    } catch (error) {
      this.logger.error('Newsletter fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Process SERP results with LLM extraction
   */
  async processSerp(results) {
    const processed = [];
    
    for (const result of results) {
      try {
        // Fetch page content
        const content = await this.fetchPageContent(result.url);
        if (!content) continue;
        
        // Extract event data
        const extracted = await this.extractor.extract({
          ...result,
          htmlContent: content
        });
        
        if (extracted) {
          processed.push(extracted);
        }
      } catch (error) {
        this.logger.warn(`Failed to process ${result.url}:`, error.message);
      }
    }
    
    return processed;
  }

  /**
   * Process newsletters with LLM extraction
   */
  async processNewsletters(newsletters) {
    const processed = [];
    
    for (const newsletter of newsletters) {
      try {
        const events = await this.extractor.extractFromNewsletter(newsletter);
        processed.push(...events);
      } catch (error) {
        this.logger.warn(`Failed to process newsletter:`, error.message);
      }
    }
    
    return processed;
  }

  /**
   * Fetch page content for SERP results
   */
  async fetchPageContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FamilyEventBot/1.0)'
        }
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Deduplicate events by title and date
   */
  deduplicate(events) {
    const seen = new Map();
    
    for (const event of events) {
      const key = this.generateDedupeKey(event);
      const existing = seen.get(key);
      
      if (!existing || event.extractionConfidence > existing.extractionConfidence) {
        seen.set(key, event);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Generate deduplication key
   */
  generateDedupeKey(event) {
    const title = (event.title || '').toLowerCase().trim();
    const date = event.eventDate || '';
    const venue = (event.venueName || '').toLowerCase().trim();
    
    // Normalize title for comparison
    const normalizedTitle = title
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 30);
    
    return `${normalizedTitle}-${date}-${venue.substring(0, 10)}`;
  }

  /**
   * Save event to database
   */
  async saveEvent(event) {
    const query = `
      INSERT INTO kid_events (
        source_type, source_url, source_id,
        title, description, event_date, start_time, end_time,
        venue_name, address, city, latitude, longitude, distance_miles,
        cost_adult, cost_child, is_free,
        age_min, age_max,
        event_url, registration_url,
        extraction_confidence, extraction_model, raw_content,
        relevance_score, filter_scores,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (source_type, source_url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        event_date = EXCLUDED.event_date,
        relevance_score = EXCLUDED.relevance_score,
        filter_scores = EXCLUDED.filter_scores,
        updated_at = NOW()
      RETURNING id
    `;

    const values = [
      event.sourceType,
      event.sourceUrl,
      event.sourceId || null,
      event.title,
      event.description,
      event.eventDate || null,
      event.startTime || null,
      event.endTime || null,
      event.venueName,
      event.address,
      event.city || 'San Francisco',
      event.latitude || null,
      event.longitude || null,
      event.distanceMiles || null,
      event.costAdult || null,
      event.costChild || null,
      event.isFree || false,
      event.ageMin || null,
      event.ageMax || null,
      event.eventUrl,
      event.registrationUrl,
      event.extractionConfidence || null,
      event.extractionModel || null,
      event.rawContent ? event.rawContent.substring(0, 5000) : null,
      event.relevanceScore || null,
      event.filterScores ? JSON.stringify(event.filterScores) : null,
      'discovered'
    ];

    const result = await this.database.query(query, values);
    return result.rows[0]?.id;
  }

  /**
   * Start a discovery run
   */
  async startDiscoveryRun(triggerType, config) {
    const result = await this.database.query(`
      INSERT INTO kid_event_discovery_runs (trigger_type, config, status)
      VALUES ($1, $2, 'running')
      RETURNING id
    `, [triggerType, JSON.stringify(config)]);
    
    return result.rows[0].id;
  }

  /**
   * Complete a discovery run
   */
  async completeDiscoveryRun(runId, results) {
    await this.database.query(`
      UPDATE kid_event_discovery_runs
      SET status = 'completed',
          completed_at = NOW(),
          events_found = $2,
          events_saved = $3
      WHERE id = $1
    `, [runId, results.eventsFound, results.eventsSaved]);
  }

  /**
   * Fail a discovery run
   */
  async failDiscoveryRun(runId, errorMessage) {
    await this.database.query(`
      UPDATE kid_event_discovery_runs
      SET status = 'failed',
          completed_at = NOW(),
          error_message = $2
      WHERE id = $1
    `, [runId, errorMessage]);
  }
}

module.exports = DiscoveryOrchestrator;
