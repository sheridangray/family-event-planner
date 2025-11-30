/**
 * Exercise Service
 * Handles exercise routines, workout logging, and exercise history
 */

class ExerciseService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Create a new exercise routine
   * @param {number} userId - User ID
   * @param {Object} routineData - Routine data
   * @returns {Promise<Object>} Created routine
   */
  async createRoutine(userId, routineData) {
    try {
      const {
        routineName,
        dayOfWeek,
        description,
        exercises,
      } = routineData;

      // Insert routine
      const routineResult = await this.database.query(
        `INSERT INTO exercise_routines (user_id, routine_name, day_of_week, description, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [userId, routineName, dayOfWeek, description]
      );

      const routine = routineResult.rows[0];

      // Insert exercises
      if (exercises && exercises.length > 0) {
        for (let i = 0; i < exercises.length; i++) {
          const exercise = exercises[i];
          await this.database.query(
            `INSERT INTO routine_exercises (
              routine_id, exercise_name, exercise_order, target_sets,
              target_reps_min, target_reps_max, target_duration_seconds,
              notes, cues, preferred_equipment, equipment_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              routine.id,
              exercise.exerciseName,
              i + 1,
              exercise.targetSets,
              exercise.targetRepsMin || null,
              exercise.targetRepsMax || null,
              exercise.targetDurationSeconds || null,
              exercise.notes || null,
              exercise.cues || null,
              exercise.preferredEquipment || null,
              exercise.equipmentNotes || null,
            ]
          );
        }
      }

      // Fetch complete routine with exercises
      return await this.getRoutine(routine.id);
    } catch (error) {
      this.logger.error(`Error creating routine for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a routine by ID with exercises
   * @param {number} routineId - Routine ID
   * @returns {Promise<Object>} Routine with exercises
   */
  async getRoutine(routineId) {
    try {
      const routineResult = await this.database.query(
        `SELECT * FROM exercise_routines WHERE id = $1`,
        [routineId]
      );

      if (routineResult.rows.length === 0) {
        return null;
      }

      const routine = routineResult.rows[0];

      // Get exercises
      const exercisesResult = await this.database.query(
        `SELECT * FROM routine_exercises
         WHERE routine_id = $1
         ORDER BY exercise_order ASC`,
        [routineId]
      );

      routine.exercises = exercisesResult.rows;
      return routine;
    } catch (error) {
      this.logger.error(`Error fetching routine ${routineId}:`, error);
      throw error;
    }
  }

  /**
   * Get all routines for a user
   * @param {number} userId - User ID
   * @param {boolean} activeOnly - Only return active routines
   * @returns {Promise<Array>} List of routines
   */
  async getRoutines(userId, activeOnly = false) {
    try {
      let sql = `SELECT * FROM exercise_routines WHERE user_id = $1`;
      const values = [userId];

      if (activeOnly) {
        sql += ` AND is_active = true`;
      }

      sql += ` ORDER BY day_of_week ASC NULLS LAST, routine_name ASC`;

      const result = await this.database.query(sql, values);
      const routines = result.rows;

      // Fetch exercises for each routine
      for (const routine of routines) {
        const exercisesResult = await this.database.query(
          `SELECT * FROM routine_exercises
           WHERE routine_id = $1
           ORDER BY exercise_order ASC`,
          [routine.id]
        );
        routine.exercises = exercisesResult.rows;
      }

      return routines;
    } catch (error) {
      this.logger.error(`Error fetching routines for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get today's routine for a user based on day of week
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Today's routine or null
   */
  async getTodayRoutine(userId) {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

      const result = await this.database.query(
        `SELECT * FROM exercise_routines
         WHERE user_id = $1 AND day_of_week = $2 AND is_active = true
         ORDER BY id ASC
         LIMIT 1`,
        [userId, dayOfWeek]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const routine = result.rows[0];

      // Get exercises
      const exercisesResult = await this.database.query(
        `SELECT * FROM routine_exercises
         WHERE routine_id = $1
         ORDER BY exercise_order ASC`,
        [routine.id]
      );

      routine.exercises = exercisesResult.rows;
      return routine;
    } catch (error) {
      this.logger.error(`Error fetching today's routine for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update a routine
   * @param {number} routineId - Routine ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated routine
   */
  async updateRoutine(routineId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.routineName !== undefined) {
        fields.push(`routine_name = $${paramIndex++}`);
        values.push(updates.routineName);
      }
      if (updates.dayOfWeek !== undefined) {
        fields.push(`day_of_week = $${paramIndex++}`);
        values.push(updates.dayOfWeek);
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(updates.isActive);
      }

      if (fields.length === 0) {
        return await this.getRoutine(routineId);
      }

      values.push(routineId);
      const sql = `UPDATE exercise_routines SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

      await this.database.query(sql, values);

      // Update exercises if provided
      if (updates.exercises) {
        // Delete existing exercises
        await this.database.query(
          `DELETE FROM routine_exercises WHERE routine_id = $1`,
          [routineId]
        );

        // Insert new exercises
        for (let i = 0; i < updates.exercises.length; i++) {
          const exercise = updates.exercises[i];
          await this.database.query(
            `INSERT INTO routine_exercises (
              routine_id, exercise_name, exercise_order, target_sets,
              target_reps_min, target_reps_max, target_duration_seconds,
              notes, cues, preferred_equipment, equipment_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              routineId,
              exercise.exerciseName,
              i + 1,
              exercise.targetSets,
              exercise.targetRepsMin || null,
              exercise.targetRepsMax || null,
              exercise.targetDurationSeconds || null,
              exercise.notes || null,
              exercise.cues || null,
              exercise.preferredEquipment || null,
              exercise.equipmentNotes || null,
            ]
          );
        }
      }

      return await this.getRoutine(routineId);
    } catch (error) {
      this.logger.error(`Error updating routine ${routineId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a routine
   * @param {number} routineId - Routine ID
   * @returns {Promise<boolean>} Success
   */
  async deleteRoutine(routineId) {
    try {
      // Cascade delete will handle routine_exercises
      const result = await this.database.query(
        `DELETE FROM exercise_routines WHERE id = $1`,
        [routineId]
      );
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Error deleting routine ${routineId}:`, error);
      throw error;
    }
  }

  /**
   * Log a workout
   * @param {number} userId - User ID
   * @param {Object} logData - Workout log data
   * @returns {Promise<Object>} Created log
   */
  async logWorkout(userId, logData) {
    try {
      const {
        routineId,
        exerciseDate,
        totalDurationMinutes,
        location,
        notes,
        entries,
      } = logData;

      const today = new Date(exerciseDate || new Date());
      const dayOfWeek = today.getDay();

      // Insert log
      const logResult = await this.database.query(
        `INSERT INTO exercise_logs (
          user_id, routine_id, exercise_date, day_of_week,
          total_duration_minutes, location, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          routineId || null,
          today.toISOString().split('T')[0],
          dayOfWeek,
          totalDurationMinutes || null,
          location || null,
          notes || null,
        ]
      );

      const log = logResult.rows[0];

      // Insert log entries
      if (entries && entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          await this.database.query(
            `INSERT INTO exercise_log_entries (
              log_id, exercise_name, exercise_order, equipment_used,
              sets_performed, reps_performed, weight_used, duration_seconds,
              rest_seconds, notes, difficulty_rating
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              log.id,
              entry.exerciseName,
              i + 1,
              entry.equipmentUsed || null,
              entry.setsPerformed,
              JSON.stringify(entry.repsPerformed || []),
              JSON.stringify(entry.weightUsed || []),
              JSON.stringify(entry.durationSeconds || []),
              entry.restSeconds || null,
              entry.notes || null,
              entry.difficultyRating || null,
            ]
          );
        }
      }

      // Update exercise history
      await this._updateExerciseHistory(userId, entries || []);

      // Fetch complete log with entries
      return await this.getWorkoutLog(log.id);
    } catch (error) {
      this.logger.error(`Error logging workout for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a workout log by ID
   * @param {number} logId - Log ID
   * @returns {Promise<Object>} Log with entries
   */
  async getWorkoutLog(logId) {
    try {
      const logResult = await this.database.query(
        `SELECT * FROM exercise_logs WHERE id = $1`,
        [logId]
      );

      if (logResult.rows.length === 0) {
        return null;
      }

      const log = logResult.rows[0];

      // Get entries
      const entriesResult = await this.database.query(
        `SELECT * FROM exercise_log_entries
         WHERE log_id = $1
         ORDER BY exercise_order ASC`,
        [logId]
      );

      // Parse JSONB fields
      log.entries = entriesResult.rows.map(entry => ({
        ...entry,
        repsPerformed: entry.reps_performed || [],
        weightUsed: entry.weight_used || [],
        durationSeconds: entry.duration_seconds || [],
      }));

      return log;
    } catch (error) {
      this.logger.error(`Error fetching workout log ${logId}:`, error);
      throw error;
    }
  }

  /**
   * Get workout history for a user
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @param {number} limit - Max results (default 50)
   * @returns {Promise<Array>} List of workout logs
   */
  async getWorkoutHistory(userId, startDate = null, endDate = null, limit = 50) {
    try {
      let sql = `
        SELECT * FROM exercise_logs
        WHERE user_id = $1
      `;
      const values = [userId];

      if (startDate) {
        sql += ` AND exercise_date >= $${values.length + 1}`;
        values.push(startDate);
      }

      if (endDate) {
        sql += ` AND exercise_date <= $${values.length + 1}`;
        values.push(endDate);
      }

      sql += ` ORDER BY exercise_date DESC, created_at DESC LIMIT $${values.length + 1}`;
      values.push(limit);

      const result = await this.database.query(sql, values);
      return result.rows;
    } catch (error) {
      this.logger.error(`Error fetching workout history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has logged today
   * @param {number} userId - User ID
   * @param {number} routineId - Optional routine ID
   * @returns {Promise<boolean>} Has logged today
   */
  async hasLoggedToday(userId, routineId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      let sql = `
        SELECT COUNT(*) as count FROM exercise_logs
        WHERE user_id = $1 AND exercise_date = $2
      `;
      const values = [userId, today];

      if (routineId) {
        sql += ` AND routine_id = $3`;
        values.push(routineId);
      }

      const result = await this.database.query(sql, values);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      this.logger.error(`Error checking if logged today for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get exercise history/patterns for a user
   * @param {number} userId - User ID
   * @param {string} exerciseName - Optional exercise name filter
   * @returns {Promise<Array>} Exercise history records
   */
  async getExerciseHistory(userId, exerciseName = null) {
    try {
      let sql = `
        SELECT * FROM exercise_history
        WHERE user_id = $1
      `;
      const values = [userId];

      if (exerciseName) {
        sql += ` AND exercise_name = $2`;
        values.push(exerciseName);
      }

      sql += ` ORDER BY last_performed DESC NULLS LAST`;

      const result = await this.database.query(sql, values);
      return result.rows;
    } catch (error) {
      this.logger.error(`Error fetching exercise history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update exercise history based on logged workout
   * @private
   */
  async _updateExerciseHistory(userId, entries) {
    try {
      for (const entry of entries) {
        // Normalize exercise name (remove equipment suffix for grouping)
        const normalizedName = entry.exerciseName
          .replace(/\s*\(.*?\)\s*$/, '') // Remove (Machine), (Bands), etc.
          .trim();

        // Calculate averages
        const repsArray = entry.repsPerformed || [];
        const weightArray = entry.weightUsed || [];
        const durationArray = entry.durationSeconds || [];

        const avgReps = repsArray.length > 0
          ? repsArray.reduce((a, b) => a + b, 0) / repsArray.length
          : null;
        const avgWeight = weightArray.length > 0 && weightArray.some(w => w !== null)
          ? weightArray.filter(w => w !== null).reduce((a, b) => a + b, 0) / weightArray.filter(w => w !== null).length
          : null;
        const avgDuration = durationArray.length > 0
          ? durationArray.reduce((a, b) => a + b, 0) / durationArray.length
          : null;

        // Upsert exercise history
        await this.database.query(
          `INSERT INTO exercise_history (
            user_id, exercise_name, equipment_type, last_performed,
            average_sets, average_reps, average_weight, average_duration_seconds
          ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)
          ON CONFLICT (user_id, exercise_name, equipment_type)
          DO UPDATE SET
            last_performed = CURRENT_DATE,
            average_sets = (exercise_history.average_sets + $4) / 2,
            average_reps = CASE 
              WHEN exercise_history.average_reps IS NULL THEN $5
              WHEN $5 IS NULL THEN exercise_history.average_reps
              ELSE (exercise_history.average_reps + $5) / 2
            END,
            average_weight = CASE
              WHEN exercise_history.average_weight IS NULL THEN $6
              WHEN $6 IS NULL THEN exercise_history.average_weight
              ELSE (exercise_history.average_weight + $6) / 2
            END,
            average_duration_seconds = CASE
              WHEN exercise_history.average_duration_seconds IS NULL THEN $7
              WHEN $7 IS NULL THEN exercise_history.average_duration_seconds
              ELSE (exercise_history.average_duration_seconds + $7) / 2
            END,
            updated_at = NOW()`,
          [
            userId,
            normalizedName,
            entry.equipmentUsed || 'bodyweight',
            entry.setsPerformed,
            avgReps,
            avgWeight,
            avgDuration,
          ]
        );
      }
    } catch (error) {
      this.logger.error(`Error updating exercise history:`, error);
      // Don't throw - history update failure shouldn't break workout logging
    }
  }
}

module.exports = ExerciseService;

