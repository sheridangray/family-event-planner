/**
 * Exercise LLM Service
 * Generates exercise details using LLM (instructions, YouTube link, body parts, type detection)
 */

const { LLMAgeEvaluator } = require('./llm-age-evaluator');

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
  "instructions": "Easy-to-follow step-by-step instructions for performing this exercise. Be clear and concise, breaking down the movement into numbered steps.",
  "youtube_url": "A YouTube video URL with instructions for this exercise. Search for a high-quality instructional video and provide the full URL. If no good video is found, return null.",
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
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        max_tokens: 1000,
        temperature: 0.7,
      });

      // Parse JSON response
      let exerciseData;
      try {
        // Try to extract JSON from response (handle markdown code blocks)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          exerciseData = JSON.parse(jsonMatch[0]);
        } else {
          exerciseData = JSON.parse(response);
        }
      } catch (parseError) {
        this.logger.error('Failed to parse LLM response as JSON', {
          response,
          error: parseError.message,
        });
        throw new Error('Failed to parse exercise details from LLM response');
      }

      // Validate required fields
      if (!exerciseData.instructions) {
        throw new Error('LLM response missing instructions');
      }
      if (!exerciseData.exercise_type) {
        throw new Error('LLM response missing exercise_type');
      }
      if (!Array.isArray(exerciseData.body_parts)) {
        exerciseData.body_parts = [];
      }

      // Normalize exercise type
      const validTypes = ['weight', 'bodyweight', 'treadmill'];
      if (!validTypes.includes(exerciseData.exercise_type.toLowerCase())) {
        // Try to infer from exercise name if type is invalid
        const nameLower = exerciseName.toLowerCase();
        if (nameLower.includes('treadmill') || nameLower.includes('run') || nameLower.includes('jog')) {
          exerciseData.exercise_type = 'treadmill';
        } else if (nameLower.includes('push') || nameLower.includes('pull') || nameLower.includes('squat') || nameLower.includes('plank')) {
          exerciseData.exercise_type = 'bodyweight';
        } else {
          exerciseData.exercise_type = 'weight';
        }
        this.logger.warn('Invalid exercise type from LLM, inferred from name', {
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
      this.logger.error('Error generating exercise details', {
        exerciseName,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = { ExerciseLLMService };

