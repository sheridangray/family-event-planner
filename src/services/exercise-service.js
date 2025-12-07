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
          
          // Prepare data arrays for new fields
          // Use entry fields directly if they are pre-formatted arrays, or extract from nested sets if necessary
          // The addExerciseToWorkout method handles the array construction from sets
          // Here we assume 'entries' might come from a direct API call matching the new schema or old
          // For robust support, we'll rely on the values passed being correct or defaulted to []
          
          await this.database.query(
            `INSERT INTO exercise_log_entries (
              log_id, exercise_name, exercise_order, equipment_used,
              sets_performed, reps_performed, weight_used, duration_seconds,
              rest_seconds, notes, difficulty_rating,
              distance_meters, band_level, resistance_level, incline_percentage,
              calories, heart_rate, speed_mph, rpe
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
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
              JSON.stringify(entry.distanceMeters || []),
              JSON.stringify(entry.bandLevel || []),
              JSON.stringify(entry.resistanceLevel || []),
              JSON.stringify(entry.inclinePercentage || []),
              JSON.stringify(entry.calories || []),
              JSON.stringify(entry.heartRate || []),
              JSON.stringify(entry.speedMph || []),
              JSON.stringify(entry.rpe || [])
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
      // Check if exercise already exists
      const existing = await this.database.query(
        `SELECT * FROM exercises WHERE LOWER(exercise_name) = LOWER($1)`,
        [exerciseName]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Generate details using LLM
      const details = await llmService.generateExerciseDetails(exerciseName);

      // Determine category: User selection > LLM guess > Default
      const category = options.category || details.category || 'barbell_dumbbell';

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
   * @param {string} query - Search query
   * @param {number} limit - Max results (default 20)
   * @returns {Promise<Array>} List of matching exercises
   */
  async searchExercises(query, limit = 20) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercises
         WHERE exercise_name ILIKE $1
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
   * @param {number} limit - Max results (default 50)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {Promise<Array>} List of exercises
   */
  async getAllExercises(limit = 50, offset = 0) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercises
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
      const sql = `UPDATE exercises SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

      const result = await this.database.query(sql, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error updating exercise ${exerciseId}:`, error);
      throw error;
    }
  }

  /**
   * Delete exercise (only if not referenced)
   * @param {number} exerciseId - Exercise ID
   * @returns {Promise<boolean>} Success
   */
  async deleteExercise(exerciseId) {
    try {
      // Check if exercise is referenced
      const routineRefs = await this.database.query(
        `SELECT COUNT(*) as count FROM routine_exercises WHERE exercise_id = $1`,
        [exerciseId]
      );
      const logRefs = await this.database.query(
        `SELECT COUNT(*) as count FROM exercise_log_entries WHERE exercise_id = $1`,
        [exerciseId]
      );

      if (parseInt(routineRefs.rows[0].count) > 0 || parseInt(logRefs.rows[0].count) > 0) {
        throw new Error('Cannot delete exercise that is referenced in routines or workout logs');
      }

      const result = await this.database.query(
        `DELETE FROM exercises WHERE id = $1`,
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
   * Create a new workout
   * @param {number} userId - User ID
   * @param {Object} workoutData - Workout data
   * @returns {Promise<Object>} Created workout
   */
  async createWorkout(userId, workoutData = {}) {
    try {
      const {
        routineId,
        exerciseDate,
        totalDurationMinutes,
        location,
        notes,
      } = workoutData;

      const today = new Date(exerciseDate || new Date());
      const dayOfWeek = today.getDay();

      const result = await this.database.query(
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

      return await this.getWorkoutLog(result.rows[0].id);
    } catch (error) {
      this.logger.error(`Error creating workout for user ${userId}:`, error);
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

      // Prepare sets data based on exercise type/category
      const sets = setsData.sets || [];
      const repsPerformed = [];
      const weightUsed = [];
      const durationSeconds = [];
      const distanceMeters = [];
      const bandLevel = [];
      const resistanceLevel = [];
      const inclinePercentage = [];
      const calories = [];
      const heartRate = [];
      const speedMph = [];
      const rpe = [];
      const restSeconds = setsData.restSeconds || null;

      for (const set of sets) {
        repsPerformed.push(set.reps || null);
        weightUsed.push(set.weight || null);
        durationSeconds.push(set.duration || null);
        distanceMeters.push(set.distance || null);
        bandLevel.push(set.bandLevel || null);
        resistanceLevel.push(set.resistanceLevel || null);
        inclinePercentage.push(set.incline || null);
        calories.push(set.calories || null);
        heartRate.push(set.heartRate || null);
        speedMph.push(set.speed || null);
        rpe.push(set.rpe || null);
      }

      // Insert exercise entry
      await this.database.query(
        `INSERT INTO exercise_log_entries (
          log_id, exercise_id, exercise_name, exercise_order,
          equipment_used, sets_performed, reps_performed, weight_used,
          duration_seconds, rest_seconds, notes, difficulty_rating,
          distance_meters, band_level, resistance_level, incline_percentage,
          calories, heart_rate, speed_mph, rpe
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          workoutId,
          exerciseId,
          exercise.exercise_name,
          nextOrder,
          setsData.equipmentUsed || null,
          sets.length,
          JSON.stringify(repsPerformed),
          JSON.stringify(weightUsed),
          JSON.stringify(durationSeconds),
          restSeconds,
          setsData.notes || null,
          setsData.difficultyRating || null,
          JSON.stringify(distanceMeters),
          JSON.stringify(bandLevel),
          JSON.stringify(resistanceLevel),
          JSON.stringify(inclinePercentage),
          JSON.stringify(calories),
          JSON.stringify(heartRate),
          JSON.stringify(speedMph),
          JSON.stringify(rpe)
        ]
      );

      // Update exercise history
      await this._updateExerciseHistory(
        (await this.getWorkoutLog(workoutId)).user_id,
        [{
          exerciseName: exercise.exercise_name,
          equipmentUsed: setsData.equipmentUsed || null,
          setsPerformed: sets.length,
          repsPerformed,
          weightUsed,
          durationSeconds,
        }]
      );

      return await this.getWorkoutLog(workoutId);
    } catch (error) {
      this.logger.error(`Error adding exercise to workout ${workoutId}:`, error);
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
        throw new Error('Cannot repeat workout from another user');
      }

      // Create new workout
      const newWorkout = await this.createWorkout(userId, {
        routineId: originalWorkout.routine_id,
        exerciseDate: new Date().toISOString().split('T')[0],
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

        const maxLength = Math.max(reps.length, weights.length, durations.length, distances.length);
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
            await this.addExerciseToWorkout(newWorkout.id, exercise.rows[0].id, {
              sets,
              restSeconds: entry.rest_seconds,
              equipmentUsed: entry.equipment_used,
              notes: entry.notes,
            });
          }
        }
      }

      return await this.getWorkoutLog(newWorkout.id);
    } catch (error) {
      this.logger.error(`Error repeating workout ${workoutId}:`, error);
      throw error;
    }
  }
}

module.exports = ExerciseService;
