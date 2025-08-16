const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { database, logger } = req.app.locals;
    
    const status = req.query.status || 'discovered';
    const events = await database.getEventsByStatus(status);
    
    res.json({
      success: true,
      events,
      count: events.length
    });
  } catch (error) {
    req.app.locals.logger.error('Error fetching events:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { database, logger, smsManager } = req.app.locals;
    const eventId = req.params.id;
    
    await database.updateEventStatus(eventId, 'approved');
    
    const events = await database.getEventsByStatus('approved');
    const event = events.find(e => e.id === eventId);
    
    if (event) {
      if (event.cost === 0) {
        await database.updateEventStatus(eventId, 'ready_for_registration');
        logger.info(`Free event ${event.title} approved and ready for registration`);
      } else {
        logger.info(`Paid event ${event.title} approved, payment required`);
      }
    }
    
    res.json({
      success: true,
      message: 'Event approved successfully',
      eventId,
      requiresPayment: event ? event.cost > 0 : false
    });
  } catch (error) {
    req.app.locals.logger.error(`Error approving event ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to approve event'
    });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { database } = req.app.locals;
    const eventId = req.params.id;
    
    await database.updateEventStatus(eventId, 'rejected');
    
    res.json({
      success: true,
      message: 'Event rejected successfully',
      eventId
    });
  } catch (error) {
    req.app.locals.logger.error(`Error rejecting event ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to reject event'
    });
  }
});

router.post('/:id/register', async (req, res) => {
  try {
    const { database, logger, registrationAutomator } = req.app.locals;
    const eventId = req.params.id;
    
    const events = await database.getEventsByStatus('approved');
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or not approved'
      });
    }
    
    if (event.cost > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot auto-register for paid events'
      });
    }
    
    const result = await registrationAutomator.registerForEvent(event);
    
    res.json({
      success: true,
      message: 'Registration completed successfully',
      result
    });
  } catch (error) {
    req.app.locals.logger.error(`Error registering for event ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/calendar', async (req, res) => {
  try {
    const { database, logger, calendarManager } = req.app.locals;
    const eventId = req.params.id;
    
    const events = await database.getEventsByStatus('booked');
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or not booked'
      });
    }
    
    const calendarResults = await calendarManager.createCalendarEvent(event);
    
    await database.updateEventStatus(eventId, 'attended');
    
    res.json({
      success: true,
      message: 'Calendar event created successfully',
      calendarResults
    });
  } catch (error) {
    req.app.locals.logger.error(`Error creating calendar event for ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar event'
    });
  }
});

module.exports = router;