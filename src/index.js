require("dotenv").config();
const express = require("express");
const cors = require("cors");
const winston = require("winston");
const path = require("path");

// Core components
const { config, validateConfig } = require("./config");
const Database = require("./database");
// const ScraperManager = require("./scrapers");
// const EventFilter = require("./filters");
// const EventScorer = require("./scoring");
// const FamilyDemographicsService = require("./services/family-demographics");
// const CalendarManager = require("./services/calendar-manager");
// CalendarConflictChecker functionality is integrated into GmailClient
// const { SMSApprovalManager } = require("./mcp/twilio");
// const UnifiedNotificationService = require("./services/unified-notification");
// const RegistrationAutomator = require("./automation/registration");
// const TaskScheduler = require("./scheduler");

// Safety and error handling
const ErrorHandler = require("./safety/error-handler");
// const PaymentGuard = require("./safety/payment-guard");

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
// const paymentGuard = new PaymentGuard(logger);

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

// Global error handling middleware - only log 500s, not 404s
app.use((req, res, next) => {
  res.on("finish", () => {
    // Only log server errors (5xx), not client errors (4xx)
    if (res.statusCode >= 500) {
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
  logger.info("🚀 Starting minimal server for iOS auth testing...");

  try {
    // Validate configuration
    validateConfig();
    logger.info("✅ Configuration validated");

    // Initialize ONLY the database
    const database = new Database();
    await database.init();
    logger.info("✅ Database initialized (single instance)");

    // Store ONLY database and logger in app locals
    app.locals.database = database;
    app.locals.logger = logger;

    logger.info("📦 Creating API router with database and logger only...");

    // Initialize API router with minimal components
    const apiRouter = createApiRouter(database, logger);
    app.use("/api", apiRouter);

    logger.info("✅ API routes mounted at /api");

    // 404 handler for undefined routes (must be after all other routes)
    app.use((req, res) => {
      res.status(404).json({
        error: "Not Found",
        path: req.path,
        message: `Cannot ${req.method} ${req.path}`,
      });
    });

    logger.info("✅ Minimal server initialization complete");
    logger.info("📱 Ready for iOS authentication testing");

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
    const server = app.listen(config.app.port, "0.0.0.0", () => {
      logger.info(`Server running on port ${config.app.port} (0.0.0.0)`);
    });

    // Graceful shutdown handling
    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully...");
      await components.database.close();
      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully...");
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
