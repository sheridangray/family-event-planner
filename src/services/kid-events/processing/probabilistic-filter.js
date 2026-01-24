/**
 * Probabilistic Filter - Confidence-based Event Filtering
 * 
 * Uses weighted scores across multiple dimensions to rank events.
 * Learns from user feedback to improve filtering over time.
 */

const FamilyConfigService = require('../../family-config');

class ProbabilisticFilter {
  constructor(logger, database, config = {}) {
    this.logger = logger;
    this.database = database;
    this.familyConfig = new FamilyConfigService(logger, database);
    
    // Default filter weights (can be learned)
    this.defaultWeights = {
      age: 0.30,        // Age appropriateness
      schedule: 0.25,   // Time fit
      budget: 0.20,     // Cost within budget
      location: 0.15,   // Distance from home
      interest: 0.10    // Activity interest match
    };
    
    this.config = {
      minimumRelevanceScore: config.minimumRelevanceScore || 0.4,
      ...config
    };
  }

  /**
   * Filter and score events
   * @param {Array} events - Array of extracted events
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Scored and filtered events
   */
  async filter(events, options = {}) {
    try {
      // Load family settings
      const familySettings = await this.familyConfig.loadConfig();
      const preferences = await this.loadPreferences(options.userId);
      const weights = preferences?.filter_weights || this.defaultWeights;
      
      const scoredEvents = [];
      
      for (const event of events) {
        const scores = await this.calculateScores(event, familySettings, preferences);
        const relevanceScore = this.calculateWeightedScore(scores, weights);
        
        scoredEvents.push({
          ...event,
          filterScores: scores,
          relevanceScore
        });
      }
      
      // Sort by relevance and filter low-score events
      const filtered = scoredEvents
        .filter(e => e.relevanceScore >= this.config.minimumRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      this.logger.info(`Filter: ${events.length} events -> ${filtered.length} passed`);
      return filtered;
    } catch (error) {
      this.logger.error('Filter error:', error.message);
      return events;
    }
  }

  /**
   * Calculate individual dimension scores
   */
  async calculateScores(event, settings, preferences) {
    return {
      age: this.scoreAge(event, settings),
      schedule: this.scoreSchedule(event, settings, preferences),
      budget: this.scoreBudget(event, settings, preferences),
      location: this.scoreLocation(event, settings),
      interest: this.scoreInterest(event, preferences)
    };
  }

  /**
   * Score age appropriateness (0-1)
   */
  scoreAge(event, settings) {
    // Get children ages from settings
    const minChildAge = settings.minChildAge || 0;
    const maxChildAge = settings.maxChildAge || 12;
    
    // If event has no age info, give moderate score
    if (!event.ageMin && !event.ageMax) {
      return 0.6;
    }
    
    const eventAgeMin = event.ageMin || 0;
    const eventAgeMax = event.ageMax || 18;
    
    // Check for overlap
    const overlap = Math.min(maxChildAge, eventAgeMax) - Math.max(minChildAge, eventAgeMin);
    
    if (overlap < 0) {
      // No overlap - not appropriate
      return 0.1;
    }
    
    // Calculate overlap percentage
    const childAgeRange = maxChildAge - minChildAge + 1;
    const overlapPercent = Math.min(overlap + 1, childAgeRange) / childAgeRange;
    
    return Math.min(1, 0.5 + (overlapPercent * 0.5));
  }

  /**
   * Score schedule fit (0-1)
   */
  scoreSchedule(event, settings, preferences) {
    if (!event.eventDate) {
      return 0.5;
    }
    
    const eventDate = new Date(event.eventDate);
    const dayOfWeek = eventDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Prefer weekends
    let score = isWeekend ? 0.8 : 0.5;
    
    // Check time preferences
    if (event.startTime && preferences?.preferred_times) {
      const eventHour = parseInt(event.startTime.split(':')[0]);
      
      if (isWeekend) {
        // Weekend: prefer after 9 AM
        if (eventHour >= 9 && eventHour <= 16) {
          score = Math.min(score + 0.2, 1);
        }
      } else {
        // Weekday: prefer after 4 PM
        if (eventHour >= 16 && eventHour <= 19) {
          score = Math.min(score + 0.2, 1);
        }
      }
    }
    
    // Check if date is within preferred range
    const daysAhead = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
    if (daysAhead < 0) {
      return 0.1; // Past event
    }
    if (daysAhead <= 14) {
      score = Math.min(score + 0.1, 1); // Prefer soon
    }
    
    return score;
  }

  /**
   * Score budget fit (0-1)
   */
  scoreBudget(event, settings, preferences) {
    if (event.isFree) {
      // Free events get bonus if user prefers free
      return preferences?.prefer_free ? 1.0 : 0.9;
    }
    
    const maxCost = preferences?.max_cost_per_event || settings.maxCostPerEvent || 50;
    const eventCost = event.costAdult || event.costChild || 0;
    
    if (eventCost <= 0) {
      return 0.7; // Unknown cost
    }
    
    if (eventCost <= maxCost) {
      // Within budget - score based on how far under budget
      return 0.7 + (0.3 * (1 - eventCost / maxCost));
    }
    
    // Over budget - penalize proportionally
    const overagePercent = (eventCost - maxCost) / maxCost;
    return Math.max(0.1, 0.5 - (overagePercent * 0.5));
  }

  /**
   * Score location proximity (0-1)
   */
  scoreLocation(event, settings) {
    const maxDistance = settings.maxDistanceMiles || 25;
    
    if (!event.distanceMiles && !event.city) {
      return 0.6; // Unknown location
    }
    
    // If we have calculated distance
    if (event.distanceMiles !== undefined) {
      if (event.distanceMiles <= maxDistance) {
        return 0.8 + (0.2 * (1 - event.distanceMiles / maxDistance));
      }
      return Math.max(0.2, 0.6 - ((event.distanceMiles - maxDistance) / maxDistance) * 0.4);
    }
    
    // City-based scoring
    const city = (event.city || '').toLowerCase();
    if (city.includes('san francisco') || city.includes('sf')) {
      return 0.9;
    }
    if (city.includes('oakland') || city.includes('berkeley')) {
      return 0.7;
    }
    
    return 0.5;
  }

  /**
   * Score interest match (0-1)
   */
  scoreInterest(event, preferences) {
    if (!preferences) {
      return 0.5;
    }
    
    const likedActivities = preferences.liked_activities || [];
    const dislikedActivities = preferences.disliked_activities || [];
    const likedVenues = preferences.liked_venues || [];
    const dislikedVenues = preferences.disliked_venues || [];
    
    let score = 0.5;
    
    const eventText = `${event.title || ''} ${event.description || ''} ${event.venueName || ''}`.toLowerCase();
    
    // Check for liked activities
    for (const activity of likedActivities) {
      if (eventText.includes(activity.toLowerCase())) {
        score = Math.min(score + 0.2, 1);
      }
    }
    
    // Check for disliked activities
    for (const activity of dislikedActivities) {
      if (eventText.includes(activity.toLowerCase())) {
        score = Math.max(score - 0.3, 0.1);
      }
    }
    
    // Check for liked venues
    for (const venue of likedVenues) {
      if (eventText.includes(venue.toLowerCase())) {
        score = Math.min(score + 0.2, 1);
      }
    }
    
    // Check for disliked venues
    for (const venue of dislikedVenues) {
      if (eventText.includes(venue.toLowerCase())) {
        score = Math.max(score - 0.3, 0.1);
      }
    }
    
    return score;
  }

  /**
   * Calculate weighted relevance score
   */
  calculateWeightedScore(scores, weights) {
    let total = 0;
    let weightSum = 0;
    
    for (const [dimension, weight] of Object.entries(weights)) {
      if (scores[dimension] !== undefined) {
        total += scores[dimension] * weight;
        weightSum += weight;
      }
    }
    
    return weightSum > 0 ? Math.round((total / weightSum) * 100) / 100 : 0;
  }

  /**
   * Load user preferences from database
   */
  async loadPreferences(userId) {
    if (!userId) return null;
    
    try {
      const result = await this.database.query(`
        SELECT * FROM kid_event_preferences WHERE user_id = $1
      `, [userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      this.logger.warn('Failed to load preferences:', error.message);
      return null;
    }
  }

  /**
   * Update preferences based on user feedback
   */
  async updateFromFeedback(userId, eventId, rating) {
    try {
      const event = await this.getEvent(eventId);
      if (!event) return;
      
      const preferences = await this.loadPreferences(userId) || {
        liked_activities: [],
        disliked_activities: [],
        liked_venues: [],
        disliked_venues: []
      };
      
      // Positive rating (4-5 stars)
      if (rating >= 4) {
        if (event.venueName && !preferences.liked_venues.includes(event.venueName)) {
          preferences.liked_venues.push(event.venueName);
        }
      }
      
      // Negative rating (1-2 stars)
      if (rating <= 2) {
        if (event.venueName && !preferences.disliked_venues.includes(event.venueName)) {
          preferences.disliked_venues.push(event.venueName);
        }
      }
      
      await this.savePreferences(userId, preferences);
    } catch (error) {
      this.logger.error('Failed to update preferences:', error.message);
    }
  }

  async getEvent(eventId) {
    try {
      const result = await this.database.query(
        'SELECT * FROM kid_events WHERE id = $1',
        [eventId]
      );
      return result.rows[0];
    } catch (error) {
      return null;
    }
  }

  async savePreferences(userId, preferences) {
    try {
      await this.database.query(`
        INSERT INTO kid_event_preferences (user_id, liked_venues, disliked_venues, liked_activities, disliked_activities)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          liked_venues = $2,
          disliked_venues = $3,
          liked_activities = $4,
          disliked_activities = $5,
          updated_at = NOW()
      `, [
        userId,
        JSON.stringify(preferences.liked_venues),
        JSON.stringify(preferences.disliked_venues),
        JSON.stringify(preferences.liked_activities),
        JSON.stringify(preferences.disliked_activities)
      ]);
    } catch (error) {
      this.logger.error('Failed to save preferences:', error.message);
    }
  }
}

module.exports = ProbabilisticFilter;
