/**
 * Health Sync Service
 * Handles syncing health data from iOS shortcuts and external sources
 */

class HealthSyncService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Sync health data for a user
   * @param {number} userId - User ID
   * @param {Object} healthData - Health metrics data
   * @param {string} source - Data source (e.g., 'ios_shortcut', 'terra', 'vital')
   * @returns {Promise<Object>} Sync result
   */
  async syncHealthData(userId, healthData, source = "ios_shortcut") {
    try {
      this.logger.info(
        `🏃 Syncing health data for user ${userId} from ${source}`
      );

      const { date, metrics } = this._normalizeHealthData(healthData);

      // Upsert health metrics
      const sql = `
        INSERT INTO health_physical_metrics (
          user_id, metric_date, steps, distance_miles, flights_climbed,
          active_calories, resting_calories, exercise_minutes, standing_hours,
          resting_heart_rate, heart_rate_variability, avg_heart_rate, max_heart_rate,
          weight_lbs, body_fat_percentage, bmi,
          sleep_hours, deep_sleep_hours, rem_sleep_hours, sleep_quality_score,
          calories_consumed, water_oz, raw_data, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW()
        )
        ON CONFLICT (user_id, metric_date) 
        DO UPDATE SET
          steps = COALESCE($3, health_physical_metrics.steps),
          distance_miles = COALESCE($4, health_physical_metrics.distance_miles),
          flights_climbed = COALESCE($5, health_physical_metrics.flights_climbed),
          active_calories = COALESCE($6, health_physical_metrics.active_calories),
          resting_calories = COALESCE($7, health_physical_metrics.resting_calories),
          exercise_minutes = COALESCE($8, health_physical_metrics.exercise_minutes),
          standing_hours = COALESCE($9, health_physical_metrics.standing_hours),
          resting_heart_rate = COALESCE($10, health_physical_metrics.resting_heart_rate),
          heart_rate_variability = COALESCE($11, health_physical_metrics.heart_rate_variability),
          avg_heart_rate = COALESCE($12, health_physical_metrics.avg_heart_rate),
          max_heart_rate = COALESCE($13, health_physical_metrics.max_heart_rate),
          weight_lbs = COALESCE($14, health_physical_metrics.weight_lbs),
          body_fat_percentage = COALESCE($15, health_physical_metrics.body_fat_percentage),
          bmi = COALESCE($16, health_physical_metrics.bmi),
          sleep_hours = COALESCE($17, health_physical_metrics.sleep_hours),
          deep_sleep_hours = COALESCE($18, health_physical_metrics.deep_sleep_hours),
          rem_sleep_hours = COALESCE($19, health_physical_metrics.rem_sleep_hours),
          sleep_quality_score = COALESCE($20, health_physical_metrics.sleep_quality_score),
          calories_consumed = COALESCE($21, health_physical_metrics.calories_consumed),
          water_oz = COALESCE($22, health_physical_metrics.water_oz),
          raw_data = COALESCE($23, health_physical_metrics.raw_data),
          updated_at = NOW()
        RETURNING id
      `;

      const values = [
        userId,
        date,
        metrics.steps,
        metrics.distance_miles,
        metrics.flights_climbed,
        metrics.active_calories,
        metrics.resting_calories,
        metrics.exercise_minutes,
        metrics.standing_hours,
        metrics.resting_heart_rate,
        metrics.heart_rate_variability,
        metrics.avg_heart_rate,
        metrics.max_heart_rate,
        metrics.weight_lbs,
        metrics.body_fat_percentage,
        metrics.bmi,
        metrics.sleep_hours,
        metrics.deep_sleep_hours,
        metrics.rem_sleep_hours,
        metrics.sleep_quality_score,
        metrics.calories_consumed,
        metrics.water_oz,
        JSON.stringify(metrics.raw || {}),
      ];

      const result = await this.database.query(sql, values);

      // Update health profile last sync time
      await this.database.query(
        `UPDATE health_profiles SET last_sync_at = NOW(), updated_at = NOW() 
         WHERE user_id = $1`,
        [userId]
      );

      // Log the sync
      await this._logSync(userId, Object.keys(metrics).length, "success", source);

      this.logger.info(`✅ Health data synced successfully for user ${userId}`);

      return {
        success: true,
        date: date,
        metricsCount: Object.keys(metrics).filter((k) => metrics[k] != null)
          .length,
        recordId: result.rows[0].id,
      };
    } catch (error) {
      this.logger.error(`❌ Health sync failed for user ${userId}:`, error);
      await this._logSync(userId, 0, "failed", source, error.message);
      throw error;
    }
  }

  /**
   * Get health metrics for a user
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Array>} Health metrics
   */
  async getHealthMetrics(userId, startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT * FROM health_physical_metrics
        WHERE user_id = $1
      `;
      const values = [userId];

      if (startDate) {
        sql += ` AND metric_date >= $${values.length + 1}`;
        values.push(startDate);
      }

      if (endDate) {
        sql += ` AND metric_date <= $${values.length + 1}`;
        values.push(endDate);
      }

      sql += ` ORDER BY metric_date DESC LIMIT 90`; // Last 90 days max

      const result = await this.database.query(sql, values);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error fetching health metrics for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get today's health summary
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Today's metrics with goals
   */
  async getTodaySummary(userId) {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Get today's metrics
      const metricsResult = await this.database.query(
        `SELECT * FROM health_physical_metrics WHERE user_id = $1 AND metric_date = $2`,
        [userId, today]
      );

      // Get active goals
      const goalsResult = await this.database.query(
        `SELECT * FROM health_goals WHERE user_id = $1 AND active = true`,
        [userId]
      );

      const metrics = metricsResult.rows[0] || {};
      const goals = {};

      goalsResult.rows.forEach((goal) => {
        goals[goal.goal_type] = goal.target_value;
      });

      return {
        date: today,
        metrics: metrics,
        goals: goals,
        progress: this._calculateProgress(metrics, goals),
      };
    } catch (error) {
      this.logger.error(
        `Error fetching today's summary for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get weekly trends
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Weekly trend data
   */
  async getWeeklyTrends(userId) {
    try {
      const sql = `
        SELECT 
          metric_date,
          steps,
          exercise_minutes,
          sleep_hours,
          resting_heart_rate,
          weight_lbs
        FROM health_physical_metrics
        WHERE user_id = $1 
          AND metric_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY metric_date ASC
      `;

      const result = await this.database.query(sql, [userId]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error fetching weekly trends for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate progress towards goals
   */
  _calculateProgress(metrics, goals) {
    const progress = {};

    for (const [goalType, targetValue] of Object.entries(goals)) {
      const currentValue = metrics[goalType] || 0;
      progress[goalType] = {
        current: currentValue,
        target: targetValue,
        percentage: Math.min(100, Math.round((currentValue / targetValue) * 100)),
        achieved: currentValue >= targetValue,
      };
    }

    return progress;
  }

  /**
   * Normalize health data from various sources
   */
  _normalizeHealthData(healthData) {
    // Handle date
    const date = healthData.date || new Date().toISOString().split("T")[0];

    // Handle metrics - support both flat and nested structures
    const metrics = {
      steps: healthData.steps || healthData.metrics?.steps || null,
      distance_miles:
        healthData.distance_miles || healthData.metrics?.distance_miles || null,
      flights_climbed:
        healthData.flights_climbed ||
        healthData.metrics?.flights_climbed ||
        null,
      active_calories:
        healthData.active_calories || healthData.metrics?.active_calories || null,
      resting_calories:
        healthData.resting_calories ||
        healthData.metrics?.resting_calories ||
        null,
      exercise_minutes:
        healthData.exercise_minutes ||
        healthData.metrics?.exercise_minutes ||
        null,
      standing_hours:
        healthData.standing_hours || healthData.metrics?.standing_hours || null,
      resting_heart_rate:
        healthData.resting_heart_rate ||
        healthData.metrics?.resting_heart_rate ||
        null,
      heart_rate_variability:
        healthData.heart_rate_variability ||
        healthData.metrics?.heart_rate_variability ||
        null,
      avg_heart_rate:
        healthData.avg_heart_rate || healthData.metrics?.avg_heart_rate || null,
      max_heart_rate:
        healthData.max_heart_rate || healthData.metrics?.max_heart_rate || null,
      weight_lbs: healthData.weight_lbs || healthData.metrics?.weight_lbs || null,
      body_fat_percentage:
        healthData.body_fat_percentage ||
        healthData.metrics?.body_fat_percentage ||
        null,
      bmi: healthData.bmi || healthData.metrics?.bmi || null,
      sleep_hours:
        healthData.sleep_hours || healthData.metrics?.sleep_hours || null,
      deep_sleep_hours:
        healthData.deep_sleep_hours ||
        healthData.metrics?.deep_sleep_hours ||
        null,
      rem_sleep_hours:
        healthData.rem_sleep_hours ||
        healthData.metrics?.rem_sleep_hours ||
        null,
      sleep_quality_score:
        healthData.sleep_quality_score ||
        healthData.metrics?.sleep_quality_score ||
        null,
      calories_consumed:
        healthData.calories_consumed ||
        healthData.metrics?.calories_consumed ||
        null,
      water_oz: healthData.water_oz || healthData.metrics?.water_oz || null,
      raw: healthData.raw || healthData,
    };

    return { date, metrics };
  }

  /**
   * Log sync attempt
   */
  async _logSync(userId, metricsCount, status, source, errorMessage = null) {
    try {
      await this.database.query(
        `INSERT INTO health_sync_logs (user_id, metrics_count, status, source, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, metricsCount, status, source, errorMessage]
      );
    } catch (error) {
      this.logger.error("Error logging health sync:", error);
    }
  }
}

module.exports = HealthSyncService;
