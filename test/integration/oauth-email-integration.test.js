/**
 * OAuth-Email Integration Tests
 * 
 * Tests the integration between the new unified OAuth system 
 * and the existing email notification system
 */

const { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } = require('@jest/globals');
const { GmailClient } = require('../../src/mcp/gmail-client');
const { EmailNotificationClient } = require('../../src/mcp/email-notifications');
const Database = require('../../src/database');

// Mock logger for testing
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('OAuth-Email Integration Tests', () => {
  let database;
  let gmailClient;
  let emailClient;
  let testUserId;

  beforeAll(async () => {
    database = new Database();
    await database.init();
    
    // Create test user
    const user = await database.createUser('integration.test@example.com', 'Integration Test User', 'user');
    testUserId = user.id;
  });

  afterAll(async () => {
    if (database) {
      await database.query('DELETE FROM oauth_tokens WHERE user_id = $1', [testUserId]);
      await database.query('DELETE FROM users WHERE id = $1', [testUserId]);
      await database.close();
    }
  });

  beforeEach(() => {
    gmailClient = new GmailClient(mockLogger, database);
    emailClient = new EmailNotificationClient(mockLogger, database, testUserId);
  });

  afterEach(async () => {
    if (gmailClient) {
      await gmailClient.cleanup();
    }
  });

  test('should integrate unified OAuth with email notification system', async () => {
    // Setup: Create valid OAuth tokens for the test user
    const tokens = {
      access_token: 'ya29.integration_test_token',
      refresh_token: '1//integration_refresh_token',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
      expiry_date: Date.now() + (60 * 60 * 1000) // 1 hour from now
    };
    
    await database.saveOAuthTokens(testUserId, 'google', tokens);
    
    // Test: Initialize Gmail client
    await gmailClient.init();
    
    // Verify: User is authenticated
    const isAuthenticated = await gmailClient.isUserAuthenticated(testUserId);
    expect(isAuthenticated).toBe(true);
    
    // Test: Email client should be able to use the unified OAuth system
    await emailClient.init();
    expect(emailClient.isInitialized).toBe(true);
    
    // Verify: Integration between systems
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Gmail client authenticated for user')
    );
  });

  test('should handle OAuth token refresh in email operations', async () => {
    // Setup: Create expired tokens
    const expiredTokens = {
      access_token: 'ya29.expired_token',
      refresh_token: '1//still_valid_refresh',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      expiry_date: Date.now() - (60 * 1000) // 1 minute ago
    };
    
    await database.saveOAuthTokens(testUserId, 'google', expiredTokens);
    await gmailClient.init();
    
    // Test: Authentication should fail for expired tokens
    const isAuthenticated = await gmailClient.isUserAuthenticated(testUserId);
    expect(isAuthenticated).toBe(false);
    
    // Verify: System handles expired tokens gracefully
    await expect(gmailClient.getAuthenticatedClient(testUserId)).rejects.toThrow();
  });

  test('should maintain OAuth audit trail for email operations', async () => {
    // Test: Log OAuth activities related to email operations
    await database.logOAuthActivity(testUserId, 'email_sent', 'google', true);
    await database.logOAuthActivity(testUserId, 'calendar_event_created', 'google', true);
    
    // Verify: Audit logs are created
    const logs = await database.query(
      'SELECT * FROM oauth_audit_log WHERE user_id = $1 ORDER BY created_at DESC',
      [testUserId]
    );
    
    expect(logs.rows.length).toBeGreaterThanOrEqual(2);
    expect(logs.rows.some(log => log.action === 'email_sent')).toBe(true);
    expect(logs.rows.some(log => log.action === 'calendar_event_created')).toBe(true);
  });

  test('should support multi-user email operations with separate OAuth tokens', async () => {
    // Setup: Create second test user
    const user2 = await database.createUser('integration.test2@example.com', 'Integration Test User 2', 'admin');
    const testUserId2 = user2.id;
    
    const tokens1 = {
      access_token: 'ya29.user1_token',
      refresh_token: '1//user1_refresh',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      expiry_date: Date.now() + (60 * 60 * 1000)
    };
    
    const tokens2 = {
      access_token: 'ya29.user2_token',
      refresh_token: '1//user2_refresh',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      expiry_date: Date.now() + (60 * 60 * 1000)
    };
    
    await database.saveOAuthTokens(testUserId, 'google', tokens1);
    await database.saveOAuthTokens(testUserId2, 'google', tokens2);
    
    // Test: Both users should have separate authentication
    await gmailClient.init();
    const user1Auth = await gmailClient.isUserAuthenticated(testUserId);
    const user2Auth = await gmailClient.isUserAuthenticated(testUserId2);
    
    expect(user1Auth).toBe(true);
    expect(user2Auth).toBe(true);
    
    // Verify: Tokens are separate
    const user1Tokens = await database.getOAuthTokens(testUserId, 'google');
    const user2Tokens = await database.getOAuthTokens(testUserId2, 'google');
    
    expect(user1Tokens.access_token).toBe(tokens1.access_token);
    expect(user2Tokens.access_token).toBe(tokens2.access_token);
    expect(user1Tokens.access_token).not.toBe(user2Tokens.access_token);
    
    // Cleanup
    await database.query('DELETE FROM oauth_tokens WHERE user_id = $1', [testUserId2]);
    await database.query('DELETE FROM users WHERE id = $1', [testUserId2]);
  });

  test('should integrate with enterprise security patterns', async () => {
    const tokens = {
      access_token: 'ya29.security_test_token',
      refresh_token: '1//security_refresh_token',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      expiry_date: Date.now() + (60 * 60 * 1000)
    };
    
    await database.saveOAuthTokens(testUserId, 'google', tokens);
    
    // Test: Security logging for OAuth operations
    await database.logOAuthActivity(testUserId, 'security_check', 'google', true);
    
    // Verify: Security audit trail exists
    const securityLogs = await database.query(
      'SELECT * FROM oauth_audit_log WHERE user_id = $1 AND action = $2',
      [testUserId, 'security_check']
    );
    
    expect(securityLogs.rows.length).toBe(1);
    expect(securityLogs.rows[0].success).toBe(true);
    
    // Test: No sensitive data in logs
    const allLogs = await database.query(
      'SELECT error_message FROM oauth_audit_log WHERE user_id = $1',
      [testUserId]
    );
    
    allLogs.rows.forEach(log => {
      if (log.error_message) {
        expect(log.error_message).not.toContain('ya29.');
        expect(log.error_message).not.toContain('1//');
      }
    });
  });

  test('should maintain backwards compatibility with existing email workflows', async () => {
    // Test: Existing email notification patterns should work with new OAuth system
    const emailClient = new EmailNotificationClient(mockLogger, database);
    
    // Initialize should work (even without user ID for backwards compatibility)
    await expect(emailClient.init()).resolves.not.toThrow();
    
    // Verify: Backwards compatibility is maintained
    expect(emailClient.isInitialized).toBe(true);
  });
});

describe('OAuth System Performance Integration', () => {
  let database;
  let gmailClient;

  beforeAll(async () => {
    database = new Database();
    await database.init();
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  beforeEach(() => {
    gmailClient = new GmailClient(mockLogger, database);
  });

  afterEach(async () => {
    if (gmailClient) {
      await gmailClient.cleanup();
    }
  });

  test('should perform OAuth operations within enterprise performance thresholds', async () => {
    await gmailClient.init();
    
    // Test: OAuth URL generation performance
    const startTime = Date.now();
    const authUrls = await Promise.all([
      gmailClient.getAuthUrl('user1@example.com'),
      gmailClient.getAuthUrl('user2@example.com'),
      gmailClient.getAuthUrl('user3@example.com'),
      gmailClient.getAuthUrl('user4@example.com'),
      gmailClient.getAuthUrl('user5@example.com')
    ]);
    const endTime = Date.now();
    
    // Verify: Performance within acceptable limits
    expect(endTime - startTime).toBeLessThan(1000); // 1 second for 5 URLs
    expect(authUrls.length).toBe(5);
    authUrls.forEach(url => {
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(50);
    });
  });

  test('should handle concurrent OAuth operations efficiently', async () => {
    // Create test users for concurrent operations
    const userIds = [];
    for (let i = 0; i < 5; i++) {
      const user = await database.createUser(`concurrent${i}@example.com`, `Concurrent User ${i}`, 'user');
      userIds.push(user.id);
    }
    
    const tokens = {
      access_token: 'ya29.concurrent_test_token',
      refresh_token: '1//concurrent_refresh',
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      expiry_date: Date.now() + (60 * 60 * 1000)
    };
    
    // Test: Concurrent token operations
    const startTime = Date.now();
    const savePromises = userIds.map(userId => 
      database.saveOAuthTokens(userId, 'google', { ...tokens, access_token: `${tokens.access_token}_${userId}` })
    );
    await Promise.all(savePromises);
    
    const authPromises = userIds.map(userId => gmailClient.isUserAuthenticated(userId));
    const authResults = await Promise.all(authPromises);
    const endTime = Date.now();
    
    // Verify: All operations successful and performant
    expect(endTime - startTime).toBeLessThan(2000); // 2 seconds for 10 operations
    expect(authResults.every(result => result === true)).toBe(true);
    
    // Cleanup
    for (const userId of userIds) {
      await database.query('DELETE FROM oauth_tokens WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
});