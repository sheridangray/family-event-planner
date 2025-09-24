const express = require('express');
const { authenticateAPI } = require('../middleware/auth');
const { GmailMCPClient } = require('../mcp/gmail');

const router = express.Router();

// GET /api/admin/mcp-status - Get MCP service authentication status
router.get('/mcp-status', authenticateAPI, async (req, res) => {
  try {
    const { logger } = req.app.locals;
    
    // Define the MCP services we want to check
    const mcpServices = [
      { 
        email: 'sheridan.gray@gmail.com',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly'
        ]
      },
      { 
        email: 'joyce.yan.zhang@gmail.com',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly'
        ]
      }
    ];

    const serviceStatus = [];

    for (const service of mcpServices) {
      try {
        // Create a temporary Gmail client to test authentication
        const gmailClient = new GmailMCPClient(logger);
        let authenticated = false;
        let lastAuthenticated = null;
        let error = null;

        try {
          // Try to initialize and test the connection
          await gmailClient.init(service.email);
          
          // Test with a simple profile request
          const profile = await gmailClient.getProfile();
          authenticated = !!profile;
          lastAuthenticated = new Date().toISOString();
        } catch (authError) {
          authenticated = false;
          error = authError.message;
          logger.warn(`MCP auth check failed for ${service.email}:`, authError.message);
        }

        serviceStatus.push({
          email: service.email,
          authenticated,
          lastAuthenticated,
          scopes: service.scopes,
          error
        });

      } catch (serviceError) {
        logger.error(`Error checking MCP service ${service.email}:`, serviceError.message);
        serviceStatus.push({
          email: service.email,
          authenticated: false,
          lastAuthenticated: null,
          scopes: service.scopes,
          error: serviceError.message
        });
      }
    }

    res.json({
      success: true,
      services: serviceStatus,
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

    logger.info(`Starting MCP OAuth flow for: ${email}`);

    // Create Gmail client and get auth URL
    const gmailClient = new GmailMCPClient(logger);
    const authUrl = await gmailClient.getAuthUrl(email);

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
    const { email, authCode } = req.body;
    const { logger } = req.app.locals;

    if (!email || !authCode) {
      return res.status(400).json({
        success: false,
        error: 'Email and authCode parameters are required'
      });
    }

    logger.info(`Completing MCP OAuth flow for: ${email}`);

    // Create Gmail client and complete auth flow
    const gmailClient = new GmailMCPClient(logger);
    const result = await gmailClient.completeAuth(email, authCode);

    logger.info(`MCP OAuth completed successfully for: ${email}`);

    res.json({
      success: true,
      email,
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