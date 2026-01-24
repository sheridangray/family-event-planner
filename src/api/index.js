const express = require("express");
const eventsRouter = require("./events");
const dashboardRouter = require("./dashboard");
const createAutomationRouter = require("./automation");
const adminRouter = require("./admin");
const { router: familyRouter } = require("./family");
const createHealthRouter = require("./health");
const createExerciseRouter = require("./exercise");
const createMobileAuthRouter = require("./auth-mobile");
const createCalendarRouter = require("./calendar");
const createOnboardingRouter = require("./onboarding");
const createAppConfigRouter = require("./app-config");
const createTimeRouter = require("./time");
const createFoodRouter = require("./food");
const createRelationshipsRouter = require("./relationships");
const createMoneyRouter = require("./money");
const createSleepRouter = require("./sleep");
const createCoachRouter = require("./coach");
const createNotificationsRouter = require("./notifications");
const createKidEventsRouter = require("./kid-events");

function createApiRouter(
  database,
  logger,
  scheduler = null,
  unifiedNotifications = null
) {
  const router = express.Router();

  router.use("/events", eventsRouter);
  router.use("/dashboard", dashboardRouter);
  router.use("/automation", createAutomationRouter(database, scheduler));
  router.use("/admin", adminRouter);
  router.use("/family", familyRouter);
  router.use("/health", createHealthRouter(database, logger));
  router.use("/exercise", createExerciseRouter(database, logger));
  router.use("/calendar", createCalendarRouter(database, logger));
  router.use("/auth", createMobileAuthRouter(database, logger));
  router.use("/onboarding", createOnboardingRouter(database, logger));
  router.use("/app-config", createAppConfigRouter(database, logger));
  router.use("/time", createTimeRouter(database, logger));
  router.use("/food", createFoodRouter(database, logger));
  router.use("/relationships", createRelationshipsRouter(database, logger));
  router.use("/money", createMoneyRouter(database, logger));
  router.use("/sleep", createSleepRouter(database, logger));
  router.use("/coach", createCoachRouter(database, logger));
  router.use("/notifications", createNotificationsRouter(database, logger));
  router.use("/kid-events", createKidEventsRouter(database, logger));

  router.get("/status", (req, res) => {
    res.json({
      success: true,
      status: "operational",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Twilio webhook endpoint for incoming SMS messages
  router.post("/sms-webhook", async (req, res) => {
    try {
      const { smsManager, logger } = req.app.locals;

      // Extract Twilio webhook parameters
      const { From: from, Body: body, MessageSid: messageId } = req.body;

      if (!from || !body) {
        logger.warn("Invalid SMS webhook payload received");
        return res.status(400).send("Invalid payload");
      }

      logger.info(`📱 SMS webhook received from ${from}: "${body}"`);

      // Process the incoming SMS response
      const result = await smsManager.handleIncomingResponse(
        from,
        body,
        messageId
      );

      if (result) {
        if (result.approved) {
          logger.info(
            `🚀 Processing approved event: ${result.eventTitle}`
          );

          try {
            await smsManager.processApprovedEvent(
              result.eventId,
              result.approvalId
            );
          } catch (processingError) {
            logger.error(
              `Error in immediate processing: ${processingError.message}`
            );
          }
        }

        logger.info(
          `SMS response processed successfully: ${JSON.stringify(result)}`
        );
      }

      // Send TwiML response to acknowledge webhook
      res.type("text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      req.app.locals.logger.error(
        "Error processing SMS webhook:",
        error.message
      );

      // Still return success to Twilio to avoid retries
      res.type("text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  });

  return router;
}

module.exports = createApiRouter;
