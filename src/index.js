require("dotenv").config();
const express = require("express");
const cors = require("cors");
const winston = require("winston");
const path = require("path");

// Core components
const { config, validateConfig } = require("./config");
const Database = require("./database");
const ScraperManager = require("./scrapers");
const EventFilter = require("./filters");
const EventScorer = require("./scoring");
const FamilyDemographicsService = require("./services/family-demographics");
const CalendarManager = require("./services/calendar-manager");
// CalendarConflictChecker functionality is integrated into GmailClient
const { SMSApprovalManager } = require("./mcp/twilio");
const UnifiedNotificationService = require("./services/unified-notification");
const RegistrationAutomator = require("./automation/registration");
const TaskScheduler = require("./scheduler");

// Safety and error handling
const ErrorHandler = require("./safety/error-handler");
const PaymentGuard = require("./safety/payment-guard");

// API routes
const createApiRouter = require("./api");
const { authenticateAPI } = require("./middleware/auth");

const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const app = express();

// Initialize core systems
const errorHandler = new ErrorHandler(logger);
const paymentGuard = new PaymentGuard(logger);

// CORS configuration for frontend
const corsOptions = {
  origin: [
    "http://localhost:3002", // Frontend development
    "http://localhost:3000", // Alternative frontend port
    "https://family-event-planner-frontend.onrender.com", // Production frontend on Render
    "https://sheridangray.com", // Custom domain (future)
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-API-Key",
  ],
};

app.use(cors(corsOptions));
app.use(express.json());

// Global error handling middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      errorHandler.handleError(
        new Error(`HTTP ${res.statusCode}: ${req.method} ${req.path}`),
        {
          component: "api",
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        }
      );
    }
  });
  next();
});

// Root endpoint for Render health checks (responds to HEAD and GET)
app.all("/", (req, res) => {
  res.status(200).json({
    service: "Family Event Planner API",
    status: "running",
    version: "1.0.0",
  });
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const systemHealth = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      errors: errorHandler.getErrorStats(),
      paymentGuard: paymentGuard.getViolationSummary(),
      scheduler: req.app.locals.scheduler
        ? req.app.locals.scheduler.getStatus()
        : null,
    };

    const healthStatus = errorHandler.isHealthy();
    systemHealth.status = healthStatus.status;

    const statusCode = healthStatus.healthy ? 200 : 503;
    res.status(statusCode).json(systemHealth);
  } catch (error) {
    errorHandler.handleError(error, { component: "health-check" });
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// API routes - will be initialized after components are ready

// Emergency shutdown endpoint (for safety)
app.post("/emergency-shutdown", authenticateAPI, (req, res) => {
  logger.error("EMERGENCY SHUTDOWN REQUESTED via API");
  res.json({ message: "Emergency shutdown initiated" });
  process.exit(1);
});

async function initializeComponents() {
  logger.info("Initializing Family Event Planner components...");

  try {
    // Validate configuration
    validateConfig();
    logger.info("Configuration validated");

    // Initialize database
    const database = new Database();
    await database.init();
    logger.info("Database initialized");

    // Initialize scrapers
    // const scraperManager = new ScraperManager(logger, database);
    // logger.info('Scrapers initialized');

    // Initialize family demographics and migrate from environment if needed
    // const familyService = new FamilyDemographicsService(logger, database);
    // await familyService.initializeFamilyFromEnvironment();
    // logger.info('Family demographics initialized');

    // Initialize filtering and scoring
    // const eventFilter = new EventFilter(logger, database);
    // const eventScorer = new EventScorer(logger, database);
    // logger.info('Event processing systems initialized');

    // Initialize calendar service
    // const calendarManager = new CalendarManager(logger);
    // await calendarManager.init();

    // Calendar conflict checking is handled by CalendarManager
    // const calendarConflictChecker = calendarManager;

    // Initialize notification services - SMS Manager is optional
    // let smsManager = null;
    // let unifiedNotifications = null;

    // // Skip SMS initialization entirely, use email-only
    // logger.info('SMS Manager disabled - using email-only notifications');

    // try {
    //   logger.info('Initializing UnifiedNotificationService (email-only)...');
    //   unifiedNotifications = new UnifiedNotificationService(logger, database, calendarManager);
    //   await unifiedNotifications.init();
    //   logger.info('Email-only notification service initialized');
    // } catch (emailError) {
    //   logger.error('Email notification service failed to initialize:', emailError.message);
    //   logger.error('Email service error stack:', emailError.stack);
    //   logger.error('Will continue without notification services (no emails will be sent)');
    //   // Don't throw - continue without notifications for now
    //   unifiedNotifications = null;
    // }

    // Initialize automation with safety guards
    // const registrationAutomator = new RegistrationAutomator(logger, database);
    // await registrationAutomator.init();

    // Wrap registration automator with payment guard
    // const originalRegisterForEvent = registrationAutomator.registerForEvent.bind(registrationAutomator);
    // registrationAutomator.registerForEvent = errorHandler.wrapAsync(async (event) => {
    //   paymentGuard.preventAutomationOnPaidEvent(event);
    //   return await originalRegisterForEvent(event);
    // }, { component: 'registration' });

    // logger.info('Registration automation initialized with safety guards');

    // Initialize scheduler with notification services
    // const scheduler = new TaskScheduler(
    //   logger, database, scraperManager, eventScorer, eventFilter,
    //   smsManager, registrationAutomator, calendarConflictChecker, unifiedNotifications
    // );

    // Store components in app locals for API access
    // app.locals.database = database;
    // app.locals.logger = logger;
    // app.locals.scraperManager = scraperManager;
    // app.locals.eventFilter = eventFilter;
    // app.locals.eventScorer = eventScorer;
    // app.locals.familyService = familyService;
    // app.locals.calendarManager = calendarManager;
    // app.locals.calendarConflictChecker = calendarConflictChecker;
    // app.locals.smsManager = smsManager;
    // app.locals.registrationAutomator = registrationAutomator;
    // app.locals.scheduler = scheduler;
    // app.locals.errorHandler = errorHandler;
    // app.locals.paymentGuard = paymentGuard;

    // Initialize API router now that all components are ready
    const apiRouter = createApiRouter(database, logger);

    // const apiRouter = createApiRouter(database, scheduler, registrationAutomator, logger, unifiedNotifications);
    app.use("/api", apiRouter);

    return {
      database,
    };
  } catch (error) {
    errorHandler.handleError(error, { component: "initialization" });
    throw error;
  }
}

async function startServer() {
  try {
    logger.info("Starting Family Event Planner...");

    // Load previous error history
    errorHandler.loadErrorLog();

    // Initialize all components
    const components = await initializeComponents();

    // Start the scheduler
    // components.scheduler.start();
    // logger.info("Task scheduler started");

    // Start the web server
    const server = app.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port}`);
    });

    // Graceful shutdown handling
    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully...");

      components.scheduler.stop();
      await components.registrationAutomator.close();
      await components.database.close();

      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully...");

      components.scheduler.stop();
      await components.registrationAutomator.close();
      await components.database.close();

      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      errorHandler.handleError(error, { component: "uncaught-exception" });
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      errorHandler.handleError(new Error(`Unhandled Rejection: ${reason}`), {
        component: "unhandled-rejection",
        promise: promise.toString(),
      });
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    errorHandler.handleError(error, { component: "startup" });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, logger, startServer };
