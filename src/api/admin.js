const express = require('express');
const { authenticateAPI } = require('../middleware/auth');
const { GmailMCPClient } = require('../mcp/gmail');

const router = express.Router();

// GET /api/admin/mcp-status - Get MCP service authentication status
router.get('/mcp-status', authenticateAPI, async (req, res) => {
  try {
    const { logger } = req.app.locals;
    
    // Use multi-user singleton to get authentication status for all users
    const { getAllUserAuthStatus } = require('../mcp/gmail-multi-user-singleton');
    const userStatuses = await getAllUserAuthStatus();

    const serviceStatus = userStatuses.map(user => ({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      authenticated: user.isAuthenticated,
      lastAuthenticated: user.lastUpdated,
      tokenExpiryDate: user.tokenExpiryDate,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      error: user.isAuthenticated ? null : 'No valid OAuth tokens found'
    }));

    // Add legacy compatibility for existing frontend
    const legacyServices = serviceStatus.map(status => ({
      email: status.email,
      authenticated: status.authenticated,
      lastAuthenticated: status.lastAuthenticated,
      scopes: status.scopes,
      error: status.error
    }));

    res.json({
      success: true,
      services: legacyServices, // Legacy format for backwards compatibility
      users: serviceStatus,     // New multi-user format
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.app.locals.logger.error('MCP status check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check MCP service status'
    });
  }
});

// POST /api/admin/mcp-auth-start - Start MCP OAuth flow
router.post('/mcp-auth-start', authenticateAPI, async (req, res) => {
  try {
    const { email } = req.body;
    const { logger } = req.app.locals;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email parameter is required'
      });
    }

    logger.info(`🚀 Starting MCP OAuth flow for: ${email}`);

    // Create Gmail client and get auth URL
    logger.info(`📝 Creating GmailMCPClient instance...`);
    const gmailClient = new GmailMCPClient(logger);
    logger.info(`✅ GmailMCPClient created successfully`);
    
    // DEBUG: List all methods on the Gmail client
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(gmailClient));
    logger.info(`🔍 Available methods on GmailMCPClient: ${methods.join(', ')}`);
    logger.info(`🎯 getAuthUrl method exists: ${typeof gmailClient.getAuthUrl}`);
    logger.info(`🎯 getAuthUrl is function: ${typeof gmailClient.getAuthUrl === 'function'}`);
    
    try {
      logger.info(`🔑 About to call getAuthUrl for ${email}...`);
      const authUrl = await gmailClient.getAuthUrl(email);
      logger.info(`🎉 getAuthUrl returned successfully: ${authUrl ? 'URL generated' : 'NO URL'}`);
      
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send', 
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ];

      res.json({
        success: true,
        authUrl,
        email,
        scopes,
        instructions: 'Open the authUrl in a browser, complete the OAuth flow, and paste the authorization code back'
      });
    } catch (authError) {
      logger.error(`Failed to generate OAuth URL for ${email}:`, authError.message);
      return res.status(500).json({
        success: false,
        error: `Failed to generate authentication URL: ${authError.message}`
      });
    }

  } catch (error) {
    req.app.locals.logger.error('MCP auth start error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to start MCP authentication flow'
    });
  }
});

// POST /api/admin/mcp-auth-complete - Complete MCP OAuth flow
router.post('/mcp-auth-complete', authenticateAPI, async (req, res) => {
  try {
    const { email, authCode, requestingUserEmail } = req.body;
    const { logger } = req.app.locals;

    if (!email || !authCode) {
      return res.status(400).json({
        success: false,
        error: 'Email and authCode parameters are required'
      });
    }

    logger.info(`Completing MCP OAuth flow for: ${email} (requested by: ${requestingUserEmail || 'unknown'})`);

    // Get user ID from database
    const { getUserIdByEmail, completeOAuthForUser } = require('../mcp/gmail-multi-user-singleton');
    const userId = await getUserIdByEmail(email);
    
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: `User not found: ${email}. Please ensure user exists in the system.`
      });
    }

    logger.info(`Found user ID ${userId} for email ${email}`);

    // Complete OAuth flow for the specific user
    const result = await completeOAuthForUser(userId, email, authCode, logger);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'OAuth completion failed'
      });
    }

    logger.info(`MCP OAuth completed successfully for user ${userId} (${email})`);

    res.json({
      success: true,
      email,
      userId,
      authenticated: true,
      message: 'MCP authentication completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.app.locals.logger.error('MCP auth complete error:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to complete MCP authentication: ${error.message}`
    });
  }
});

module.exports = router;