/**
 * Kid Events API Routes
 * 
 * Endpoints for the new Kids Event Discovery system.
 */

const express = require('express');
const { DiscoveryOrchestrator } = require('../services/kid-events');
const { authenticateFlexible } = require('../middleware/auth');

function createKidEventsRouter(database, logger) {
  const router = express.Router();

  // Get discovered kid events
  router.get('/', authenticateFlexible, async (req, res) => {
    try {
      const { 
        status = 'discovered',
        limit = 20,
        offset = 0,
        minScore = 0,
        sortBy = 'relevance_score'
      } = req.query;

      const validSortFields = ['relevance_score', 'event_date', 'discovered_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'relevance_score';
      const sortDir = sortField === 'relevance_score' ? 'DESC' : 'ASC';

      const result = await database.query(`
        SELECT * FROM kid_events
        WHERE status = $1
        AND (relevance_score IS NULL OR relevance_score >= $2)
        ORDER BY ${sortField} ${sortDir} NULLS LAST
        LIMIT $3 OFFSET $4
      `, [status, parseFloat(minScore), parseInt(limit), parseInt(offset)]);

      const countResult = await database.query(`
        SELECT COUNT(*) as total FROM kid_events
        WHERE status = $1
        AND (relevance_score IS NULL OR relevance_score >= $2)
      `, [status, parseFloat(minScore)]);

      res.json({
        success: true,
        data: {
          events: result.rows.map(formatEvent),
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching kid events:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
  });

  // Get single event by ID
  router.get('/:id', authenticateFlexible, async (req, res) => {
    try {
      const result = await database.query(
        'SELECT * FROM kid_events WHERE id = $1',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      res.json({
        success: true,
        data: formatEvent(result.rows[0])
      });
    } catch (error) {
      logger.error('Error fetching event:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch event' });
    }
  });

  // Update event status (interested, approved, rejected)
  router.patch('/:id/status', authenticateFlexible, async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['discovered', 'interested', 'approved', 'rejected', 'attended'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const result = await database.query(`
        UPDATE kid_events
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [status, req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      res.json({
        success: true,
        message: `Event marked as ${status}`,
        data: formatEvent(result.rows[0])
      });
    } catch (error) {
      logger.error('Error updating event status:', error.message);
      res.status(500).json({ success: false, error: 'Failed to update event' });
    }
  });

  // Rate an attended event
  router.post('/:id/rate', authenticateFlexible, async (req, res) => {
    try {
      const { rating, notes } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
      }

      const result = await database.query(`
        UPDATE kid_events
        SET user_rating = $1, notes = $2, status = 'attended', updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [rating, notes, req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      // Update preferences based on feedback (background task)
      // TODO: Implement preference learning

      res.json({
        success: true,
        message: 'Event rated successfully',
        data: formatEvent(result.rows[0])
      });
    } catch (error) {
      logger.error('Error rating event:', error.message);
      res.status(500).json({ success: false, error: 'Failed to rate event' });
    }
  });

  // Trigger on-demand discovery
  router.post('/discover', authenticateFlexible, async (req, res) => {
    try {
      console.log('📨 [API] ========== POST /kid-events/discover ==========');
      console.log('📨 [API] Request body:', JSON.stringify(req.body, null, 2));
      
      const {
        location,
        radiusMiles,
        daysAhead,
        ageMin,
        ageMax,
        enableSerp = true,
        enableEventbrite = true,
        enableNewsletters = true,
        maxUrls = 5  // Default to 5 for faster debugging
      } = req.body;

      const config = {
        location: location || 'San Francisco, CA',
        radiusMiles: radiusMiles || 25,
        daysAhead: daysAhead || 14,
        ageMin,
        ageMax,
        enableSerp,
        enableEventbrite,
        enableNewsletters,
        maxUrls: Math.min(maxUrls, 50),  // Cap at 50 max
        triggerType: 'on_demand'
      };

      console.log('📨 [API] Final config:', JSON.stringify(config, null, 2));
      console.log('📨 [API] Environment check:');
      console.log('   - BRAVE_SEARCH_API_KEY:', !!process.env.BRAVE_SEARCH_API_KEY);
      console.log('   - EVENTBRITE_API_KEY:', !!process.env.EVENTBRITE_API_KEY);
      console.log('   - OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY || !!process.env.OPEN_AI_API_KEY);
      
      logger.info('Starting on-demand kid events discovery with config:', config);

      // Run discovery in background
      const orchestrator = new DiscoveryOrchestrator(logger, database, config);
      
      // Return immediately, process in background
      console.log('📨 [API] Starting discovery in background...');
      orchestrator.discover(config)
        .then(results => {
          console.log('✅ [API] Discovery completed:', JSON.stringify(results, null, 2));
          logger.info('On-demand discovery completed:', results);
        })
        .catch(error => {
          console.log('❌ [API] Discovery failed:', error.message);
          console.log('❌ [API] Error stack:', error.stack);
          logger.error('On-demand discovery failed:', error.message);
        });

      res.json({
        success: true,
        message: 'Discovery started',
        config
      });
    } catch (error) {
      console.log('❌ [API] Error starting discovery:', error.message);
      console.log('❌ [API] Error stack:', error.stack);
      logger.error('Error starting discovery:', error.message);
      res.status(500).json({ success: false, error: 'Failed to start discovery' });
    }
  });

  // Get discovery run history
  router.get('/discovery/runs', authenticateFlexible, async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const result = await database.query(`
        SELECT * FROM kid_event_discovery_runs
        ORDER BY started_at DESC
        LIMIT $1
      `, [parseInt(limit)]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching discovery runs:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch discovery runs' });
    }
  });

  // Get user preferences
  router.get('/preferences', authenticateFlexible, async (req, res) => {
    try {
      const userId = req.user?.id || 1; // Default to user 1 for now

      const result = await database.query(
        'SELECT * FROM kid_event_preferences WHERE user_id = $1',
        [userId]
      );

      res.json({
        success: true,
        data: result.rows[0] || getDefaultPreferences()
      });
    } catch (error) {
      logger.error('Error fetching preferences:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
    }
  });

  // Update user preferences
  router.put('/preferences', authenticateFlexible, async (req, res) => {
    try {
      const userId = req.user?.id || 1;
      const {
        filter_weights,
        liked_venues,
        disliked_venues,
        liked_activities,
        disliked_activities,
        preferred_days,
        preferred_times,
        max_cost_per_event,
        prefer_free
      } = req.body;

      const result = await database.query(`
        INSERT INTO kid_event_preferences (
          user_id, filter_weights, liked_venues, disliked_venues,
          liked_activities, disliked_activities, preferred_days,
          preferred_times, max_cost_per_event, prefer_free
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
          filter_weights = COALESCE($2, kid_event_preferences.filter_weights),
          liked_venues = COALESCE($3, kid_event_preferences.liked_venues),
          disliked_venues = COALESCE($4, kid_event_preferences.disliked_venues),
          liked_activities = COALESCE($5, kid_event_preferences.liked_activities),
          disliked_activities = COALESCE($6, kid_event_preferences.disliked_activities),
          preferred_days = COALESCE($7, kid_event_preferences.preferred_days),
          preferred_times = COALESCE($8, kid_event_preferences.preferred_times),
          max_cost_per_event = COALESCE($9, kid_event_preferences.max_cost_per_event),
          prefer_free = COALESCE($10, kid_event_preferences.prefer_free),
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        filter_weights ? JSON.stringify(filter_weights) : null,
        liked_venues ? JSON.stringify(liked_venues) : null,
        disliked_venues ? JSON.stringify(disliked_venues) : null,
        liked_activities ? JSON.stringify(liked_activities) : null,
        disliked_activities ? JSON.stringify(disliked_activities) : null,
        preferred_days ? JSON.stringify(preferred_days) : null,
        preferred_times ? JSON.stringify(preferred_times) : null,
        max_cost_per_event,
        prefer_free
      ]);

      res.json({
        success: true,
        message: 'Preferences updated',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating preferences:', error.message);
      res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
  });

  return router;
}

// Helper: Format event for API response
function formatEvent(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description,
    date: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue_name,
    address: row.address,
    city: row.city,
    location: row.latitude && row.longitude ? {
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude)
    } : null,
    distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
    cost: {
      adult: row.cost_adult ? parseFloat(row.cost_adult) : null,
      child: row.cost_child ? parseFloat(row.cost_child) : null,
      isFree: row.is_free
    },
    ageRange: {
      min: row.age_min,
      max: row.age_max
    },
    urls: {
      event: row.event_url,
      registration: row.registration_url
    },
    extraction: {
      confidence: row.extraction_confidence ? parseFloat(row.extraction_confidence) : null,
      model: row.extraction_model
    },
    relevanceScore: row.relevance_score ? parseFloat(row.relevance_score) : null,
    filterScores: row.filter_scores,
    status: row.status,
    rating: row.user_rating,
    notes: row.notes,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at
  };
}

// Helper: Get default preferences
function getDefaultPreferences() {
  return {
    filter_weights: { age: 0.3, schedule: 0.25, budget: 0.2, location: 0.15, interest: 0.1 },
    liked_venues: [],
    disliked_venues: [],
    liked_activities: [],
    disliked_activities: [],
    preferred_days: ['saturday', 'sunday'],
    preferred_times: { weekday_after: '17:00', weekend_start: '09:00' },
    max_cost_per_event: 50,
    prefer_free: true
  };
}

module.exports = createKidEventsRouter;
