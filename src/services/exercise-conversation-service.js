/**
 * Exercise Conversation Service
 * Manages exercise chat conversations, embeddings, and RAG retrieval
 */

const EmbeddingService = require('./embedding-service');
const ExerciseService = require('./exercise-service');

class ExerciseConversationService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.embeddingService = new EmbeddingService(logger);
    this.exerciseService = new ExerciseService(database, logger);
  }

  /**
   * Create a new conversation
   * @param {number} userId - User ID
   * @param {Object} contextSnapshot - Snapshot of user's workout state
   * @returns {Promise<Object>} Created conversation
   */
  async createConversation(userId, contextSnapshot = null) {
    try {
      const result = await this.database.query(
        `INSERT INTO exercise_conversations (user_id, context_snapshot)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, contextSnapshot ? JSON.stringify(contextSnapshot) : null]
      );

      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error creating conversation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Save a message to conversation
   * @param {number} conversationId - Conversation ID
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Saved message
   */
  async saveMessage(conversationId, role, content, metadata = {}) {
    try {
      // Get current message count
      const conv = await this.database.query(
        'SELECT message_count FROM exercise_conversations WHERE id = $1',
        [conversationId]
      );

      if (conv.rows.length === 0) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const messageOrder = (conv.rows[0]?.message_count || 0) + 1;

      // Insert message
      const result = await this.database.query(
        `INSERT INTO exercise_conversation_messages 
         (conversation_id, role, content, message_order, metadata, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          conversationId,
          role,
          content,
          messageOrder,
          JSON.stringify(metadata),
          metadata.tokensUsed || null,
        ]
      );

      // Update conversation
      await this.database.query(
        `UPDATE exercise_conversations 
         SET message_count = message_count + 1,
             last_message_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );

      const message = result.rows[0];

      // Generate and save embedding for semantic search (async, don't wait)
      this.generateAndSaveEmbedding(
        conversationId,
        message.id,
        content,
        role === 'user' ? 'user_message' : 'assistant_message'
      ).catch(err => {
        this.logger.error(`Error generating embedding for message ${message.id}:`, err);
        // Don't throw - embedding failure shouldn't break message saving
      });

      return message;
    } catch (error) {
      this.logger.error(`Error saving message to conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Generate and save embedding for semantic search
   * @param {number} conversationId - Conversation ID
   * @param {number} messageId - Message ID
   * @param {string} text - Text to embed
   * @param {string} chunkType - Type of chunk
   */
  async generateAndSaveEmbedding(conversationId, messageId, text, chunkType) {
    try {
      const embedding = await this.embeddingService.generateEmbedding(text);

      // Convert array to PostgreSQL vector format
      const vectorString = `[${embedding.join(',')}]`;

      await this.database.query(
        `INSERT INTO exercise_conversation_embeddings 
         (conversation_id, message_id, embedding, text_chunk, chunk_type)
         VALUES ($1, $2, $3::vector, $4, $5)`,
        [conversationId, messageId, vectorString, text, chunkType]
      );

      this.logger.debug(`Saved embedding for message ${messageId}`);
    } catch (error) {
      this.logger.error(`Error generating/saving embedding:`, error);
      throw error;
    }
  }

  /**
   * Retrieve relevant conversation history using vector search (RAG)
   * @param {number} userId - User ID
   * @param {string} query - User query
   * @param {number} limit - Max results (default 5)
   * @returns {Promise<Array>} Relevant conversation snippets
   */
  async retrieveRelevantConversations(userId, query, limit = 5) {
    try {
      // Generate embedding for user query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      // Vector similarity search using cosine distance
      // Note: <=> is the cosine distance operator in pgvector
      const result = await this.database.query(
        `SELECT 
          ec.id as conversation_id,
          ecm.id as message_id,
          ecm.content,
          ecm.role,
          ecm.created_at,
          1 - (ce.embedding <=> $1::vector) as similarity
         FROM exercise_conversation_embeddings ce
         JOIN exercise_conversations ec ON ce.conversation_id = ec.id
         LEFT JOIN exercise_conversation_messages ecm ON ce.message_id = ecm.id
         WHERE ec.user_id = $2
         ORDER BY ce.embedding <=> $1::vector
         LIMIT $3`,
        [vectorString, userId, limit]
      );

      return result.rows.map(row => ({
        conversationId: row.conversation_id,
        messageId: row.message_id,
        content: row.content,
        role: row.role,
        similarity: parseFloat(row.similarity),
        timestamp: row.created_at,
      }));
    } catch (error) {
      this.logger.error(`Error retrieving relevant conversations for user ${userId}:`, error);
      // Return empty array on error rather than throwing
      return [];
    }
  }

  /**
   * Build context for LLM prompt
   * @param {number} userId - User ID
   * @param {string} userQuery - User's query
   * @returns {Promise<Object>} Context object
   */
  async buildContext(userId, userQuery) {
    try {
      const context = {
        // 1. Recent workout logs
        recentWorkouts: await this._getRecentWorkouts(userId, 7),

        // 2. Relevant past conversations (RAG retrieval)
        relevantConversations: await this.retrieveRelevantConversations(userId, userQuery, 3),

        // 3. Exercise history/patterns
        exerciseHistory: await this.exerciseService.getExerciseHistory(userId),

        // 4. Current routines
        currentRoutines: await this.exerciseService.getRoutines(userId, true),

        // 5. Today's routine
        todayRoutine: await this.exerciseService.getTodayRoutine(userId),
      };

      return context;
    } catch (error) {
      this.logger.error(`Error building context for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {number} conversationId - Conversation ID
   * @param {number} limit - Max messages (default 50)
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversationHistory(conversationId, limit = 50) {
    try {
      const result = await this.database.query(
        `SELECT id, role, content, message_order, metadata, created_at
         FROM exercise_conversation_messages
         WHERE conversation_id = $1
         ORDER BY message_order ASC
         LIMIT $2`,
        [conversationId, limit]
      );

      return result.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }));
    } catch (error) {
      this.logger.error(`Error fetching conversation history for ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * @param {number} userId - User ID
   * @param {number} limit - Max results (default 20)
   * @returns {Promise<Array>} List of conversations
   */
  async getConversations(userId, limit = 20) {
    try {
      const result = await this.database.query(
        `SELECT * FROM exercise_conversations
         WHERE user_id = $1
         ORDER BY last_message_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      this.logger.error(`Error fetching conversations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get recent workouts for context
   * @private
   */
  async _getRecentWorkouts(userId, days) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const logs = await this.exerciseService.getWorkoutHistory(
        userId,
        startDate.toISOString().split('T')[0],
        null,
        30
      );

      // Fetch entries for each log
      const workouts = [];
      for (const log of logs) {
        const fullLog = await this.exerciseService.getWorkoutLog(log.id);
        if (fullLog) {
          workouts.push(fullLog);
        }
      }

      return workouts;
    } catch (error) {
      this.logger.error(`Error fetching recent workouts:`, error);
      return [];
    }
  }
}

module.exports = ExerciseConversationService;

