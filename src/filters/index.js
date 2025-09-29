const { config } = require("../config");
const WeatherService = require("../services/weather");
const PreferenceLearningService = require("../services/preference-learning");
const FamilyDemographicsService = require("../services/family-demographics");
const FamilyConfigService = require("../services/family-config");
const LLMAgeEvaluator = require("../services/llm-age-evaluator");

class EventFilter {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.weatherService = new WeatherService(logger, database);
    this.preferenceLearning = new PreferenceLearningService(logger, database);
    this.familyService = new FamilyDemographicsService(logger, database);
    this.familyConfig = new FamilyConfigService(database, logger);
    this.configCache = null;
    this.configCacheExpiry = null;

    // Initialize LLM age evaluator if Together.ai API key is available
    this.llmEvaluator = null;
    try {
      this.llmEvaluator = new LLMAgeEvaluator(logger);
      this.logger.info(
        "LLM age evaluator initialized - will use AI for age appropriateness"
      );
    } catch (error) {
      this.logger.warn(
        "LLM age evaluator not available, falling back to rule-based filtering:",
        error.message
      );
    }
  }

  /**
   * Get configuration from database with caching
   */
  async getConfig() {
    // Check cache first (5 minute TTL)
    if (this.configCache && this.configCacheExpiry && Date.now() < this.configCacheExpiry) {
      return this.configCache;
    }

    try {
      const dbConfig = await this.familyConfig.getFamilyConfig();
      this.configCache = dbConfig;
      this.configCacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
      
      this.logger.debug('Loaded filter configuration from database');
      return dbConfig;
    } catch (error) {
      this.logger.warn('Failed to load config from database, using environment fallback:', error.message);
      return config;
    }
  }

  async evaluateAllEvents(events) {
    // This method evaluates filters for all events and attaches results,
    // but returns all events (not just the ones that pass filters)
    await this.filterEvents(events);
    return events; // Return all events with filterResults attached
  }

  async filterEvents(events) {
    // Get current family demographics for age checking
    const familyDemographics = await this.familyService.getFamilyDemographics();
    
    // Get configuration from database
    const currentConfig = await this.getConfig();

    // Use LLM batch evaluation for age appropriateness and time extraction if available
    let ageEvaluations = new Map();
    if (this.llmEvaluator && events.length > 0) {
      try {
        this.logger.info(
          `Using LLM to evaluate age appropriateness and extract time for ${events.length} events`
        );

        // Create raw content map for events that have it
        const rawContentMap = new Map();
        events.forEach((event) => {
          if (event.rawContent) {
            rawContentMap.set(event.id, event.rawContent);
          }
        });

        ageEvaluations = await this.llmEvaluator.batchEvaluateEvents(
          events,
          familyDemographics.childAges,
          rawContentMap
        );
      } catch (error) {
        this.logger.error(
          "LLM age evaluation failed, falling back to rule-based:",
          error.message
        );
      }
    }

    const filtered = [];

    for (const event of events) {
      // Initialize filter tracking
      event.filterResults = {
        passed: false,
        reasons: []
      };

      // Check age appropriateness using LLM if available, otherwise use rules
      let ageAppropriate = true;
      let ageReason = null;
      let llmExtractedTime = null;
      
      if (ageEvaluations.has(event.id)) {
        const evaluation = ageEvaluations.get(event.id);
        ageAppropriate = evaluation.suitable;
        llmExtractedTime = evaluation.extractedTime;
        
        if (!ageAppropriate) {
          ageReason = `Age inappropriate: ${evaluation.reason}`;
        }

        // Update event date if LLM extracted more specific time
        if (llmExtractedTime && llmExtractedTime !== "ALL_DAY") {
          try {
            const updatedDate = this.parseTimeAndUpdateDate(
              event.date,
              llmExtractedTime
            );
            if (updatedDate) {
              event.date = updatedDate;
              event.llmExtractedTime = llmExtractedTime;
            }
          } catch (error) {
            this.logger.warn(
              `Failed to parse LLM time "${llmExtractedTime}" for ${event.title}:`,
              error.message
            );
          }
        }
      } else {
        const ageResult = this.isAgeAppropriate(event, familyDemographics);
        ageAppropriate = ageResult.passed;
        ageReason = ageResult.reason;
      }

      // Check each filter and capture detailed reasons
      const timeRange = await this.isWithinTimeRange(event, currentConfig);
      const schedule = await this.isScheduleCompatible(event, currentConfig);
      const budget = await this.isWithinBudget(event, currentConfig);
      const capacity = this.hasAvailableCapacity(event);
      const notAttended = this.isNotPreviouslyAttended(event);
      const weather = await this.isWeatherSuitable(event);

      // Store nap time information for scoring
      event.isDuringNapTime = schedule.isDuringNapTime || false;

      // Collect all filter reasons
      if (!ageAppropriate) event.filterResults.reasons.push(ageReason);
      if (!timeRange.passed) event.filterResults.reasons.push(timeRange.reason);
      if (!schedule.passed) event.filterResults.reasons.push(schedule.reason);
      if (!budget.passed) event.filterResults.reasons.push(budget.reason);
      if (!capacity.passed) event.filterResults.reasons.push(capacity.reason);
      if (!notAttended.passed) event.filterResults.reasons.push(notAttended.reason);
      if (!weather.passed) event.filterResults.reasons.push(weather.reason);

      const allFiltersPassed = ageAppropriate && 
        timeRange.passed && 
        schedule.passed && 
        budget.passed && 
        capacity.passed && 
        notAttended.passed && 
        weather.passed;

      if (allFiltersPassed) {
        // Add LLM evaluation metadata to event
        if (ageEvaluations.has(event.id)) {
          event.llmEvaluation = ageEvaluations.get(event.id);
        }
        
        event.filterResults.passed = true;
        event.filterResults.reasons = ["Passed all filters"];
        filtered.push(event);
      } else {
        event.filterResults.passed = false;
        // Reasons are already populated above
      }
    }

    const evaluationMethod = this.llmEvaluator ? "LLM" : "rule-based";
    this.logger.info(
      `Filtered ${events.length} events down to ${
        filtered.length
      } suitable events using ${evaluationMethod} age evaluation (${
        familyDemographics.children.length
      } children: ages ${familyDemographics.childAges.join(", ")})`
    );
    return filtered;
  }

  isAgeAppropriate(event, familyDemographics) {
    if (!event.ageRange || (!event.ageRange.min && !event.ageRange.max)) {
      return { passed: true, reason: "No age restrictions" };
    }

    const eventMinAge = event.ageRange.min || 0;
    const eventMaxAge = event.ageRange.max || 18;

    // Check if any child fits in the event age range
    const isAppropriate = familyDemographics.children.some((child) => {
      return child.currentAge >= eventMinAge && child.currentAge <= eventMaxAge;
    });

    if (!isAppropriate) {
      const childAges = familyDemographics.childAges.join(", ");
      return {
        passed: false,
        reason: `Age inappropriate (${eventMinAge}-${eventMaxAge} years vs family: ${childAges} years)`
      };
    }

    return { passed: true, reason: "Age appropriate" };
  }

  async isWithinTimeRange(event, currentConfig = null) {
    if (!currentConfig) {
      currentConfig = await this.getConfig();
    }

    const now = new Date();
    const eventDate = new Date(event.date);

    // Validate event date
    if (isNaN(eventDate.getTime())) {
      return {
        passed: false,
        reason: `Invalid date: ${event.date}`
      };
    }

    // Check for obviously invalid dates
    const currentYear = new Date().getFullYear();
    const eventYear = eventDate.getFullYear();
    if (eventYear < currentYear || eventYear > currentYear + 2) {
      return {
        passed: false,
        reason: `Invalid year (${eventYear})`
      };
    }

    // Check if event is in the past (with 1-hour grace period for today's events)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (eventDate < oneHourAgo) {
      return {
        passed: false,
        reason: "Event is in the past"
      };
    }

    const minAdvanceMs = currentConfig.preferences.minAdvanceDays * 24 * 60 * 60 * 1000;
    const maxAdvanceMs = currentConfig.preferences.maxAdvanceMonths * 30 * 24 * 60 * 60 * 1000;

    const timeDiff = eventDate.getTime() - now.getTime();
    const daysAway = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));

    // Add small buffer (1 hour) to handle boundary conditions
    const bufferedTimeDiff = timeDiff + 60 * 60 * 1000;
    const isInRange = bufferedTimeDiff >= minAdvanceMs && timeDiff <= maxAdvanceMs;

    if (!isInRange) {
      if (bufferedTimeDiff < minAdvanceMs) {
        return {
          passed: false,
          reason: `Too soon (${daysAway} days away, minimum ${currentConfig.preferences.minAdvanceDays} days required)`
        };
      } else if (timeDiff > maxAdvanceMs) {
        return {
          passed: false,
          reason: `Too far (${daysAway} days away, maximum ${currentConfig.preferences.maxAdvanceMonths * 30} days allowed)`
        };
      }
    }

    return { passed: true, reason: "Within time range" };
  }

  async isScheduleCompatible(event, currentConfig = null) {
    if (!currentConfig) {
      currentConfig = await this.getConfig();
    }

    const eventDate = new Date(event.date);
    const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday
    let eventTime = eventDate.toTimeString().substr(0, 5); // HH:MM format

    // Handle all-day events that default to 00:00
    const isAllDayEvent = eventTime === "00:00" && !event.time; // No explicit time provided
    if (isAllDayEvent) {
      // For all-day events, assume reasonable default times based on day type
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      eventTime = isWeekend ? "10:00" : "17:00"; // Weekend morning or weekday evening
    }

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    let result;
    if (isWeekend) {
      result = this.isWeekendCompatible(eventDate, eventTime, isAllDayEvent, currentConfig);
    } else {
      result = this.isWeekdayCompatible(eventTime, isAllDayEvent, currentConfig);
    }

    // Add day context to the reason
    if (!result.passed) {
      result.reason = `Schedule conflict on ${dayNames[dayOfWeek]}: ${result.reason}`;
    } else if (result.isDuringNapTime) {
      result.reason = `${dayNames[dayOfWeek]} ${result.reason}`;
    }

    return result;
  }

  isWeekdayCompatible(eventTime, isAllDayEvent = false, currentConfig) {
    const earliestTime = currentConfig.schedule.weekdayEarliestTime;
    const isCompatible = eventTime >= earliestTime;

    if (!isCompatible) {
      return {
        passed: false,
        reason: `${eventTime} is before earliest weekday time ${earliestTime}`
      };
    }

    return { 
      passed: true, 
      reason: isAllDayEvent ? `All-day event (assumed ${eventTime})` : "Schedule compatible"
    };
  }

  isWeekendCompatible(eventDate, eventTime, isAllDayEvent = false, currentConfig) {
    const napStart = currentConfig.schedule.weekendNapStart;
    const napEnd = currentConfig.schedule.weekendNapEnd;
    const earliestTime = currentConfig.schedule.weekendEarliestTime;

    if (eventTime < earliestTime) {
      return {
        passed: false,
        reason: `${eventTime} is before earliest weekend time ${earliestTime}`
      };
    }

    // Nap time events are allowed but will be scored lower
    const isDuringNapTime = eventTime >= napStart && eventTime <= napEnd;

    return { 
      passed: true, 
      reason: isAllDayEvent ? `All-day weekend event (assumed ${eventTime})` : 
              isDuringNapTime ? `During nap time (${napStart}-${napEnd}) - ranked lower` : 
              "Weekend schedule compatible",
      isDuringNapTime: isDuringNapTime
    };
  }

  async isWithinBudget(event, currentConfig = null) {
    if (!currentConfig) {
      currentConfig = await this.getConfig();
    }

    const maxCost = currentConfig.preferences.maxCostPerEvent;
    const eventCost = event.cost || 0;
    const isAffordable = eventCost <= maxCost;

    if (!isAffordable) {
      return {
        passed: false,
        reason: `Too expensive ($${eventCost} > $${maxCost} budget)`
      };
    }

    return { 
      passed: true, 
      reason: eventCost === 0 ? "Free event" : `Within budget ($${eventCost} ≤ $${maxCost})`
    };
  }

  hasAvailableCapacity(event) {
    if (
      !event.currentCapacity ||
      typeof event.currentCapacity.available !== "number"
    ) {
      return { passed: true, reason: "No capacity restrictions" };
    }

    const available = event.currentCapacity.available;
    const total = event.currentCapacity.total || "unknown";
    const hasCapacity = available > 0;

    if (!hasCapacity) {
      return {
        passed: false,
        reason: `No available spots (${available}/${total} available)`
      };
    }

    return { 
      passed: true, 
      reason: `Capacity available (${available}/${total} spots)`
    };
  }

  isNotPreviouslyAttended(event) {
    const notAttended = !event.previouslyAttended;

    if (!notAttended) {
      return {
        passed: false,
        reason: "Previously attended"
      };
    }

    return { passed: true, reason: "New experience" };
  }

  async filterByCalendarConflicts(events, calendarChecker) {
    const filtered = [];
    let blockedCount = 0;
    let warningCount = 0;

    for (const event of events) {
      try {
        // Get detailed conflict information
        const conflictDetails = await calendarChecker.getConflictDetails(
          event.date
        );

        if (!conflictDetails.hasConflict) {
          // Check for warnings (Sheridan's conflicts)
          if (conflictDetails.hasWarning) {
            this.logger.warn(
              `⚠️  Event has calendar warning: ${event.title} on ${event.date} (Sheridan's calendar conflict)`
            );
            warningCount++;
          }
          filtered.push(event);
        } else {
          // Joyce's calendar has conflict - block the event
          // this.logger.info(
          //   `❌ Event filtered - Joyce's calendar conflict: ${event.title} on ${event.date}`
          // );
          blockedCount++;
        }
      } catch (error) {
        this.logger.warn(
          `Error checking calendar for event ${event.title}:`,
          error.message
        );
        filtered.push(event);
      }
    }

    this.logger.info(
      `Calendar conflict check: ${events.length} events -> ${filtered.length} events (${blockedCount} blocked by Joyce's calendar, ${warningCount} warnings from Sheridan's calendar)`
    );
    return filtered;
  }

  filterByNovelty(events, database) {
    return events.filter((event) => {
      const isNovel = !event.previouslyAttended && !event.isRecurring;

      if (!isNovel) {
        // this.logger.debug(`Event filtered - not novel: ${event.title}`);
      }

      return isNovel;
    });
  }

  async filterAndSort(events, options = {}) {
    let filtered = await this.filterEvents(events);

    if (options.calendarChecker) {
      filtered = await this.filterByCalendarConflicts(
        filtered,
        options.calendarChecker
      );
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
      const capacityRatio =
        event.currentCapacity.available / event.currentCapacity.total;
      return capacityRatio <= 0.2;
    }

    return false;
  }

  async isWeatherSuitable(event) {
    try {
      const isOutdoor = this.weatherService.isEventOutdoor(event);

      // Only check weather for outdoor events
      if (!isOutdoor) {
        return { passed: true, reason: "Indoor event" };
      }

      const eventDate = new Date(event.date);
      const weather = await this.weatherService.getWeatherForecast(eventDate);

      // Cache weather data in database
      if (this.database) {
        try {
          await this.database.cacheWeatherData(
            "San Francisco",
            eventDate.toISOString().split("T")[0],
            weather
          );
        } catch (cacheError) {
          this.logger.warn(
            `Failed to cache weather data: ${cacheError.message}`
          );
        }
      }

      const isSuitable = weather.isOutdoorFriendly;

      if (!isSuitable) {
        return {
          passed: false,
          reason: `Weather unsuitable for outdoor event (${weather.condition}, ${weather.temperature}°F, precipitation: ${weather.precipitation}%)`
        };
      }

      return { 
        passed: true, 
        reason: `Good weather for outdoor event (${weather.condition}, ${weather.temperature}°F)`
      };
    } catch (error) {
      this.logger.error(`WEATHER ERROR for "${event.title}": ${error.message}`);
      return { passed: true, reason: "Weather check failed - defaulting to allow" };
    }
  }

  async addPreferenceScores(events) {
    const scoredEvents = [];

    for (const event of events) {
      try {
        const basePreferenceScore =
          await this.preferenceLearning.getEventPreferenceScore(event);
        
        // Apply nap time penalty: reduce score by 20 points for nap time events
        let finalScore = basePreferenceScore;
        if (event.isDuringNapTime) {
          finalScore = Math.max(0, basePreferenceScore - 20); // Don't go below 0
          this.logger.debug(
            `Applied nap time penalty to "${event.title}": ${basePreferenceScore} -> ${finalScore}`
          );
        }
        
        event.preferenceScore = finalScore;
        scoredEvents.push(event);

        // this.logger.debug(
        //   `Event preference score: ${event.title} = ${finalScore}`
        // );
      } catch (error) {
        this.logger.warn(
          `Error calculating preference score for ${event.title}:`,
          error.message
        );
        // Apply nap time penalty to neutral score too
        const neutralScore = event.isDuringNapTime ? 30 : 50;
        event.preferenceScore = neutralScore;
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
      await this.preferenceLearning.recordEventInteraction(
        eventId,
        interactionType,
        metadata
      );
    } catch (error) {
      this.logger.error(`Error recording event interaction:`, error.message);
    }
  }

  parseTimeAndUpdateDate(originalDate, timeString) {
    try {
      // Parse time patterns like "4:30 PM", "10:00 AM - 11:30 AM", "4:30 - 6:30 PM"
      const timePattern = /(\d+):(\d+)\s*(AM|PM)/i;
      const match = timeString.match(timePattern);

      if (!match) {
        return null;
      }

      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3].toUpperCase();

      // Convert to 24-hour format
      if (ampm === "PM" && hours !== 12) {
        hours += 12;
      } else if (ampm === "AM" && hours === 12) {
        hours = 0;
      }

      // Create new date with extracted time
      const newDate = new Date(originalDate);
      newDate.setHours(hours, minutes, 0, 0);

      this.logger.debug(
        `Updated event time from ${originalDate} to ${newDate} using LLM-extracted time: ${timeString}`
      );
      return newDate;
    } catch (error) {
      this.logger.warn(
        `Error parsing time string "${timeString}":`,
        error.message
      );
      return null;
    }
  }
}

module.exports = EventFilter;
