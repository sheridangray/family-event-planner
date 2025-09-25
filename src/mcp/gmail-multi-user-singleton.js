/**
 * Multi-User Gmail MCP Client Singleton Manager
 * 
 * This enhanced singleton manages separate GmailMCPClient instances for each user,
 * solving the multi-user OAuth token storage and sharing problem.
 * 
 * Key Features:
 * 1. Per-user Gmail client instances with isolated OAuth tokens
 * 2. Database-backed token persistence for production scaling
 * 3. Automatic token refresh and database updates
 * 4. Backwards compatibility with single-user system
 * 5. Performance optimization with instance caching
 * 
 * Migration Strategy:
 * - Phase 1: Maintain backwards compatibility with getUserId = null for single-user mode
 * - Phase 2: Gradually migrate services to pass userId
 * - Phase 3: Remove backwards compatibility after full migration
 */

const { GmailMCPClient } = require('./gmail');
const { Pool } = require('pg');

class GmailMultiUserSingleton {
  constructor() {
    this.instances = new Map(); // userId -> GmailMCPClient
    this.initializationPromises = new Map(); // userId -> Promise
    this.logger = null;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  _initializeDatabase() {
    if (!this.db) {
      const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
      this.db = new Pool({
        connectionString,
        ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
      });
    }
  }

  /**
   * Get Gmail client instance for a specific user
   * @param {number|null} userId - User ID from users table (null for backwards compatibility)
   * @param {Object} logger - Logger instance
   * @returns {Promise<GmailMCPClient>} The Gmail client instance for the user
   */
  async getInstance(userId, logger) {
    this.logger = logger;
    this._initializeDatabase();

    // Backwards compatibility: if no userId provided, use single-user mode
    if (userId === null || userId === undefined) {
      return this._getSingleUserInstance();
    }

    const userKey = `user_${userId}`;

    // If we already have an instance for this user, return it
    if (this.instances.has(userKey) && this.instances.get(userKey).isInitialized) {
      return this.instances.get(userKey);
    }

    // If initialization is already in progress for this user, wait for it
    if (this.initializationPromises.has(userKey)) {
      return this.initializationPromises.get(userKey);
    }

    // Start fresh initialization for this user
    this.initializationPromises.set(userKey, this._initializeUserInstance(userId));
    
    try {
      const instance = await this.initializationPromises.get(userKey);
      this.instances.set(userKey, instance);
      return instance;
    } finally {
      // Clear the promise so future calls can check the instance directly
      this.initializationPromises.delete(userKey);
    }
  }

  /**
   * Backwards compatibility method for single-user mode
   * @private
   */
  async _getSingleUserInstance() {
    // Use existing single-user singleton for backwards compatibility
    const { getGmailClient } = require('./gmail-singleton');
    return getGmailClient(this.logger);
  }

  /**
   * Internal method to create and initialize Gmail client for a specific user
   * @param {number} userId - User ID
   * @private
   */
  async _initializeUserInstance(userId) {
    this.logger?.info(`🔄 Initializing Gmail MCP Client for user ${userId}...`);
    
    try {
      // Load tokens from database
      const tokens = await this._loadTokensFromDatabase(userId);
      
      // Create and initialize client with tokens
      const client = new GmailMCPClient(this.logger);
      await client.initWithTokens(tokens);
      
      // Override the saveTokens method to save to database
      const originalSaveTokens = client.saveTokens.bind(client);
      client.saveTokens = async (tokens) => {
        // First save using original multi-strategy approach
        await originalSaveTokens(tokens);
        // Then save to database for persistence
        await this._saveTokensToDatabase(userId, tokens);
      };
      
      // Mark as initialized
      client.isInitialized = true;
      client.userId = userId; // Add user context
      
      this.logger?.info(`✅ Gmail MCP Client initialized for user ${userId}`);
      return client;
      
    } catch (error) {
      this.logger?.error(`❌ Failed to initialize Gmail client for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Load OAuth tokens from database for a specific user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} OAuth tokens object
   * @private
   */
  async _loadTokensFromDatabase(userId) {
    try {
      const result = await this.db.query(
        'SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
        [userId, 'google']
      );
      
      if (result.rows.length === 0) {
        throw new Error(`No OAuth tokens found for user ${userId}. Please complete OAuth flow.`);
      }
      
      const row = result.rows[0];
      return {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        token_type: row.token_type || 'Bearer',
        scope: row.scope,
        expiry_date: row.expiry_date
      };
      
    } catch (error) {
      this.logger?.error(`Failed to load tokens for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Save OAuth tokens to database for a specific user
   * @param {number} userId - User ID
   * @param {Object} tokens - OAuth tokens object
   * @private
   */
  async _saveTokensToDatabase(userId, tokens) {
    try {
      await this.db.query(`
        INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_type, scope, expiry_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_type = EXCLUDED.token_type,
          scope = EXCLUDED.scope,
          expiry_date = EXCLUDED.expiry_date,
          updated_at = NOW()
      `, [
        userId, 
        'google', 
        tokens.access_token, 
        tokens.refresh_token, 
        tokens.token_type || 'Bearer', 
        tokens.scope, 
        tokens.expiry_date
      ]);

      // Log audit trail
      await this.db.query(`
        INSERT INTO oauth_audit_log (user_id, action, provider, success)
        VALUES ($1, $2, $3, $4)
      `, [userId, 'token_updated', 'google', true]);

      this.logger?.info(`🔐 Updated tokens in database for user ${userId}`);
      
    } catch (error) {
      this.logger?.error(`Failed to save tokens for user ${userId}:`, error.message);
      
      // Log failed attempt
      try {
        await this.db.query(`
          INSERT INTO oauth_audit_log (user_id, action, provider, success, error_message)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, 'token_update_failed', 'google', false, error.message]);
      } catch (auditError) {
        // Silent fail on audit logging
      }
      
      throw error;
    }
  }

  /**
   * Complete OAuth flow for a specific user
   * @param {number} userId - User ID
   * @param {string} email - User's email address
   * @param {string} authCode - OAuth authorization code
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} OAuth completion result
   */
  async completeOAuthForUser(userId, email, authCode, logger) {
    this.logger = logger;
    this._initializeDatabase();

    try {
      // Create a temporary client for OAuth completion
      const client = new GmailMCPClient(logger);
      const result = await client.completeAuth(email, authCode);

      if (result.success) {
        // Save tokens to database
        await this._saveTokensToDatabase(userId, result.tokens);
        
        // Clear any existing instance so it gets reinitialized with new tokens
        const userKey = `user_${userId}`;
        this.instances.delete(userKey);
        this.initializationPromises.delete(userKey);
        
        // Log successful OAuth completion
        await this.db.query(`
          INSERT INTO oauth_audit_log (user_id, action, provider, success)
          VALUES ($1, $2, $3, $4)
        `, [userId, 'oauth_completed', 'google', true]);

        logger?.info(`✅ OAuth completed successfully for user ${userId} (${email})`);
      }
      
      return result;
      
    } catch (error) {
      logger?.error(`❌ OAuth failed for user ${userId}:`, error.message);
      
      // Log failed attempt
      try {
        await this.db.query(`
          INSERT INTO oauth_audit_log (user_id, action, provider, success, error_message)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, 'oauth_failed', 'google', false, error.message]);
      } catch (auditError) {
        // Silent fail on audit logging
      }
      
      throw error;
    }
  }

  /**
   * Refresh Gmail client instance for a user (forces re-initialization)
   * @param {number} userId - User ID
   * @param {Object} logger - Logger instance
   * @returns {Promise<GmailMCPClient>} Refreshed Gmail client instance
   */
  async refreshUserInstance(userId, logger) {
    this.logger = logger;
    const userKey = `user_${userId}`;
    
    this.logger?.info(`🔄 Refreshing Gmail client for user ${userId}...`);
    
    this.instances.delete(userKey);
    this.initializationPromises.delete(userKey);
    
    return this.getInstance(userId, logger);
  }

  /**
   * Check if a user is authenticated (has valid tokens)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if user is authenticated
   */
  async isUserAuthenticated(userId) {
    this._initializeDatabase();
    
    try {
      const result = await this.db.query(
        'SELECT expiry_date FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
        [userId, 'google']
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      // Check if token is not expired (with 5 minute buffer)
      const expiryDate = result.rows[0].expiry_date;
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5 minutes
      
      return now < (expiryDate - buffer);
      
    } catch (error) {
      this.logger?.error(`Error checking authentication for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Get authentication status for all users
   * @returns {Promise<Array>} Array of user authentication statuses
   */
  async getAllUserAuthStatus() {
    this._initializeDatabase();
    
    try {
      const result = await this.db.query(`
        SELECT u.id, u.email, u.name, u.role,
               ot.expiry_date, ot.updated_at,
               CASE 
                 WHEN ot.expiry_date IS NULL THEN false
                 WHEN ot.expiry_date < (EXTRACT(EPOCH FROM NOW()) * 1000 + 300000) THEN false
                 ELSE true
               END as is_authenticated
        FROM users u
        LEFT JOIN oauth_tokens ot ON u.id = ot.user_id AND ot.provider = 'google'
        WHERE u.active = true
        ORDER BY u.id
      `);
      
      return result.rows.map(row => ({
        userId: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isAuthenticated: row.is_authenticated,
        tokenExpiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
        lastUpdated: row.updated_at
      }));
      
    } catch (error) {
      this.logger?.error('Error getting auth status for all users:', error.message);
      return [];
    }
  }

  /**
   * Get user ID by email address
   * @param {string} email - User's email address
   * @returns {Promise<number|null>} User ID or null if not found
   */
  async getUserIdByEmail(email) {
    this._initializeDatabase();
    
    try {
      const result = await this.db.query(
        'SELECT id FROM users WHERE email = $1 AND active = true',
        [email]
      );
      
      return result.rows.length > 0 ? result.rows[0].id : null;
      
    } catch (error) {
      this.logger?.error(`Error finding user by email ${email}:`, error.message);
      return null;
    }
  }

  /**
   * Close database connections and clean up instances
   */
  async cleanup() {
    if (this.db) {
      await this.db.end();
      this.db = null;
    }
    this.instances.clear();
    this.initializationPromises.clear();
  }
}

// Create the singleton instance
const gmailMultiUserSingleton = new GmailMultiUserSingleton();

/**
 * Get Gmail client for a specific user (multi-user mode)
 * @param {number} userId - User ID from users table
 * @param {Object} logger - Logger instance
 * @returns {Promise<GmailMCPClient>} Gmail client instance for the user
 */
async function getGmailClientForUser(userId, logger) {
  return gmailMultiUserSingleton.getInstance(userId, logger);
}

/**
 * Backwards compatible method - uses single-user mode if no userId provided
 * @param {number|Object} userIdOrLogger - User ID or logger (for backwards compatibility)
 * @param {Object} logger - Logger instance (if userId provided)
 * @returns {Promise<GmailMCPClient>} Gmail client instance
 */
async function getGmailClient(userIdOrLogger, logger) {
  // Backwards compatibility logic
  if (typeof userIdOrLogger === 'object' && userIdOrLogger !== null && !logger) {
    // Called as getGmailClient(logger) - single-user mode
    return gmailMultiUserSingleton.getInstance(null, userIdOrLogger);
  } else {
    // Called as getGmailClient(userId, logger) - multi-user mode
    return gmailMultiUserSingleton.getInstance(userIdOrLogger, logger);
  }
}

/**
 * Complete OAuth flow for a specific user
 * @param {number} userId - User ID
 * @param {string} email - User's email address
 * @param {string} authCode - OAuth authorization code
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} OAuth completion result
 */
async function completeOAuthForUser(userId, email, authCode, logger) {
  return gmailMultiUserSingleton.completeOAuthForUser(userId, email, authCode, logger);
}

/**
 * Refresh Gmail client for a specific user
 * @param {number} userId - User ID
 * @param {Object} logger - Logger instance
 * @returns {Promise<GmailMCPClient>} Refreshed Gmail client
 */
async function refreshGmailClientForUser(userId, logger) {
  return gmailMultiUserSingleton.refreshUserInstance(userId, logger);
}

/**
 * Check if a specific user is authenticated
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Authentication status
 */
async function isUserAuthenticated(userId) {
  return gmailMultiUserSingleton.isUserAuthenticated(userId);
}

/**
 * Get authentication status for all users
 * @returns {Promise<Array>} Array of user auth statuses
 */
async function getAllUserAuthStatus() {
  return gmailMultiUserSingleton.getAllUserAuthStatus();
}

/**
 * Get user ID by email address
 * @param {string} email - User's email address
 * @returns {Promise<number|null>} User ID or null if not found
 */
async function getUserIdByEmail(email) {
  return gmailMultiUserSingleton.getUserIdByEmail(email);
}

/**
 * Clean up singleton resources
 */
async function cleanup() {
  return gmailMultiUserSingleton.cleanup();
}

module.exports = {
  // Multi-user methods
  getGmailClientForUser,
  completeOAuthForUser,
  refreshGmailClientForUser,
  isUserAuthenticated,
  getAllUserAuthStatus,
  getUserIdByEmail,
  cleanup,
  
  // Backwards compatible methods
  getGmailClient,
  
  // Singleton instance (for testing)
  _singleton: gmailMultiUserSingleton
};