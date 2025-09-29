const express = require('express');
const { authenticateAPI } = require('../middleware/auth');
const { GmailMCPClient } = require('../mcp/gmail');

const router = express.Router();

// GET /api/admin/mcp-status - Get MCP service authentication status
router.get('/mcp-status', authenticateAPI, async (req, res) => {
  try {
    const { logger } = req.app.locals;

    logger.info('🔍 Starting MCP status check...');

    // Use database to get authentication status for all users
    const Database = require('../database');
    const database = new Database();

    logger.info('📦 Database instance created');
    await database.init();
    logger.info('🚀 Database initialized');

    logger.info('🔍 Fetching user authentication statuses...');
    let userStatuses;
    try {
      userStatuses = await database.getAllUserAuthStatus();
      logger.info(`✅ Found ${userStatuses.length} user statuses`);
    } catch (dbError) {
      logger.error('💥 Database query failed:', dbError.message);
      logger.error('DB Error details:', dbError);
      throw dbError;
    }

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
    req.app.locals.logger.error('❌ MCP status check error:', error.message || 'Unknown error');
    req.app.locals.logger.error('Full error object:', JSON.stringify(error, null, 2));
    req.app.locals.logger.error('Error stack:', error.stack || 'No stack trace available');
    res.status(500).json({
      success: false,
      error: 'Failed to check MCP service status',
      details: error.message || 'Unknown error'
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

    // Create unified Gmail client and get auth URL
    logger.info(`📝 Creating unified GmailClient instance...`);
    const { GmailClient } = require('../mcp/gmail-client');
    const Database = require('../database');
    const database = new Database();
    await database.init();
    const gmailClient = new GmailClient(logger, database);
    logger.info(`✅ Unified GmailClient created successfully`);
    
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

    // Get user from database
    const Database = require('../database');
    const database = new Database();
    await database.init();
    const user = await database.getUserByEmail(email);
    const userId = user ? user.id : null;
    
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: `User not found: ${email}. Please ensure user exists in the system.`
      });
    }

    logger.info(`Found user ID ${userId} for email ${email}`);

    // Complete OAuth flow using unified client
    const { GmailClient } = require('../mcp/gmail-client');
    const gmailClient = new GmailClient(logger, database);
    const result = await gmailClient.completeOAuthFlow(userId, email, authCode);

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

// GET /api/admin/oauth-callback - Handle OAuth callback from Google
router.get('/oauth-callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const { logger } = req.app.locals;

    if (error) {
      logger.error(`OAuth callback error: ${error}`);
      return res.status(400).send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body>
            <h1>Authentication Error</h1>
            <p>Error: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body>
            <h1>Authentication Error</h1>
            <p>No authorization code received</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    }

    logger.info(`📨 OAuth callback received with code: ${code.substring(0, 20)}...`);

    // Send success message and close the popup
    res.send(`
      <html>
        <head><title>Authentication Successful</title></head>
        <body>
          <h1>✅ Authentication Successful!</h1>
          <p>You can close this window. Your account is being authenticated...</p>
          <script>
            // Send the code to the parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                code: '${code}'
              }, window.location.origin);
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    req.app.locals.logger.error('OAuth callback error:', error.message);
    res.status(500).send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body>
          <h1>Authentication Error</h1>
          <p>Internal server error: ${error.message}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
});

// GET /api/admin/user-auth-status - Get current user's authentication status
router.get('/user-auth-status', authenticateAPI, async (req, res) => {
  try {
    const { logger } = req.app.locals;
    const userEmail = req.headers['x-user-email']; // Get user email from header
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User email not found in request'
      });
    }

    // Get authentication status for the current user only
    const Database = require('../database');
    const database = new Database();
    await database.init();
    const user = await database.getUserByEmail(userEmail);
    const userId = user ? user.id : null;
    
    if (!userId) {
      return res.json({
        success: true,
        status: {
          email: userEmail,
          authenticated: false,
          error: 'User not found in system'
        }
      });
    }

    const tokens = await database.getOAuthTokens(userId, 'google');
    const isAuthenticated = !!tokens;
    
    // Get token details if authenticated
    let lastAuthenticated = null;
    if (isAuthenticated) {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
      });
      
      try {
        const result = await pool.query(
          'SELECT updated_at FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
          [userId, 'google']
        );
        if (result.rows.length > 0) {
          lastAuthenticated = result.rows[0].updated_at;
        }
      } finally {
        await pool.end();
      }
    }

    res.json({
      success: true,
      status: {
        email: userEmail,
        authenticated: isAuthenticated,
        lastAuthenticated,
        error: isAuthenticated ? null : 'No valid OAuth tokens found'
      }
    });

  } catch (error) {
    req.app.locals.logger.error('User auth status check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status'
    });
  }
});

module.exports = router;