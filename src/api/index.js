const express = require('express');
const eventsRouter = require('./events');

const router = express.Router();

router.use('/events', eventsRouter);

router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.post('/scrape', async (req, res) => {
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

router.post('/score', async (req, res) => {
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

router.post('/process-approvals', async (req, res) => {
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

module.exports = router;