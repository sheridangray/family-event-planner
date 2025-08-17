const { config } = require('../config');
const WeatherService = require('../services/weather');
const PreferenceLearningService = require('../services/preference-learning');
const FamilyDemographicsService = require('../services/family-demographics');

class EventFilter {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.weatherService = new WeatherService(logger);
    this.preferenceLearning = new PreferenceLearningService(logger, database);
    this.familyService = new FamilyDemographicsService(logger, database);
  }

  async filterEvents(events) {
    const filtered = [];
    
    // Get current family demographics for age checking
    const familyDemographics = await this.familyService.getFamilyDemographics();
    
    for (const event of events) {
      if (this.isAgeAppropriate(event, familyDemographics) &&
          this.isWithinTimeRange(event) &&
          this.isScheduleCompatible(event) &&
          this.isWithinBudget(event) &&
          this.hasAvailableCapacity(event) &&
          this.isNotPreviouslyAttended(event) &&
          await this.isWeatherSuitable(event)) {
        filtered.push(event);
      }
    }

    this.logger.info(`Filtered ${events.length} events down to ${filtered.length} suitable events (${familyDemographics.children.length} children: ages ${familyDemographics.childAges.join(', ')})`);
    return filtered;
  }

  isAgeAppropriate(event, familyDemographics) {
    if (!event.ageRange || (!event.ageRange.min && !event.ageRange.max)) {
      return true; // No age restrictions
    }

    const eventMinAge = event.ageRange.min || 0;
    const eventMaxAge = event.ageRange.max || 18;

    // Check if any child fits in the event age range
    const isAppropriate = familyDemographics.children.some(child => {
      return child.currentAge >= eventMinAge && child.currentAge <= eventMaxAge;
    });
    
    if (!isAppropriate) {
      const childAges = familyDemographics.childAges.join(', ');
      this.logger.debug(`Event filtered - age range: ${event.title} (${eventMinAge}-${eventMaxAge} vs children ages ${childAges})`);
    }
    
    return isAppropriate;
  }

  isWithinTimeRange(event) {
    const now = new Date();
    const eventDate = new Date(event.date);
    
    const minAdvanceMs = config.preferences.minAdvanceWeeks * 7 * 24 * 60 * 60 * 1000;
    const maxAdvanceMs = config.preferences.maxAdvanceMonths * 30 * 24 * 60 * 60 * 1000;
    
    const timeDiff = eventDate.getTime() - now.getTime();
    
    const isInRange = timeDiff >= minAdvanceMs && timeDiff <= maxAdvanceMs;
    
    if (!isInRange) {
      const weeksAway = Math.round(timeDiff / (7 * 24 * 60 * 60 * 1000));
      this.logger.debug(`Event filtered - timing: ${event.title} (${weeksAway} weeks away)`);
    }
    
    return isInRange;
  }

  isScheduleCompatible(event) {
    const eventDate = new Date(event.date);
    const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday
    const eventTime = eventDate.toTimeString().substr(0, 5); // HH:MM format
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) {
      return this.isWeekendCompatible(eventDate, eventTime);
    } else {
      return this.isWeekdayCompatible(eventTime);
    }
  }

  isWeekdayCompatible(eventTime) {
    const earliestTime = config.schedule.weekdayEarliestTime;
    const isCompatible = eventTime >= earliestTime;
    
    if (!isCompatible) {
      this.logger.debug(`Event filtered - weekday schedule: event at ${eventTime}, earliest allowed ${earliestTime}`);
    }
    
    return isCompatible;
  }

  isWeekendCompatible(eventDate, eventTime) {
    const napStart = config.schedule.weekendNapStart;
    const napEnd = config.schedule.weekendNapEnd;
    const earliestTime = config.schedule.weekendEarliestTime;
    
    if (eventTime < earliestTime) {
      this.logger.debug(`Event filtered - weekend too early: event at ${eventTime}, earliest allowed ${earliestTime}`);
      return false;
    }

    if (eventTime >= napStart && eventTime <= napEnd) {
      this.logger.debug(`Event filtered - conflicts with nap time: event at ${eventTime} (nap ${napStart}-${napEnd})`);
      return false;
    }
    
    return true;
  }

  isWithinBudget(event) {
    const maxCost = config.preferences.maxCostPerEvent;
    const isAffordable = event.cost <= maxCost;
    
    if (!isAffordable) {
      this.logger.debug(`Event filtered - cost: ${event.title} costs $${event.cost}, max budget $${maxCost}`);
    }
    
    return isAffordable;
  }

  hasAvailableCapacity(event) {
    if (!event.currentCapacity || typeof event.currentCapacity.available !== 'number') {
      return true;
    }
    
    const hasCapacity = event.currentCapacity.available > 0;
    
    if (!hasCapacity) {
      this.logger.debug(`Event filtered - no capacity: ${event.title}`);
    }
    
    return hasCapacity;
  }

  isNotPreviouslyAttended(event) {
    const notAttended = !event.previouslyAttended;
    
    if (!notAttended) {
      this.logger.debug(`Event filtered - previously attended: ${event.title}`);
    }
    
    return notAttended;
  }

  async filterByCalendarConflicts(events, calendarChecker) {
    const filtered = [];
    let blockedCount = 0;
    let warningCount = 0;
    
    for (const event of events) {
      try {
        // Get detailed conflict information
        const conflictDetails = await calendarChecker.getConflictDetails(event.date);
        
        if (!conflictDetails.hasConflict) {
          // Check for warnings (Sheridan's conflicts)
          if (conflictDetails.hasWarning) {
            this.logger.warn(`⚠️  Event has calendar warning: ${event.title} on ${event.date} (Sheridan's calendar conflict)`);
            warningCount++;
          }
          filtered.push(event);
        } else {
          // Joyce's calendar has conflict - block the event
          this.logger.info(`❌ Event filtered - Joyce's calendar conflict: ${event.title} on ${event.date}`);
          blockedCount++;
        }
      } catch (error) {
        this.logger.warn(`Error checking calendar for event ${event.title}:`, error.message);
        filtered.push(event);
      }
    }
    
    this.logger.info(`Calendar conflict check: ${events.length} events -> ${filtered.length} events (${blockedCount} blocked by Joyce's calendar, ${warningCount} warnings from Sheridan's calendar)`);
    return filtered;
  }

  filterByNovelty(events, database) {
    return events.filter(event => {
      const isNovel = !event.previouslyAttended && !event.isRecurring;
      
      if (!isNovel) {
        this.logger.debug(`Event filtered - not novel: ${event.title}`);
      }
      
      return isNovel;
    });
  }

  async filterAndSort(events, options = {}) {
    let filtered = await this.filterEvents(events);
    
    if (options.calendarChecker) {
      filtered = await this.filterByCalendarConflicts(filtered, options.calendarChecker);
    }
    
    if (options.database) {
      filtered = this.filterByNovelty(filtered, options.database);
    }
    
    // Add preference scoring to all filtered events
    filtered = await this.addPreferenceScores(filtered);
    
    if (options.prioritizeUrgent) {
      filtered = this.prioritizeUrgentEvents(filtered);
    } else {
      // Sort by preference score if not prioritizing urgent events
      filtered = this.sortByPreferenceScore(filtered);
    }
    
    return filtered;
  }

  prioritizeUrgentEvents(events) {
    return events.sort((a, b) => {
      const aUrgent = this.isUrgentEvent(a);
      const bUrgent = this.isUrgentEvent(b);
      
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      
      return new Date(a.date) - new Date(b.date);
    });
  }

  isUrgentEvent(event) {
    if (event.registrationOpens) {
      const now = new Date();
      const regOpens = new Date(event.registrationOpens);
      const timeDiff = regOpens.getTime() - now.getTime();
      const hoursUntilOpen = timeDiff / (1000 * 60 * 60);
      
      return hoursUntilOpen <= 24 && hoursUntilOpen > 0;
    }
    
    if (event.currentCapacity && event.currentCapacity.total) {
      const capacityRatio = event.currentCapacity.available / event.currentCapacity.total;
      return capacityRatio <= 0.2;
    }
    
    return false;
  }

  async isWeatherSuitable(event) {
    try {
      // Only check weather for outdoor events
      if (!this.weatherService.isEventOutdoor(event)) {
        return true;
      }

      const eventDate = new Date(event.date);
      const weather = await this.weatherService.getWeatherForecast(eventDate);
      
      // Cache weather data in database
      if (this.database) {
        await this.database.cacheWeatherData(
          'San Francisco, CA',
          eventDate.toISOString().split('T')[0],
          weather
        );
      }

      const isSuitable = weather.isOutdoorFriendly;
      
      if (!isSuitable) {
        this.logger.debug(`Event filtered - weather: ${event.title} on ${eventDate.toDateString()} (${weather.condition}, ${weather.temperature}°F)`);
      }
      
      return isSuitable;
    } catch (error) {
      this.logger.warn(`Error checking weather for event ${event.title}:`, error.message);
      return true; // Default to allowing the event if weather check fails
    }
  }

  async addPreferenceScores(events) {
    const scoredEvents = [];
    
    for (const event of events) {
      try {
        const preferenceScore = await this.preferenceLearning.getEventPreferenceScore(event);
        event.preferenceScore = preferenceScore;
        scoredEvents.push(event);
        
        this.logger.debug(`Event preference score: ${event.title} = ${preferenceScore}`);
      } catch (error) {
        this.logger.warn(`Error calculating preference score for ${event.title}:`, error.message);
        event.preferenceScore = 50; // Neutral score
        scoredEvents.push(event);
      }
    }
    
    return scoredEvents;
  }

  sortByPreferenceScore(events) {
    return events.sort((a, b) => {
      // Sort by preference score (higher is better), then by date
      if (b.preferenceScore !== a.preferenceScore) {
        return b.preferenceScore - a.preferenceScore;
      }
      return new Date(a.date) - new Date(b.date);
    });
  }

  async recordEventInteraction(eventId, interactionType, metadata = {}) {
    try {
      await this.preferenceLearning.recordEventInteraction(eventId, interactionType, metadata);
    } catch (error) {
      this.logger.error(`Error recording event interaction:`, error.message);
    }
  }
}

module.exports = EventFilter;