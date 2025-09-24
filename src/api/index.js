const express = require('express');
const eventsRouter = require('./events');
const dashboardRouter = require('./dashboard');
const createAutomationRouter = require('./automation');
const adminRouter = require('./admin');
const GmailWebhookHandler = require('./gmail-webhooks');
const { authenticateAPI } = require('../middleware/auth');

function createApiRouter(database, scheduler, registrationAutomator, logger, unifiedNotifications = null) {
  const router = express.Router();

  router.use('/events', eventsRouter);
  router.use('/dashboard', dashboardRouter);
  router.use('/automation', createAutomationRouter(database, scheduler, registrationAutomator));
  router.use('/admin', adminRouter);
  
  // Gmail webhook routes - pass unifiedNotifications to access CalendarManager
  if (logger) {
    const gmailWebhookHandler = new GmailWebhookHandler(logger, database, unifiedNotifications);
    gmailWebhookHandler.init().catch(err => {
      logger.error('Failed to initialize Gmail webhook handler:', err);
    });
    router.use('/webhooks', gmailWebhookHandler.createRouter());
  }

  router.get('/status', (req, res) => {
    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  router.post('/scrape', authenticateAPI, async (req, res) => {
    try {
      const { scraperManager, logger } = req.app.locals;
      const source = req.body.source;
      
      let events;
      if (source) {
        events = await scraperManager.scrapeSource(source);
      } else {
        events = await scraperManager.scrapeAll();
      }
      
      res.json({
        success: true,
        message: `Scraping completed${source ? ` for ${source}` : ''}`,
        eventsFound: events.length
      });
    } catch (error) {
      req.app.locals.logger.error('Error during manual scrape:', error.message);
      res.status(500).json({
        success: false,
        error: 'Scraping failed'
      });
    }
  });

  router.post('/score', authenticateAPI, async (req, res) => {
    try {
      const { database, eventScorer, logger } = req.app.locals;
      
      const events = await database.getEventsByStatus('discovered');
      const scoredEvents = await eventScorer.scoreEvents(events);
      
      res.json({
        success: true,
        message: 'Events scored successfully',
        eventCount: scoredEvents.length
      });
    } catch (error) {
      req.app.locals.logger.error('Error during scoring:', error.message);
      res.status(500).json({
        success: false,
        error: 'Scoring failed'
      });
    }
  });

  router.post('/process-approvals', authenticateAPI, async (req, res) => {
    try {
      const { registrationAutomator, logger } = req.app.locals;
      
      const results = await registrationAutomator.processApprovedEvents();
      
      res.json({
        success: true,
        message: 'Approved events processed',
        results
      });
    } catch (error) {
      req.app.locals.logger.error('Error processing approvals:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to process approvals'
      });
    }
  });

  // Twilio webhook endpoint for incoming SMS messages
  router.post('/sms-webhook', async (req, res) => {
    try {
      const { smsManager, registrationAutomator, logger } = req.app.locals;
      
      // Extract Twilio webhook parameters
      const { From: from, Body: body, MessageSid: messageId } = req.body;
      
      if (!from || !body) {
        logger.warn('Invalid SMS webhook payload received');
        return res.status(400).send('Invalid payload');
      }
      
      logger.info(`📱 SMS webhook received from ${from}: "${body}"`);
      
      // Process the incoming SMS response
      const result = await smsManager.handleIncomingResponse(from, body, messageId);
      
      if (result) {
        // Immediately process approved events if SMS was approved
        if (result.approved) {
          logger.info(`🚀 Immediately processing approved event: ${result.eventTitle}`);
          
          try {
            // Process the specific approved event
            await smsManager.processApprovedEvent(result.eventId, result.approvalId);
            
            // If it's a free event, trigger registration automation immediately
            if (!result.requiresPayment) {
              const registrationResults = await registrationAutomator.processApprovedEvents();
              logger.info(`Registration automation triggered: ${registrationResults.length} events processed`);
            }
          } catch (processingError) {
            logger.error(`Error in immediate processing: ${processingError.message}`);
            // Don't fail the webhook - the scheduled task will pick it up
          }
        }
        
        logger.info(`SMS response processed successfully: ${JSON.stringify(result)}`);
      }
      
      // Send TwiML response to acknowledge webhook
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      
    } catch (error) {
      req.app.locals.logger.error('Error processing SMS webhook:', error.message);
      
      // Still return success to Twilio to avoid retries
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  });

  return router;
}

module.exports = createApiRouter;