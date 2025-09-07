const express = require('express');
const { authenticateAPI } = require('../middleware/auth');
const router = express.Router();

// Enhanced events list with filtering, pagination, and search
router.get('/', authenticateAPI, async (req, res) => {
  try {
    const { database, logger } = req.app.locals;
    
    const {
      status = 'all',
      search = '',
      venue = '',
      cost = '',
      age = '',
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    // Status filter
    if (status !== 'all') {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }
    
    // Search filter (title, description, source)
    if (search) {
      whereConditions.push(`(title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++} OR source ILIKE $${paramIndex++})`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Venue filter
    if (venue) {
      whereConditions.push(`location_name ILIKE $${paramIndex++}`);
      queryParams.push(`%${venue}%`);
    }
    
    // Cost filter
    if (cost === 'free') {
      whereConditions.push(`cost = 0`);
    } else if (cost === 'under25') {
      whereConditions.push(`cost > 0 AND cost <= 25`);
    } else if (cost === 'under50') {
      whereConditions.push(`cost > 0 AND cost <= 50`);
    }
    
    // Age filter (check if event age range overlaps with family age range)
    if (age === 'perfect') {
      // Assume family has children aged 2-4 (should come from settings)
      whereConditions.push(`age_min <= 4 AND age_max >= 2`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM events 
      ${whereClause}
    `;
    
    const countResult = await database.query(countQuery, queryParams);
    const totalEvents = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const eventsQuery = `
      SELECT 
        id, title, date, time, location_name, location_address, location_distance,
        cost, age_min, age_max, status, description, registration_url,
        social_proof_rating, social_proof_review_count, social_proof_tags,
        weather_context, preferences_context, urgency_context,
        source, auto_registration, confirmation_number, rejection_reason,
        failure_reason, score, created_at, updated_at
      FROM events 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const eventsResult = await database.query(eventsQuery, queryParams);
    
    // Format events for frontend
    const formattedEvents = eventsResult.rows.map(event => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: {
        name: event.location_name || '',
        address: event.location_address || '',
        distance: event.location_distance || '',
      },
      cost: event.cost || 0,
      ageRange: {
        min: event.age_min || 0,
        max: event.age_max || 10,
      },
      status: event.status,
      description: event.description || '',
      registrationUrl: event.registration_url || '',
      socialProof: {
        rating: event.social_proof_rating || 0,
        reviewCount: event.social_proof_review_count || 0,
        tags: event.social_proof_tags ? event.social_proof_tags.split(',') : [],
      },
      context: {
        weather: event.weather_context,
        preferences: event.preferences_context,
        urgency: event.urgency_context,
      },
      source: event.source || '',
      autoRegistration: event.auto_registration,
      confirmationNumber: event.confirmation_number,
      rejectionReason: event.rejection_reason,
      failureReason: event.failure_reason,
      score: event.score,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));
    
    res.json({
      success: true,
      data: {
        events: formattedEvents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEvents / parseInt(limit)),
          totalEvents,
          limit: parseInt(limit),
          hasNextPage: offset + formattedEvents.length < totalEvents,
          hasPrevPage: parseInt(page) > 1,
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    req.app.locals.logger.error('Error fetching events:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      message: error.message
    });
  }
});

router.post('/:id/approve', authenticateAPI, async (req, res) => {
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

router.post('/:id/reject', authenticateAPI, async (req, res) => {
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

router.post('/:id/register', authenticateAPI, async (req, res) => {
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

router.post('/:id/calendar', authenticateAPI, async (req, res) => {
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

// GET specific event details
router.get('/:id', authenticateAPI, async (req, res) => {
  try {
    const { database } = req.app.locals;
    const eventId = req.params.id;
    
    const result = await database.query(`
      SELECT 
        id, title, date, time, location_name, location_address, location_distance,
        cost, age_min, age_max, status, description, registration_url,
        social_proof_rating, social_proof_review_count, social_proof_tags,
        weather_context, preferences_context, urgency_context,
        source, auto_registration, confirmation_number, rejection_reason,
        failure_reason, score, created_at, updated_at
      FROM events 
      WHERE id = $1
    `, [eventId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    const event = result.rows[0];
    const formattedEvent = {
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: {
        name: event.location_name || '',
        address: event.location_address || '',
        distance: event.location_distance || '',
      },
      cost: event.cost || 0,
      ageRange: {
        min: event.age_min || 0,
        max: event.age_max || 10,
      },
      status: event.status,
      description: event.description || '',
      registrationUrl: event.registration_url || '',
      socialProof: {
        rating: event.social_proof_rating || 0,
        reviewCount: event.social_proof_review_count || 0,
        tags: event.social_proof_tags ? event.social_proof_tags.split(',') : [],
      },
      context: {
        weather: event.weather_context,
        preferences: event.preferences_context,
        urgency: event.urgency_context,
      },
      source: event.source || '',
      autoRegistration: event.auto_registration,
      confirmationNumber: event.confirmation_number,
      rejectionReason: event.rejection_reason,
      failureReason: event.failure_reason,
      score: event.score,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };
    
    res.json({
      success: true,
      data: formattedEvent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    req.app.locals.logger.error(`Error fetching event ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event details'
    });
  }
});

// POST bulk approve/reject events
router.post('/bulk-action', authenticateAPI, async (req, res) => {
  try {
    const { database, logger } = req.app.locals;
    const { action, eventIds } = req.body;
    
    if (!action || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing action or eventIds'
      });
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "approve" or "reject"'
      });
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const placeholders = eventIds.map((_, index) => `$${index + 1}`).join(',');
    
    const result = await database.query(`
      UPDATE events 
      SET status = '${newStatus}', updated_at = NOW()
      WHERE id IN (${placeholders})
      RETURNING id, title, cost
    `, eventIds);
    
    logger.info(`Bulk ${action}: ${result.rows.length} events updated`);
    
    // For approved free events, mark them ready for registration
    if (action === 'approve') {
      const freeEventIds = result.rows.filter(event => event.cost === 0).map(event => event.id);
      if (freeEventIds.length > 0) {
        const freePlaceholders = freeEventIds.map((_, index) => `$${index + 1}`).join(',');
        await database.query(`
          UPDATE events 
          SET status = 'ready_for_registration'
          WHERE id IN (${freePlaceholders})
        `, freeEventIds);
        logger.info(`${freeEventIds.length} free events marked ready for registration`);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully ${action}d ${result.rows.length} events`,
      updatedEvents: result.rows,
      action,
      count: result.rows.length
    });
    
  } catch (error) {
    req.app.locals.logger.error('Bulk action error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk action'
    });
  }
});

module.exports = router;