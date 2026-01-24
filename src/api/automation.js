const express = require("express");
const router = express.Router();
const { GmailClient } = require("../mcp/gmail-client");
const Database = require("../database");

// Google Integration health check - tests calendar and email for sheridan.gray@gmail.com
async function checkGoogleIntegration() {
  try {
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const database = new Database();
    await database.init();
    const gmailClient = new GmailClient(logger, database);

    // Get user ID for sheridan.gray@gmail.com
    const user = await database.getUserByEmail("sheridan.gray@gmail.com");
    if (!user) {
      console.warn(
        "Primary user sheridan.gray@gmail.com not found in database"
      );
      return false;
    }

    // Test calendar access using the unified client
    let calendarHealthy = false;
    try {
      const testDate = new Date().toISOString();
      const calendarResult = await gmailClient.checkCalendarConflicts(
        user.id,
        testDate,
        60
      );
      calendarHealthy = true;
    } catch (error) {
      console.warn("Calendar health check failed:", error.message);
    }

    // Test email access by checking if we can get authenticated client
    let emailHealthy = false;
    try {
      const authenticatedClient = await gmailClient.getAuthenticatedClient(
        user.id
      );
      emailHealthy = !!authenticatedClient;
    } catch (error) {
      console.warn("Email health check failed:", error.message);
    }

    return calendarHealthy && emailHealthy;
  } catch (error) {
    console.warn("Google integration health check failed:", error.message);
    return false;
  }
}

// Weather service health check
async function checkWeatherService() {
  try {
    const homeZip = "94158";
    const homeCity = "San Francisco";
    const homeCountry = "US";
    const weatherApiKey = process.env.WEATHER_API_KEY;

    if (!weatherApiKey) {
      return false;
    }

    let weatherUrl;
    if (homeZip && homeZip.match(/^\d{5}$/)) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${homeZip},${homeCountry}&appid=${weatherApiKey}&units=imperial`;
    } else {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        homeCity
      )}&appid=${weatherApiKey}&units=imperial`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(weatherUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "FamilyEventPlanner/1.0" },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data && data.main && typeof data.main.temp === "number";
    }

    return false;
  } catch (error) {
    console.warn("Weather service health check failed:", error.message);
    return false;
  }
}

// Initialize router with database and automation components
function createAutomationRouter(database, taskScheduler) {
  // Get automation status
  router.get("/status", async (req, res) => {
    try {
      res.json({
        status: "operational",
        message: "Automation system is running. Kid Events discovery coming soon.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting automation status:", error);
      res.status(500).json({ error: "Failed to get automation status" });
    }
  });

  // Get system health
  router.get("/health", async (req, res) => {
    try {
      if (!taskScheduler) {
        return res.json({
          systemStatus: "unavailable",
          components: {},
          lastHealthCheck: new Date().toISOString(),
        });
      }

      // Get system health score
      const healthScore = await taskScheduler.calculateSystemHealthScore();
      const schedulerStatus = taskScheduler.getStatus();

      // Check external service health
      const weatherServiceHealthy = await checkWeatherService();
      const googleIntegrationHealthy = await checkGoogleIntegration();

      res.json({
        systemStatus: healthScore.description.toLowerCase(),
        healthScore: healthScore.score,
        components: {
          database: healthScore.details.database?.healthy || false,
          googleIntegration: googleIntegrationHealthy,
          emailService: healthScore.details.emailService?.healthy || false,
          calendarIntegration:
            healthScore.details.calendarIntegration?.healthy || false,
          databasePerformance:
            healthScore.details.databasePerformance?.healthy || false,
          systemResources:
            healthScore.details.systemResources?.healthy || false,
          scheduler: schedulerStatus.running,
          weatherService: weatherServiceHealthy,
        },
        performance: {
          basicDatabaseResponseTime: `${
            healthScore.details.databasePerformance?.details?.basicQueryTime ||
            0
          }ms`,
          complexDatabaseResponseTime: `${
            healthScore.details.databasePerformance?.details
              ?.complexQueryTime || 0
          }ms`,
          memoryUsageMB:
            healthScore.details.systemResources?.details?.memoryUsageMB || 0,
          memoryTotalMB:
            healthScore.details.systemResources?.details?.memoryTotalMB || 0,
          uptimeHours:
            healthScore.details.systemResources?.details?.uptimeHours || 0,
        },
        lastHealthCheck: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting system health:", error);
      res.status(500).json({ error: "Failed to get system health" });
    }
  });

  // Get recent automation activity
  router.get("/activity", async (req, res) => {
    try {
      const activities = [];

      // Get recent event approvals
      let recentApprovals = { rows: [] };
      try {
        recentApprovals = await database.query(`
          SELECT id, title as event_title, updated_at as response_at
          FROM events 
          WHERE status = 'approved'
          ORDER BY updated_at DESC
          LIMIT 10
        `);
      } catch (error) {
        console.warn("Failed to get recent approvals:", error.message);
      }

      recentApprovals.rows.forEach((approval) => {
        activities.push({
          id: `approval-${approval.id}`,
          type: "approval",
          message: `Event approved: "${approval.event_title}"`,
          timestamp: new Date(approval.response_at || approval.updated_at),
          status: "success",
        });
      });

      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json(activities.slice(0, 15));
    } catch (error) {
      console.error("Error getting automation activity:", error);
      res.status(500).json({ error: "Failed to get automation activity" });
    }
  });

  // LLM Event Scanner endpoint
  router.post("/llm-scan", async (req, res) => {
    try {
      const { logger, database } = req.app.locals;
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: "Prompt is required",
        });
      }

      logger.info("🤖 LLM Event Scanner request received");

      // Import required services
      const FamilyDemographicsService = require("../services/family-demographics");
      const WeatherService = require("../services/weather");
      const LLMAgeEvaluator = require("../services/llm-age-evaluator");

      // Initialize services
      const familyDemographics = new FamilyDemographicsService(
        logger,
        database
      );
      const weatherService = new WeatherService(logger, database);

      let llmEvaluator;
      try {
        llmEvaluator = new LLMAgeEvaluator(logger);
      } catch (error) {
        logger.warn("LLM Evaluator initialization failed:", error.message);
        llmEvaluator = {
          callTogetherAI: async () => {
            throw new Error(
              "TOGETHER_AI_API_KEY environment variable is required"
            );
          },
        };
      }

      // Get family demographics
      let demographics;
      try {
        demographics = await familyDemographics.getFamilyDemographics();
        logger.info("Family demographics loaded:", {
          childrenCount: demographics.children.length,
          parentsCount: demographics.parents.length,
        });
      } catch (error) {
        logger.warn("Failed to load family demographics:", error.message);
        demographics = { children: [], parents: [] };
      }

      const childrenAges = demographics.children.map(
        (child) => child.currentAge
      );
      const childrenNames = demographics.children.map((child) => child.name);
      const allInterests = demographics.children.flatMap(
        (child) => child.interests || []
      );

      const ageRangeMin =
        childrenAges.length > 0 ? Math.min(...childrenAges) : 0;
      const ageRangeMax =
        childrenAges.length > 0 ? Math.max(...childrenAges) : 18;

      // Get family settings
      let settings = {};
      try {
        const settingsResult = await database.query(`
          SELECT setting_key, setting_value 
          FROM family_settings 
          WHERE setting_key IN ('home_zip', 'home_city', 'home_country', 'max_distance', 'time_preferences')
        `);

        settingsResult.rows.forEach((row) => {
          settings[row.setting_key] = row.setting_value;
        });
        logger.info("Family settings loaded:", Object.keys(settings));
      } catch (error) {
        logger.warn("Failed to load family settings:", error.message);
        settings = {};
      }

      const homeLocation = settings.home_zip
        ? `${settings.home_city || "San Francisco"}, ${settings.home_zip}`
        : settings.home_city || "San Francisco";
      const maxDistance = settings.max_distance || "25";
      const currentDate = new Date().toLocaleDateString();
      const targetDateRange = `${new Date().toLocaleDateString()} to ${new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toLocaleDateString()}`;

      // Get weather forecast
      let weatherForecast = "Weather data unavailable";
      try {
        const weatherData = await weatherService.getWeatherForecast(
          new Date(),
          homeLocation
        );
        if (weatherData && weatherData.forecast) {
          weatherForecast = weatherData.forecast
            .map((day) => `${day.date}: ${day.description}, ${day.temp}°F`)
            .join("\n");
        }
      } catch (error) {
        logger.warn("Failed to get weather forecast:", error.message);
      }

      // Process template variables
      const processedPrompt = prompt
        .replace(/\{\{children_ages\}\}/g, childrenAges.join(", "))
        .replace(/\{\{age_range_min\}\}/g, ageRangeMin)
        .replace(/\{\{age_range_max\}\}/g, ageRangeMax)
        .replace(/\{\{children_names\}\}/g, childrenNames.join(", "))
        .replace(
          /\{\{children_interests\}\}/g,
          [...new Set(allInterests)].join(", ")
        )
        .replace(/\{\{home_location\}\}/g, homeLocation)
        .replace(/\{\{max_distance\}\}/g, maxDistance)
        .replace(/\{\{current_date\}\}/g, currentDate)
        .replace(/\{\{target_date_range\}\}/g, targetDateRange)
        .replace(/\{\{weather_forecast\}\}/g, weatherForecast);

      logger.info("📝 Processed prompt with family data");

      // Call Together AI
      let llmResponse;
      try {
        llmResponse = await llmEvaluator.callTogetherAI(processedPrompt, {
          model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
          max_tokens: 4000,
          temperature: 0.7,
        });
      } catch (error) {
        logger.error("Together AI call failed with error:", error.message);
        llmResponse = `**LLM Event Scanner Demo Response**

**TOP PICK** - California Academy of Sciences: NightLife (Score: 9/10)
- Reasoning: Perfect for families with children ages 5-12, combines education with entertainment
- Date: ${new Date().toLocaleDateString()}
- Time: 6:00 PM - 10:00 PM
- Location: 55 Music Concourse Dr, San Francisco
- Cost: $15-25 per person
- Description: After-hours museum experience with live music, food, and special exhibits
- Registration: Required - buy tickets online

*Note: This is a demo response. To get real-time event recommendations, please configure the TOGETHER_AI_API_KEY environment variable.*`;
      }

      logger.info("✅ LLM response received");

      res.json({
        success: true,
        response: llmResponse,
        variables: {
          children_ages: childrenAges.join(", "),
          age_range_min: ageRangeMin,
          age_range_max: ageRangeMax,
          children_names: childrenNames.join(", "),
          children_interests: [...new Set(allInterests)].join(", "),
          home_location: homeLocation,
          max_distance: maxDistance,
          current_date: currentDate,
          target_date_range: targetDateRange,
        },
      });
    } catch (error) {
      req.app.locals.logger.error("Error in LLM scan:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to process LLM scan request",
      });
    }
  });

  return router;
}

module.exports = createAutomationRouter;
