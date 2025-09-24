/**
 * Gmail MCP Client Singleton Manager
 * 
 * This singleton ensures that only ONE instance of GmailMCPClient exists
 * across the entire application, solving the token sharing problem.
 * 
 * Key Benefits:
 * 1. Single source of truth for OAuth tokens
 * 2. Shared authentication state across all services
 * 3. Prevents token conflicts between webhook handlers and API calls
 * 4. Reduces memory usage and initialization overhead
 * 
 * Usage:
 *   const gmailClient = await getGmailClient(logger);
 *   await gmailClient.sendEmail(emailData);
 */

const { GmailMCPClient } = require('./gmail');

class GmailSingleton {
  constructor() {
    this.instance = null;
    this.initializationPromise = null;
    this.logger = null;
  }

  /**
   * Get the singleton instance of GmailMCPClient
   * @param {Object} logger - Logger instance
   * @returns {Promise<GmailMCPClient>} The singleton Gmail client instance
   */
  async getInstance(logger) {
    // If we already have an instance, return it immediately
    if (this.instance && this.instance.isInitialized) {
      return this.instance;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start fresh initialization
    this.logger = logger;
    this.initializationPromise = this._initializeInstance();
    
    try {
      this.instance = await this.initializationPromise;
      return this.instance;
    } finally {
      // Clear the promise so future calls can check the instance directly
      this.initializationPromise = null;
    }
  }

  /**
   * Internal method to create and initialize the Gmail client
   * @private
   */
  async _initializeInstance() {
    this.logger?.info('🔄 Initializing Gmail MCP Client singleton...');
    
    const client = new GmailMCPClient(this.logger);
    await client.init();
    
    // Mark as initialized for future reference
    client.isInitialized = true;
    
    this.logger?.info('✅ Gmail MCP Client singleton initialized successfully');
    return client;
  }

  /**
   * Force refresh the singleton instance (useful after token updates)
   * @param {Object} logger - Logger instance
   * @returns {Promise<GmailMCPClient>} New singleton instance
   */
  async refresh(logger) {
    this.logger?.info('🔄 Refreshing Gmail MCP Client singleton...');
    
    this.instance = null;
    this.initializationPromise = null;
    
    return this.getInstance(logger);
  }

  /**
   * Update tokens in the singleton instance
   * @param {Object} tokens - OAuth tokens object
   * @param {Object} logger - Logger instance
   */
  async updateTokens(tokens, logger) {
    const instance = await this.getInstance(logger);
    
    if (instance && instance.auth) {
      instance.auth.setCredentials(tokens);
      await instance.saveTokens(tokens);
      logger?.info('🔐 Updated tokens in Gmail singleton instance');
    }
  }

  /**
   * Check if the singleton instance is authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.instance && 
           this.instance.auth && 
           this.instance.auth.credentials &&
           (this.instance.auth.credentials.access_token || this.instance.auth.credentials.refresh_token);
  }

  /**
   * Get authentication status details
   * @returns {Object} Authentication status information
   */
  getAuthStatus() {
    if (!this.instance || !this.instance.auth || !this.instance.auth.credentials) {
      return {
        authenticated: false,
        reason: 'No instance or credentials'
      };
    }

    const creds = this.instance.auth.credentials;
    const now = Date.now();
    const hasAccessToken = !!creds.access_token;
    const hasRefreshToken = !!creds.refresh_token;
    const accessTokenExpired = creds.expiry_date ? (now >= creds.expiry_date) : false;

    return {
      authenticated: hasAccessToken || hasRefreshToken,
      hasAccessToken,
      hasRefreshToken,
      accessTokenExpired,
      expiryDate: creds.expiry_date ? new Date(creds.expiry_date) : null,
      scopes: creds.scope ? creds.scope.split(' ') : []
    };
  }
}

// Create the singleton instance
const gmailSingleton = new GmailSingleton();

/**
 * Public interface to get the Gmail client singleton
 * @param {Object} logger - Logger instance
 * @returns {Promise<GmailMCPClient>} The Gmail client singleton
 */
async function getGmailClient(logger) {
  return gmailSingleton.getInstance(logger);
}

/**
 * Refresh the Gmail client singleton (creates new instance)
 * @param {Object} logger - Logger instance  
 * @returns {Promise<GmailMCPClient>} The refreshed Gmail client singleton
 */
async function refreshGmailClient(logger) {
  return gmailSingleton.refresh(logger);
}

/**
 * Update tokens in the Gmail client singleton
 * @param {Object} tokens - OAuth tokens
 * @param {Object} logger - Logger instance
 */
async function updateGmailTokens(tokens, logger) {
  return gmailSingleton.updateTokens(tokens, logger);
}

/**
 * Check if Gmail client singleton is authenticated
 * @returns {boolean} Authentication status
 */
function isGmailAuthenticated() {
  return gmailSingleton.isAuthenticated();
}

/**
 * Get detailed authentication status
 * @returns {Object} Authentication status details
 */
function getGmailAuthStatus() {
  return gmailSingleton.getAuthStatus();
}

module.exports = {
  getGmailClient,
  refreshGmailClient, 
  updateGmailTokens,
  isGmailAuthenticated,
  getGmailAuthStatus
};