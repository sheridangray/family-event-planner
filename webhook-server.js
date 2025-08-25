const express = require('express');
const GmailWebhookHandler = require('./src/api/gmail-webhooks');
const Database = require('./src/database');

// Logger setup
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${new Date().toISOString()} ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${new Date().toISOString()} ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️  ${new Date().toISOString()} ${msg}`, ...args),
  error: (msg, ...args) => console.error(`❌ ${new Date().toISOString()} ${msg}`, ...args)
};

class WebhookServer {
  constructor() {
    this.app = express();
    this.database = null;
    this.webhookHandler = null;
    this.port = process.env.WEBHOOK_PORT || 3001;
  }

  async init() {
    logger.info('🚀 Initializing Webhook Server...');

    // Initialize database
    this.database = new Database();
    await this.database.init();

    // Initialize Gmail webhook handler
    this.webhookHandler = new GmailWebhookHandler(logger, this.database);
    await this.webhookHandler.init();

    // Configure Express middleware
    this.setupMiddleware();
    this.setupRoutes();

    logger.info('✅ Webhook server initialized');
  }

  setupMiddleware() {
    // Raw body parser for Pub/Sub verification
    this.app.use('/api/gmail/notifications', express.raw({ type: 'application/json' }));
    
    // JSON parser for other endpoints
    this.app.use(express.json());

    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Gmail Webhook Server',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/gmail/health',
          notifications: '/api/gmail/notifications'
        }
      });
    });

    // Gmail webhook routes
    const webhookRouter = this.webhookHandler.createRouter();
    this.app.use('/api', webhookRouter);

    // Test endpoint for development
    this.app.post('/api/test/email-reply', async (req, res) => {
      try {
        logger.info('🧪 Test email reply received');
        
        const { from, subject, body } = req.body;
        
        if (!from || !subject || !body) {
          return res.status(400).json({ 
            error: 'Missing required fields: from, subject, body' 
          });
        }

        // Simulate processing an email reply
        const result = await this.webhookHandler.notificationService.handleIncomingResponse(
          from,
          { subject, body },
          `test-${Date.now()}`,
          true // isEmail
        );

        res.json({ 
          success: true, 
          result,
          message: 'Test email reply processed'
        });

      } catch (error) {
        logger.error('Error processing test email reply:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      logger.error('Express error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async start() {
    const server = this.app.listen(this.port, () => {
      logger.info(`🌐 Webhook server listening on port ${this.port}`);
      logger.info(`📡 Gmail notifications endpoint: http://localhost:${this.port}/api/gmail/notifications`);
      logger.info(`🧪 Test endpoint: http://localhost:${this.port}/api/test/email-reply`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('\n💡 Development Setup:');
        logger.info('1. Install ngrok: npm install -g ngrok');
        logger.info(`2. Expose webhook: ngrok http ${this.port}`);
        logger.info('3. Copy the ngrok HTTPS URL to WEBHOOK_BASE_URL in .env');
        logger.info('4. Run: node setup-gmail-webhooks.js --configure');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    return server;
  }
}

// Auto-start if run directly
async function main() {
  try {
    const server = new WebhookServer();
    await server.init();
    await server.start();
  } catch (error) {
    logger.error('Failed to start webhook server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WebhookServer;