/**
 * Exercise LLM Service
 * Generates exercise details using LLM (instructions, YouTube link, body parts, type detection)
 */

const LLMAgeEvaluator = require("./llm-age-evaluator");

class ExerciseLLMService {
  constructor(logger) {
    this.logger = logger;
    this.llm = new LLMAgeEvaluator(logger);
  }

  /**
   * Generate exercise details using LLM
   * @param {string} exerciseName - Name of the exercise
   * @returns {Promise<Object>} Exercise details with instructions, YouTube URL, body parts, and type
   */
  async generateExerciseDetails(exerciseName) {
    try {
      const prompt = `Given the exercise name "${exerciseName}", provide detailed information in JSON format with the following structure:

{
  "instructions": "Easy-to-follow step-by-step instructions for performing this exercise. Be clear and concise, breaking down the movement into numbered steps, each with a newline character.",
  "youtube_url": "A YouTube video URL with instructions for this exercise. Validate that this is a valid and working YouTube video URL. Search for a high-quality instructional video and provide the full URL. If no good video is found, return null.",
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
        if (type === 'weight') category = 'barbell_dumbbell';
        else if (type === 'bodyweight') category = 'bodyweight';
        else if (type === 'treadmill') category = 'cardio_distance';
      }

      // Valid categories list
      const validCategories = [
        'barbell_dumbbell', 'bodyweight', 'assisted', 'machine', 'isometric',
        'cardio_distance', 'cardio_time', 'interval', 'mobility', 'skill'
      ];

      if (!category || !validCategories.includes(category)) {
        // Try to infer from name if missing or invalid
        const nameLower = exerciseName.toLowerCase();
        if (nameLower.includes("run") || nameLower.includes("cycle") || nameLower.includes("row")) {
          category = "cardio_distance";
        } else if (nameLower.includes("elliptical") || nameLower.includes("stair")) {
          category = "cardio_time";
        } else if (nameLower.includes("plank") || nameLower.includes("hold")) {
          category = "isometric";
        } else if (nameLower.includes("stretch") || nameLower.includes("roll")) {
          category = "mobility";
        } else if (nameLower.includes("machine")) {
          category = "machine";
        } else if (nameLower.includes("band") && nameLower.includes("assist")) {
          category = "assisted";
        } else if (nameLower.includes("body") || nameLower.includes("push-up") || nameLower.includes("pull-up")) {
          category = "bodyweight";
        } else {
          category = "barbell_dumbbell"; // Default fallback
        }
        
        this.logger.warn("Invalid/missing category from LLM, inferred from name", {
          exerciseName,
          llmCategory: exerciseData.category,
          inferredCategory: category
        });
      }

      return {
        instructions: exerciseData.instructions,
        youtubeUrl: exerciseData.youtube_url || null,
        bodyParts: exerciseData.body_parts || [],
        category: category, // Return the new category field
        exerciseType: category // Keep backward compatibility internally if needed, but we should move to category
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
