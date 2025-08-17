class PreferenceLearningService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
  }

  async recordEventInteraction(eventId, interactionType, metadata = {}) {
    try {
      // Record interaction in database
      await this.database.recordEventInteraction(eventId, interactionType, metadata);
      
      this.logger.debug(`Recorded ${interactionType} for event ${eventId}`);
    } catch (error) {
      this.logger.error('Error recording event interaction:', error.message);
    }
  }

  async getEventPreferenceScore(event) {
    try {
      const preferences = await this.analyzePreferences();
      return this.calculatePreferenceScore(event, preferences);
    } catch (error) {
      this.logger.error('Error calculating preference score:', error.message);
      return 50; // Neutral score
    }
  }

  async analyzePreferences() {
    try {
      const interactions = await this.database.getEventInteractions();
      
      const analysis = {
        preferredVenues: this.analyzeVenuePreferences(interactions),
        preferredEventTypes: this.analyzeEventTypePreferences(interactions),
        preferredTimes: this.analyzeTimePreferences(interactions),
        preferredCosts: this.analyzeCostPreferences(interactions),
        preferredAgeRanges: this.analyzeAgeRangePreferences(interactions),
        avoidedKeywords: this.analyzeAvoidedKeywords(interactions),
        seasonalPreferences: this.analyzeSeasonalPreferences(interactions)
      };

      this.logger.debug('Preference analysis completed', analysis);
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing preferences:', error.message);
      return this.getDefaultPreferences();
    }
  }

  analyzeVenuePreferences(interactions) {
    const venueScores = {};
    
    interactions.forEach(interaction => {
      const venue = this.extractVenue(interaction.event);
      if (!venueScores[venue]) {
        venueScores[venue] = { positive: 0, negative: 0, total: 0 };
      }
      
      venueScores[venue].total++;
      
      if (['attended', 'approved', 'registered'].includes(interaction.type)) {
        venueScores[venue].positive++;
      } else if (['rejected', 'cancelled'].includes(interaction.type)) {
        venueScores[venue].negative++;
      }
    });

    // Calculate preference scores for venues
    const preferences = {};
    Object.entries(venueScores).forEach(([venue, scores]) => {
      if (scores.total >= 2) { // Only consider venues with multiple interactions
        preferences[venue] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  analyzeEventTypePreferences(interactions) {
    const typeScores = {};
    
    interactions.forEach(interaction => {
      const types = this.categorizeEvent(interaction.event);
      
      types.forEach(type => {
        if (!typeScores[type]) {
          typeScores[type] = { positive: 0, negative: 0, total: 0 };
        }
        
        typeScores[type].total++;
        
        if (['attended', 'approved', 'registered'].includes(interaction.type)) {
          typeScores[type].positive++;
        } else if (['rejected', 'cancelled'].includes(interaction.type)) {
          typeScores[type].negative++;
        }
      });
    });

    const preferences = {};
    Object.entries(typeScores).forEach(([type, scores]) => {
      if (scores.total >= 2) {
        preferences[type] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  analyzeTimePreferences(interactions) {
    const timeSlots = {
      'morning': { positive: 0, negative: 0, total: 0 },
      'afternoon': { positive: 0, negative: 0, total: 0 },
      'evening': { positive: 0, negative: 0, total: 0 },
      'weekend': { positive: 0, negative: 0, total: 0 },
      'weekday': { positive: 0, negative: 0, total: 0 }
    };

    interactions.forEach(interaction => {
      const eventDate = new Date(interaction.event.date);
      const hour = eventDate.getHours();
      const isWeekend = eventDate.getDay() === 0 || eventDate.getDay() === 6;
      
      let timeSlot;
      if (hour < 12) timeSlot = 'morning';
      else if (hour < 17) timeSlot = 'afternoon';
      else timeSlot = 'evening';
      
      const dayType = isWeekend ? 'weekend' : 'weekday';
      
      [timeSlot, dayType].forEach(slot => {
        timeSlots[slot].total++;
        
        if (['attended', 'approved', 'registered'].includes(interaction.type)) {
          timeSlots[slot].positive++;
        } else if (['rejected', 'cancelled'].includes(interaction.type)) {
          timeSlots[slot].negative++;
        }
      });
    });

    const preferences = {};
    Object.entries(timeSlots).forEach(([slot, scores]) => {
      if (scores.total >= 2) {
        preferences[slot] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  analyzeCostPreferences(interactions) {
    const costRanges = {
      'free': { positive: 0, negative: 0, total: 0 },
      'low': { positive: 0, negative: 0, total: 0 },    // $1-25
      'medium': { positive: 0, negative: 0, total: 0 }, // $26-60
      'high': { positive: 0, negative: 0, total: 0 }    // $61+
    };

    interactions.forEach(interaction => {
      const cost = interaction.event.cost || 0;
      let range;
      
      if (cost === 0) range = 'free';
      else if (cost <= 25) range = 'low';
      else if (cost <= 60) range = 'medium';
      else range = 'high';
      
      costRanges[range].total++;
      
      if (['attended', 'approved', 'registered'].includes(interaction.type)) {
        costRanges[range].positive++;
      } else if (['rejected', 'cancelled'].includes(interaction.type)) {
        costRanges[range].negative++;
      }
    });

    const preferences = {};
    Object.entries(costRanges).forEach(([range, scores]) => {
      if (scores.total >= 2) {
        preferences[range] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  analyzeAgeRangePreferences(interactions) {
    const agePreferences = {
      'toddler': { positive: 0, negative: 0, total: 0 },    // 0-3
      'preschool': { positive: 0, negative: 0, total: 0 },  // 3-5
      'school': { positive: 0, negative: 0, total: 0 },     // 5-12
      'family': { positive: 0, negative: 0, total: 0 }      // All ages
    };

    interactions.forEach(interaction => {
      const ageRange = interaction.event.ageRange || { min: 0, max: 18 };
      
      let category;
      if (ageRange.max <= 3) category = 'toddler';
      else if (ageRange.max <= 5) category = 'preschool';
      else if (ageRange.max <= 12) category = 'school';
      else category = 'family';
      
      agePreferences[category].total++;
      
      if (['attended', 'approved', 'registered'].includes(interaction.type)) {
        agePreferences[category].positive++;
      } else if (['rejected', 'cancelled'].includes(interaction.type)) {
        agePreferences[category].negative++;
      }
    });

    const preferences = {};
    Object.entries(agePreferences).forEach(([category, scores]) => {
      if (scores.total >= 2) {
        preferences[category] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  analyzeAvoidedKeywords(interactions) {
    const rejectedEvents = interactions.filter(i => 
      ['rejected', 'cancelled'].includes(i.type)
    );

    const keywordCounts = {};
    
    rejectedEvents.forEach(interaction => {
      const text = (interaction.event.title + ' ' + interaction.event.description).toLowerCase();
      const words = text.split(/\s+/).filter(word => word.length > 3);
      
      words.forEach(word => {
        keywordCounts[word] = (keywordCounts[word] || 0) + 1;
      });
    });

    // Return keywords that appear in multiple rejected events
    return Object.entries(keywordCounts)
      .filter(([word, count]) => count >= 2)
      .map(([word]) => word);
  }

  analyzeSeasonalPreferences(interactions) {
    const seasons = {
      'spring': { positive: 0, negative: 0, total: 0 },
      'summer': { positive: 0, negative: 0, total: 0 },
      'fall': { positive: 0, negative: 0, total: 0 },
      'winter': { positive: 0, negative: 0, total: 0 }
    };

    interactions.forEach(interaction => {
      const month = new Date(interaction.event.date).getMonth();
      let season;
      
      if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer';
      else if (month >= 8 && month <= 10) season = 'fall';
      else season = 'winter';
      
      seasons[season].total++;
      
      if (['attended', 'approved', 'registered'].includes(interaction.type)) {
        seasons[season].positive++;
      } else if (['rejected', 'cancelled'].includes(interaction.type)) {
        seasons[season].negative++;
      }
    });

    const preferences = {};
    Object.entries(seasons).forEach(([season, scores]) => {
      if (scores.total >= 2) {
        preferences[season] = (scores.positive - scores.negative) / scores.total;
      }
    });

    return preferences;
  }

  calculatePreferenceScore(event, preferences) {
    let score = 50; // Start with neutral score
    
    // Venue preference
    const venue = this.extractVenue(event);
    if (preferences.preferredVenues[venue] !== undefined) {
      score += preferences.preferredVenues[venue] * 20;
    }

    // Event type preferences
    const eventTypes = this.categorizeEvent(event);
    eventTypes.forEach(type => {
      if (preferences.preferredEventTypes[type] !== undefined) {
        score += preferences.preferredEventTypes[type] * 15;
      }
    });

    // Time preferences
    const eventDate = new Date(event.date);
    const hour = eventDate.getHours();
    const isWeekend = eventDate.getDay() === 0 || eventDate.getDay() === 6;
    
    let timeSlot;
    if (hour < 12) timeSlot = 'morning';
    else if (hour < 17) timeSlot = 'afternoon';
    else timeSlot = 'evening';
    
    if (preferences.preferredTimes[timeSlot] !== undefined) {
      score += preferences.preferredTimes[timeSlot] * 10;
    }
    
    const dayType = isWeekend ? 'weekend' : 'weekday';
    if (preferences.preferredTimes[dayType] !== undefined) {
      score += preferences.preferredTimes[dayType] * 10;
    }

    // Cost preferences
    const cost = event.cost || 0;
    let costRange;
    if (cost === 0) costRange = 'free';
    else if (cost <= 25) costRange = 'low';
    else if (cost <= 60) costRange = 'medium';
    else costRange = 'high';
    
    if (preferences.preferredCosts[costRange] !== undefined) {
      score += preferences.preferredCosts[costRange] * 15;
    }

    // Avoided keywords penalty
    const eventText = (event.title + ' ' + event.description).toLowerCase();
    preferences.avoidedKeywords.forEach(keyword => {
      if (eventText.includes(keyword)) {
        score -= 20;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  extractVenue(event) {
    if (!event.location?.address) return 'unknown';
    
    const address = event.location.address.toLowerCase();
    
    if (address.includes('library')) return 'SF Library';
    if (address.includes('academy')) return 'Cal Academy';
    if (address.includes('chase center')) return 'Chase Center';
    if (address.includes('rec') || address.includes('park')) return 'SF Rec & Parks';
    
    return address.split(',')[0]; // First part of address
  }

  categorizeEvent(event) {
    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const text = title + ' ' + description;
    
    const categories = [];
    
    if (text.match(/story|read|book/)) categories.push('storytime');
    if (text.match(/music|sing|song|concert/)) categories.push('music');
    if (text.match(/art|craft|create|draw|paint/)) categories.push('arts');
    if (text.match(/science|experiment|discover|learn/)) categories.push('science');
    if (text.match(/animal|zoo|pet|wildlife/)) categories.push('animals');
    if (text.match(/sport|game|play|active|run/)) categories.push('sports');
    if (text.match(/outdoor|park|garden|nature/)) categories.push('outdoor');
    if (text.match(/theater|show|performance/)) categories.push('performance');
    if (text.match(/food|cook|eat|kitchen/)) categories.push('food');
    
    return categories.length > 0 ? categories : ['general'];
  }

  getDefaultPreferences() {
    return {
      preferredVenues: {},
      preferredEventTypes: {},
      preferredTimes: {},
      preferredCosts: { 'free': 0.3, 'low': 0.2 }, // Slight preference for free/low cost
      preferredAgeRanges: {},
      avoidedKeywords: [],
      seasonalPreferences: {}
    };
  }
}

module.exports = PreferenceLearningService;