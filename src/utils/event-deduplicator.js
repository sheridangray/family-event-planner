/**
 * Event deduplication system for family event planner
 */

const { compositeSimilarity, normalizeString } = require('./string-similarity');
const { compareLocations, normalizeAddress } = require('./location-normalizer');

class EventDeduplicator {
  constructor(logger, database = null) {
    this.logger = logger;
    this.database = database;
    this.seenEvents = new Map(); // fingerprint -> event
    this.eventsBySource = new Map(); // source -> events
    this.similarityThreshold = 0.75;
  }

  /**
   * Create a normalized fingerprint for exact duplicate detection
   * @param {Object} event 
   * @returns {string} Event fingerprint
   */
  createEventFingerprint(event) {
    const normalizedTitle = normalizeString(event.title);
    
    let dateStr = '';
    try {
      if (event.date instanceof Date && !isNaN(event.date.getTime())) {
        dateStr = event.date.toISOString().split('T')[0];
      } else if (event.date) {
        const parsedDate = new Date(event.date);
        if (!isNaN(parsedDate.getTime())) {
          dateStr = parsedDate.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      this.logger.warn(`Invalid date for event ${event.title}: ${event.date}`);
      dateStr = 'invalid-date';
    }
    
    const normalizedLocation = normalizeAddress(event.location?.address || '');
    
    return `${normalizedTitle}|${dateStr}|${normalizedLocation}`;
  }

  /**
   * Calculate comprehensive similarity score between two events
   * @param {Object} event1 
   * @param {Object} event2 
   * @returns {number} Similarity score (0-1)
   */
  calculateEventSimilarity(event1, event2) {
    // Title similarity (most important)
    const titleSimilarity = compositeSimilarity(
      normalizeString(event1.title), 
      normalizeString(event2.title)
    );
    
    // Location similarity
    const locationSimilarity = compareLocations(
      event1.location, 
      event2.location
    );
    
    // Date similarity
    let dateScore = 0;
    try {
      const date1 = new Date(event1.date);
      const date2 = new Date(event2.date);
      
      if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
        const dateDiffHours = Math.abs(date1 - date2) / (1000 * 60 * 60);
        dateScore = dateDiffHours <= 1 ? 1.0 : Math.max(0, 1 - dateDiffHours / 24);
      }
    } catch (error) {
      // If date comparison fails, use neutral score
      dateScore = 0.5;
    }
    
    // Time similarity (for events on same day)
    let timeScore = 1.0;
    try {
      const date1 = new Date(event1.date);
      const date2 = new Date(event2.date);
      
      if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
        const dateDiffHours = Math.abs(date1 - date2) / (1000 * 60 * 60);
        if (dateDiffHours <= 24) {
          const time1 = this.extractTimeFromEvent(event1);
          const time2 = this.extractTimeFromEvent(event2);
          if (time1 && time2) {
            const timeDiffMinutes = Math.abs(time1 - time2);
            timeScore = timeDiffMinutes <= 30 ? 1.0 : Math.max(0, 1 - timeDiffMinutes / 480); // 8 hours
          }
        }
      }
    } catch (error) {
      timeScore = 1.0; // neutral if can't compare
    }
    
    // Age range similarity
    const ageScore = this.compareAgeRanges(event1.ageRange, event2.ageRange);
    
    // Weighted composite score
    const compositeScore = (
      titleSimilarity * 0.4 +
      locationSimilarity * 0.25 +
      dateScore * 0.2 +
      timeScore * 0.1 +
      ageScore * 0.05
    );
    
    // Boost score for exact matches in key fields
    if (titleSimilarity > 0.95 && locationSimilarity > 0.9 && dateScore > 0.9) {
      return Math.min(1.0, compositeScore + 0.1);
    }
    
    return compositeScore;
  }

  /**
   * Extract time information from event (in minutes from midnight)
   * @param {Object} event 
   * @returns {number|null} Time in minutes from midnight
   */
  extractTimeFromEvent(event) {
    // Try to extract from description or title
    const text = `${event.title} ${event.description || ''}`;
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3].toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      return hours * 60 + minutes;
    }
    
    // Try to extract from date object if it has time info
    const date = new Date(event.date);
    if (date.getHours() !== 0 || date.getMinutes() !== 0) {
      return date.getHours() * 60 + date.getMinutes();
    }
    
    return null;
  }

  /**
   * Compare age ranges for similarity
   * @param {Object} range1 
   * @param {Object} range2 
   * @returns {number} Similarity score (0-1)
   */
  compareAgeRanges(range1, range2) {
    if (!range1 || !range2) return 0.5; // neutral if missing
    
    const overlap = Math.max(0, Math.min(range1.max, range2.max) - Math.max(range1.min, range2.min));
    const union = Math.max(range1.max, range2.max) - Math.min(range1.min, range2.min);
    
    return union > 0 ? overlap / union : 0;
  }

  /**
   * Find the most similar existing event
   * @param {Object} newEvent 
   * @returns {Object|null} Most similar event or null
   */
  findMostSimilarEvent(newEvent) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const existingEvent of this.seenEvents.values()) {
      const similarity = this.calculateEventSimilarity(newEvent, existingEvent);
      
      if (similarity > bestScore && similarity >= this.similarityThreshold) {
        bestScore = similarity;
        bestMatch = existingEvent;
      }
    }
    
    return bestMatch ? { event: bestMatch, score: bestScore } : null;
  }

  /**
   * Merge duplicate event data, keeping the best information from each
   * @param {Object} primaryEvent - The event to merge into
   * @param {Object} duplicateEvent - The duplicate event data
   * @param {number} similarityScore - The similarity score that triggered the merge
   * @returns {Object} Updated primary event
   */
  async mergeEventData(primaryEvent, duplicateEvent, similarityScore = null) {
    // Track multiple sources
    if (!primaryEvent.sources) {
      primaryEvent.sources = [primaryEvent.source];
    }
    
    if (!primaryEvent.sources.includes(duplicateEvent.source)) {
      primaryEvent.sources.push(duplicateEvent.source);
    }
    
    // Keep the longest/best description
    if (duplicateEvent.description && 
        (!primaryEvent.description || duplicateEvent.description.length > primaryEvent.description.length)) {
      primaryEvent.description = duplicateEvent.description;
    }
    
    // Keep the best image URL
    if (duplicateEvent.imageUrl && !primaryEvent.imageUrl) {
      primaryEvent.imageUrl = duplicateEvent.imageUrl;
    }
    
    // Collect multiple registration URLs
    if (duplicateEvent.registrationUrl && duplicateEvent.registrationUrl !== primaryEvent.registrationUrl) {
      if (!primaryEvent.alternateUrls) {
        primaryEvent.alternateUrls = [];
      }
      primaryEvent.alternateUrls.push(duplicateEvent.registrationUrl);
    }
    
    // Keep the more specific location if available
    if (duplicateEvent.location?.address && 
        (!primaryEvent.location?.address || duplicateEvent.location.address.length > primaryEvent.location.address.length)) {
      primaryEvent.location = { ...primaryEvent.location, ...duplicateEvent.location };
    }
    
    // Keep the lower cost (more conservative estimate)
    if (duplicateEvent.cost !== undefined && duplicateEvent.cost < primaryEvent.cost) {
      primaryEvent.cost = duplicateEvent.cost;
    }
    
    // Keep the more restrictive age range if significantly different
    if (duplicateEvent.ageRange && primaryEvent.ageRange) {
      const ageSimilarity = this.compareAgeRanges(primaryEvent.ageRange, duplicateEvent.ageRange);
      if (ageSimilarity < 0.8) {
        // If significantly different, keep the more restrictive one
        const primaryRange = primaryEvent.ageRange.max - primaryEvent.ageRange.min;
        const duplicateRange = duplicateEvent.ageRange.max - duplicateEvent.ageRange.min;
        
        if (duplicateRange < primaryRange) {
          primaryEvent.ageRange = duplicateEvent.ageRange;
        }
      }
    }
    
    // Update the merged timestamp
    primaryEvent.lastMerged = new Date();
    primaryEvent.mergeCount = (primaryEvent.mergeCount || 1) + 1;
    
    // Record the merge in database if available
    if (this.database && similarityScore !== null) {
      try {
        const mergeType = similarityScore >= 0.95 ? 'exact' : 'fuzzy';
        await this.database.recordEventMerge(
          primaryEvent.id,
          duplicateEvent,
          similarityScore,
          mergeType
        );
      } catch (error) {
        this.logger.warn(`Failed to record event merge in database: ${error.message}`);
      }
    }
    
    this.logger.debug(`Merged duplicate event: "${duplicateEvent.title}" from ${duplicateEvent.source} into "${primaryEvent.title}"`);
    
    return primaryEvent;
  }

  /**
   * Process and deduplicate a batch of events
   * @param {Array} newEvents - Array of events to deduplicate
   * @returns {Array} Deduplicated events
   */
  async deduplicateEvents(newEvents) {
    const uniqueEvents = [];
    let exactDuplicates = 0;
    let fuzzyDuplicates = 0;
    
    for (const event of newEvents) {
      try {
        const fingerprint = this.createEventFingerprint(event);
        
        // Check for exact duplicates first
        if (this.seenEvents.has(fingerprint)) {
          const existingEvent = this.seenEvents.get(fingerprint);
          await this.mergeEventData(existingEvent, event, 1.0);
          exactDuplicates++;
          continue;
        }
        
        // Check for fuzzy duplicates
        const similarMatch = this.findMostSimilarEvent(event);
        if (similarMatch) {
          await this.mergeEventData(similarMatch.event, event, similarMatch.score);
          fuzzyDuplicates++;
          this.logger.debug(`Fuzzy duplicate detected: similarity=${similarMatch.score.toFixed(3)}`);
          continue;
        }
        
        // New unique event
        this.seenEvents.set(fingerprint, event);
        uniqueEvents.push(event);
        
        // Track by source for analytics
        if (!this.eventsBySource.has(event.source)) {
          this.eventsBySource.set(event.source, []);
        }
        this.eventsBySource.get(event.source).push(event);
        
      } catch (error) {
        this.logger.error(`Error processing event for deduplication: ${event.title}`, error);
        // Include problematic events rather than losing them
        uniqueEvents.push(event);
      }
    }
    
    this.logger.info(`Deduplication results: ${newEvents.length} input events -> ${uniqueEvents.length} unique events (${exactDuplicates} exact, ${fuzzyDuplicates} fuzzy duplicates removed)`);
    
    return uniqueEvents;
  }

  /**
   * Get deduplication statistics
   * @returns {Object} Statistics about processed events
   */
  getStats() {
    const totalEvents = this.seenEvents.size;
    const sourceStats = {};
    
    for (const [source, events] of this.eventsBySource.entries()) {
      sourceStats[source] = events.length;
    }
    
    return {
      totalUniqueEvents: totalEvents,
      eventsBySource: sourceStats,
      duplicatesDetected: Array.from(this.seenEvents.values()).reduce((sum, event) => sum + (event.mergeCount || 1) - 1, 0)
    };
  }

  /**
   * Clear the deduplicator state (useful for testing or periodic cleanup)
   */
  reset() {
    this.seenEvents.clear();
    this.eventsBySource.clear();
    this.logger.debug('Event deduplicator state reset');
  }
}

module.exports = EventDeduplicator;