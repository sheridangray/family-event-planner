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
  "exercise_type": "weight" | "bodyweight" | "treadmill"
}

Exercise type detection rules:
- "weight": Exercises that use external weights (dumbbells, barbells, machines, resistance bands)
- "bodyweight": Exercises that use only body weight (push-ups, pull-ups, squats, planks, etc.)
- "treadmill": Any treadmill or running exercise

Examples:
- "Bench Press" → type: "weight", body_parts: ["chest", "shoulders", "triceps"]
- "Push-ups" → type: "bodyweight", body_parts: ["chest", "shoulders", "triceps", "core"]
- "Treadmill Run" → type: "treadmill", body_parts: ["legs", "cardiovascular"]

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
      if (!exerciseData.exercise_type) {
        throw new Error("LLM response missing exercise_type");
      }
      if (!Array.isArray(exerciseData.body_parts)) {
        exerciseData.body_parts = [];
      }

      // Normalize exercise type
      const validTypes = ["weight", "bodyweight", "treadmill"];
      if (!validTypes.includes(exerciseData.exercise_type.toLowerCase())) {
        // Try to infer from exercise name if type is invalid
        const nameLower = exerciseName.toLowerCase();
        if (
          nameLower.includes("treadmill") ||
          nameLower.includes("run") ||
          nameLower.includes("jog")
        ) {
          exerciseData.exercise_type = "treadmill";
        } else if (
          nameLower.includes("push") ||
          nameLower.includes("pull") ||
          nameLower.includes("squat") ||
          nameLower.includes("plank")
        ) {
          exerciseData.exercise_type = "bodyweight";
        } else {
          exerciseData.exercise_type = "weight";
        }
        this.logger.warn("Invalid exercise type from LLM, inferred from name", {
          exerciseName,
          inferredType: exerciseData.exercise_type,
        });
      } else {
        exerciseData.exercise_type = exerciseData.exercise_type.toLowerCase();
      }

      return {
        instructions: exerciseData.instructions,
        youtubeUrl: exerciseData.youtube_url || null,
        bodyParts: exerciseData.body_parts || [],
        exerciseType: exerciseData.exercise_type,
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
