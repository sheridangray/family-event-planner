/**
 * Exercise LLM Service
 * Generates exercise details using LLM (instructions, YouTube link, body parts, type detection)
 */

const LLMAgeEvaluator = require("./llm-age-evaluator");
const { google } = require("googleapis");

class ExerciseLLMService {
  constructor(logger) {
    this.logger = logger;
    this.llm = new LLMAgeEvaluator(logger);

    // Initialize YouTube API client if API key is available
    if (process.env.YOUTUBE_API_KEY) {
      this.youtube = google.youtube({
        version: "v3",
        auth: process.env.YOUTUBE_API_KEY,
      });
      this.logger.info("YouTube API client initialized");
    } else {
      this.youtube = null;
      this.logger.warn(
        "YOUTUBE_API_KEY not found - YouTube search will be skipped"
      );
    }
  }

  /**
   * Search YouTube for an exercise tutorial video
   * @param {string} exerciseName - Name of the exercise
   * @returns {Promise<string|null>} YouTube URL or null if not found
   */
  async searchYouTubeVideo(exerciseName) {
    if (!this.youtube) {
      this.logger.debug("YouTube API not configured, skipping search");
      return null;
    }

    try {
      this.logger.debug("Searching YouTube for exercise video", {
        exerciseName,
      });

      // Search for exercise tutorial videos
      const response = await this.youtube.search.list({
        part: "snippet",
        q: `${exerciseName} exercise tutorial proper form how to`,
        type: "video",
        maxResults: 10,
        order: "relevance",
        videoDuration: "short", // Under 4 minutes - quick refreshers
        relevanceLanguage: "en",
        safeSearch: "strict",
      });

      if (!response.data.items || response.data.items.length === 0) {
        this.logger.debug("No YouTube videos found", { exerciseName });
        return null;
      }

      // List of reputable fitness channels (lowercase for matching)
      const reputableChannels = [
        "athlean-x",
        "athleanx",
        "jeff nippard",
        "scott herman",
        "scotthermanfitness",
        "squat university",
        "barbell medicine",
        "renaissance periodization",
        "mind pump",
        "jeff cavaliere",
        "jeremy ethier",
        "omar isuf",
        "alan thrall",
        "mark rippetoe",
        "starting strength",
        "stronger by science",
        "juggernaut training systems",
        "calgary barbell",
        "brian alsruhe",
      ];

      // Try to find video from reputable channel first
      for (const item of response.data.items) {
        const channelTitle = item.snippet.channelTitle.toLowerCase();
        const isReputable = reputableChannels.some((channel) =>
          channelTitle.includes(channel)
        );

        if (isReputable) {
          const url = `https://www.youtube.com/watch?v=${item.id.videoId}`;
          this.logger.info("Found reputable YouTube video", {
            exerciseName,
            channel: item.snippet.channelTitle,
            title: item.snippet.title,
            url,
          });
          return url;
        }
      }

      // If no reputable channel found, return first result
      const firstVideo = response.data.items[0];
      const url = `https://www.youtube.com/watch?v=${firstVideo.id.videoId}`;

      this.logger.info(
        "Using first YouTube result (no reputable channel found)",
        {
          exerciseName,
          channel: firstVideo.snippet.channelTitle,
          title: firstVideo.snippet.title,
          url,
        }
      );

      return url;
    } catch (error) {
      this.logger.warn("YouTube API search failed", {
        exerciseName,
        error: error.message,
        code: error.code,
      });
      return null; // Fail gracefully
    }
  }

  /**
   * Generate exercise details using LLM
   * @param {string} exerciseName - Name of the exercise
   * @returns {Promise<Object>} Exercise details with instructions, YouTube URL, body parts, and type
   */
  async generateExerciseDetails(exerciseName) {
    try {
      // Updated prompt - LLM should NOT generate YouTube URLs anymore
      const prompt = `Given the exercise name "${exerciseName}", provide detailed information in JSON format with the following structure:

{
  "instructions": "Easy-to-follow step-by-step instructions for performing this exercise. Be clear and concise, breaking down the movement into numbered steps, each with a newline character.",
  "body_parts": ["array", "of", "targeted", "body", "parts"],
  "category": "category_enum_value"
}

Category rules (select ONE based on exercise mechanics):
- "barbell_dumbbell": Weighted movements (Bench press, squats, curls, deadlifts)
- "bodyweight": Bodyweight strength (Push-ups, pull-ups, air squats, dips)
- "assisted": Band or machine assisted exercises (Band pull-ups, assisted dips)
- "machine": Pin-loaded or plate-loaded machines (Leg press, pec deck, lat pulldown)
- "isometric": Static holds (Plank, wall sit, dead hang)
- "cardio_distance": Distance-based cardio (Running, cycling, rowing, walking)
- "cardio_time": Time/Calorie-based cardio (Elliptical, stair climber, assault bike, jump rope)
- "interval": HIIT, circuits, rounds (Burpees, box jumps, battle ropes)
- "mobility": Stretching, foam rolling, yoga poses
- "skill": Technique practice (Handstands, double unders, olympic lifting drills)

Return ONLY valid JSON, no additional text or markdown formatting.`;

      const response = await this.llm.callTogetherAI(prompt, {
        model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        max_tokens: 1000,
        temperature: 0.7,
      });

      this.logger.debug("LLM response for exercise generation", {
        exerciseName,
        responseLength: response.length,
        responsePreview: response.substring(0, 200),
      });

      // Parse JSON response
      let exerciseData;
      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedResponse = response.trim();

        // Remove markdown code block markers
        cleanedResponse = cleanedResponse.replace(/^```json\s*/i, "");
        cleanedResponse = cleanedResponse.replace(/^```\s*/i, "");
        cleanedResponse = cleanedResponse.replace(/\s*```$/i, "");
        cleanedResponse = cleanedResponse.trim();

        // Try to extract JSON object from response
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          exerciseData = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the whole cleaned response
          exerciseData = JSON.parse(cleanedResponse);
        }
      } catch (parseError) {
        this.logger.error("Failed to parse LLM response as JSON", {
          exerciseName,
          response: response.substring(0, 500), // Log first 500 chars
          error: parseError.message,
        });

        // Fallback: create a basic exercise structure with inferred type
        const nameLower = exerciseName.toLowerCase();
        let inferredType = "weight";
        if (
          nameLower.includes("treadmill") ||
          nameLower.includes("run") ||
          nameLower.includes("jog")
        ) {
          inferredType = "treadmill";
        } else if (
          nameLower.includes("push") ||
          nameLower.includes("pull") ||
          nameLower.includes("squat") ||
          nameLower.includes("plank") ||
          nameLower.includes("sit-up") ||
          nameLower.includes("crunch")
        ) {
          inferredType = "bodyweight";
        }

        this.logger.warn("Using fallback exercise data due to parse error", {
          exerciseName,
          inferredType,
        });

        exerciseData = {
          instructions: `Perform ${exerciseName}. Focus on proper form and controlled movements.`,
          youtube_url: null,
          body_parts: [],
          exercise_type: inferredType,
        };
      }

      // Validate required fields
      if (!exerciseData.instructions) {
        throw new Error("LLM response missing instructions");
      }
      if (!exerciseData.category && !exerciseData.exercise_type) {
        throw new Error("LLM response missing category");
      }
      if (!Array.isArray(exerciseData.body_parts)) {
        exerciseData.body_parts = [];
      }

      // Map old fields if necessary or validate category
      let category = exerciseData.category;

      // Fallback mapping if LLM returns old format
      if (!category && exerciseData.exercise_type) {
        const type = exerciseData.exercise_type.toLowerCase();
        if (type === "weight") category = "barbell_dumbbell";
        else if (type === "bodyweight") category = "bodyweight";
        else if (type === "treadmill") category = "cardio_distance";
      }

      // Valid categories list
      const validCategories = [
        "barbell_dumbbell",
        "bodyweight",
        "assisted",
        "machine",
        "isometric",
        "cardio_distance",
        "cardio_time",
        "interval",
        "mobility",
        "skill",
      ];

      if (!category || !validCategories.includes(category)) {
        // Try to infer from name if missing or invalid
        const nameLower = exerciseName.toLowerCase();
        if (
          nameLower.includes("run") ||
          nameLower.includes("cycle") ||
          nameLower.includes("row")
        ) {
          category = "cardio_distance";
        } else if (
          nameLower.includes("elliptical") ||
          nameLower.includes("stair")
        ) {
          category = "cardio_time";
        } else if (nameLower.includes("plank") || nameLower.includes("hold")) {
          category = "isometric";
        } else if (
          nameLower.includes("stretch") ||
          nameLower.includes("roll")
        ) {
          category = "mobility";
        } else if (nameLower.includes("machine")) {
          category = "machine";
        } else if (nameLower.includes("band") && nameLower.includes("assist")) {
          category = "assisted";
        } else if (
          nameLower.includes("body") ||
          nameLower.includes("push-up") ||
          nameLower.includes("pull-up")
        ) {
          category = "bodyweight";
        } else {
          category = "barbell_dumbbell"; // Default fallback
        }

        this.logger.warn(
          "Invalid/missing category from LLM, inferred from name",
          {
            exerciseName,
            llmCategory: exerciseData.category,
            inferredCategory: category,
          }
        );
      }

      // Search YouTube for real video (using YouTube API instead of LLM)
      this.logger.info("Searching for YouTube video via API", { exerciseName });
      const youtubeUrl = await this.searchYouTubeVideo(exerciseName);

      if (youtubeUrl) {
        this.logger.info("YouTube video found successfully", {
          exerciseName,
          youtubeUrl,
        });
      } else {
        this.logger.info("No YouTube video found, will save as null", {
          exerciseName,
        });
      }

      return {
        instructions: exerciseData.instructions,
        youtubeUrl: youtubeUrl, // Now from YouTube API, not LLM
        bodyParts: exerciseData.body_parts || [],
        category: category,
        exerciseType: category,
      };
    } catch (error) {
      this.logger.error("Error generating exercise details", {
        exerciseName,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ExerciseLLMService;
