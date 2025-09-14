const express = require('express');
const { authenticateAPI } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - Main dashboard data
router.get('/', authenticateAPI, async (req, res) => {
  try {
    const { database, logger, scheduler } = req.app.locals;
    
    // Get event counts by status
    const eventCounts = await database.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM events 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `);
    
    // Get recent events requiring attention
    const pendingEvents = await database.query(`
      SELECT 
        e.id, e.title, e.date, 
        COALESCE(e.time, TO_CHAR(e.date, 'HH24:MI')) as time,
        e.status, e.cost, e.source
      FROM events e
      LEFT JOIN event_scores es ON e.id = es.event_id
      WHERE e.status = 'discovered'
      ORDER BY COALESCE(es.total_score, 0) DESC, e.created_at DESC
      LIMIT 5
    `);
    
    // Get upcoming registered events
    const upcomingEvents = await database.query(`
      SELECT 
        id, title, date, 
        COALESCE(time, TO_CHAR(date, 'HH24:MI')) as time,
        COALESCE(location_name, 'TBD') as venue, 
        status, 
        (SELECT confirmation_number FROM registrations r WHERE r.event_id = events.id AND r.success = true LIMIT 1) as confirmation_number
      FROM events 
      WHERE status IN ('approved', 'registered') 
      AND date >= CURRENT_DATE
      ORDER BY date ASC
      LIMIT 5
    `);
    
    // Get automation statistics
    const automationStats = await database.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'discovered' AND created_at >= CURRENT_DATE) as discovered_today,
        COUNT(*) FILTER (WHERE status = 'approved' AND updated_at >= CURRENT_DATE) as approved_today,
        COUNT(*) FILTER (WHERE status = 'registered' AND updated_at >= CURRENT_DATE) as registered_today
      FROM events
    `);
    
    // Get system health from scheduler
    const systemHealth = scheduler ? scheduler.getStatus() : { healthy: true };
    
    // Process counts into usable format
    const statusCounts = {
      discovered: 0,
      approved: 0,
      registered: 0,
      rejected: 0,
      total: 0
    };
    
    eventCounts.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
      statusCounts.total += parseInt(row.count);
    });
    
    const response = {
      success: true,
      data: {
        quickStats: {
          totalEvents: statusCounts.total,
          pendingReview: statusCounts.discovered,
          approved: statusCounts.approved,
          registered: statusCounts.registered,
          automationActive: systemHealth.healthy || false
        },
        todayStats: {
          discovered: automationStats.rows[0]?.discovered_today || 0,
          approved: automationStats.rows[0]?.approved_today || 0,
          registered: automationStats.rows[0]?.registered_today || 0
        },
        pendingEvents: pendingEvents.rows.map(event => ({
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time,
          status: event.status,
          cost: event.cost,
          source: event.source
        })),
        upcomingEvents: upcomingEvents.rows.map(event => ({
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time,
          venue: event.venue,
          status: event.status,
          confirmationNumber: event.confirmation_number
        })),
        systemHealth: {
          status: systemHealth.healthy ? 'healthy' : 'degraded',
          uptime: process.uptime(),
          lastUpdate: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    req.app.locals.logger.error('Dashboard API error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data',
      message: error.message
    });
  }
});

// GET /api/dashboard/quick-actions - Quick action items
router.get('/quick-actions', authenticateAPI, async (req, res) => {
  try {
    const { database } = req.app.locals;
    
    // Get high-priority events that need attention
    const urgentEvents = await database.query(`
      SELECT COUNT(*) as count
      FROM events e
      LEFT JOIN event_scores es ON e.id = es.event_id
      WHERE e.status = 'discovered' 
      AND (
        e.date <= CURRENT_DATE + INTERVAL '3 days'
        OR COALESCE(es.total_score, 0) >= 0.8
      )
    `);
    
    // Get automation failures that need review
    const failedRegistrations = await database.query(`
      SELECT COUNT(*) as count
      FROM events 
      WHERE status = 'registration_failed'
      AND updated_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    const quickActions = [
      {
        id: 'review-urgent',
        title: 'Review Urgent Events',
        description: 'Events happening soon or highly scored',
        count: parseInt(urgentEvents.rows[0]?.count || 0),
        priority: 'high',
        action: '/dashboard/events?filter=urgent'
      },
      {
        id: 'fix-failures',
        title: 'Fix Registration Failures',
        description: 'Events that failed automatic registration',
        count: parseInt(failedRegistrations.rows[0]?.count || 0),
        priority: 'medium',
        action: '/dashboard/events?status=registration_failed'
      }
    ];
    
    res.json({
      success: true,
      data: quickActions.filter(action => action.count > 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    req.app.locals.logger.error('Quick actions API error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load quick actions'
    });
  }
});

module.exports = router;