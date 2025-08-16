const { config } = require('../config');

class EventFilter {
  constructor(logger) {
    this.logger = logger;
  }

  filterEvents(events) {
    const filtered = events.filter(event => {
      return this.isAgeAppropriate(event) &&
             this.isWithinTimeRange(event) &&
             this.isScheduleCompatible(event) &&
             this.isWithinBudget(event) &&
             this.hasAvailableCapacity(event) &&
             this.isNotPreviouslyAttended(event);
    });

    this.logger.info(`Filtered ${events.length} events down to ${filtered.length} suitable events`);
    return filtered;
  }

  isAgeAppropriate(event) {
    const { minChildAge, maxChildAge } = config.preferences;
    
    if (!event.ageRange || (!event.ageRange.min && !event.ageRange.max)) {
      return true;
    }

    const eventMinAge = event.ageRange.min || 0;
    const eventMaxAge = event.ageRange.max || 18;

    const isAppropriate = eventMinAge <= maxChildAge && eventMaxAge >= minChildAge;
    
    if (!isAppropriate) {
      this.logger.debug(`Event filtered - age range: ${event.title} (${eventMinAge}-${eventMaxAge} vs ${minChildAge}-${maxChildAge})`);
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
    
    for (const event of events) {
      try {
        const hasConflict = await calendarChecker.hasConflict(event.date);
        if (!hasConflict) {
          filtered.push(event);
        } else {
          this.logger.debug(`Event filtered - calendar conflict: ${event.title} on ${event.date}`);
        }
      } catch (error) {
        this.logger.warn(`Error checking calendar for event ${event.title}:`, error.message);
        filtered.push(event);
      }
    }
    
    this.logger.info(`Calendar conflict check: ${events.length} events -> ${filtered.length} events`);
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
    let filtered = this.filterEvents(events);
    
    if (options.calendarChecker) {
      filtered = await this.filterByCalendarConflicts(filtered, options.calendarChecker);
    }
    
    if (options.database) {
      filtered = this.filterByNovelty(filtered, options.database);
    }
    
    if (options.prioritizeUrgent) {
      filtered = this.prioritizeUrgentEvents(filtered);
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
}

module.exports = EventFilter;