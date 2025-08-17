require('dotenv').config();
const express = require('express');
const winston = require('winston');
const path = require('path');

// Core components
const { config, validateConfig } = require('./config');
const Database = require('./database');
const ScraperManager = require('./scrapers');
const EventFilter = require('./filters');
const EventScorer = require('./scoring');
const { CalendarConflictChecker } = require('./mcp/gmail');
const { SMSApprovalManager } = require('./mcp/twilio');
const RegistrationAutomator = require('./automation/registration');
const TaskScheduler = require('./scheduler');

// Safety and error handling
const ErrorHandler = require('./safety/error-handler');
const PaymentGuard = require('./safety/payment-guard');

// API routes
const apiRouter = require('./api');
const { authenticateAPI } = require('./middleware/auth');

const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../logs/error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, '../logs/combined.log') }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();

// Initialize core systems
const errorHandler = new ErrorHandler(logger);
const paymentGuard = new PaymentGuard(logger);

app.use(express.json());

// Global error handling middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      errorHandler.handleError(new Error(`HTTP ${res.statusCode}: ${req.method} ${req.path}`), {
        component: 'api',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    }
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const systemHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      errors: errorHandler.getErrorStats(),
      paymentGuard: paymentGuard.getViolationSummary(),
      scheduler: req.app.locals.scheduler ? req.app.locals.scheduler.getStatus() : null
    };
    
    const healthStatus = errorHandler.isHealthy();
    systemHealth.status = healthStatus.status;
    
    const statusCode = healthStatus.healthy ? 200 : 503;
    res.status(statusCode).json(systemHealth);
  } catch (error) {
    errorHandler.handleError(error, { component: 'health-check' });
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// API routes
app.use('/api', apiRouter);

// Emergency shutdown endpoint (for safety)
app.post('/emergency-shutdown', authenticateAPI, (req, res) => {
  logger.error('EMERGENCY SHUTDOWN REQUESTED via API');
  res.json({ message: 'Emergency shutdown initiated' });
  process.exit(1);
});

async function initializeComponents() {
  logger.info('Initializing Family Event Planner components...');
  
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');
    
    // Initialize database
    const database = new Database();
    await database.init();
    logger.info('Database initialized');
    
    // Initialize scrapers
    const scraperManager = new ScraperManager(logger, database);
    logger.info('Scrapers initialized');
    
    // Initialize filtering and scoring
    const eventFilter = new EventFilter(logger);
    const eventScorer = new EventScorer(logger, database);
    logger.info('Event processing systems initialized');
    
    // Initialize MCP clients
    const calendarManager = new CalendarConflictChecker(logger);
    await calendarManager.init();
    
    const smsManager = new SMSApprovalManager(logger, database);
    await smsManager.init();
    logger.info('MCP clients initialized');
    
    // Initialize automation with safety guards
    const registrationAutomator = new RegistrationAutomator(logger, database);
    await registrationAutomator.init();
    
    // Wrap registration automator with payment guard
    const originalRegisterForEvent = registrationAutomator.registerForEvent.bind(registrationAutomator);
    registrationAutomator.registerForEvent = errorHandler.wrapAsync(async (event) => {
      paymentGuard.preventAutomationOnPaidEvent(event);
      return await originalRegisterForEvent(event);
    }, { component: 'registration' });
    
    logger.info('Registration automation initialized with safety guards');
    
    // Initialize scheduler
    const scheduler = new TaskScheduler(
      logger, database, scraperManager, eventScorer, eventFilter,
      smsManager, registrationAutomator, calendarManager
    );
    
    // Store components in app locals for API access
    app.locals.database = database;
    app.locals.logger = logger;
    app.locals.scraperManager = scraperManager;
    app.locals.eventFilter = eventFilter;
    app.locals.eventScorer = eventScorer;
    app.locals.calendarManager = calendarManager;
    app.locals.smsManager = smsManager;
    app.locals.registrationAutomator = registrationAutomator;
    app.locals.scheduler = scheduler;
    app.locals.errorHandler = errorHandler;
    app.locals.paymentGuard = paymentGuard;
    
    return {
      database, scraperManager, eventFilter, eventScorer,
      calendarManager, smsManager, registrationAutomator, scheduler
    };
    
  } catch (error) {
    errorHandler.handleError(error, { component: 'initialization' });
    throw error;
  }
}

async function startServer() {
  try {
    logger.info('Starting Family Event Planner...');
    
    // Load previous error history
    errorHandler.loadErrorLog();
    
    // Initialize all components
    const components = await initializeComponents();
    
    // Start the scheduler
    components.scheduler.start();
    logger.info('Task scheduler started');
    
    // Start the web server
    const server = app.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port}`);
      logger.info('Family Event Planner started successfully');
    });
    
    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      
      components.scheduler.stop();
      await components.registrationAutomator.close();
      await components.database.close();
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      
      components.scheduler.stop();
      await components.registrationAutomator.close();
      await components.database.close();
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      errorHandler.handleError(error, { component: 'uncaught-exception' });
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      errorHandler.handleError(new Error(`Unhandled Rejection: ${reason}`), { 
        component: 'unhandled-rejection',
        promise: promise.toString()
      });
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
    return server;
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    errorHandler.handleError(error, { component: 'startup' });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, logger, startServer };