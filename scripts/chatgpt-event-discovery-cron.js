#!/usr/bin/env node

/**
 * ChatGPT Event Discovery Cron Job
 *
 * This script runs every 5 minutes to:
 * 1. Generate event discoveries using OpenAI API
 * 2. POST results to the backend API
 *
 * Environment variables required:
 * - OPEN_AI_API_KEY: OpenAI API key
 * - CHATGPT_API_KEY: API key for backend authentication
 * - BACKEND_API_URL: Backend API URL (defaults to production)
 */

require("dotenv").config();

const OpenAI = require("openai");
const https = require("https");
const http = require("http");

// Configuration
const OPENAI_API_KEY = process.env.OPEN_AI_API_KEY;
const CHATGPT_API_KEY =
  process.env.CHATGPT_API_KEY ||
  "chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475";
const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  "https://family-event-planner-backend.onrender.com";

// Validate environment
if (!OPENAI_API_KEY) {
  console.error("❌ ERROR: OPEN_AI_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Calculate the target date (14 days from today)
 */
function getTargetDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

/**
 * Build the event discovery prompt
 */
function buildPrompt() {
  const targetDate = getTargetDate();
  const today = new Date().toISOString();

  return `Search for fully kid-centric, family-friendly events within 25 miles of San Francisco, California, that occur 14 days from today (${targetDate}). Apply the following filters:
- Events must be specifically kid-focused (ages ~2–6 welcome) with stroller-friendly or toddler-appropriate setup.
- Weekday events must start after 5:00 PM; weekend events may be any time.
- Consider forecasted weather for outdoor events.
- Check my Google Calendar for conflicts on that date and exclude/flag any conflicting time slots.
- Rank all events 1–10 by relevance and quality.
- Highlight the Top 3 recommendations with detailed reasoning.
- For each event, include a Google Calendar add link using the standard action=TEMPLATE URL with title, dates (local), and details.
- If registration is available, include the registration URL.
- Return the result as a JSON with the following structure:

{
  "dateSearched": "${today}",
  "searchContext": {
    "searchRadiusMiles": 25,
    "baseLocation": "San Francisco, California",
    "targetDate": "${targetDate}",
    "familyContext": {
      "wife": { "name": "Joyce Zhang", "dob": "1987-02-24" },
      "children": [
        { "name": "Apollo Gray", "dob": "2021-04-26" },
        { "name": "Athena Gray", "dob": "2023-03-10" }
      ]
    },
    "filters": {
      "kidCentricAgeRange": "2-6 years",
      "strollerFriendly": true,
      "weekdayAfter5pm": true,
      "weekendAnytime": true,
      "prioritizeMissionBay": true,
      "considerWeather": true
    },
    "calendarConflictsChecked": true
  },
  "events": [
    {
      "rank": <RANK>,
      "pickType": <PICK_TYPE>,
      "score": <SCORE>,
      "event": {
        "title": <EVENT_TITLE>,
        "date": "${targetDate}",
        "startTime": <EVENT_START_TIME>,
        "endTime": <EVENT_END_TIME>,
        "location": {
          "name": <EVENT_LOCATION_NAME>,
          "address": <EVENT_LOCATION_ADDRESS>,
          "distanceMiles": <EVENT_DISTANCE_MILES>
        },
        "cost": {
          "adult": <ADULT_COST>,
          "child": <CHILD_COST>,
          "infantFree": <INFANT_FREE>,
          "currency": "USD"
        },
        "description": <DESCRIPTION>,
        "weather": {
          "forecast": <WEATHER_FORECAST>,
          "riskLevel": <WEATHER_RISK_LEVEL>
        },
        "urls": {
          "eventPage": <EVENT_PAGE>,
          "registration": <REGISTRATION_LINK>,
          "addToCalendar": <GOOGLE_CALENDAR_LINK>
        },
        "calendarConflict": <CALENDAR_CONFLICT>
      },
      "reasoning": <REASONING>
    }
  ],
  "metadata": {
    "generatedBy": "OpenAI Event Discovery Cron Job",
    "version": "1.0",
    "runtimeSeconds": <RUNTIME_SECONDS>
  }
}

IMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON. Ensure all dates are in ISO 8601 format and all required fields are populated.`;
}

/**
 * Parse JSON from OpenAI response, handling code blocks
 */
function parseJSONResponse(responseText) {
  // Remove markdown code blocks if present
  let jsonText = responseText.trim();

  // Remove ```json and ``` wrappers
  jsonText = jsonText.replace(/^```json\s*/i, "");
  jsonText = jsonText.replace(/^```\s*/i, "");
  jsonText = jsonText.replace(/\s*```$/i, "");

  // Find JSON object boundaries
  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(jsonText);
}

/**
 * POST discovery to backend API
 */
async function postToBackend(discoveryData) {
  const url = new URL(`${BACKEND_API_URL}/api/chatgpt-event-discoveries`);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;

  const postData = JSON.stringify(discoveryData);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": CHATGPT_API_KEY,
        "Content-Length": Buffer.byteLength(postData),
      },
      timeout: 30000, // 30 second timeout
    };

    const req = client.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            resolve({ success: true, raw: data });
          }
        } else {
          reject(new Error(`Backend API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const processId = process.pid;

  console.log(`\n🚀 ChatGPT Event Discovery Cron Job - ${timestamp}`);
  console.log("==========================================");
  console.log(`📊 Process ID: ${processId}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Backend URL: ${BACKEND_API_URL}`);
  console.log(`🤖 OpenAI Model: gpt-4o-mini`);
  console.log("==========================================\n");

  try {
    // Step 1: Generate prompt
    console.log("📝 Building discovery prompt...");
    const prompt = buildPrompt();
    const targetDate = getTargetDate();
    console.log(`   Target date: ${targetDate}`);
    console.log(`   Prompt length: ${prompt.length} characters`);

    // Step 2: Call OpenAI API
    console.log("\n🤖 Calling OpenAI API...");
    const openaiStartTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency, can upgrade to gpt-4o if needed
      messages: [
        {
          role: "system",
          content:
            "You are an expert event discovery assistant that finds family-friendly events for toddlers in San Francisco. Always return valid JSON matching the exact structure requested.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" }, // Force JSON output
      temperature: 0.7,
      max_tokens: 4000,
    });

    const openaiDuration = ((Date.now() - openaiStartTime) / 1000).toFixed(2);
    const responseText = completion.choices[0].message.content;
    console.log(`   ✅ Received ${responseText.length} characters from OpenAI`);
    console.log(`   ⏱️  OpenAI API call took: ${openaiDuration}s`);
    console.log(
      `   💰 Tokens used: ${completion.usage?.total_tokens || "unknown"}`
    );
    if (completion.usage) {
      console.log(`      - Input tokens: ${completion.usage.prompt_tokens}`);
      console.log(
        `      - Output tokens: ${completion.usage.completion_tokens}`
      );
    }

    // Step 3: Parse JSON response
    console.log("\n📦 Parsing JSON response...");
    let discoveryData;
    try {
      // Try parsing with response format
      discoveryData = JSON.parse(responseText);
      console.log("   ✅ Direct JSON parsing successful");
    } catch (e) {
      console.log(
        "   ⚠️  Direct parsing failed, trying markdown extraction..."
      );
      // Fallback: try extracting JSON from markdown
      try {
        discoveryData = parseJSONResponse(responseText);
        console.log("   ✅ Markdown extraction successful");
      } catch (e2) {
        throw new Error(
          `Failed to parse JSON: ${
            e.message
          }. Response: ${responseText.substring(0, 200)}...`
        );
      }
    }

    // Validate required fields
    if (
      !discoveryData.dateSearched ||
      !discoveryData.searchContext ||
      !discoveryData.events
    ) {
      throw new Error("Invalid JSON structure: missing required fields");
    }

    const eventsCount = discoveryData.events?.length || 0;
    console.log(`   ✅ Parsed successfully: ${eventsCount} events found`);

    // Log event details
    if (eventsCount > 0) {
      console.log("   📋 Event summary:");
      discoveryData.events.slice(0, 5).forEach((event, index) => {
        const eventTitle = event.event?.title || "Unknown";
        const eventRank = event.rank || "N/A";
        const eventScore = event.score || "N/A";
        console.log(
          `      ${
            index + 1
          }. [Rank ${eventRank}, Score ${eventScore}] ${eventTitle.substring(
            0,
            60
          )}${eventTitle.length > 60 ? "..." : ""}`
        );
      });
      if (eventsCount > 5) {
        console.log(`      ... and ${eventsCount - 5} more events`);
      }
    }

    // Step 4: POST to backend
    console.log("\n📡 POSTing to backend API...");
    const backendStartTime = Date.now();
    const backendResponse = await postToBackend(discoveryData);
    const backendDuration = ((Date.now() - backendStartTime) / 1000).toFixed(2);
    console.log(`   ⏱️  Backend API call took: ${backendDuration}s`);

    const runtimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n✅ Success!");
    console.log(`   Discovery ID: ${backendResponse.discoveryId || "N/A"}`);
    console.log(`   Events saved: ${eventsCount}`);
    console.log(`   Target date: ${targetDate}`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   ⏱️  Total runtime: ${runtimeSeconds}s`);
    console.log(`      - OpenAI API: ${openaiDuration}s`);
    console.log(`      - Backend API: ${backendDuration}s`);
    console.log(
      `      - Overhead: ${(
        parseFloat(runtimeSeconds) -
        parseFloat(openaiDuration) -
        parseFloat(backendDuration)
      ).toFixed(2)}s`
    );

    // Update metadata with actual runtime
    if (backendResponse.discoveryId && discoveryData.metadata) {
      discoveryData.metadata.runtimeSeconds = parseFloat(runtimeSeconds);
    }

    console.log("\n✨ Cron job completed successfully!");
    console.log(
      `📊 Summary: ${eventsCount} events discovered in ${runtimeSeconds}s (PID ${processId})`
    );
    process.exit(0);
  } catch (error) {
    const runtimeSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("\n❌ Error occurred:");
    console.error(`   Message: ${error.message}`);
    console.error(`   Type: ${error.constructor.name}`);
    console.error(`   Runtime: ${runtimeSeconds}s`);
    console.error(`   Process ID: ${processId}`);
    console.error(`   Timestamp: ${new Date().toISOString()}`);

    if (error.stack) {
      console.error("\n📋 Stack trace:");
      console.error(error.stack);
    }

    // Log additional context for debugging
    console.error("\n🔍 Debug context:");
    console.error(
      `   OpenAI API Key: ${
        OPENAI_API_KEY
          ? "Set (" + OPENAI_API_KEY.substring(0, 10) + "...)"
          : "Missing"
      }`
    );
    console.error(`   ChatGPT API Key: ${CHATGPT_API_KEY ? "Set" : "Missing"}`);
    console.error(`   Backend URL: ${BACKEND_API_URL}`);
    console.error(`   Environment: ${process.env.NODE_ENV || "development"}`);

    console.error("\n❌ Cron job failed!");
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, buildPrompt, postToBackend };
