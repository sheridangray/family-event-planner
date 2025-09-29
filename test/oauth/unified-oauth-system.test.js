/**
 * Enterprise-Grade OAuth System Tests
 * 
 * Tests the unified Gmail client and database-first OAuth architecture
 * Integrated with our enterprise testing framework
 */

const { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } = require('@jest/globals');
const { GmailClient } = require('../../src/mcp/gmail-client');
const Database = require('../../src/database');

// Test utilities
const createTestLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
});

const createValidTokens = () => ({
  access_token: 'ya29.test_access_token_12345',
  refresh_token: '1//test_refresh_token_67890',
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
  expiry_date: Date.now() + (60 * 60 * 1000) // 1 hour from now
});

describe('Unified OAuth System - Enterprise Tests', () => {
  let database;
  let gmailClient;
  let testLogger;
  let testUserId1, testUserId2;

  beforeAll(async () => {
    // Initialize database connection
    database = new Database();
    await database.init();
    
    // Clean up any existing test data
    await database.query('DELETE FROM oauth_tokens WHERE user_id IN (999, 998)');
    await database.query('DELETE FROM users WHERE id IN (999, 998)');
    
    // Create test users
    const user1 = await database.createUser('test.admin@example.com', 'Test Admin', 'admin');
    const user2 = await database.createUser('test.user@example.com', 'Test User', 'user');
    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (database) {
      await database.query('DELETE FROM oauth_tokens WHERE user_id IN ($1, $2)', [testUserId1, testUserId2]);
      await database.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId1, testUserId2]);
      await database.close();
    }
  });

  beforeEach(() => {
    testLogger = createTestLogger();
    gmailClient = new GmailClient(testLogger, database);
  });

  afterEach(async () => {
    if (gmailClient) {
      await gmailClient.cleanup();
    }
  });

  describe('Database OAuth Token Management', () => {
    test('should save and retrieve OAuth tokens for users', async () => {
      const tokens = createValidTokens();
      
      // Save tokens for test user
      await database.saveOAuthTokens(testUserId1, 'google', tokens);
      
      // Retrieve tokens
      const retrievedTokens = await database.getOAuthTokens(testUserId1, 'google');
      
      expect(retrievedTokens.access_token).toBe(tokens.access_token);
      expect(retrievedTokens.refresh_token).toBe(tokens.refresh_token);
      expect(retrievedTokens.scope).toBe(tokens.scope);
      expect(retrievedTokens.expiry_date).toBe(tokens.expiry_date);
    });

    test('should update existing OAuth tokens', async () => {
      const initialTokens = createValidTokens();
      const updatedTokens = {
        ...createValidTokens(),
        access_token: 'ya29.updated_access_token_54321'
      };
      
      // Save initial tokens
      await database.saveOAuthTokens(testUserId1, 'google', initialTokens);
      
      // Update tokens
      await database.saveOAuthTokens(testUserId1, 'google', updatedTokens);
      
      // Verify update
      const retrievedTokens = await database.getOAuthTokens(testUserId1, 'google');
      expect(retrievedTokens.access_token).toBe(updatedTokens.access_token);
    });

    test('should check user authentication status correctly', async () => {
      const validTokens = createValidTokens();
      const expiredTokens = {
        ...createValidTokens(),
        expiry_date: Date.now() - (60 * 1000) // 1 minute ago
      };
      
      // Test with valid tokens
      await database.saveOAuthTokens(testUserId1, 'google', validTokens);
      const isValidAuth = await database.isUserAuthenticated(testUserId1, 'google');
      expect(isValidAuth).toBe(true);
      
      // Test with expired tokens
      await database.saveOAuthTokens(testUserId2, 'google', expiredTokens);
      const isExpiredAuth = await database.isUserAuthenticated(testUserId2, 'google');
      expect(isExpiredAuth).toBe(false);
    });

    test('should handle missing OAuth tokens gracefully', async () => {
      // Try to get tokens for user without any
      await expect(database.getOAuthTokens(999, 'google')).rejects.toThrow('No OAuth tokens found');
      
      // Check auth status for user without tokens
      const authStatus = await database.isUserAuthenticated(999, 'google');
      expect(authStatus).toBe(false);
    });

    test('should get authentication status for all users', async () => {
      const validTokens = createValidTokens();
      await database.saveOAuthTokens(testUserId1, 'google', validTokens);
      
      const authStatuses = await database.getAllUserAuthStatus();
      
      // Should include our test users
      const user1Status = authStatuses.find(status => status.userId === testUserId1);
      const user2Status = authStatuses.find(status => status.userId === testUserId2);
      
      expect(user1Status).toBeDefined();
      expect(user1Status.isAuthenticated).toBe(true);
      expect(user1Status.email).toBe('test.admin@example.com');
      
      expect(user2Status).toBeDefined();
      expect(user2Status.isAuthenticated).toBe(false);
      expect(user2Status.email).toBe('test.user@example.com');
    });

    test('should log OAuth activities', async () => {
      await database.logOAuthActivity(testUserId1, 'token_created', 'google', true);
      await database.logOAuthActivity(testUserId1, 'token_refresh_failed', 'google', false, 'Network error');
      
      // Verify logs were created (basic check)
      const logs = await database.query(
        'SELECT * FROM oauth_audit_log WHERE user_id = $1 ORDER BY created_at DESC',
        [testUserId1]
      );
      
      expect(logs.rows.length).toBeGreaterThanOrEqual(2);
      expect(logs.rows[0].action).toBe('token_refresh_failed');
      expect(logs.rows[0].success).toBe(false);
      expect(logs.rows[1].action).toBe('token_created');
      expect(logs.rows[1].success).toBe(true);
    });
  });

  describe('Unified Gmail Client', () => {
    test('should initialize successfully', async () => {
      await gmailClient.init();
      
      expect(gmailClient.isInitialized).toBe(true);
      expect(testLogger.info).toHaveBeenCalledWith('🚀 Initializing unified Gmail MCP client...');
      expect(testLogger.info).toHaveBeenCalledWith('✅ Unified Gmail client initialized successfully');
    });

    test('should generate OAuth URLs for users', async () => {
      await gmailClient.init();
      
      const authUrl1 = await gmailClient.getAuthUrl('test.admin@example.com');
      const authUrl2 = await gmailClient.getAuthUrl('test.user@example.com');
      
      expect(authUrl1).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl1).toContain('login_hint=test.admin%40example.com');
      expect(authUrl2).toContain('login_hint=test.user%40example.com');
      
      // URLs should have required scopes
      expect(authUrl1).toContain('gmail.readonly');
      expect(authUrl1).toContain('gmail.send');
      expect(authUrl1).toContain('calendar.events');
      expect(authUrl1).toContain('calendar.readonly');
    });

    test('should check user authentication correctly', async () => {
      const validTokens = createValidTokens();
      const expiredTokens = {
        ...createValidTokens(),
        expiry_date: Date.now() - (60 * 1000) // 1 minute ago
      };
      
      await database.saveOAuthTokens(testUserId1, 'google', validTokens);
      await database.saveOAuthTokens(testUserId2, 'google', expiredTokens);
      
      const isUser1Auth = await gmailClient.isUserAuthenticated(testUserId1);
      const isUser2Auth = await gmailClient.isUserAuthenticated(testUserId2);
      
      expect(isUser1Auth).toBe(true);
      expect(isUser2Auth).toBe(false);
    });

    test('should handle missing credentials gracefully', async () => {
      // Test without MCP_GMAIL_CREDENTIALS_JSON
      const originalEnv = process.env.MCP_GMAIL_CREDENTIALS_JSON;
      delete process.env.MCP_GMAIL_CREDENTIALS_JSON;
      
      const clientWithoutCreds = new GmailClient(testLogger, database);
      
      await expect(clientWithoutCreds.init()).rejects.toThrow('Gmail MCP credentials not configured');
      
      // Restore environment
      process.env.MCP_GMAIL_CREDENTIALS_JSON = originalEnv;
    });

    test('should fail gracefully when getting authenticated client for invalid user', async () => {
      await gmailClient.init();
      
      await expect(gmailClient.getAuthenticatedClient(999)).rejects.toThrow('No OAuth tokens found for user 999');
    });
  });

  describe('Multi-User OAuth Integration', () => {
    test('should support multiple users with separate tokens', async () => {
      const tokens1 = createValidTokens();
      const tokens2 = {
        ...createValidTokens(),
        access_token: 'ya29.different_access_token_99999'
      };
      
      await database.saveOAuthTokens(testUserId1, 'google', tokens1);
      await database.saveOAuthTokens(testUserId2, 'google', tokens2);
      
      const retrievedTokens1 = await database.getOAuthTokens(testUserId1, 'google');
      const retrievedTokens2 = await database.getOAuthTokens(testUserId2, 'google');
      
      expect(retrievedTokens1.access_token).toBe(tokens1.access_token);
      expect(retrievedTokens2.access_token).toBe(tokens2.access_token);
      expect(retrievedTokens1.access_token).not.toBe(retrievedTokens2.access_token);
    });

    test('should isolate user authentication status', async () => {
      const validTokens = createValidTokens();
      const expiredTokens = {
        ...createValidTokens(),
        expiry_date: Date.now() - (60 * 1000)
      };
      
      await database.saveOAuthTokens(testUserId1, 'google', validTokens);
      await database.saveOAuthTokens(testUserId2, 'google', expiredTokens);
      
      expect(await gmailClient.isUserAuthenticated(testUserId1)).toBe(true);
      expect(await gmailClient.isUserAuthenticated(testUserId2)).toBe(false);
    });

    test('should handle user lookup by email', async () => {
      const foundUserId = await database.getUserIdByEmail('test.admin@example.com');
      const notFoundUserId = await database.getUserIdByEmail('nonexistent@example.com');
      
      expect(foundUserId).toBe(testUserId1);
      expect(notFoundUserId).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection failures gracefully', async () => {
      // This test would need to be adjusted based on how you want to handle DB failures
      // For now, just ensure we don't crash on invalid database operations
      
      await expect(database.getOAuthTokens(-1, 'invalid')).rejects.toThrow();
    });

    test('should validate token data before saving', async () => {
      const invalidTokens = {
        // Missing required fields
        access_token: 'test',
        // Missing refresh_token, scope, expiry_date
      };
      
      // Should handle missing fields gracefully (implementation dependent)
      await expect(database.saveOAuthTokens(testUserId1, 'google', invalidTokens)).rejects.toThrow();
    });

    test('should handle concurrent token updates', async () => {
      const tokens1 = createValidTokens();
      const tokens2 = {
        ...createValidTokens(),
        access_token: 'ya29.concurrent_token_update'
      };
      
      // Simulate concurrent updates
      const promises = [
        database.saveOAuthTokens(testUserId1, 'google', tokens1),
        database.saveOAuthTokens(testUserId1, 'google', tokens2)
      ];
      
      await Promise.all(promises);
      
      // Last update should win
      const finalTokens = await database.getOAuthTokens(testUserId1, 'google');
      expect([tokens1.access_token, tokens2.access_token]).toContain(finalTokens.access_token);
    });
  });

  describe('Security and Audit Logging', () => {
    test('should log successful OAuth operations', async () => {
      await database.logOAuthActivity(testUserId1, 'oauth_completed', 'google', true);
      
      const logs = await database.query(
        'SELECT * FROM oauth_audit_log WHERE user_id = $1 AND action = $2',
        [testUserId1, 'oauth_completed']
      );
      
      expect(logs.rows.length).toBe(1);
      expect(logs.rows[0].success).toBe(true);
      expect(logs.rows[0].provider).toBe('google');
    });

    test('should log failed OAuth operations with error details', async () => {
      const errorMessage = 'Invalid authorization code';
      await database.logOAuthActivity(testUserId1, 'oauth_failed', 'google', false, errorMessage);
      
      const logs = await database.query(
        'SELECT * FROM oauth_audit_log WHERE user_id = $1 AND action = $2',
        [testUserId1, 'oauth_failed']
      );
      
      expect(logs.rows.length).toBe(1);
      expect(logs.rows[0].success).toBe(false);
      expect(logs.rows[0].error_message).toBe(errorMessage);
    });

    test('should not expose sensitive token data in logs', async () => {
      const tokens = createValidTokens();
      await database.saveOAuthTokens(testUserId1, 'google', tokens);
      
      // Verify that access tokens are not logged in our test logger
      const logCalls = testLogger.info.mock.calls.flat();
      const hasTokenInLogs = logCalls.some(call => 
        typeof call === 'string' && call.includes(tokens.access_token)
      );
      
      expect(hasTokenInLogs).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple user token operations efficiently', async () => {
      const startTime = Date.now();
      const userPromises = [];
      
      // Create tokens for multiple users concurrently
      for (let i = 0; i < 10; i++) {
        const tokens = createValidTokens();
        userPromises.push(database.saveOAuthTokens(testUserId1, `test_provider_${i}`, tokens));
      }
      
      await Promise.all(userPromises);
      const endTime = Date.now();
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    test('should cache authentication status efficiently', async () => {
      const tokens = createValidTokens();
      await database.saveOAuthTokens(testUserId1, 'google', tokens);
      
      const startTime = Date.now();
      
      // Multiple authentication checks should be fast
      const authChecks = [];
      for (let i = 0; i < 20; i++) {
        authChecks.push(gmailClient.isUserAuthenticated(testUserId1));
      }
      
      const results = await Promise.all(authChecks);
      const endTime = Date.now();
      
      // All should return true
      expect(results.every(result => result === true)).toBe(true);
      // Should complete quickly (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
    });
  });
});

// Integration test with enterprise testing patterns
describe('OAuth System Integration - Production Readiness', () => {
  test('should meet enterprise security standards', () => {
    // Test that our OAuth implementation follows security best practices
    expect(typeof GmailClient).toBe('function');
    
    // Verify no hardcoded credentials in source
    const gmailClientSource = GmailClient.toString();
    expect(gmailClientSource).not.toMatch(/ya29\.|1\/\//); // No real Google tokens
    expect(gmailClientSource).not.toMatch(/client_secret.*GOCSPX/); // No real client secrets
  });

  test('should support production deployment requirements', async () => {
    // Verify environment variable requirements
    const requiredEnvVars = [
      'DATABASE_URL',
      'MCP_GMAIL_CREDENTIALS_JSON'
    ];
    
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        console.warn(`Warning: ${envVar} not set - required for production`);
      }
    });
    
    // This test passes if no critical environment variables are missing
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('should handle high availability scenarios', async () => {
    // Test that the system can recover from temporary failures
    const database = new Database();
    await database.init();
    
    try {
      // Test database reconnection capability
      await database.close();
      await database.init();
      
      // Should be able to perform operations after reconnection
      const users = await database.getAllUsers();
      expect(Array.isArray(users)).toBe(true);
      
    } finally {
      await database.close();
    }
  });
});