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
      const { routineName, dayOfWeek, description, exercises } = routineData;

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
      this.logger.error(
        `Error fetching today's routine for user ${userId}:`,
        error
      );
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
      const sql = `UPDATE exercise_routines SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

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
        uuid,
        routineId,
        exerciseDate,
        totalDurationMinutes,
        location,
        notes,
        entries,
        status = "COMPLETED",
        startedAt,
        started_at,
        endedAt,
        ended_at,
      } = logData;

      const today = new Date(exerciseDate || new Date());
      const dayOfWeek = today.getDay();

      // Insert log (WorkoutSession)
      const logResult = await this.database.query(
        `INSERT INTO exercise_logs (
          user_id, uuid, routine_id, exercise_date, day_of_week,
          total_duration_minutes, location, notes, status, started_at, ended_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          userId,
          uuid || null,
          routineId || null,
          today.toISOString().split("T")[0],
          dayOfWeek,
          totalDurationMinutes || null,
          location || null,
          notes || null,
          status,
          startedAt || started_at || null,
          endedAt || ended_at || null,
        ]
      );

      const log = logResult.rows[0];

      // Insert log entries (ExerciseLogs)
      if (entries && entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          await this.createExerciseLog(userId, {
            ...entry,
            logId: log.id,
            exerciseOrder: i + 1,
          });
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
   * Create an atomic exercise log (can exist without a workout session)
   * @param {number} userId - User ID
   * @param {Object} entryData - Exercise log data
   * @returns {Promise<Object>} Created log entry
   */
  async createExerciseLog(userId, entryData) {
    try {
      const {
        uuid,
        logId,
        exerciseId,
        exerciseName,
        exerciseOrder,
        equipmentUsed,
        sets, // Array of set objects: [{ reps, weight, duration, ... }]
        notes,
        difficultyRating,
        performedAt,
        source = "manual",
        syncState = "synced",
      } = entryData;

      // Ensure exercise exists or name is provided
      let finalExerciseName = exerciseName;
      let finalExerciseId = exerciseId;

      if (exerciseId && !exerciseName) {
        const ex = await this.getExercise(exerciseId);
        if (ex) finalExerciseName = ex.exercise_name;
      }

      // Legacy field extraction for backward compatibility if needed,
      // but primarily using the 'sets' JSONB column now.
      const repsPerformed = [];
      const weightUsed = [];
      const durationSeconds = [];

      if (sets && Array.isArray(sets)) {
        for (const set of sets) {
          repsPerformed.push(set.reps || null);
          weightUsed.push(set.weight || null);
          durationSeconds.push(set.duration || null);
        }
      }

      const result = await this.database.query(
        `INSERT INTO exercise_log_entries (
          uuid, log_id, exercise_id, exercise_name, exercise_order, 
          equipment_used, sets_performed, sets, reps_performed, weight_used, 
          duration_seconds, notes, difficulty_rating, performed_at,
          source, sync_state, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          uuid || null,
          logId || null,
          finalExerciseId || null,
          finalExerciseName,
          exerciseOrder || 1,
          equipmentUsed || null,
          sets ? sets.length : 0,
          JSON.stringify(sets || []),
          JSON.stringify(repsPerformed),
          JSON.stringify(weightUsed),
          JSON.stringify(durationSeconds),
          notes || null,
          difficultyRating || null,
          performedAt || new Date(),
          source,
          syncState,
          userId || null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      this.logger.error(
        `Error creating exercise log for user ${userId}:`,
        error
      );
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
        `SELECT * FROM exercise_logs WHERE id = $1 AND deleted_at IS NULL`,
        [logId]
      );

      if (logResult.rows.length === 0) {
        return null;
      }

      const log = logResult.rows[0];

      // Get entries
      const entriesResult = await this.database.query(
        `SELECT * FROM exercise_log_entries
         WHERE log_id = $1 AND deleted_at IS NULL
         ORDER BY exercise_order ASC`,
        [logId]
      );

      this.logger.debug(
        `🔍 [WorkoutLog] Found ${entriesResult.rows.length} entries for workout ${logId}`
      );

      // Parse JSONB fields
      log.entries = entriesResult.rows.map((entry) => ({
        ...entry,
        sets: entry.sets || [],
        repsPerformed: entry.reps_performed || [],
        weightUsed: entry.weight_used || [],
        durationSeconds: entry.duration_seconds || [],
        performedAt: entry.performed_at,
        source: entry.source,
        syncState: entry.sync_state,
        // legacy fields
        distanceMeters: entry.distance_meters || [],
        bandLevel: entry.band_level || [],
        resistanceLevel: entry.resistance_level || [],
        inclinePercentage: entry.incline_percentage || [],
        calories: entry.calories || [],
        heartRate: entry.heart_rate || [],
        speedMph: entry.speed_mph || [],
        rpe: entry.rpe || [],
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
  async getWorkoutHistory(
    userId,
    startDate = null,
    endDate = null,
    limit = 50
  ) {
    try {
      this.logger.info(`🕒 [History] Fetching history for user ${userId}`, {
        startDate,
        endDate,
        limit,
      });
      let sql = `
        SELECT * FROM exercise_logs
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      const values = [userId];

      if (startDate) {
        // Handle both Date objects and strings
        const dateVal =
          startDate instanceof Date
            ? startDate.toISOString().split("T")[0]
            : startDate;
        sql += ` AND exercise_date >= $${values.length + 1}::DATE`;
        values.push(dateVal);
      }

      if (endDate) {
        // Handle both Date objects and strings
        const dateVal =
          endDate instanceof Date
            ? endDate.toISOString().split("T")[0]
            : endDate;
        sql += ` AND exercise_date <= $${values.length + 1}::DATE`;
        values.push(dateVal);
      }

      sql += ` ORDER BY exercise_date DESC, created_at DESC LIMIT $${
        values.length + 1
      }`;
      values.push(limit);

      this.logger.debug(
        `🔍 [History] Executing SQL: ${sql} with values: ${JSON.stringify(
          values
        )}`
      );
      const result = await this.database.query(sql, values);
      this.logger.info(
        `✅ [History] Found ${result.rows.length} workouts for user ${userId}`
      );

      if (result.rows.length === 0) {
        // Debug: check total count for this user
        const countResult = await this.database.query(
          "SELECT COUNT(*) FROM exercise_logs WHERE user_id = $1",
          [userId]
        );
        const deletedResult = await this.database.query(
          "SELECT COUNT(*) FROM exercise_logs WHERE user_id = $1 AND deleted_at IS NOT NULL",
          [userId]
        );
        this.logger.info(
          `🔍 [History] Total workouts for user ${userId}: ${countResult.rows[0].count}, Deleted: ${deletedResult.rows[0].count}`
        );
      }

      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error fetching workout history for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get independent exercise logs (not grouped into a session)
   * @param {number} userId - User ID
   * @param {number} limit - Limit
   * @returns {Promise<Array>} List of exercise logs
   */
  async getIndependentExerciseLogs(userId, limit = 50) {
    try {
      const sql = `
        SELECT e.*, ex.category as ex_category, ex.input_schema
        FROM exercise_log_entries e
        LEFT JOIN exercise_logs l ON e.log_id = l.id
        LEFT JOIN exercises ex ON e.exercise_id = ex.id
        WHERE e.user_id = $1
        AND (e.log_id IS NULL OR l.status != 'COMPLETED')
        AND e.deleted_at IS NULL
        ORDER BY e.performed_at DESC
        LIMIT $2
      `;

      const result = await this.database.query(sql, [userId, limit]);
      return result.rows.map((entry) => ({
        ...entry,
        sets: entry.sets || [],
        repsPerformed: entry.reps_performed || [],
        weightUsed: entry.weight_used || [],
        durationSeconds: entry.duration_seconds || [],
      }));
    } catch (error) {
      this.logger.error(`Error fetching independent logs:`, error);
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
      const today = new Date().toISOString().split("T")[0];
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
      this.logger.error(
        `Error checking if logged today for user ${userId}:`,
        error
      );
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
      this.logger.error(
        `Error fetching exercise history for user ${userId}:`,
        error
      );
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
          .replace(/\s*\(.*?\)\s*$/, "") // Remove (Machine), (Bands), etc.
          .trim();

        // Calculate averages
        const repsArray = entry.repsPerformed || [];
        const weightArray = entry.weightUsed || [];
        const durationArray = entry.durationSeconds || [];

        const avgReps =
          repsArray.length > 0
            ? repsArray.reduce((a, b) => a + b, 0) / repsArray.length
            : null;
        const avgWeight =
          weightArray.length > 0 && weightArray.some((w) => w !== null)
            ? weightArray.filter((w) => w !== null).reduce((a, b) => a + b, 0) /
              weightArray.filter((w) => w !== null).length
            : null;
        const avgDuration =
          durationArray.length > 0
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
            entry.equipmentUsed || "bodyweight",
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

  // ==================== NEW EXERCISE METHODS ====================

  /**
   * Create a new exercise (with LLM-generated details)
   * @param {string} exerciseName - Name of the exercise
   * @param {Object} llmService - ExerciseLLMService instance
   * @param {Object} options - Additional options (e.g. category)
   * @returns {Promise<Object>} Created exercise
   */
  async createExercise(exerciseName, llmService, options = {}) {
    try {
      // Check if the exercise already exists (even if archived)
      const existing = await this.database.query(
        `SELECT * FROM exercises 
         WHERE LOWER(exercise_name) = LOWER($1) 
         LIMIT 1`,
        [exerciseName]
      );

      if (existing.rows.length > 0) {
        const exercise = existing.rows[0];
        // If it's archived, unarchive it
        if (exercise.is_archived) {
          await this.database.query(
            "UPDATE exercises SET is_archived = false, updated_at = NOW() WHERE id = $1",
            [exercise.id]
          );
          exercise.is_archived = false;
        }
        return exercise;
      }

      // Generate details using LLM
      const details = await llmService.generateExerciseDetails(exerciseName);

      // Determine category: User selection > LLM guess > Default
      const category =
        options.category || details.category || "barbell_dumbbell";

      // Insert exercise
      const result = await this.database.query(
        `INSERT INTO exercises (exercise_name, instructions, youtube_url, body_parts, exercise_type, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          exerciseName,
          details.instructions,
          details.youtubeUrl,
          details.bodyParts,
          category, // Store category as exercise_type for backward compatibility if needed, or just strictly use category
          category,
        ]
      );

      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error creating exercise "${exerciseName}":`, error);
      throw error;
    }
  }

  /**
   * Get exercise by ID
   * @param {number} exerciseId - Exercise ID
   * @returns {Promise<Object|null>} Exercise or null
   */
  async getExercise(exerciseId) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercises WHERE id = $1`,
        [exerciseId]
      );
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Error fetching exercise ${exerciseId}:`, error);
      throw error;
    }
  }

  /**
   * Search exercises by name (autocomplete)
   * Excludes archived exercises
   * @param {string} query - Search query
   * @param {number} limit - Max results (default 20)
   * @returns {Promise<Array>} List of matching exercises
   */
  async searchExercises(query, limit = 20) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercises
         WHERE exercise_name ILIKE $1
         AND (is_archived = false OR is_archived IS NULL)
         ORDER BY exercise_name ASC
         LIMIT $2`,
        [`%${query}%`, limit]
      );
      return result.rows;
    } catch (error) {
      this.logger.error(`Error searching exercises:`, error);
      throw error;
    }
  }

  /**
   * Get all exercises with pagination
   * Excludes archived exercises
   * @param {number} limit - Max results (default 50)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {Promise<Array>} List of exercises
   */
  async getAllExercises(limit = 50, offset = 0) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercises
         WHERE is_archived = false OR is_archived IS NULL
         ORDER BY exercise_name ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      this.logger.error(`Error fetching all exercises:`, error);
      throw error;
    }
  }

  /**
   * Update exercise
   * @param {number} exerciseId - Exercise ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated exercise
   */
  async updateExercise(exerciseId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.instructions !== undefined) {
        fields.push(`instructions = $${paramIndex++}`);
        values.push(updates.instructions);
      }
      if (updates.youtubeUrl !== undefined) {
        fields.push(`youtube_url = $${paramIndex++}`);
        values.push(updates.youtubeUrl);
      }
      if (updates.bodyParts !== undefined) {
        fields.push(`body_parts = $${paramIndex++}`);
        values.push(updates.bodyParts);
      }
      if (updates.exerciseType !== undefined) {
        fields.push(`exercise_type = $${paramIndex++}`);
        values.push(updates.exerciseType);
      }
      if (updates.category !== undefined) {
        fields.push(`category = $${paramIndex++}`);
        values.push(updates.category);
      }

      if (fields.length === 0) {
        return await this.getExercise(exerciseId);
      }

      values.push(exerciseId);
      const sql = `UPDATE exercises SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

      const result = await this.database.query(sql, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error updating exercise ${exerciseId}:`, error);
      throw error;
    }
  }

  /**
   * Delete exercise (soft delete - archives the exercise)
   * @param {number} exerciseId - Exercise ID
   * @returns {Promise<boolean>} Success
   */
  async deleteExercise(exerciseId) {
    try {
      // Soft delete by archiving the exercise
      // This preserves database integrity for historical logs and routines
      const result = await this.database.query(
        `UPDATE exercises 
         SET is_archived = true, updated_at = NOW()
         WHERE id = $1 AND is_archived = false`,
        [exerciseId]
      );
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Error deleting exercise ${exerciseId}:`, error);
      throw error;
    }
  }

  // ==================== NEW WORKOUT METHODS ====================

  /**
   * Delete a workout session (soft delete)
   * @param {number} workoutId - Workout ID
   * @returns {Promise<boolean>} Success
   */
  async deleteWorkout(workoutId) {
    try {
      this.logger.info(`🗑️ [Workout] Deleting workout ${workoutId}...`);
      const result = await this.database.query(
        `UPDATE exercise_logs 
         SET deleted_at = NOW() 
         WHERE id = $1`,
        [workoutId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Workout ${workoutId} not found`);
      }

      // Also soft-delete all entries within this workout
      await this.database.query(
        `UPDATE exercise_log_entries 
         SET deleted_at = NOW() 
         WHERE log_id = $1`,
        [workoutId]
      );

      this.logger.info(
        `✅ [Workout] Deleted workout ${workoutId} and its entries`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ [Workout] Error deleting workout ${workoutId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update workout status
   * @param {number} workoutId - Workout ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated workout
   */
  async updateWorkoutStatus(workoutId, status) {
    try {
      const validStatuses = ["IN_PROGRESS", "COMPLETED", "DISCARDED"];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const endedAt = status === "COMPLETED" ? "NOW()" : "NULL";

      const result = await this.database.query(
        `UPDATE exercise_logs 
         SET status = $1, ended_at = ${endedAt}, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, workoutId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return await this.getWorkoutLog(workoutId);
    } catch (error) {
      this.logger.error(`Error updating workout status ${workoutId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new workout
   * @param {number} userId - User ID
   * @param {Object} workoutData - Workout data
   * @returns {Promise<Object>} Created workout
   */
  async createWorkout(userId, workoutData = {}) {
    try {
      this.logger.info(
        `🚀 [Workout] Creating workout for user ${userId}...`,
        workoutData
      );

      const { routineId, exerciseDate, totalDurationMinutes, location, notes } =
        workoutData;

      let dateStr;
      let dayOfWeek;

      if (exerciseDate) {
        // If date provided (YYYY-MM-DD), split it to avoid UTC conversion issues
        const [year, month, day] = exerciseDate.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        dateStr = exerciseDate;
        dayOfWeek = d.getDay();
      } else {
        // If no date provided, use server local time instead of UTC to avoid date shifting
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        dateStr = `${year}-${month}-${day}`;
        dayOfWeek = now.getDay();
      }

      // Check if user already has an IN_PROGRESS workout TODAY
      const existingResult = await this.database.query(
        `SELECT id FROM exercise_logs 
         WHERE user_id = $1 AND status = 'IN_PROGRESS' 
         AND exercise_date = $2 AND deleted_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [userId, dateStr]
      );

      if (existingResult.rows.length > 0) {
        const existingId = existingResult.rows[0].id;
        this.logger.info(
          `📎 [Workout] Found existing IN_PROGRESS workout ${existingId} for user ${userId}, returning that instead.`
        );
        return await this.getWorkoutLog(existingId);
      }

      const result = await this.database.query(
        `INSERT INTO exercise_logs (
          user_id, routine_id, exercise_date, day_of_week,
          total_duration_minutes, location, notes, status, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', NOW())
        RETURNING *`,
        [
          userId,
          routineId || null,
          dateStr,
          dayOfWeek,
          totalDurationMinutes || null,
          location || null,
          notes || null,
        ]
      );

      const workoutId = result.rows[0].id;
      this.logger.info(`✅ [Workout] Created workout with ID: ${workoutId}`);
      return await this.getWorkoutLog(workoutId);
    } catch (error) {
      this.logger.error(
        `❌ [Workout] Error creating workout for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start a workout session from a routine
   * @param {number} userId - User ID
   * @param {number} routineId - Routine ID
   * @returns {Promise<Object>} Created workout
   */
  async startWorkoutFromRoutine(userId, routineId) {
    try {
      this.logger.info(
        `🚀 [Workout] Starting workout from routine ${routineId} for user ${userId}...`
      );

      const routine = await this.getRoutine(routineId);
      if (!routine) {
        throw new Error(`Routine ${routineId} not found`);
      }

      // Create the workout log entry
      const workout = await this.createWorkout(userId, {
        routineId,
        notes: `Started from routine: ${routine.routine_name}`,
      });

      // Create exercise log entries for each exercise in the routine
      if (routine.exercises && routine.exercises.length > 0) {
        for (const routineEx of routine.exercises) {
          // Find the exercise definition ID if possible
          const exResult = await this.database.query(
            "SELECT id FROM exercises WHERE exercise_name = $1 LIMIT 1",
            [routineEx.exercise_name]
          );
          const exerciseId =
            exResult.rows.length > 0 ? exResult.rows[0].id : null;

          // Create shell sets based on targets
          const sets = [];
          for (let i = 0; i < routineEx.target_sets; i++) {
            sets.push({
              reps: routineEx.target_reps_min || 0,
              weight: null,
              duration: routineEx.target_duration_seconds || null,
            });
          }

          await this.createExerciseLog(userId, {
            logId: workout.id,
            exerciseId,
            exerciseName: routineEx.exercise_name,
            exerciseOrder: routineEx.exercise_order,
            equipmentUsed: routineEx.preferred_equipment,
            sets,
            notes: routineEx.notes,
          });
        }
      }

      return await this.getWorkoutLog(workout.id);
    } catch (error) {
      this.logger.error(
        `❌ [Workout] Error starting workout from routine ${routineId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Add exercise to workout
   * @param {number} workoutId - Workout ID
   * @param {number} exerciseId - Exercise ID
   * @param {Object} setsData - Sets data (sets array with reps, weight, etc.)
   * @returns {Promise<Object>} Updated workout
   */
  async addExerciseToWorkout(workoutId, exerciseId, setsData) {
    try {
      this.logger.info(
        `📝 [Workout] Adding exercise ${exerciseId} to workout ${workoutId}...`,
        setsData
      );
      const exercise = await this.getExercise(exerciseId);
      if (!exercise) {
        throw new Error(`Exercise ${exerciseId} not found`);
      }

      // Get current max exercise_order in workout
      const maxOrderResult = await this.database.query(
        `SELECT MAX(exercise_order) as max_order FROM exercise_log_entries WHERE log_id = $1`,
        [workoutId]
      );
      const nextOrder = (maxOrderResult.rows[0].max_order || 0) + 1;

      // Get the user_id for history update and ownership
      const workoutResult = await this.database.query(
        `SELECT user_id FROM exercise_logs WHERE id = $1`,
        [workoutId]
      );
      const userId = workoutResult.rows[0].user_id;

      // Use the new unified createExerciseLog method
      const logEntry = await this.createExerciseLog(userId, {
        ...setsData,
        logId: workoutId,
        exerciseId,
        exerciseName: exercise.exercise_name,
        exerciseOrder: nextOrder,
      });

      this.logger.info(
        `✅ [Workout] Exercise added successfully to workout ${workoutId}`
      );

      // Update exercise history (legacy support for now)
      const repsPerformed = [];
      const weightUsed = [];
      const durationSeconds = [];
      if (setsData.sets) {
        for (const s of setsData.sets) {
          repsPerformed.push(s.reps || null);
          weightUsed.push(s.weight || null);
          durationSeconds.push(s.duration || null);
        }
      }

      await this._updateExerciseHistory(userId, [
        {
          exerciseName: exercise.exercise_name,
          equipmentUsed: setsData.equipmentUsed || null,
          setsPerformed: setsData.sets ? setsData.sets.length : 0,
          repsPerformed,
          weightUsed,
          durationSeconds,
        },
      ]);

      return await this.getWorkoutLog(workoutId);
    } catch (error) {
      this.logger.error(
        `❌ [Workout] Error adding exercise to workout ${workoutId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Repeat a workout (copy previous sets/weights)
   * @param {number} workoutId - Original workout ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} New workout with copied data
   */
  async repeatWorkout(workoutId, userId) {
    try {
      const originalWorkout = await this.getWorkoutLog(workoutId);
      if (!originalWorkout) {
        throw new Error(`Workout ${workoutId} not found`);
      }

      if (originalWorkout.user_id !== userId) {
        throw new Error("Cannot repeat workout from another user");
      }

      // Create new workout
      const newWorkout = await this.createWorkout(userId, {
        routineId: originalWorkout.routine_id,
        exerciseDate: new Date().toISOString().split("T")[0],
        location: originalWorkout.location,
        notes: `Repeated from ${originalWorkout.exercise_date}`,
      });

      // Copy all exercises with their sets
      for (const entry of originalWorkout.entries) {
        const sets = [];

        // Reconstruct sets from entry data
        const reps = entry.repsPerformed || [];
        const weights = entry.weightUsed || [];
        const durations = entry.durationSeconds || [];
        const distances = entry.distanceMeters || [];
        const bands = entry.bandLevel || [];
        const resistances = entry.resistanceLevel || [];
        const inclines = entry.inclinePercentage || [];
        const cals = entry.calories || [];
        const hrs = entry.heartRate || [];
        const speeds = entry.speedMph || [];
        const rpes = entry.rpe || [];

        const maxLength = Math.max(
          reps.length,
          weights.length,
          durations.length,
          distances.length
        );
        for (let i = 0; i < maxLength; i++) {
          sets.push({
            reps: reps[i] || null,
            weight: weights[i] || null,
            duration: durations[i] || null,
            distance: distances[i] || null,
            bandLevel: bands[i] || null,
            resistanceLevel: resistances[i] || null,
            incline: inclines[i] || null,
            calories: cals[i] || null,
            heartRate: hrs[i] || null,
            speed: speeds[i] || null,
            rpe: rpes[i] || null,
          });
        }

        if (entry.exercise_id) {
          await this.addExerciseToWorkout(newWorkout.id, entry.exercise_id, {
            sets,
            restSeconds: entry.rest_seconds,
            equipmentUsed: entry.equipment_used,
            notes: entry.notes,
          });
        } else {
          // Fallback for entries without exercise_id
          const exercise = await this.database.query(
            `SELECT id FROM exercises WHERE exercise_name = $1 LIMIT 1`,
            [entry.exercise_name]
          );
          if (exercise.rows.length > 0) {
            await this.addExerciseToWorkout(
              newWorkout.id,
              exercise.rows[0].id,
              {
                sets,
                restSeconds: entry.rest_seconds,
                equipmentUsed: entry.equipment_used,
                notes: entry.notes,
              }
            );
          }
        }
      }

      return await this.getWorkoutLog(newWorkout.id);
    } catch (error) {
      this.logger.error(`Error repeating workout ${workoutId}:`, error);
      throw error;
    }
  }

  /**
   * Update a specific exercise entry in a workout
   * @param {number} entryId - Entry ID
   * @param {number} userId - User ID for verification
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated entry
   */
  async updateWorkoutEntry(entryId, userId, updates) {
    try {
      this.logger.info(
        `📝 [Workout] Updating entry ${entryId} for user ${userId}...`,
        updates
      );

      // Verify ownership and check if deleted
      const entryResult = await this.database.query(
        `SELECT user_id, deleted_at FROM exercise_log_entries WHERE id = $1`,
        [entryId]
      );

      if (entryResult.rows.length === 0) {
        throw new Error(`Entry ${entryId} does not exist`);
      }

      if (entryResult.rows[0].deleted_at !== null) {
        throw new Error(
          `Entry ${entryId} has been deleted and cannot be updated`
        );
      }

      if (
        entryResult.rows[0].user_id !== null &&
        parseInt(entryResult.rows[0].user_id) !== parseInt(userId)
      ) {
        throw new Error("Unauthorized to update this entry");
      }

      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.sets !== undefined) {
        fields.push(`sets = $${paramIndex++}`);
        values.push(JSON.stringify(updates.sets));
      }
      if (updates.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(updates.notes);
      }
      if (updates.restSeconds !== undefined) {
        fields.push(`rest_seconds = $${paramIndex++}`);
        values.push(updates.restSeconds);
      }
      if (updates.exerciseOrder !== undefined) {
        fields.push(`exercise_order = $${paramIndex++}`);
        values.push(updates.exerciseOrder);
      }

      if (fields.length === 0) {
        return await this._getEntryById(entryId);
      }

      values.push(entryId);
      const sql = `UPDATE exercise_log_entries SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
      const result = await this.database.query(sql, values);

      return result.rows[0];
    } catch (error) {
      this.logger.error(
        `❌ [WorkoutService] Error updating entry ${entryId}:`,
        error
      );
      console.error(
        `❌ [WorkoutService] Error updating entry ${entryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a specific exercise entry from a workout
   * @param {number} entryId - Entry ID
   * @param {number} userId - User ID for verification
   * @returns {Promise<boolean>} Success
   */
  async deleteWorkoutEntry(entryId, userId) {
    try {
      this.logger.info(
        `🗑️ [Workout] Deleting entry ${entryId} for user ${userId}...`
      );

      // Verify ownership
      const entryResult = await this.database.query(
        `SELECT user_id FROM exercise_log_entries WHERE id = $1 AND deleted_at IS NULL`,
        [entryId]
      );

      if (entryResult.rows.length === 0) {
        throw new Error(`Entry ${entryId} not found`);
      }

      if (
        entryResult.rows[0].user_id !== null &&
        parseInt(entryResult.rows[0].user_id) !== parseInt(userId)
      ) {
        throw new Error("Unauthorized to delete this entry");
      }

      const result = await this.database.query(
        `UPDATE exercise_log_entries SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [entryId]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`❌ [Workout] Error deleting entry ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Get entry by ID (internal helper)
   */
  async _getEntryById(entryId) {
    const result = await this.database.query(
      `SELECT * FROM exercise_log_entries WHERE id = $1`,
      [entryId]
    );
    return result.rows[0] || null;
  }
}

module.exports = ExerciseService;
