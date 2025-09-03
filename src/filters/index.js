const { config } = require("../config");
const WeatherService = require("../services/weather");
const PreferenceLearningService = require("../services/preference-learning");
const FamilyDemographicsService = require("../services/family-demographics");
const LLMAgeEvaluator = require("../services/llm-age-evaluator");

class EventFilter {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.weatherService = new WeatherService(logger, database);
    this.preferenceLearning = new PreferenceLearningService(logger, database);
    this.familyService = new FamilyDemographicsService(logger, database);

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

  async filterEvents(events) {
    // Get current family demographics for age checking
    const familyDemographics = await this.familyService.getFamilyDemographics();

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
      // Check age appropriateness using LLM if available, otherwise use rules
      let ageAppropriate = true;
      let llmExtractedTime = null;
      if (ageEvaluations.has(event.id)) {
        const evaluation = ageEvaluations.get(event.id);
        ageAppropriate = evaluation.suitable;
        llmExtractedTime = evaluation.extractedTime;

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

        if (!ageAppropriate) {
          this.logger.debug(
            `Event filtered by LLM - age inappropriate: ${event.title} (${evaluation.reason})`
          );
        }
      } else {
        ageAppropriate = this.isAgeAppropriate(event, familyDemographics);
      }

      // Debug each filter step
      const timeRange = this.isWithinTimeRange(event);
      const schedule = this.isScheduleCompatible(event);
      const budget = this.isWithinBudget(event);
      const capacity = this.hasAvailableCapacity(event);
      const notAttended = this.isNotPreviouslyAttended(event);
      const weather = await this.isWeatherSuitable(event);

      if (
        ageAppropriate &&
        timeRange &&
        schedule &&
        budget &&
        capacity &&
        notAttended &&
        weather
      ) {
        // Add LLM evaluation metadata to event
        if (ageEvaluations.has(event.id)) {
          event.llmEvaluation = ageEvaluations.get(event.id);
        }

        filtered.push(event);
      } else if (ageAppropriate) {
        // Log which filter eliminated this LLM-approved event
        const reasons = [];
        if (!timeRange) reasons.push("time-range");
        if (!schedule) reasons.push("schedule");
        if (!budget) reasons.push("budget");
        if (!capacity) reasons.push("capacity");
        if (!notAttended) reasons.push("previously-attended");
        if (!weather) reasons.push("weather");

        // this.logger.info(
        //   `Event "${event.title}" eliminated by filters: ${reasons.join(", ")}`
        // );
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
      return true; // No age restrictions
    }

    const eventMinAge = event.ageRange.min || 0;
    const eventMaxAge = event.ageRange.max || 18;

    // Check if any child fits in the event age range
    const isAppropriate = familyDemographics.children.some((child) => {
      return child.currentAge >= eventMinAge && child.currentAge <= eventMaxAge;
    });

    if (!isAppropriate) {
      const childAges = familyDemographics.childAges.join(", ");
      // this.logger.debug(
      //   `Event filtered - age range: ${event.title} (${eventMinAge}-${eventMaxAge} vs children ages ${childAges})`
      // );
    }

    return isAppropriate;
  }

  isWithinTimeRange(event) {
    const now = new Date();
    const eventDate = new Date(event.date);

    // Validate event date
    if (isNaN(eventDate.getTime())) {
      // this.logger.info(
      //   `TIME RANGE: Event "${event.title}" rejected - invalid date: ${event.date}`
      // );
      return false;
    }

    // Check for obviously invalid dates
    const currentYear = new Date().getFullYear();
    const eventYear = eventDate.getFullYear();
    if (eventYear < currentYear || eventYear > currentYear + 2) {
      // this.logger.info(
      //   `TIME RANGE: Event "${event.title}" rejected - invalid year ${eventYear}: ${event.date}`
      // );
      return false;
    }

    // Check if event is in the past (with 1-hour grace period for today's events)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (eventDate < oneHourAgo) {
      // this.logger.info(
      //   `TIME RANGE: Event "${event.title}" rejected - event is in the past: ${event.date}`
      // );
      return false;
    }

    const minAdvanceMs =
      config.preferences.minAdvanceDays * 24 * 60 * 60 * 1000;
    const maxAdvanceMs =
      config.preferences.maxAdvanceMonths * 30 * 24 * 60 * 60 * 1000;

    const timeDiff = eventDate.getTime() - now.getTime();
    const daysAway = Math.ceil(timeDiff / (24 * 60 * 60 * 1000)); // Use ceil for more inclusive calculation

    // Add small buffer (1 hour) to handle boundary conditions
    const bufferedTimeDiff = timeDiff + 60 * 60 * 1000;
    const isInRange =
      bufferedTimeDiff >= minAdvanceMs && timeDiff <= maxAdvanceMs;

    // DETAILED DEBUG LOGGING
    // this.logger.info(`TIME RANGE DEBUG: Event "${event.title}"`);
    // this.logger.info(`  - Event Date: ${eventDate.toISOString()} (${event.date})`);
    // this.logger.info(`  - Current Time: ${now.toISOString()}`);
    // this.logger.info(`  - Days Away: ${daysAway}`);
    // this.logger.info(`  - Min Advance Days: ${config.preferences.minAdvanceDays}`);
    // this.logger.info(`  - Max Advance Months: ${config.preferences.maxAdvanceMonths}`);
    // this.logger.info(`  - Time Diff (ms): ${timeDiff}`);
    // this.logger.info(`  - Buffered Time Diff (ms): ${bufferedTimeDiff}`);
    // this.logger.info(`  - Min Required (ms): ${minAdvanceMs}`);
    // this.logger.info(`  - Max Allowed (ms): ${maxAdvanceMs}`);
    // this.logger.info(`  - Passes Time Filter: ${isInRange}`);

    // if (!isInRange) {
    //   if (bufferedTimeDiff < minAdvanceMs) {
    //     this.logger.info(
    //       `  - REJECTED: Event is ${daysAway} days away, minimum ${config.preferences.minAdvanceDays} days required`
    //     );
    //   } else if (timeDiff > maxAdvanceMs) {
    //     this.logger.info(
    //       `  - REJECTED: Event is ${daysAway} days away, maximum ${
    //         config.preferences.maxAdvanceMonths * 30
    //       } days allowed`
    //     );
    //   }
    // }

    return isInRange;
  }

  isScheduleCompatible(event) {
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
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    // DETAILED DEBUG LOGGING
    // this.logger.info(`SCHEDULE DEBUG: Event "${event.title}"`);
    // this.logger.info(`  - Event Date: ${eventDate.toISOString()}`);
    // this.logger.info(`  - Day of Week: ${dayNames[dayOfWeek]} (${dayOfWeek})`);
    // this.logger.info(
    //   `  - Original Event Time: ${eventDate.toTimeString().substr(0, 5)}`
    // );
    // this.logger.info(`  - Is All-Day Event: ${isAllDayEvent}`);
    // this.logger.info(`  - Effective Event Time: ${eventTime}`);
    // this.logger.info(`  - Is Weekend: ${isWeekend}`);

    let compatible;
    if (isWeekend) {
      compatible = this.isWeekendCompatible(
        eventDate,
        eventTime,
        isAllDayEvent
      );
      // this.logger.info(`  - Weekend Compatibility: ${compatible}`);
    } else {
      compatible = this.isWeekdayCompatible(eventTime, isAllDayEvent);
      // this.logger.info(`  - Weekday Compatibility: ${compatible}`);
    }

    return compatible;
  }

  isWeekdayCompatible(eventTime, isAllDayEvent = false) {
    const earliestTime = config.schedule.weekdayEarliestTime;
    const isCompatible = eventTime >= earliestTime;

    // this.logger.info(`    - WEEKDAY CHECK:`);
    // this.logger.info(`      - Event Time: ${eventTime}`);
    // this.logger.info(`      - Earliest Allowed: ${earliestTime}`);
    // this.logger.info(`      - Is All-Day Event: ${isAllDayEvent}`);
    // this.logger.info(`      - Compatible: ${isCompatible}`);

    if (!isCompatible && !isAllDayEvent) {
      // this.logger.info(
      //   `      - REJECTED: Event at ${eventTime} is before earliest weekday time ${earliestTime}`
      // );
    } else if (isAllDayEvent) {
      // this.logger.info(
      //   `      - ACCEPTED: All-day event with assumed time ${eventTime}`
      // );
    }

    return isCompatible;
  }

  isWeekendCompatible(eventDate, eventTime, isAllDayEvent = false) {
    const napStart = config.schedule.weekendNapStart;
    const napEnd = config.schedule.weekendNapEnd;
    const earliestTime = config.schedule.weekendEarliestTime;

    // this.logger.info(`    - WEEKEND CHECK:`);
    // this.logger.info(`      - Event Time: ${eventTime}`);
    // this.logger.info(`      - Earliest Allowed: ${earliestTime}`);
    // this.logger.info(`      - Nap Time: ${napStart} - ${napEnd}`);
    // this.logger.info(`      - Is All-Day Event: ${isAllDayEvent}`);

    if (eventTime < earliestTime) {
      this.logger.info(
        `      - REJECTED: Event at ${eventTime} is before earliest weekend time ${earliestTime}`
      );
      return false;
    }

    if (eventTime >= napStart && eventTime <= napEnd) {
      // this.logger.info(
      //   `      - REJECTED: Event at ${eventTime} conflicts with nap time (${napStart}-${napEnd})`
      // );
      return false;
    }

    // if (isAllDayEvent) {
    //   // this.logger.info(
    //   //   `      - ACCEPTED: All-day weekend event with assumed time ${eventTime}`
    //   // );
    // } else {
    //   this.logger.info(`      - ACCEPTED: Weekend schedule compatible`);
    // }
    return true;
  }

  isWithinBudget(event) {
    const maxCost = config.preferences.maxCostPerEvent;
    const eventCost = event.cost || 0;
    const isAffordable = eventCost <= maxCost;

    // if (!isAffordable) {
    // this.logger.info(
    //   `BUDGET: Event "${event.title}" rejected - costs $${eventCost}, exceeds max budget $${maxCost}`
    // );
    // }

    return isAffordable;
  }

  hasAvailableCapacity(event) {
    if (
      !event.currentCapacity ||
      typeof event.currentCapacity.available !== "number"
    ) {
      return true;
    }

    const available = event.currentCapacity.available;
    const hasCapacity = available > 0;

    // if (!hasCapacity) {
    // this.logger.info(
    //   `CAPACITY: Event "${event.title}" rejected - no available spots (${available} available)`
    // );
    // }

    return hasCapacity;
  }

  isNotPreviouslyAttended(event) {
    const notAttended = !event.previouslyAttended;

    // if (!notAttended) {
    // this.logger.info(
    //   `ATTENDANCE: Event "${event.title}" rejected - previously attended`
    // );
    // }

    return notAttended;
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
        return true;
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
        // this.logger.info(
        //   `WEATHER: Event "${event.title}" rejected - weather unsuitable (${weather.condition}, ${weather.temperature}°F, precipitation: ${weather.precipitation})`
        // );
      }

      return isSuitable;
    } catch (error) {
      this.logger.error(`WEATHER ERROR for "${event.title}": ${error.message}`);
      return true; // Default to allowing the event if weather check fails
    }
  }

  async addPreferenceScores(events) {
    const scoredEvents = [];

    for (const event of events) {
      try {
        const preferenceScore =
          await this.preferenceLearning.getEventPreferenceScore(event);
        event.preferenceScore = preferenceScore;
        scoredEvents.push(event);

        // this.logger.debug(
        //   `Event preference score: ${event.title} = ${preferenceScore}`
        // );
      } catch (error) {
        this.logger.warn(
          `Error calculating preference score for ${event.title}:`,
          error.message
        );
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
