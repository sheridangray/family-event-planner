/**
 * Discovery Orchestrator - Coordinates Event Discovery Pipeline
 * 
 * Manages the full discovery flow:
 * 1. Fetch from all sources (SERP, Eventbrite, newsletters)
 * 2. Extract event data using LLM
 * 3. Filter and score events
 * 4. Save to database
 */

const { BraveSearchSource, EventbriteSource, NewsletterSource } = require('./sources');
const { LLMExtractor, ProbabilisticFilter } = require('./processing');
const axios = require('axios');

class DiscoveryOrchestrator {
  constructor(logger, database, config = {}) {
    this.logger = logger;
    this.database = database;
    
    // Initialize sources
    // Using Brave Search API (Google Custom Search API closed to new customers)
    this.braveSource = new BraveSearchSource(logger, config);
    this.eventbriteSource = new EventbriteSource(logger, config);
    this.newsletterSource = new NewsletterSource(logger, database, config);
    
    // Initialize processors
    this.extractor = new LLMExtractor(logger, config);
    this.filter = new ProbabilisticFilter(logger, database, config);
    
    // Configuration
    // Note: Eventbrite API was deprecated in 2019, disabled by default
    // Eventbrite events can still be found via web search + LLM extraction
    this.config = {
      location: config.location || 'San Francisco, CA',
      radiusMiles: config.radiusMiles || 25,
      daysAhead: config.daysAhead || 14,
      ageMin: config.ageMin,
      ageMax: config.ageMax,
      enableSerp: config.enableSerp !== false, // Keep same flag name for iOS compatibility
      enableEventbrite: config.enableEventbrite === true, // Disabled by default (API deprecated)
      enableNewsletters: config.enableNewsletters !== false,
      maxUrls: config.maxUrls || 5, // Limit URLs to process (for debugging)
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
      
      const [braveResults, eventbriteResults, newsletterResults] = await Promise.all([
        runConfig.enableSerp ? this.fetchBraveSearch(runConfig) : [],
        runConfig.enableEventbrite ? this.fetchEventbrite(runConfig) : [],
        runConfig.enableNewsletters ? this.fetchNewsletters(runConfig) : []
      ]);

      console.log('📊 [Discovery] Source results:');
      console.log('   - Web Search (Brave):', braveResults.length, 'results');
      console.log('   - Eventbrite:', eventbriteResults.length, 'events');
      console.log('   - Newsletters:', newsletterResults.length, 'emails');
      
      results.bySource.webSearch = braveResults.length;
      results.bySource.eventbrite = eventbriteResults.length;
      results.bySource.newsletter = newsletterResults.length;

      // Step 2: Process web search results (need LLM extraction)
      console.log('🤖 [Discovery] Step 2: Processing web search results with LLM...');
      const processedWebSearch = await this.processWebSearch(braveResults);
      console.log('🤖 [Discovery] Web search LLM extracted:', processedWebSearch.length, 'events');
      
      // Step 3: Process newsletters (need LLM extraction)
      console.log('📧 [Discovery] Step 3: Processing newsletters with LLM...');
      const processedNewsletters = await this.processNewsletters(newsletterResults);
      console.log('📧 [Discovery] Newsletter LLM extracted:', processedNewsletters.length, 'events');
      
      // Eventbrite already has structured data
      const allEvents = [
        ...processedWebSearch,
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
   * Fetch from Brave Search source
   */
  async fetchBraveSearch(config) {
    try {
      const results = await this.braveSource.search(config);
      this.logger.info(`Brave Search returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error('Brave Search fetch failed:', error.message);
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
   * Process web search results with LLM extraction
   */
  async processWebSearch(results) {
    const processed = [];
    let fetchSuccessCount = 0;
    let fetchFailCount = 0;
    let totalEventsExtracted = 0;
    let urlsWithEvents = 0;
    let urlsWithoutEvents = 0;
    let extractFailCount = 0;
    
    // Limit URLs to process based on config
    const maxUrls = this.config.maxUrls || 5;
    const urlsToProcess = results.slice(0, maxUrls);
    
    console.log(`🤖 [LLM] Processing ${urlsToProcess.length} URLs (max: ${maxUrls}, available: ${results.length})...`);
    
    for (let i = 0; i < urlsToProcess.length; i++) {
      const result = urlsToProcess[i];
      
      try {
        console.log(`🤖 [LLM] [${i + 1}/${urlsToProcess.length}] Fetching: ${result.url}`);
        
        // Fetch page content
        const content = await this.fetchPageContent(result.url);
        if (!content) {
          console.log(`   ⚠️  [LLM] Fetch failed or empty content`);
          fetchFailCount++;
          continue;
        }
        
        fetchSuccessCount++;
        const contentLength = content.length;
        console.log(`   ✅ [LLM] Fetched ${contentLength} chars`);
        
        // Extract event data (now returns array)
        const extractedEvents = await this.extractor.extract({
          ...result,
          htmlContent: content
        });
        
        if (extractedEvents && extractedEvents.length > 0) {
          if (extractedEvents.length === 1) {
            console.log(`   ✅ [LLM] Extracted 1 event: "${extractedEvents[0].title}" (confidence: ${extractedEvents[0].extractionConfidence})`);
          } else {
            console.log(`   ✅ [LLM] Extracted ${extractedEvents.length} events from this page:`);
            extractedEvents.forEach((e, idx) => {
              console.log(`      ${idx + 1}. "${e.title}" (confidence: ${e.extractionConfidence})`);
            });
          }
          totalEventsExtracted += extractedEvents.length;
          urlsWithEvents++;
          processed.push(...extractedEvents);
        } else {
          console.log(`   ⚠️  [LLM] No events found on this page`);
          urlsWithoutEvents++;
        }
      } catch (error) {
        console.log(`   ❌ [LLM] Error: ${error.message}`);
        extractFailCount++;
        this.logger.warn(`Failed to process ${result.url}:`, error.message);
      }
    }
    
    console.log(`🤖 [LLM] ========== EXTRACTION SUMMARY ==========`);
    console.log(`🤖 [LLM] URLs available: ${results.length}, processed: ${urlsToProcess.length} (max: ${maxUrls})`);
    console.log(`🤖 [LLM] Fetch success: ${fetchSuccessCount}, fail: ${fetchFailCount}`);
    console.log(`🤖 [LLM] URLs with events: ${urlsWithEvents}, without: ${urlsWithoutEvents}`);
    console.log(`🤖 [LLM] Total events extracted: ${totalEventsExtracted}`);
    console.log(`🤖 [LLM] Extraction errors: ${extractFailCount}`);
    
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
   * Fetch page content for web search results
   */
  async fetchPageContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      return response.data;
    } catch (error) {
      // Log specific error types for debugging
      if (error.code === 'ECONNABORTED') {
        console.log(`   ⏱️  Timeout after 15s`);
      } else if (error.response?.status) {
        console.log(`   🚫 HTTP ${error.response.status}`);
      } else if (error.code) {
        console.log(`   ❌ ${error.code}`);
      }
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
