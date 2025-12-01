/**
 * Exercise Coach Service
 * Generates AI-powered exercise suggestions and recommendations
 */

const LLMAgeEvaluator = require('./llm-age-evaluator');
const ExerciseService = require('./exercise-service');

class ExerciseCoachService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.exerciseService = new ExerciseService(database, logger);

    // Initialize LLM client
    try {
      this.llmClient = new LLMAgeEvaluator(logger);
    } catch (error) {
      this.logger.warn('LLM client not available:', error.message);
      this.llmClient = null;
    }
  }

  /**
   * Generate AI suggestions for a specific workout log entry
   * @param {number} userId - User ID
   * @param {number} logEntryId - Log entry ID
   * @returns {Promise<Array>} Array of suggestions
   */
  async generateSuggestions(userId, logEntryId) {
    try {
      if (!this.llmClient) {
        throw new Error('LLM client not available. TOGETHER_AI_API_KEY required.');
      }

      // Get log entry details
      const logResult = await this.database.query(
        `SELECT 
          ele.*, el.exercise_date, el.user_id, el.routine_id
         FROM exercise_log_entries ele
         JOIN exercise_logs el ON ele.log_id = el.id
         WHERE ele.id = $1 AND el.user_id = $2`,
        [logEntryId, userId]
      );

      if (logResult.rows.length === 0) {
        throw new Error('Log entry not found');
      }

      const entry = logResult.rows[0];

      // Parse JSONB fields
      const repsPerformed = entry.reps_performed || [];
      const weightUsed = entry.weight_used || [];
      const durationSeconds = entry.duration_seconds || [];

      // Get exercise history for this exercise
      const history = await this.exerciseService.getExerciseHistory(
        userId,
        entry.exercise_name
      );

      // Get recent performances of this exercise
      const recentLogs = await this._getRecentExercisePerformances(
        userId,
        entry.exercise_name,
        5
      );

      // Build prompt
      const prompt = this._buildSuggestionPrompt(entry, history, recentLogs);

      // Call LLM
      const llmResponse = await this.llmClient.callTogetherAI(prompt, {
        model: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
        max_tokens: 500,
        temperature: 0.7,
        systemMessage: this._getSystemPrompt(),
      });

      // Parse suggestions
      const suggestions = this._parseSuggestions(llmResponse, entry);

      // Save suggestions to database
      for (const suggestion of suggestions) {
        await this.database.query(
          `INSERT INTO exercise_suggestions (
            user_id, log_entry_id, log_id, exercise_name,
            suggestion_type, suggestion_text, reasoning, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            logEntryId,
            entry.log_id,
            entry.exercise_name,
            suggestion.suggestionType,
            suggestion.suggestionText,
            suggestion.reasoning,
            suggestion.priority || 'medium',
          ]
        );
      }

      return suggestions;
    } catch (error) {
      this.logger.error(`Error generating suggestions for log entry ${logEntryId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze exercise progression over time
   * @param {number} userId - User ID
   * @param {string} exerciseName - Exercise name
   * @returns {Promise<Object>} Progression analysis
   */
  async analyzeProgression(userId, exerciseName) {
    try {
      // Get exercise history
      const history = await this.exerciseService.getExerciseHistory(userId, exerciseName);

      if (history.length === 0) {
        return {
          trend: 'no_data',
          message: 'Not enough data to analyze progression',
        };
      }

      // Get recent performances
      const recentLogs = await this._getRecentExercisePerformances(userId, exerciseName, 10);

      if (recentLogs.length < 3) {
        return {
          trend: 'insufficient_data',
          message: 'Need at least 3 performances to analyze progression',
        };
      }

      // Analyze trend (simplified - could be enhanced with statistical analysis)
      const trend = this._calculateTrend(recentLogs);

      return {
        trend,
        recentPerformances: recentLogs,
        history: history[0], // Most recent history record
      };
    } catch (error) {
      this.logger.error(`Error analyzing progression for ${exerciseName}:`, error);
      throw error;
    }
  }

  /**
   * Build suggestion prompt for LLM
   * @private
   */
  _buildSuggestionPrompt(entry, history, recentLogs) {
    const repsPerformed = entry.reps_performed || [];
    const weightUsed = entry.weight_used || [];
    const durationSeconds = entry.duration_seconds || [];

    let prompt = `Analyze this exercise performance and provide personalized suggestions:

Exercise: ${entry.exercise_name}
Equipment: ${entry.equipment_used || 'Not specified'}
Sets: ${entry.sets_performed}
Reps per set: ${repsPerformed.join(', ')}
${weightUsed.some(w => w !== null) ? `Weight per set: ${weightUsed.join(', ')} lbs` : ''}
${durationSeconds.length > 0 ? `Duration per set: ${durationSeconds.join(', ')} seconds` : ''}
Notes: ${entry.notes || 'None'}

`;

    if (history.length > 0) {
      const h = history[0];
      prompt += `Exercise History:
- Average sets: ${h.average_sets || 'N/A'}
- Average reps: ${h.average_reps || 'N/A'}
- Average weight: ${h.average_weight || 'N/A'} lbs
- Last performed: ${h.last_performed || 'N/A'}
- Progression trend: ${h.progression_trend || 'Unknown'}

`;
    }

    if (recentLogs.length > 0) {
      prompt += `Recent Performances:\n`;
      recentLogs.forEach((log, idx) => {
        prompt += `${idx + 1}. ${log.date}: ${log.repsPerformed?.join(', ') || 'N/A'} reps`;
        if (log.weightUsed?.some(w => w !== null)) {
          prompt += ` @ ${log.weightUsed.join(', ')} lbs`;
        }
        prompt += '\n';
      });
      prompt += '\n';
    }

    prompt += `Provide 1-3 specific, actionable suggestions for improvement. Format as JSON array:
[
  {
    "suggestionType": "progression|form|equipment|volume|rest",
    "suggestionText": "Specific suggestion text",
    "reasoning": "Why this suggestion",
    "priority": "high|medium|low"
  }
]`;

    return prompt;
  }

  /**
   * Parse LLM response into structured suggestions
   * @private
   */
  _parseSuggestions(llmResponse, entry) {
    try {
      // Try to extract JSON from response
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return Array.isArray(suggestions) ? suggestions : [suggestions];
      }

      // Fallback: parse as text
      return [{
        suggestionType: 'general',
        suggestionText: llmResponse.trim(),
        reasoning: 'AI-generated suggestion',
        priority: 'medium',
      }];
    } catch (error) {
      this.logger.error('Error parsing suggestions:', error);
      return [{
        suggestionType: 'general',
        suggestionText: llmResponse.trim(),
        reasoning: 'AI-generated suggestion',
        priority: 'medium',
      }];
    }
  }

  /**
   * Get system prompt for exercise coach
   * @private
   */
  _getSystemPrompt() {
    return `You are an expert exercise coach and personal trainer. You analyze workout performances and provide specific, actionable suggestions for improvement. Focus on:
- Progressive overload (increasing weight, reps, or sets)
- Form and technique improvements
- Equipment recommendations
- Volume and rest period optimization
- Injury prevention

Be encouraging, specific, and evidence-based in your recommendations.`;
  }

  /**
   * Get recent exercise performances
   * @private
   */
  async _getRecentExercisePerformances(userId, exerciseName, limit) {
    try {
      const result = await this.database.query(
        `SELECT 
          el.exercise_date,
          ele.reps_performed,
          ele.weight_used,
          ele.duration_seconds,
          ele.sets_performed
         FROM exercise_log_entries ele
         JOIN exercise_logs el ON ele.log_id = el.id
         WHERE el.user_id = $1 
           AND LOWER(ele.exercise_name) LIKE LOWER($2)
         ORDER BY el.exercise_date DESC
         LIMIT $3`,
        [userId, `%${exerciseName}%`, limit]
      );

      return result.rows.map(row => ({
        date: row.exercise_date,
        repsPerformed: row.reps_performed || [],
        weightUsed: row.weight_used || [],
        durationSeconds: row.duration_seconds || [],
        setsPerformed: row.sets_performed,
      }));
    } catch (error) {
      this.logger.error('Error fetching recent performances:', error);
      return [];
    }
  }

  /**
   * Calculate progression trend
   * @private
   */
  _calculateTrend(recentLogs) {
    if (recentLogs.length < 3) return 'insufficient_data';

    // Simple trend calculation based on reps or weight
    // Could be enhanced with more sophisticated analysis
    const first = recentLogs[recentLogs.length - 1];
    const last = recentLogs[0];

    const firstAvgReps = first.repsPerformed?.length > 0
      ? first.repsPerformed.reduce((a, b) => a + b, 0) / first.repsPerformed.length
      : 0;
    const lastAvgReps = last.repsPerformed?.length > 0
      ? last.repsPerformed.reduce((a, b) => a + b, 0) / last.repsPerformed.length
      : 0;

    if (lastAvgReps > firstAvgReps * 1.1) return 'improving';
    if (lastAvgReps < firstAvgReps * 0.9) return 'declining';
    return 'stable';
  }
}

module.exports = ExerciseCoachService;

