const { config } = require('../config');

class EventScorer {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    
    this.weights = {
      novelty: 0.35,
      urgency: 0.25, 
      social: 0.20,
      match: 0.15,
      cost: 0.05
    };
  }

  async scoreEvents(events) {
    const scoredEvents = [];
    
    for (const event of events) {
      try {
        const scores = await this.calculateEventScore(event);
        await this.database.saveEventScore(event.id, scores);
        
        event.scoreFactors = scores;
        scoredEvents.push(event);
        
        this.logger.debug(`Scored event ${event.title}: ${scores.totalScore.toFixed(2)}`);
      } catch (error) {
        this.logger.error(`Error scoring event ${event.title}:`, error.message);
        scoredEvents.push(event);
      }
    }
    
    scoredEvents.sort((a, b) => {
      const aScore = a.scoreFactors?.totalScore || 0;
      const bScore = b.scoreFactors?.totalScore || 0;
      return bScore - aScore;
    });
    
    this.logger.info(`Scored and ranked ${scoredEvents.length} events`);
    return scoredEvents;
  }

  async calculateEventScore(event) {
    const noveltyScore = await this.calculateNoveltyScore(event);
    const urgencyScore = this.calculateUrgencyScore(event);
    const socialScore = this.calculateSocialScore(event);
    const matchScore = this.calculateMatchScore(event);
    const costScore = this.calculateCostScore(event);
    
    const totalScore = (
      noveltyScore * this.weights.novelty +
      urgencyScore * this.weights.urgency +
      socialScore * this.weights.social +
      matchScore * this.weights.match +
      costScore * this.weights.cost
    );
    
    return {
      noveltyScore,
      urgencyScore,
      socialScore,
      matchScore,
      totalScore: Math.min(100, Math.max(0, totalScore))
    };
  }

  async calculateNoveltyScore(event) {
    try {
      const isVenueVisited = await this.database.isVenueVisited(this.extractVenueName(event));
      
      if (isVenueVisited) {
        return 20;
      }
      
      if (event.isRecurring) {
        return 40;
      }
      
      if (this.isSpecialEvent(event)) {
        return 95;
      }
      
      if (this.isSeasonalEvent(event)) {
        return 85;
      }
      
      return 75;
      
    } catch (error) {
      this.logger.warn(`Error calculating novelty score for ${event.title}:`, error.message);
      return 50;
    }
  }

  calculateUrgencyScore(event) {
    let score = 50;
    
    if (event.registrationOpens) {
      const now = new Date();
      const regOpens = new Date(event.registrationOpens);
      const timeDiff = regOpens.getTime() - now.getTime();
      const hoursUntilOpen = timeDiff / (1000 * 60 * 60);
      
      if (hoursUntilOpen <= 2) {
        score = 100;
      } else if (hoursUntilOpen <= 24) {
        score = 90;
      } else if (hoursUntilOpen <= 72) {
        score = 70;
      }
    }
    
    if (event.currentCapacity && event.currentCapacity.total) {
      const available = event.currentCapacity.available;
      const total = event.currentCapacity.total;
      const capacityRatio = available / total;
      
      if (capacityRatio <= 0.1) {
        score = Math.max(score, 95);
      } else if (capacityRatio <= 0.3) {
        score = Math.max(score, 80);
      } else if (capacityRatio <= 0.5) {
        score = Math.max(score, 65);
      }
    }
    
    const eventDate = new Date(event.date);
    const now = new Date();
    const daysUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilEvent <= 7) {
      score = Math.max(score, 85);
    } else if (daysUntilEvent <= 14) {
      score = Math.max(score, 70);
    }
    
    return score;
  }

  calculateSocialScore(event) {
    let score = 50;
    
    if (event.socialProof) {
      if (event.socialProof.yelpRating && event.socialProof.yelpRating >= 4.5) {
        score += 20;
      } else if (event.socialProof.yelpRating && event.socialProof.yelpRating >= 4.0) {
        score += 10;
      }
      
      if (event.socialProof.googleRating && event.socialProof.googleRating >= 4.5) {
        score += 15;
      } else if (event.socialProof.googleRating && event.socialProof.googleRating >= 4.0) {
        score += 8;
      }
      
      if (event.socialProof.instagramPosts && event.socialProof.instagramPosts.length > 0) {
        score += Math.min(25, event.socialProof.instagramPosts.length * 5);
      }
      
      if (event.socialProof.influencerMentions && event.socialProof.influencerMentions.length > 0) {
        score += 30;
      }
    }
    
    if (this.hasTrendingKeywords(event)) {
      score += 15;
    }
    
    return Math.min(100, score);
  }

  calculateMatchScore(event) {
    let score = 50;
    
    const { minChildAge, maxChildAge } = config.preferences;
    if (event.ageRange) {
      const overlapStart = Math.max(event.ageRange.min || 0, minChildAge);
      const overlapEnd = Math.min(event.ageRange.max || 18, maxChildAge);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const childAgeRange = maxChildAge - minChildAge;
      const overlapRatio = overlap / childAgeRange;
      
      score += overlapRatio * 30;
    }
    
    const eventDate = new Date(event.date);
    const dayOfWeek = eventDate.getDay();
    const hour = eventDate.getHours();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (hour >= 9 && hour <= 11) {
        score += 20;
      } else if (hour >= 14 && hour <= 16) {
        score += 15;
      }
    } else {
      if (hour >= 16) {
        score += 10;
      }
    }
    
    if (this.hasPreferredActivities(event)) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  calculateCostScore(event) {
    const cost = event.cost || 0;
    
    if (cost === 0) {
      return 100;
    }
    
    const maxCost = config.preferences.maxCostPerEvent;
    const costRatio = cost / maxCost;
    
    if (costRatio <= 0.25) {
      return 90;
    } else if (costRatio <= 0.5) {
      return 75;
    } else if (costRatio <= 0.75) {
      return 60;
    } else {
      return 40;
    }
  }

  extractVenueName(event) {
    if (event.location && event.location.address) {
      const address = event.location.address;
      const parts = address.split(',');
      return parts[0].trim();
    }
    
    const title = event.title.toLowerCase();
    if (title.includes(' at ')) {
      const parts = title.split(' at ');
      return parts[parts.length - 1].trim();
    }
    
    return 'Unknown Venue';
  }

  isSpecialEvent(event) {
    const text = (event.title + ' ' + event.description).toLowerCase();
    const specialKeywords = [
      'grand opening', 'new', 'first time', 'inaugural', 'launch',
      'pop-up', 'limited time', 'exclusive', 'special edition',
      'festival', 'celebration', 'anniversary'
    ];
    
    return specialKeywords.some(keyword => text.includes(keyword));
  }

  isSeasonalEvent(event) {
    const text = (event.title + ' ' + event.description).toLowerCase();
    const now = new Date();
    const month = now.getMonth();
    
    const seasonalKeywords = {
      winter: ['holiday', 'christmas', 'winter', 'snow', 'ice'],
      spring: ['spring', 'easter', 'garden', 'bloom', 'flower'],
      summer: ['summer', 'beach', 'outdoor', 'picnic', 'water'],
      fall: ['fall', 'autumn', 'halloween', 'harvest', 'pumpkin']
    };
    
    let currentSeason;
    if (month >= 11 || month <= 1) currentSeason = 'winter';
    else if (month >= 2 && month <= 4) currentSeason = 'spring';
    else if (month >= 5 && month <= 7) currentSeason = 'summer';
    else currentSeason = 'fall';
    
    return seasonalKeywords[currentSeason].some(keyword => text.includes(keyword));
  }

  hasTrendingKeywords(event) {
    const text = (event.title + ' ' + event.description).toLowerCase();
    const trendingKeywords = [
      'viral', 'trending', 'popular', 'instagram', 'tiktok',
      'interactive', 'immersive', 'experience', 'sensory'
    ];
    
    return trendingKeywords.some(keyword => text.includes(keyword));
  }

  hasPreferredActivities(event) {
    const text = (event.title + ' ' + event.description).toLowerCase();
    const preferredKeywords = [
      'story time', 'craft', 'art', 'music', 'nature', 'animals',
      'playground', 'outdoor', 'hands-on', 'interactive', 'educational',
      'toddler', 'preschool', 'family friendly'
    ];
    
    return preferredKeywords.some(keyword => text.includes(keyword));
  }

  async getTopScoredEvents(limit = 20) {
    try {
      const events = await this.database.getEventsByStatus('discovered');
      const scoredEvents = await this.scoreEvents(events);
      return scoredEvents.slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting top scored events:', error.message);
      return [];
    }
  }
}

module.exports = EventScorer;