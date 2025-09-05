class FamilyPreferenceLearning {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.learningHistory = new Map();
    this.preferencesCache = null;
    this.cacheExpiry = null;
  }

  async init() {
    this.logger.info('Family preference learning system initialized');
  }

  /**
   * Record family interaction with an event for learning
   */
  async recordEventInteraction(eventId, interactionType, metadata = {}) {
    try {
      const event = await this.database.getEventById(eventId);
      if (!event) {
        this.logger.warn(`Cannot record interaction for non-existent event: ${eventId}`);
        return;
      }

      const interaction = {
        eventId: eventId,
        eventTitle: event.title,
        eventSource: event.source,
        eventCost: event.cost,
        eventDate: event.date,
        eventLocation: event.location_address,
        interactionType: interactionType, // 'approved', 'rejected', 'registered', 'failed', 'cancelled'
        interactionTime: new Date(),
        metadata: metadata,
        eventCategories: this.categorizeEvent(event),
        eventKeywords: this.extractEventKeywords(event)
      };

      // Store in memory for immediate use
      this.learningHistory.set(eventId, interaction);

      // TODO: Store in database when schema is available
      // await this.database.recordEventInteraction(interaction);

      this.logger.debug(`Recorded ${interactionType} interaction for event: ${event.title}`);

      // Update preferences cache
      this.invalidatePreferencesCache();

    } catch (error) {
      this.logger.error('Failed to record event interaction:', error.message);
    }
  }

  /**
   * Categorize event for learning purposes
   */
  categorizeEvent(event) {
    const categories = [];
    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const source = event.source.toLowerCase();
    const location = (event.location_address || '').toLowerCase();

    // Age group categories
    if (title.includes('baby') || title.includes('infant')) {
      categories.push('baby');
    }
    if (title.includes('toddler') || title.includes('ages 2') || title.includes('ages 3')) {
      categories.push('toddler');
    }
    if (title.includes('kid') || title.includes('child') || title.includes('ages 4') || title.includes('ages 5-')) {
      categories.push('kids');
    }
    if (title.includes('teen') || title.includes('ages 13') || title.includes('youth')) {
      categories.push('teen');
    }
    if (title.includes('family') || title.includes('all ages')) {
      categories.push('family');
    }

    // Activity type categories
    if (title.includes('story') || title.includes('reading') || title.includes('book')) {
      categories.push('reading');
    }
    if (title.includes('art') || title.includes('craft') || title.includes('paint') || title.includes('draw')) {
      categories.push('arts_crafts');
    }
    if (title.includes('music') || title.includes('sing') || title.includes('dance')) {
      categories.push('music_dance');
    }
    if (title.includes('science') || title.includes('stem') || title.includes('experiment')) {
      categories.push('science');
    }
    if (title.includes('outdoor') || title.includes('nature') || title.includes('hike') || title.includes('park')) {
      categories.push('outdoor');
    }
    if (title.includes('sport') || title.includes('swim') || title.includes('play')) {
      categories.push('sports');
    }
    if (title.includes('movie') || title.includes('film') || title.includes('show')) {
      categories.push('entertainment');
    }
    if (title.includes('workshop') || title.includes('class') || title.includes('learn')) {
      categories.push('educational');
    }

    // Venue type categories
    if (source.includes('museum') || location.includes('museum')) {
      categories.push('museum');
    }
    if (source.includes('library') || location.includes('library')) {
      categories.push('library');
    }
    if (source.includes('park') || location.includes('park')) {
      categories.push('park');
    }
    if (source.includes('community') || location.includes('community')) {
      categories.push('community');
    }

    // Time categories
    const eventTime = new Date(event.date);
    const hour = eventTime.getHours();
    
    if (hour < 12) {
      categories.push('morning');
    } else if (hour < 17) {
      categories.push('afternoon');
    } else {
      categories.push('evening');
    }

    const dayOfWeek = eventTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      categories.push('weekend');
    } else {
      categories.push('weekday');
    }

    // Cost categories
    if (event.cost === 0) {
      categories.push('free');
    } else if (event.cost < 20) {
      categories.push('low_cost');
    } else {
      categories.push('paid');
    }

    return categories;
  }

  /**
   * Extract keywords from event for preference learning
   */
  extractEventKeywords(event) {
    const keywords = new Set();
    const text = `${event.title} ${event.description || ''}`.toLowerCase();
    
    // Split into words and filter meaningful ones
    const words = text.match(/\b\w{3,}\b/g) || [];
    
    const meaningfulWords = words.filter(word => {
      return !this.isStopWord(word) && word.length >= 3;
    });

    meaningfulWords.forEach(word => keywords.add(word));
    return Array.from(keywords);
  }

  /**
   * Check if word is a stop word (common words to ignore)
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'with', 'will', 'this', 'that', 'from',
      'they', 'has', 'have', 'can', 'your', 'you', 'our', 'all', 'about',
      'event', 'program', 'activity', 'time', 'day', 'week', 'month', 'year'
    ]);
    return stopWords.has(word);
  }

  /**
   * Analyze family preferences based on interaction history
   */
  async analyzeFamilyPreferences() {
    try {
      // Check cache first
      if (this.preferencesCache && this.cacheExpiry && new Date() < this.cacheExpiry) {
        return this.preferencesCache;
      }

      // Get all event interactions (from memory for now, database later)
      const interactions = Array.from(this.learningHistory.values());
      
      if (interactions.length === 0) {
        return this.getDefaultPreferences();
      }

      const approved = interactions.filter(i => i.interactionType === 'approved');
      const rejected = interactions.filter(i => i.interactionType === 'rejected');
      const registered = interactions.filter(i => i.interactionType === 'registered');

      const preferences = {
        totalInteractions: interactions.length,
        approvalRate: approved.length / interactions.length,
        registrationSuccessRate: registered.length / Math.max(approved.length, 1),
        
        // Category preferences (higher score = more preferred)
        categoryPreferences: this.calculateCategoryPreferences(approved, rejected),
        
        // Time preferences
        timePreferences: this.calculateTimePreferences(approved),
        
        // Source preferences
        sourcePreferences: this.calculateSourcePreferences(approved, rejected),
        
        // Cost sensitivity
        costPreferences: this.calculateCostPreferences(approved, rejected),
        
        // Keywords that correlate with approval
        positiveKeywords: this.calculateKeywordPreferences(approved, rejected, true),
        negativeKeywords: this.calculateKeywordPreferences(approved, rejected, false),
        
        // Learning confidence (how much data we have)
        learningConfidence: Math.min(interactions.length / 50, 1), // Max confidence at 50 interactions
        
        lastUpdated: new Date()
      };

      // Cache for 1 hour
      this.preferencesCache = preferences;
      this.cacheExpiry = new Date(Date.now() + 60 * 60 * 1000);

      this.logger.debug(`Analyzed family preferences: ${approved.length} approved, ${rejected.length} rejected, confidence: ${(preferences.learningConfidence * 100).toFixed(1)}%`);
      
      return preferences;

    } catch (error) {
      this.logger.error('Failed to analyze family preferences:', error.message);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Calculate category preferences based on approved/rejected events
   */
  calculateCategoryPreferences(approved, rejected) {
    const categoryScores = {};
    
    // Count category occurrences in approved events
    approved.forEach(interaction => {
      interaction.eventCategories.forEach(category => {
        categoryScores[category] = (categoryScores[category] || 0) + 2; // +2 for approval
      });
    });
    
    // Subtract for rejected events
    rejected.forEach(interaction => {
      interaction.eventCategories.forEach(category => {
        categoryScores[category] = (categoryScores[category] || 0) - 1; // -1 for rejection
      });
    });
    
    // Normalize scores to 0-1 scale
    const maxScore = Math.max(...Object.values(categoryScores), 1);
    const minScore = Math.min(...Object.values(categoryScores), 0);
    const range = maxScore - minScore || 1;
    
    Object.keys(categoryScores).forEach(category => {
      categoryScores[category] = Math.max(0, (categoryScores[category] - minScore) / range);
    });
    
    return categoryScores;
  }

  /**
   * Calculate time-based preferences
   */
  calculateTimePreferences(approved) {
    const timePrefs = {
      preferredHours: {},
      preferredDays: {},
      weekdayVsWeekend: { weekday: 0, weekend: 0 }
    };
    
    approved.forEach(interaction => {
      const eventDate = new Date(interaction.eventDate);
      const hour = eventDate.getHours();
      const day = eventDate.getDay();
      
      // Hour preferences
      timePrefs.preferredHours[hour] = (timePrefs.preferredHours[hour] || 0) + 1;
      
      // Day preferences
      timePrefs.preferredDays[day] = (timePrefs.preferredDays[day] || 0) + 1;
      
      // Weekday vs weekend
      if (day === 0 || day === 6) {
        timePrefs.weekdayVsWeekend.weekend++;
      } else {
        timePrefs.weekdayVsWeekend.weekday++;
      }
    });
    
    return timePrefs;
  }

  /**
   * Calculate source preferences
   */
  calculateSourcePreferences(approved, rejected) {
    const sourceScores = {};
    
    approved.forEach(interaction => {
      sourceScores[interaction.eventSource] = (sourceScores[interaction.eventSource] || 0) + 2;
    });
    
    rejected.forEach(interaction => {
      sourceScores[interaction.eventSource] = (sourceScores[interaction.eventSource] || 0) - 1;
    });
    
    return sourceScores;
  }

  /**
   * Calculate cost preferences
   */
  calculateCostPreferences(approved, rejected) {
    const approvedCosts = approved.map(i => i.eventCost);
    const rejectedCosts = rejected.map(i => i.eventCost);
    
    const freeApproved = approvedCosts.filter(cost => cost === 0).length;
    const paidApproved = approvedCosts.filter(cost => cost > 0).length;
    const freeRejected = rejectedCosts.filter(cost => cost === 0).length;
    const paidRejected = rejectedCosts.filter(cost => cost > 0).length;
    
    return {
      freeEventPreference: freeApproved / Math.max(freeApproved + freeRejected, 1),
      paidEventPreference: paidApproved / Math.max(paidApproved + paidRejected, 1),
      averageAcceptedCost: approvedCosts.length > 0 ? approvedCosts.reduce((a, b) => a + b, 0) / approvedCosts.length : 0,
      maxAcceptedCost: Math.max(...approvedCosts, 0)
    };
  }

  /**
   * Calculate keyword preferences
   */
  calculateKeywordPreferences(approved, rejected, positive = true) {
    const keywordScores = {};
    
    const targetEvents = positive ? approved : rejected;
    const oppositeEvents = positive ? rejected : approved;
    
    targetEvents.forEach(interaction => {
      interaction.eventKeywords.forEach(keyword => {
        keywordScores[keyword] = (keywordScores[keyword] || 0) + 1;
      });
    });
    
    oppositeEvents.forEach(interaction => {
      interaction.eventKeywords.forEach(keyword => {
        keywordScores[keyword] = (keywordScores[keyword] || 0) - 0.5;
      });
    });
    
    // Return top keywords
    return Object.entries(keywordScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .filter(([,score]) => score > 0)
      .map(([keyword]) => keyword);
  }

  /**
   * Get default preferences for new families
   */
  getDefaultPreferences() {
    return {
      totalInteractions: 0,
      approvalRate: 0.5,
      registrationSuccessRate: 0.8,
      categoryPreferences: {
        family: 0.8,
        free: 0.9,
        weekend: 0.7,
        educational: 0.6,
        outdoor: 0.6
      },
      timePreferences: {
        preferredHours: { 10: 3, 11: 3, 14: 2, 15: 2 },
        preferredDays: { 0: 2, 6: 3 }, // Sunday: 2, Saturday: 3
        weekdayVsWeekend: { weekday: 1, weekend: 3 }
      },
      sourcePreferences: {},
      costPreferences: {
        freeEventPreference: 0.9,
        paidEventPreference: 0.3,
        averageAcceptedCost: 0,
        maxAcceptedCost: 25
      },
      positiveKeywords: ['family', 'kids', 'fun', 'educational', 'interactive'],
      negativeKeywords: [],
      learningConfidence: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Predict family interest in an event based on learned preferences
   */
  async predictEventInterest(event) {
    try {
      const preferences = await this.analyzeFamilyPreferences();
      const categories = this.categorizeEvent(event);
      const keywords = this.extractEventKeywords(event);
      
      let score = 0.5; // Base score
      let confidence = preferences.learningConfidence;
      
      // Category-based scoring
      let categoryScore = 0;
      let categoryCount = 0;
      categories.forEach(category => {
        if (preferences.categoryPreferences[category] !== undefined) {
          categoryScore += preferences.categoryPreferences[category];
          categoryCount++;
        }
      });
      
      if (categoryCount > 0) {
        score += (categoryScore / categoryCount - 0.5) * 0.3; // Category influence: ±30%
      }
      
      // Keyword-based scoring
      let keywordBonus = 0;
      let keywordPenalty = 0;
      
      keywords.forEach(keyword => {
        if (preferences.positiveKeywords.includes(keyword)) {
          keywordBonus += 0.05; // +5% per positive keyword
        }
        if (preferences.negativeKeywords.includes(keyword)) {
          keywordPenalty += 0.05; // -5% per negative keyword
        }
      });
      
      score += keywordBonus - keywordPenalty;
      
      // Source-based scoring
      const sourceScore = preferences.sourcePreferences[event.source];
      if (sourceScore !== undefined) {
        const normalizedSourceScore = Math.max(-1, Math.min(1, sourceScore / 10)); // Normalize to ±1
        score += normalizedSourceScore * 0.1; // Source influence: ±10%
      }
      
      // Cost-based scoring
      if (event.cost === 0) {
        score += (preferences.costPreferences.freeEventPreference - 0.5) * 0.2; // Free event bonus/penalty
      } else if (event.cost > preferences.costPreferences.maxAcceptedCost) {
        score -= 0.3; // Heavy penalty for events above max accepted cost
      }
      
      // Time-based scoring
      const eventDate = new Date(event.date);
      const hour = eventDate.getHours();
      const day = eventDate.getDay();
      
      const hourPreference = preferences.timePreferences.preferredHours[hour] || 0;
      const dayPreference = preferences.timePreferences.preferredDays[day] || 0;
      
      if (hourPreference > 0) score += 0.05; // Small bonus for preferred times
      if (dayPreference > 0) score += 0.05; // Small bonus for preferred days
      
      // Clamp score to 0-1 range
      score = Math.max(0, Math.min(1, score));
      
      return {
        score: score,
        confidence: confidence,
        reasoning: this.generateReasoningExplanation(score, categories, keywords, preferences),
        categories: categories
      };
      
    } catch (error) {
      this.logger.error('Failed to predict event interest:', error.message);
      return { score: 0.5, confidence: 0, reasoning: 'Prediction failed', categories: [] };
    }
  }

  /**
   * Generate human-readable explanation for prediction
   */
  generateReasoningExplanation(score, categories, keywords, preferences) {
    const reasons = [];
    
    if (score > 0.7) {
      reasons.push('Strong match based on family preferences');
    } else if (score > 0.5) {
      reasons.push('Good match for family interests');
    } else if (score > 0.3) {
      reasons.push('Moderate interest expected');
    } else {
      reasons.push('Lower interest based on past preferences');
    }
    
    // Add specific category reasons
    const preferredCategories = Object.entries(preferences.categoryPreferences)
      .filter(([,score]) => score > 0.6)
      .map(([category]) => category);
    
    const matchingPreferred = categories.filter(cat => preferredCategories.includes(cat));
    if (matchingPreferred.length > 0) {
      reasons.push(`Matches preferred categories: ${matchingPreferred.join(', ')}`);
    }
    
    return reasons.join('; ');
  }

  /**
   * Get personalized event recommendations
   */
  async getEventRecommendations(events, limit = 10) {
    try {
      const predictions = await Promise.all(
        events.map(async event => ({
          event: event,
          prediction: await this.predictEventInterest(event)
        }))
      );
      
      return predictions
        .sort((a, b) => b.prediction.score - a.prediction.score)
        .slice(0, limit)
        .map(({ event, prediction }) => ({
          ...event,
          interestScore: prediction.score,
          confidence: prediction.confidence,
          reasoning: prediction.reasoning
        }));
        
    } catch (error) {
      this.logger.error('Failed to get event recommendations:', error.message);
      return events.slice(0, limit);
    }
  }

  /**
   * Invalidate preferences cache
   */
  invalidatePreferencesCache() {
    this.preferencesCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    const interactions = Array.from(this.learningHistory.values());
    const approved = interactions.filter(i => i.interactionType === 'approved');
    const rejected = interactions.filter(i => i.interactionType === 'rejected');
    const registered = interactions.filter(i => i.interactionType === 'registered');
    
    return {
      totalInteractions: interactions.length,
      approvedEvents: approved.length,
      rejectedEvents: rejected.length,
      registeredEvents: registered.length,
      approvalRate: interactions.length > 0 ? approved.length / interactions.length : 0,
      registrationRate: approved.length > 0 ? registered.length / approved.length : 0,
      learningConfidence: Math.min(interactions.length / 50, 1),
      cacheStatus: this.preferencesCache ? 'cached' : 'expired'
    };
  }
}

module.exports = FamilyPreferenceLearning;