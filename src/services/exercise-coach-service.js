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

    // Lazy load services to avoid circular dependency
    this._exerciseService = null;
    this._healthContextBuilder = null;

    // Track active analysis jobs to prevent duplicate triggers
    this.activeAnalyses = new Set();
  }

  get exerciseService() {
    if (!this._exerciseService) {
      const ExerciseService = require("./exercise-service");
      this._exerciseService = new ExerciseService(this.database, this.logger);
    }
    return this._exerciseService;
  }

  get healthContextBuilder() {
    if (!this._healthContextBuilder) {
      const HealthContextBuilder = require("./health-context-builder");
      this._healthContextBuilder = new HealthContextBuilder(
        this.database,
        this.logger
      );
    }
    return this._healthContextBuilder;
  }

  /**
   * Analyze a completed workout
   * @param {number} workoutId - Workout session ID
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeWorkout(workoutId) {
    try {
      if (this.activeAnalyses.has(workoutId)) {
        this.logger.info(
          `🤖 [Coach] Analysis for workout ${workoutId} is already in progress. Skipping trigger.`
        );
        return null;
      }

      this.activeAnalyses.add(workoutId);

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
          equipmentUsed: entry.equipment_used,
          currentPerformance: {
            sets:
              entry.sets && entry.sets.length > 0
                ? entry.sets.length
                : entry.sets_performed,
            reps:
              entry.sets && entry.sets.length > 0
                ? entry.sets.map((s) => s.reps)
                : entry.reps_performed,
            weight:
              entry.sets && entry.sets.length > 0
                ? entry.sets.map((s) => s.weight)
                : entry.weight_used,
            duration:
              entry.sets && entry.sets.length > 0
                ? entry.sets.map((s) => s.duration)
                : entry.duration_seconds,
            notes: entry.notes,
          },
          historySummary: history[0] || null,
          recentLogs,
        });
      }

      // 4. Calculate basic stats
      const stats = this._calculateWorkoutStats(workout);

      // 5. Fetch comprehensive health context
      let healthText = "";
      try {
        const healthContext = await this.healthContextBuilder.buildContext(
          userId,
          { timeRange: "week" }
        );
        healthText =
          this.healthContextBuilder.formatContextForPrompt(healthContext);
      } catch (healthError) {
        this.logger.warn(
          `⚠️ [Coach] Failed to fetch health context for user ${userId}:`,
          healthError
        );
      }

      // 6. Construct AI Prompt
      const prompt = this._buildAnalysisPrompt(
        workout,
        routine,
        exerciseAnalysisContext,
        stats,
        healthText
      );

      // 7. Call LLM
      const startTime = Date.now();
      this.logger.info(
        `🤖 [Coach] Calling LLM for analysis of workout ${workoutId}... (Prompt size: ${prompt.length} chars)`
      );
      const response = await this.llm.callTogetherAI(prompt, {
        model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        max_tokens: 1500,
        temperature: 0.7,
        systemMessage: `You are an expert strength coach and nutrition-adjacent fitness advisor focused on sustainable fat loss, performance, and joint longevity. Your job is to analyze a user’s completed workout and produce specific, actionable coaching feedback using the user’s recent training history and constraints.

          NON-NEGOTIABLES
          - Do NOT be generic. Avoid “great job” unless followed by concrete, specific observations.
          - Do NOT hallucinate. If a detail is missing (e.g., prior weights, pain score), say what you can and ask for exactly one missing input at the end (only if it materially changes advice).
          - Safety first: if the user reports sharp pain, instability, numbness/tingling, or rapidly worsening symptoms, advise stopping and seeking medical evaluation. Otherwise, give training modifications.
          - Keep advice practical and immediately usable in the next session.
          - The user has a history of ACL/MCL surgery and occasional knee popping/slippage when overworked. Optimize for knee-friendly progress.
          - The user’s primary goal is fat loss/body recomposition; secondary goal is knee health/longevity.

          INPUTS YOU WILL RECEIVE (may be partial)
          - Session Overview: Date, Total Duration, Active Exercise Time, Total Volume, and Estimated Calories.
          - Exercise Details: For each exercise performed:
              - Name and equipment.
              - Current Performance: Sets, reps per set, weight per set, and any exercise-specific notes.
              - Recent History: The last 5 times this specific exercise was performed (sets, reps, weight, and date).
              - All-time Averages: Long-term averages for sets, reps, and weight.
          - Routine Context: If based on a routine, you will see target sets/reps to compare against actual performance.
          - User Health Data (Apple HealthKit):
              - Activity & Fitness: Daily steps, exercise minutes, and active calories.
              - Body Metrics: Weight and trends.
              - Health & Vitals: Resting heart rate and heart rate variability (HRV).
              - Sleep: Hours, quality scores, and patterns.
              - Nutrition: Caloric intake and hydration (if available).
              - Insights: Correlations (e.g., sleep vs. activity) and anomalies.
          - User Feedback: Overall session notes regarding fatigue, energy, or specific observations.

          YOUR OUTPUT FORMAT (follow exactly)
          1) Title line: “Workout Review — {date or day} — {workout_name}”
          2) 3–5 bullet “Key Wins” (specific to today’s data)
          3) “Key Flags (if any)” (0–3 bullets). Only include if actionable (e.g., form drift, joint warning signs, recovery debt).
          4) Exercise-by-exercise coaching (table-like bullets):
            - Exercise: what went well + one improvement cue + next progression recommendation.
            - Compare to recent history when available: note up/down in load/reps/quality.
          5) “Next Workout Plan Adjustments” (2–5 bullets):
            - What to keep the same
            - What to progress (and how: load vs reps vs tempo vs ROM)
            - What to regress/modify (if needed) due to fatigue or knee signal
          6) “One thing to focus on next session” (single sentence, high leverage)

          COACHING LOGIC / RULES
          - Progression priority order when equipment jumps are large: (1) reps, (2) tempo (slow eccentrics/pauses), (3) ROM quality, (4) load.
          - For compound lifts: aim to stay 1–2 reps shy of failure most sets; allow failure only on the final set occasionally.
          - If user did a double-session or is behind schedule: prioritize “volume completion” and reduce intensity; suggest trimming 1 set per accessory to manage recovery.
          - Knee-safe heuristics:
            - Prefer hip-dominant patterns (RDL, hip thrust) when knee is sensitive.
            - For knee-dominant work, keep shin more vertical, control eccentrics, and use isometrics (wall sits/TKEs) when needed.
          - Fat loss context:
            - Encourage consistency, weekly adherence, and recovery behaviors.

          TONE
          Direct, supportive, no hype. Speak like a pragmatic coach. Use simple language. Use numbers from the workout when possible. Be specific about rationale when suggesting modifications to the routine.

          EXAMPLE OF SPECIFICITY
          Bad: “Nice work today, keep it up.”
          Good: “Your hip thrust hit 4×12 at 135 with only a small rep drop—stay at 135 next session and aim for 12/12/12/12 before adding load.”

          Now produce the workout review using the provided inputs.`,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(
        `✅ [Coach] Received LLM response for workout ${workoutId} in ${duration}s`
      );

      this.logger.debug(
        `🤖 [Coach] LLM Raw Response for workout ${workoutId}: ${response.substring(
          0,
          500
        )}...`
      );

      // 8. Parse and save analysis
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
    } finally {
      this.activeAnalyses.delete(workoutId);
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
    let totalActiveSeconds = 0;

    for (const entry of workout.entries) {
      // 1. Calculate Active Time for this exercise
      if (entry.started_at && entry.ended_at) {
        const start = new Date(entry.started_at);
        const end = new Date(entry.ended_at);
        const diff = (end - start) / 1000;
        if (diff > 0) totalActiveSeconds += diff;
      } else if (
        entry.duration_seconds &&
        Array.isArray(entry.duration_seconds)
      ) {
        // Fallback to individual set durations if timestamps are missing
        totalActiveSeconds += entry.duration_seconds.reduce(
          (a, b) => a + (b || 0),
          0
        );
      }

      // 2. Use the 'sets' array which is the primary source of truth now
      const sets = entry.sets || [];
      totalSets += sets.length > 0 ? sets.length : entry.sets_performed || 0;

      if (sets.length > 0) {
        for (const set of sets) {
          const r = set.reps || 0;
          const w = set.weight || 0;
          totalReps += r;
          totalVolume += r * w;

          // If individual set has duration but entry doesn't have start/end
          if (!entry.started_at && set.duration) {
            // This might overcount if we already used entry.duration_seconds,
            // but the PRD/models prioritize the sets array now.
            // We've already handled duration_seconds above, so we'll be careful.
          }
        }
      } else {
        // Fallback to legacy fields if sets array is empty
        const reps = entry.reps_performed || [];
        const weights = entry.weight_used || [];

        for (let i = 0; i < reps.length; i++) {
          const r = reps[i] || 0;
          const w = weights[i] || 0;
          totalReps += r;
          totalVolume += r * w;
        }
      }
    }

    // Calculate total session time for comparison (sanity check)
    let sessionMins = 0;
    if (workout.started_at && workout.ended_at) {
      const sStart = new Date(workout.started_at);
      const sEnd = new Date(workout.ended_at);
      sessionMins = Math.round((sEnd - sStart) / 1000 / 60);
    } else {
      sessionMins = workout.total_duration_minutes || 0;
    }

    // Determine final duration to use for analysis
    // We prioritize Active Time (converted to mins) if we have it,
    // otherwise fallback to the session-level duration or the hardcoded 45.
    const activeMins = Math.round(totalActiveSeconds / 60);
    const finalDurationMins =
      activeMins > 0 ? activeMins : sessionMins > 0 ? sessionMins : 45;

    // Rough calorie estimation based on duration and intensity
    // Assuming ~5-8 kcal per minute for moderate strength training
    // If we use active time, we use a slightly higher multiplier (7.5)
    // than the total session time (6.5) because the rest periods are excluded.
    const kcalMultiplier = activeMins > 0 ? 8.0 : 6.5;
    const estimatedCalories = Math.round(finalDurationMins * kcalMultiplier);

    return {
      calories: estimatedCalories,
      volume_lbs: totalVolume,
      duration_mins: finalDurationMins,
      session_total_mins: sessionMins,
      active_mins: activeMins,
      total_reps: totalReps,
      total_sets: totalSets,
    };
  }

  /**
   * Build the analysis prompt for the LLM
   * @private
   */
  _buildAnalysisPrompt(workout, routine, context, stats, healthText) {
    let prompt = `Analyze this workout as a professional fitness instructor. 

**Workout Overview:**
- Date: ${workout.exercise_date}
- Total Duration: ${stats.session_total_mins} minutes
- Active Exercise Time: ${stats.active_mins} minutes
- Total Volume: ${stats.volume_lbs} lbs
- Total Reps: ${stats.total_reps}
- Total Sets: ${stats.total_sets}
- Estimated Calories: ${stats.calories}
${workout.notes ? `- User Notes: ${workout.notes}` : ""}

**Exercises Performed:**
`;

    for (const item of context) {
      prompt += `\n### ${item.exerciseName}${
        item.equipmentUsed ? ` (${item.equipmentUsed})` : ""
      }\n`;
      prompt += `- Today: ${item.currentPerformance.sets} sets. `;

      if (
        item.currentPerformance.reps &&
        item.currentPerformance.reps.length > 0
      ) {
        const details = item.currentPerformance.reps
          .map((r, i) => {
            const w = item.currentPerformance.weight
              ? item.currentPerformance.weight[i]
              : null;
            return w ? `${r} @ ${w} lbs` : `${r} reps`;
          })
          .join(", ");
        prompt += `Performance: [${details}]. `;
      }

      if (item.currentPerformance.notes) {
        prompt += `\n- Exercise Notes: ${item.currentPerformance.notes}`;
      }

      if (item.recentLogs && item.recentLogs.length > 0) {
        prompt += `\n- Recent History (Last 5 Sessions):`;
        item.recentLogs.forEach((log) => {
          let histDetails = "";

          // Use 'sets' array if available in history logs
          if (log.sets && Array.isArray(log.sets)) {
            histDetails = log.sets
              .map((s) =>
                s.weight ? `${s.reps}@${s.weight}lbs` : `${s.reps} reps`
              )
              .join(", ");
          } else if (log.reps_performed && Array.isArray(log.reps_performed)) {
            // Legacy fallback
            histDetails = log.reps_performed
              .map((r, i) => {
                const w = log.weight_used ? log.weight_used[i] : null;
                return w ? `${r}@${w}lbs` : `${r} reps`;
              })
              .join(", ");
          }

          prompt += `\n  * ${new Date(
            log.exercise_date
          ).toLocaleDateString()}: [${histDetails}]`;
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

    if (healthText) {
      prompt += `\n\n**User Health Context (Recent Trends):**\n${healthText}`;
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
      "current": { "sets": 3, "reps_min": 10, "reps_max": 12 },
      "suggested": { "sets": 4, "reps_min": 8, "reps_max": 10 },
      "reason": "Reason for tweak"
    }
  ]
}

**IMPORTANT:** For "routine_tweaks", provide both "reps_min" and "reps_max" to define the target range.

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
