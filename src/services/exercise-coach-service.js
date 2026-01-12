/**
 * Exercise Coach Service
 * Provides AI-powered analysis of workouts, spots trends, and suggests routine improvements.
 */

const LLMAgeEvaluator = require("./llm-age-evaluator");

class ExerciseCoachService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.llm = new LLMAgeEvaluator(logger);

    // Lazy load ExerciseService to avoid circular dependency
    this._exerciseService = null;
  }

  get exerciseService() {
    if (!this._exerciseService) {
      const ExerciseService = require("./exercise-service");
      this._exerciseService = new ExerciseService(this.database, this.logger);
    }
    return this._exerciseService;
  }

  /**
   * Analyze a completed workout
   * @param {number} workoutId - Workout session ID
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeWorkout(workoutId) {
    try {
      this.logger.info(
        `🤖 [Coach] Starting analysis for workout ${workoutId}...`
      );

      // 1. Fetch workout data
      const workout = await this.exerciseService.getWorkoutLog(workoutId);
      if (!workout) {
        throw new Error(`Workout ${workoutId} not found`);
      }

      const userId = workout.user_id;

      // 2. Fetch routine if applicable
      let routine = null;
      if (workout.routine_id) {
        routine = await this.exerciseService.getRoutine(workout.routine_id);
      }

      // 3. Fetch history for each exercise in the workout
      const exerciseAnalysisContext = [];
      for (const entry of workout.entries) {
        const history = await this.exerciseService.getExerciseHistory(
          userId,
          entry.exercise_name
        );
        const recentLogs = await this._getRecentExercisePerformances(
          userId,
          entry.exercise_name,
          5
        );

        exerciseAnalysisContext.push({
          exerciseName: entry.exercise_name,
          currentPerformance: {
            sets: entry.sets_performed,
            reps: entry.reps_performed,
            weight: entry.weight_used,
            duration: entry.duration_seconds,
            notes: entry.notes,
          },
          historySummary: history[0] || null,
          recentLogs,
        });
      }

      // 4. Calculate basic stats
      const stats = this._calculateWorkoutStats(workout);

      // 5. Construct AI Prompt
      const prompt = this._buildAnalysisPrompt(
        workout,
        routine,
        exerciseAnalysisContext,
        stats
      );

      // 6. Call LLM
      this.logger.info(
        `🤖 [Coach] Calling LLM for analysis of workout ${workoutId}...`
      );
      const response = await this.llm.callTogetherAI(prompt, {
        model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        max_tokens: 1500,
        temperature: 0.7,
        systemMessage: `You are an experienced, evidence-based fitness coach and strength instructor.

Analyze the user’s logged workout data (exercises, sets, reps, load, rest, notes, and history) and provide specific, actionable coaching feedback.

Your goals:
1. Identify progress, plateaus, regressions, and fatigue signals
2. Compare today’s performance to prior sessions of the same exercise
3. Recommend clear next-step adjustments (weight, reps, sets, tempo, rest, or exercise selection)

Coaching rules:
- Do not use generic praise (e.g., “good job”, “nice workout”) unless paired with concrete evidence
- Always reference at least one quantitative change (weight, reps, sets, volume, or RPE) when possible
- Explicitly call out increases, decreases, or stagnation in performance
- Incorporate the user’s notes, stated goals, and preferences into your guidance
- Flag potential recovery issues, form breakdown risk, or programming imbalance when relevant

Output style:
- Be concise, confident, and practical
- Prefer short sections or bullets over paragraphs
- Focus on what to do next session

If data is missing or ambiguous:
- State assumptions clearly
- Offer 1–2 safe, conservative recommendations rather than guessing

Your role is to coach, not narrate.`,
      });

      this.logger.debug(
        `🤖 [Coach] LLM Raw Response for workout ${workoutId}: ${response.substring(
          0,
          500
        )}...`
      );

      // 7. Parse and save analysis
      const analysis = this._parseAnalysisResponse(response);
      this.logger.info(
        `🤖 [Coach] Parsed analysis for workout ${workoutId}, saving to DB...`
      );

      const savedAnalysis = await this._saveAnalysis(
        workoutId,
        userId,
        analysis,
        stats
      );

      this.logger.info(
        `✅ [Coach] Analysis completed and saved for workout ${workoutId}. ID: ${savedAnalysis.id}`
      );
      return savedAnalysis;
    } catch (error) {
      this.logger.error(
        `❌ [Coach] Error analyzing workout ${workoutId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get recent performances for a specific exercise
   * @private
   */
  async _getRecentExercisePerformances(userId, exerciseName, limit) {
    try {
      const sql = `
        SELECT e.reps_performed, e.weight_used, e.duration_seconds, l.exercise_date, l.id as workout_id
        FROM exercise_log_entries e
        JOIN exercise_logs l ON e.log_id = l.id
        WHERE l.user_id = $1 
        AND LOWER(e.exercise_name) = LOWER($2)
        AND l.deleted_at IS NULL
        AND e.deleted_at IS NULL
        ORDER BY l.exercise_date DESC
        LIMIT $3
      `;
      const result = await this.database.query(sql, [
        userId,
        exerciseName,
        limit,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error fetching recent performances for ${exerciseName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Calculate basic workout stats
   * @private
   */
  _calculateWorkoutStats(workout) {
    let totalVolume = 0;
    let totalReps = 0;
    let totalSets = 0;

    for (const entry of workout.entries) {
      totalSets += entry.sets_performed;

      const reps = entry.reps_performed || [];
      const weights = entry.weight_used || [];

      for (let i = 0; i < reps.length; i++) {
        const r = reps[i] || 0;
        const w = weights[i] || 0;
        totalReps += r;
        totalVolume += r * w;
      }
    }

    // Rough calorie estimation based on duration and intensity
    // Assuming ~5-8 kcal per minute for moderate strength training
    const durationMins = workout.total_duration_minutes || 45;
    const estimatedCalories = Math.round(durationMins * 6.5);

    return {
      calories: estimatedCalories,
      volume_lbs: totalVolume,
      duration_mins: durationMins,
      total_reps: totalReps,
      total_sets: totalSets,
    };
  }

  /**
   * Build the analysis prompt for the LLM
   * @private
   */
  _buildAnalysisPrompt(workout, routine, context, stats) {
    let prompt = `Analyze this workout as a professional fitness instructor. 

**Workout Overview:**
- Date: ${workout.exercise_date}
- Duration: ${stats.duration_mins} minutes
- Total Volume: ${stats.volume_lbs} lbs
- Total Reps: ${stats.total_reps}
- Total Sets: ${stats.total_sets}
- Estimated Calories: ${stats.calories}
${workout.notes ? `- User Notes: ${workout.notes}` : ""}

**Exercises Performed:**
`;

    for (const item of context) {
      prompt += `\n### ${item.exerciseName}\n`;
      prompt += `- Today: ${item.currentPerformance.sets} sets. `;
      if (item.currentPerformance.reps.length > 0) {
        const details = item.currentPerformance.reps
          .map((r, i) => {
            const w = item.currentPerformance.weight[i];
            return w ? `${r} @ ${w} lbs` : `${r} reps`;
          })
          .join(", ");
        prompt += `Reps/Weight: [${details}]. `;
      }

      if (item.recentLogs && item.recentLogs.length > 0) {
        prompt += `\n- Recent History (Last 5 Sessions):`;
        item.recentLogs.forEach((log) => {
          const histDetails = log.reps_performed
            .map((r, i) => {
              const w = log.weight_used[i];
              return w ? `${r}@${w}lbs` : `${r} reps`;
            })
            .join(", ");
          prompt += `\n  * ${log.exercise_date}: ${log.reps_performed.length} sets [${histDetails}]`;
        });
      } else if (item.historySummary) {
        prompt += `\n- All-time Averages: ${item.historySummary.average_sets} sets, ${item.historySummary.average_reps} reps, ${item.historySummary.average_weight} lbs.`;
      }
    }

    if (routine) {
      prompt += `\n\n**Routine Context:**
- Routine Name: ${routine.routine_name}
- Routine Exercises: ${routine.exercises
        .map(
          (e) =>
            `${e.exercise_name} (Target: ${e.target_sets} sets of ${
              e.target_reps_min
            }${e.target_reps_max ? "-" + e.target_reps_max : ""} reps)`
        )
        .join(", ")}
`;
    }

    prompt += `
\n**Task:**
1. Provide a concise, motivating analysis (Fitness Instructor persona).
2. Spot any specific trends or progressions (e.g., "You increased your bench press weight by 5 lbs since last week").
3. Suggest 1-2 future exercises or focus areas.
4. If this was based on a routine, suggest 1-2 SPECIFIC tweaks to the routine (sets, reps, or equipment) based on performance.

**Output Format (Strict JSON):**
{
  "analysis_text": "Your motivating feedback here...",
  "trends": ["Trend 1", "Trend 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "routine_tweaks": [
    {
      "exercise": "Exercise Name",
      "current": { "sets": 3, "reps": 10 },
      "suggested": { "sets": 4, "reps": 8 },
      "reason": "Reason for tweak"
    }
  ]
}

**IMPORTANT:** For "routine_tweaks", the "reps" field MUST be a single integer, NOT an array. Use the most common rep count or the target rep count from the routine.

Return ONLY the JSON.`;

    return prompt;
  }

  /**
   * Parse LLM response
   * @private
   */
  _parseAnalysisResponse(response) {
    try {
      // Clean markdown if present
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^```json\s*/i, "");
      cleaned = cleaned.replace(/^```\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/i, "");

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error("Failed to parse AI analysis response:", error);
      return {
        analysis_text: response,
        trends: [],
        suggestions: [],
        routine_tweaks: [],
      };
    }
  }

  /**
   * Save analysis to database
   * @private
   */
  async _saveAnalysis(workoutId, userId, analysis, stats) {
    const sql = `
      INSERT INTO workout_analysis (
        workout_id, user_id, analysis_text, stats, routine_tweaks
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    // Combine analysis trends/suggestions into the text if needed,
    // or keep them structured in the table if we update schema.
    // For now, let's keep the table as planned.

    const result = await this.database.query(sql, [
      workoutId,
      userId,
      analysis.analysis_text,
      JSON.stringify(stats),
      JSON.stringify(analysis.routine_tweaks || []),
    ]);

    return result.rows[0];
  }

  /**
   * Get analysis for a workout
   * @param {number} workoutId
   * @returns {Promise<Object|null>}
   */
  async getAnalysis(workoutId) {
    try {
      const sql = `SELECT * FROM workout_analysis WHERE workout_id = $1`;
      const result = await this.database.query(sql, [workoutId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Error fetching analysis for ${workoutId}:`, error);
      throw error;
    }
  }

  /**
   * Placeholder for legacy suggestions functionality
   * @param {number} userId
   * @param {number} logEntryId
   */
  async generateSuggestions(userId, logEntryId) {
    this.logger.info(`Legacy suggestions requested for ${logEntryId}`);
    return [];
  }
}

module.exports = ExerciseCoachService;
