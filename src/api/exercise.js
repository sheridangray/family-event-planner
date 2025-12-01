const express = require("express");
const { authenticateFlexible } = require("../middleware/auth");

function createExerciseRouter(database, logger) {
  const router = express.Router();
  const ExerciseService = require("../services/exercise-service");
  const ExerciseLLMService = require("../services/exercise-llm-service");
  const ExerciseConversationService = require("../services/exercise-conversation-service");
  const ExerciseCoachService = require("../services/exercise-coach-service");
  const LLMAgeEvaluator = require("../services/llm-age-evaluator");

  const exerciseService = new ExerciseService(database, logger);
  const exerciseLLMService = new ExerciseLLMService(logger);
  const conversationService = new ExerciseConversationService(database, logger);
  const coachService = new ExerciseCoachService(database, logger);

  // Helper to get userId from request
  const getUserId = (req) => {
    return req.user?.id || req.body.userId || parseInt(req.params.userId);
  };

  // ==================== EXERCISES ====================

  /**
   * POST /api/exercise/exercises
   * Create a new exercise (triggers LLM generation)
   */
  router.post("/exercises", authenticateFlexible, async (req, res) => {
    try {
      const { exerciseName } = req.body;

      if (!exerciseName) {
        return res.status(400).json({
          success: false,
          error: "exerciseName required",
        });
      }

      const exercise = await exerciseService.createExercise(exerciseName, exerciseLLMService);

      res.json({
        success: true,
        data: exercise,
      });
    } catch (error) {
      logger.error("Error creating exercise:", {
        exerciseName,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: "Failed to create exercise",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/exercises/search?q=query
   * Search exercises by name (autocomplete)
   * NOTE: This must come before /exercises/:id to avoid route conflicts
   */
  router.get("/exercises/search", authenticateFlexible, async (req, res) => {
    try {
      const query = req.query.q || "";
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;

      if (!query) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const exercises = await exerciseService.searchExercises(query, limit);

      res.json({
        success: true,
        data: exercises,
      });
    } catch (error) {
      logger.error("Error searching exercises:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search exercises",
      });
    }
  });

  /**
   * GET /api/exercise/exercises
   * Get all exercises with pagination
   * NOTE: This comes after /exercises/search to avoid route conflicts
   */
  router.get("/exercises", authenticateFlexible, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;

      const exercises = await exerciseService.getAllExercises(limit, offset);

      res.json({
        success: true,
        data: exercises,
      });
    } catch (error) {
      logger.error("Error fetching exercises:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch exercises",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/exercises/:id
   * Get exercise by ID
   */
  router.get("/exercises/:id", authenticateFlexible, async (req, res) => {
    try {
      const exerciseId = parseInt(req.params.id);
      const exercise = await exerciseService.getExercise(exerciseId);

      if (!exercise) {
        return res.status(404).json({
          success: false,
          error: "Exercise not found",
        });
      }

      res.json({
        success: true,
        data: exercise,
      });
    } catch (error) {
      logger.error("Error fetching exercise:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch exercise",
      });
    }
  });

  /**
   * PUT /api/exercise/exercises/:id
   * Update exercise
   */
  router.put("/exercises/:id", authenticateFlexible, async (req, res) => {
    try {
      const exerciseId = parseInt(req.params.id);
      const exercise = await exerciseService.updateExercise(exerciseId, req.body);

      res.json({
        success: true,
        data: exercise,
      });
    } catch (error) {
      logger.error("Error updating exercise:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update exercise",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/exercise/exercises/:id
   * Delete exercise
   */
  router.delete("/exercises/:id", authenticateFlexible, async (req, res) => {
    try {
      const exerciseId = parseInt(req.params.id);
      const success = await exerciseService.deleteExercise(exerciseId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Exercise not found or cannot be deleted",
        });
      }

      res.json({
        success: true,
        message: "Exercise deleted",
      });
    } catch (error) {
      logger.error("Error deleting exercise:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete exercise",
        message: error.message,
      });
    }
  });

  // ==================== WORKOUTS ====================

  /**
   * POST /api/exercise/workouts
   * Create a new workout
   */
  router.post("/workouts", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const workout = await exerciseService.createWorkout(userId, req.body);

      res.json({
        success: true,
        data: workout,
      });
    } catch (error) {
      logger.error("Error creating workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create workout",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/workouts
   * Get workout history
   */
  router.get("/workouts", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const { startDate, endDate, limit } = req.query;
      const workouts = await exerciseService.getWorkoutHistory(
        userId,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        limit ? parseInt(limit) : 50
      );

      // Fetch full workout details for each
      const workoutsWithEntries = await Promise.all(
        workouts.map(workout => exerciseService.getWorkoutLog(workout.id))
      );

      res.json({
        success: true,
        data: workoutsWithEntries,
      });
    } catch (error) {
      logger.error("Error fetching workout history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch workout history",
      });
    }
  });

  /**
   * GET /api/exercise/workouts/:id
   * Get workout by ID
   */
  router.get("/workouts/:id", authenticateFlexible, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const workout = await exerciseService.getWorkoutLog(workoutId);

      if (!workout) {
        return res.status(404).json({
          success: false,
          error: "Workout not found",
        });
      }

      res.json({
        success: true,
        data: workout,
      });
    } catch (error) {
      logger.error("Error fetching workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch workout",
      });
    }
  });

  /**
   * POST /api/exercise/workouts/:id/exercises
   * Add exercise to workout
   */
  router.post("/workouts/:id/exercises", authenticateFlexible, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const { exerciseId, sets, restSeconds, equipmentUsed, notes } = req.body;

      if (!exerciseId || !sets) {
        return res.status(400).json({
          success: false,
          error: "exerciseId and sets required",
        });
      }

      const workout = await exerciseService.addExerciseToWorkout(workoutId, exerciseId, {
        sets,
        restSeconds,
        equipmentUsed,
        notes,
      });

      res.json({
        success: true,
        data: workout,
      });
    } catch (error) {
      logger.error("Error adding exercise to workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add exercise to workout",
        message: error.message,
      });
    }
  });

  /**
   * POST /api/exercise/workouts/:id/repeat
   * Repeat a workout (copy previous sets/weights)
   */
  router.post("/workouts/:id/repeat", authenticateFlexible, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const userId = getUserId(req);

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const workout = await exerciseService.repeatWorkout(workoutId, userId);

      res.json({
        success: true,
        data: workout,
      });
    } catch (error) {
      logger.error("Error repeating workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to repeat workout",
        message: error.message,
      });
    }
  });

  /**
   * POST /api/exercise/start
   * Start new exercise session (returns exercise details with type info)
   */
  router.post("/start", authenticateFlexible, async (req, res) => {
    try {
      const { exerciseId, workoutId } = req.body;

      if (!exerciseId) {
        return res.status(400).json({
          success: false,
          error: "exerciseId required",
        });
      }

      const exercise = await exerciseService.getExercise(exerciseId);

      if (!exercise) {
        return res.status(404).json({
          success: false,
          error: "Exercise not found",
        });
      }

      res.json({
        success: true,
        data: {
          exercise,
          workoutId: workoutId || null,
        },
      });
    } catch (error) {
      logger.error("Error starting exercise:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start exercise",
        message: error.message,
      });
    }
  });

  // ==================== ROUTINES ====================

  /**
   * POST /api/exercise/routines
   * Create a new exercise routine
   */
  router.post("/routines", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const routine = await exerciseService.createRoutine(userId, req.body);

      res.json({
        success: true,
        data: routine,
      });
    } catch (error) {
      logger.error("Error creating routine:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create routine",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/routines
   * Get all routines for user
   */
  router.get("/routines", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const activeOnly = req.query.activeOnly === "true";
      const routines = await exerciseService.getRoutines(userId, activeOnly);

      res.json({
        success: true,
        data: routines,
      });
    } catch (error) {
      logger.error("Error fetching routines:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch routines",
      });
    }
  });

  /**
   * GET /api/exercise/routines/today
   * Get today's routine for user
   */
  router.get("/routines/today", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const routine = await exerciseService.getTodayRoutine(userId);

      res.json({
        success: true,
        data: routine,
      });
    } catch (error) {
      logger.error("Error fetching today's routine:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch today's routine",
      });
    }
  });

  /**
   * GET /api/exercise/routines/:id
   * Get specific routine
   */
  router.get("/routines/:id", authenticateFlexible, async (req, res) => {
    try {
      const routineId = parseInt(req.params.id);
      const routine = await exerciseService.getRoutine(routineId);

      if (!routine) {
        return res.status(404).json({
          success: false,
          error: "Routine not found",
        });
      }

      res.json({
        success: true,
        data: routine,
      });
    } catch (error) {
      logger.error("Error fetching routine:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch routine",
      });
    }
  });

  /**
   * PUT /api/exercise/routines/:id
   * Update routine
   */
  router.put("/routines/:id", authenticateFlexible, async (req, res) => {
    try {
      const routineId = parseInt(req.params.id);
      const routine = await exerciseService.updateRoutine(routineId, req.body);

      res.json({
        success: true,
        data: routine,
      });
    } catch (error) {
      logger.error("Error updating routine:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update routine",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/exercise/routines/:id
   * Delete routine
   */
  router.delete("/routines/:id", authenticateFlexible, async (req, res) => {
    try {
      const routineId = parseInt(req.params.id);
      const success = await exerciseService.deleteRoutine(routineId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Routine not found",
        });
      }

      res.json({
        success: true,
        message: "Routine deleted",
      });
    } catch (error) {
      logger.error("Error deleting routine:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete routine",
      });
    }
  });

  // ==================== LOGGING ====================

  /**
   * POST /api/exercise/logs
   * Log a workout
   */
  router.post("/logs", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const log = await exerciseService.logWorkout(userId, req.body);

      res.json({
        success: true,
        data: log,
      });
    } catch (error) {
      logger.error("Error logging workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to log workout",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/logs
   * Get workout history
   */
  router.get("/logs", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const { startDate, endDate, limit } = req.query;
      const logs = await exerciseService.getWorkoutHistory(
        userId,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        limit ? parseInt(limit) : 50
      );

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error("Error fetching workout history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch workout history",
      });
    }
  });

  /**
   * GET /api/exercise/logs/today
   * Check if logged today
   */
  router.get("/logs/today", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const routineId = req.query.routineId ? parseInt(req.query.routineId) : null;
      const hasLogged = await exerciseService.hasLoggedToday(userId, routineId);

      res.json({
        success: true,
        data: { hasLogged },
      });
    } catch (error) {
      logger.error("Error checking if logged today:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check log status",
      });
    }
  });

  /**
   * GET /api/exercise/logs/:id
   * Get specific workout log
   */
  router.get("/logs/:id", authenticateFlexible, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      const log = await exerciseService.getWorkoutLog(logId);

      if (!log) {
        return res.status(404).json({
          success: false,
          error: "Log not found",
        });
      }

      res.json({
        success: true,
        data: log,
      });
    } catch (error) {
      logger.error("Error fetching workout log:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch workout log",
      });
    }
  });

  // ==================== AI SUGGESTIONS ====================

  /**
   * POST /api/exercise/suggestions
   * Get AI suggestions for a workout log entry
   */
  router.post("/suggestions", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { logEntryId } = req.body;

      if (!userId || !logEntryId) {
        return res.status(400).json({
          success: false,
          error: "userId and logEntryId required",
        });
      }

      const suggestions = await coachService.generateSuggestions(userId, logEntryId);

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      logger.error("Error generating suggestions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate suggestions",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/suggestions/:logId
   * Get suggestions for a specific log
   */
  router.get("/suggestions/:logId", authenticateFlexible, async (req, res) => {
    try {
      const logId = parseInt(req.params.logId);
      const userId = getUserId(req);

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const result = await database.query(
        `SELECT * FROM exercise_suggestions
         WHERE log_id = $1 AND user_id = $2
         ORDER BY generated_at DESC`,
        [logId, userId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error("Error fetching suggestions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch suggestions",
      });
    }
  });

  // ==================== CHAT ====================

  /**
   * POST /api/exercise/chat
   * Send message and get AI response
   */
  router.post("/chat", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { message, conversationId } = req.body;

      if (!userId || !message) {
        return res.status(400).json({
          success: false,
          error: "userId and message required",
        });
      }

      // Get or create conversation
      let convId = conversationId;
      if (!convId) {
        const workoutSnapshot = await exerciseService.getTodayRoutine(userId);
        const conv = await conversationService.createConversation(userId, {
          todayRoutine: workoutSnapshot,
          timestamp: new Date().toISOString(),
        });
        convId = conv.id;
      }

      // Save user message
      await conversationService.saveMessage(convId, "user", message);

      // Build context (RAG retrieval)
      const context = await conversationService.buildContext(userId, message);

      // Build prompt with context
      const prompt = buildPromptWithContext(message, context);

      // Call LLM
      let llmClient;
      try {
        llmClient = new LLMAgeEvaluator(logger);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "LLM service not available",
          message: error.message,
        });
      }

      const llmResponse = await llmClient.callTogetherAI(prompt, {
        model: "openai/gpt-oss-20b",
        max_tokens: 1000,
        temperature: 0.7,
        systemMessage: getSystemPrompt(),
      });

      // Estimate tokens (rough estimate)
      const tokensUsed = Math.ceil((prompt.length + llmResponse.length) / 4);

      // Save assistant response
      await conversationService.saveMessage(
        convId,
        "assistant",
        llmResponse,
        { tokensUsed }
      );

      res.json({
        success: true,
        data: {
          conversationId: convId,
          response: llmResponse,
          context: {
            workoutsReferenced: context.recentWorkouts.length,
            conversationsReferenced: context.relevantConversations.length,
          },
        },
      });
    } catch (error) {
      logger.error("Error in exercise chat:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process chat message",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/exercise/conversations
   * List conversations for user
   */
  router.get("/conversations", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit) : 20;
      const conversations = await conversationService.getConversations(userId, limit);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      logger.error("Error fetching conversations:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch conversations",
      });
    }
  });

  /**
   * GET /api/exercise/conversations/:id
   * Get conversation history
   */
  router.get("/conversations/:id", authenticateFlexible, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const messages = await conversationService.getConversationHistory(conversationId, limit);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      logger.error("Error fetching conversation history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch conversation history",
      });
    }
  });

  // ==================== HISTORY ====================

  /**
   * GET /api/exercise/history
   * Get exercise patterns/history
   */
  router.get("/history", authenticateFlexible, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { exerciseName } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId required",
        });
      }

      const history = await exerciseService.getExerciseHistory(userId, exerciseName || null);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error("Error fetching exercise history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch exercise history",
      });
    }
  });

  return router;
}

// Helper function to build prompt with context
function buildPromptWithContext(userQuery, context) {
  const systemPrompt = `You are an AI Exercise Coach helping users with their workout routines.
You have access to their workout history, exercise patterns, and past conversations.`;

  let contextText = systemPrompt + "\n\n";

  // Add recent workouts
  if (context.recentWorkouts && context.recentWorkouts.length > 0) {
    contextText += "## Recent Workouts:\n";
    context.recentWorkouts.slice(0, 5).forEach((workout) => {
      contextText += `- ${workout.exercise_date}: ${workout.routine_id ? "Routine workout" : "Custom workout"}\n`;
      if (workout.entries && workout.entries.length > 0) {
        contextText += `  Exercises: ${workout.entries.map((e) => e.exercise_name).join(", ")}\n`;
      }
    });
    contextText += "\n";
  }

  // Add relevant past conversations (RAG retrieval)
  if (context.relevantConversations && context.relevantConversations.length > 0) {
    contextText += "## Relevant Past Conversations:\n";
    context.relevantConversations.forEach((conv) => {
      contextText += `[${conv.role}]: ${conv.content}\n`;
    });
    contextText += "\n";
  }

  // Add exercise history patterns
  if (context.exerciseHistory && context.exerciseHistory.length > 0) {
    contextText += "## Exercise Patterns:\n";
    context.exerciseHistory.slice(0, 10).forEach((ex) => {
      contextText += `- ${ex.exercise_name}: Last performed ${ex.last_performed || "never"}, `;
      contextText += `Average: ${ex.average_sets || "N/A"} sets × ${ex.average_reps || "N/A"} reps\n`;
    });
    contextText += "\n";
  }

  // Add today's routine
  if (context.todayRoutine) {
    contextText += `## Today's Routine: ${context.todayRoutine.routine_name}\n`;
    if (context.todayRoutine.exercises) {
      contextText += `Exercises: ${context.todayRoutine.exercises.map((e) => e.exercise_name).join(", ")}\n`;
    }
    contextText += "\n";
  }

  // Add current user query
  contextText += `## User Question:\n${userQuery}\n\n`;
  contextText += `## Your Response:\n`;

  return contextText;
}

// Helper function to get system prompt
function getSystemPrompt() {
  return `You are an AI Exercise Coach. You help users with:
- Workout planning and routine management
- Exercise form and technique advice
- Progression recommendations
- Equipment suggestions
- Motivation and encouragement

Be specific, encouraging, and evidence-based. Reference their workout history when relevant.`;
}

module.exports = createExerciseRouter;

