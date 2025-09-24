const express = require('express');
const router = express.Router();
const { GmailMCPClient } = require('../mcp/gmail');

// Google Integration health check - tests calendar and email for sheridan.gray@gmail.com
async function checkGoogleIntegration() {
  try {
    const { getGmailClient } = require('../mcp/gmail-singleton');
    const logger = { 
      info: () => {}, 
      warn: () => {}, 
      error: () => {}, 
      debug: () => {} 
    };

    const gmailClient = await getGmailClient(logger);

    // Test calendar access
    let calendarHealthy = false;
    try {
      const calendarResponse = await gmailClient.calendar.calendarList.list({ maxResults: 1 });
      calendarHealthy = !!calendarResponse.data.items;
    } catch (error) {
      console.warn('Calendar health check failed:', error.message);
    }

    // Test Gmail profile access (email API)
    let emailHealthy = false;
    try {
      const profileResponse = await gmailClient.gmail.users.getProfile({ userId: 'me' });
      emailHealthy = profileResponse.data.emailAddress === 'sheridan.gray@gmail.com';
    } catch (error) {
      console.warn('Email health check failed:', error.message);
    }

    // Return true only if both calendar and email are working
    return calendarHealthy && emailHealthy;
  } catch (error) {
    console.warn('Google integration health check failed:', error.message);
    return false;
  }
}

// Weather service health check
async function checkWeatherService() {
  try {
    const homeZip = process.env.HOME_ZIP || process.env.HOME_ADDRESS;
    const homeCity = process.env.HOME_CITY || 'San Francisco';
    const homeCountry = process.env.HOME_COUNTRY || 'US';
    const weatherApiKey = process.env.WEATHER_API_KEY;

    if (!weatherApiKey) {
      return false; // No API key configured
    }

    // Build weather API URL - prefer zip code for accuracy
    let weatherUrl;
    if (homeZip && homeZip.match(/^\d{5}$/)) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${homeZip},${homeCountry}&appid=${weatherApiKey}&units=imperial`;
    } else {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(homeCity)}&appid=${weatherApiKey}&units=imperial`;
    }

    // Test weather API with 3 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(weatherUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'FamilyEventPlanner/1.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data && data.main && typeof data.main.temp === 'number';
    }
    
    return false;
  } catch (error) {
    console.warn('Weather service health check failed:', error.message);
    return false;
  }
}

// Initialize router with database and automation components
function createAutomationRouter(database, taskScheduler, registrationAutomator) {
  
  // Get automation status/statistics
  router.get('/status', async (req, res) => {
    try {
      // Get the latest discovery run ID from discovery_runs table
      const latestRunResult = await database.getLatestDiscoveryRunId();
      const latestRunId = latestRunResult || 0;
      
      // Get latest discovery run statistics
      const [
        eventsDiscovered,
        emailsSent,
        emailApprovals,
        lastDiscoveryResult,
        filteredEvents,
        allEvents
      ] = await Promise.all([
        // Get events discovered count from discovered_events table (raw count)
        database.query(`
          SELECT COALESCE((SELECT COUNT(*) FROM discovered_events WHERE discovery_run_id = $1), 0) as count
        `, [latestRunId]),
        // Fallback if email_approvals table doesn't exist yet
        database.query(`
          SELECT 0 as count
        `).catch(() => ({ rows: [{ count: 0 }] })),
        database.query(`
          SELECT COUNT(*) as count 
          FROM events 
          WHERE discovery_run_id = $1 AND status = 'approved'
        `, [latestRunId]),
        // Get last discovery run timestamp from discovery_runs table
        database.query(`
          SELECT COALESCE(completed_at, started_at) as created_at
          FROM discovery_runs 
          WHERE id = $1
        `, [latestRunId]),
        database.query(`
          SELECT COUNT(*) as count 
          FROM events 
          WHERE discovery_run_id = $1 AND status = 'discovered'
        `, [latestRunId]),
        database.getEventsByStatus('discovered')
      ]);

      // Check email notification status
      const emailNotificationStatus = 'active'; // TODO: Check actual email service status

      // Calculate next discovery run based on scheduler
      const nextDiscoveryRun = calculateNextDiscoveryRun();

      // Format last discovery run timestamp
      let lastDiscoveryRun = 'Never';
      if (lastDiscoveryResult.rows.length > 0) {
        const lastRun = new Date(lastDiscoveryResult.rows[0].created_at);
        const now = new Date();
        const diffMs = now - lastRun;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours === 0) {
          lastDiscoveryRun = `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
          lastDiscoveryRun = `${diffHours}h ${diffMinutes}m ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          lastDiscoveryRun = `${diffDays}d ago`;
        }
      }

      res.json({
        eventsDiscoveredLatest: parseInt(eventsDiscovered.rows[0].count),
        emailsSentLatest: parseInt(emailsSent.rows[0].count),
        emailApprovalsReceived: parseInt(emailApprovals.rows[0].count),
        lastDiscoveryRun: lastDiscoveryRun,
        filteredEventsLatest: parseInt(filteredEvents.rows[0].count),
        emailNotificationStatus: emailNotificationStatus,
        nextDiscoveryRun: nextDiscoveryRun,
        latestDiscoveryRunId: latestRunId
      });

    } catch (error) {
      console.error('Error getting automation status:', error);
      res.status(500).json({ error: 'Failed to get automation status' });
    }
  });

  // Get active scrapers with stats
  router.get('/scrapers', async (req, res) => {
    try {
      // Get time range parameter (default to 7 days)
      const timeRange = req.query.timeRange || '7';
      const validTimeRanges = ['1', '7', '30'];
      const days = validTimeRanges.includes(timeRange) ? parseInt(timeRange) : 7;
      
      // Get the latest discovery run ID
      const latestRunId = await database.getLatestDiscoveryRunId();
      
      const scrapersResult = await database.query(`
        SELECT 
          s.id,
          s.name,
          s.display_name,
          s.description,
          s.target_domain,
          s.enabled,
          s.updated_at,
          COUNT(ss.id) as total_runs,
          SUM(CASE WHEN ss.success = true THEN 1 ELSE 0 END) as successful_runs,
          SUM(CASE WHEN ss.success = false THEN 1 ELSE 0 END) as failed_runs,
          MAX(ss.completed_at) as last_run,
          SUM(ss.events_found) as total_events_found
        FROM scrapers s
        LEFT JOIN scraper_stats ss ON s.id = ss.scraper_id 
          AND ss.completed_at >= NOW() - INTERVAL '${days} days'
        GROUP BY s.id, s.name, s.display_name, s.description, s.target_domain, s.enabled, s.updated_at
        ORDER BY s.id
      `);

      // Get the most recent discovery run timestamp where each scraper actually participated
      const scraperLatestRunResult = await database.query(`
        SELECT 
          s.name as scraper_name,
          latest_run.last_discovery_run,
          COALESCE(latest_run.raw_events_found, 0) as discovered,
          0 as proposed,
          0 as approved, 
          0 as registered
        FROM scrapers s
        LEFT JOIN (
          -- Find the most recent discovery run where each scraper actually participated
          SELECT DISTINCT
            ss.scraper_id,
            dr.completed_at as last_discovery_run,
            de.events_found as raw_events_found,
            ROW_NUMBER() OVER (PARTITION BY ss.scraper_id ORDER BY dr.started_at DESC) as rn
          FROM scraper_stats ss
          JOIN discovery_runs dr ON ss.discovery_run_id = dr.id
          JOIN (
            SELECT 
              scraper_name,
              discovery_run_id,
              COUNT(*) as events_found
            FROM discovered_events 
            GROUP BY scraper_name, discovery_run_id
          ) de ON de.discovery_run_id = ss.discovery_run_id AND de.scraper_name = (
            SELECT name FROM scrapers WHERE id = ss.scraper_id
          )
          WHERE dr.completed_at IS NOT NULL
        ) latest_run ON s.id = latest_run.scraper_id AND latest_run.rn = 1
        WHERE s.enabled = true
      `);

      // Create a map of event stats by scraper name for quick lookup
      const eventStatsBySource = {};
      scraperLatestRunResult.rows.forEach(row => {
        eventStatsBySource[row.scraper_name] = {
          discovered: parseInt(row.discovered) || 0,
          proposed: parseInt(row.proposed) || 0,
          approved: parseInt(row.approved) || 0,
          registered: parseInt(row.registered) || 0,
          lastDiscoveryRun: row.last_discovery_run
        };
      });

      const scrapers = scrapersResult.rows.map(row => {
        const eventStats = eventStatsBySource[row.name] || {
          discovered: 0,
          proposed: 0,
          approved: 0,
          registered: 0,
          lastDiscoveryRun: null
        };

        // Use the latest discovery run time if available, otherwise fall back to scraper_stats
        const lastRunTime = eventStats.lastDiscoveryRun || row.last_run;

        return {
          id: row.id,
          name: row.name,
          displayName: row.display_name,
          description: row.description,
          domain: row.target_domain,
          enabled: row.enabled,
          updatedAt: row.updated_at,
          stats: {
            totalRuns: parseInt(row.total_runs) || 0,
            successfulRuns: parseInt(row.successful_runs) || 0,
            failedRuns: parseInt(row.failed_runs) || 0,
            lastRun: lastRunTime ? formatTimeAgo(lastRunTime) : 'Never',
            totalEventsFound: parseInt(row.total_events_found) || 0
          },
          eventPipeline: {
            discovered: eventStats.discovered,
            proposed: eventStats.proposed,
            approved: eventStats.approved,
            registered: eventStats.registered
          }
        };
      });

      res.json(scrapers);

    } catch (error) {
      console.error('Error getting scrapers:', error);
      res.status(500).json({ error: 'Failed to get scrapers' });
    }
  });

  // Toggle scraper enabled/disabled
  router.post('/scrapers/:id/toggle', async (req, res) => {
    try {
      const scraperId = parseInt(req.params.id);
      
      const result = await database.query(`
        UPDATE scrapers 
        SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 
        RETURNING enabled
      `, [scraperId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Scraper not found' });
      }

      res.json({ 
        success: true, 
        enabled: result.rows[0].enabled,
        message: `Scraper ${result.rows[0].enabled ? 'enabled' : 'disabled'} successfully`
      });

    } catch (error) {
      console.error('Error toggling scraper:', error);
      res.status(500).json({ error: 'Failed to toggle scraper' });
    }
  });

  // Delete scraper
  router.delete('/scrapers/:id', async (req, res) => {
    try {
      const scraperId = parseInt(req.params.id);
      
      const result = await database.query(`
        DELETE FROM scrapers WHERE id = $1 RETURNING name
      `, [scraperId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Scraper not found' });
      }

      res.json({ 
        success: true,
        message: `Scraper "${result.rows[0].name}" deleted successfully`
      });

    } catch (error) {
      console.error('Error deleting scraper:', error);
      res.status(500).json({ error: 'Failed to delete scraper' });
    }
  });

  // Run individual scraper
  router.post('/scrapers/:id/run', async (req, res) => {
    try {
      const scraperId = parseInt(req.params.id);
      const { scheduler, logger } = req.app.locals;
      
      if (!scheduler) {
        return res.status(500).json({
          success: false,
          error: 'Scheduler not available'
        });
      }

      // Get scraper info
      const scraperResult = await database.query(`
        SELECT name, display_name FROM scrapers WHERE id = $1 AND enabled = true
      `, [scraperId]);

      if (scraperResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Scraper not found or disabled' 
        });
      }

      const scraperInfo = scraperResult.rows[0];
      logger.info(`🚀 Manual scraper run triggered for ${scraperInfo.display_name} via API`);
      
      // Run single scraper in background (manual = true)
      scheduler.runSingleScraper(scraperInfo.name, true).then(() => {
        logger.info(`✅ Manual scraper run completed for ${scraperInfo.display_name}`);
      }).catch(error => {
        logger.error(`❌ Manual scraper run failed for ${scraperInfo.display_name}:`, error.message);
      });
      
      res.json({
        success: true,
        message: `Scraper "${scraperInfo.display_name}" started successfully`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      req.app.locals.logger.error('Error running individual scraper:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to run scraper'
      });
    }
  });

  // Submit scraper request
  router.post('/scraper-requests', async (req, res) => {
    try {
      const { domain, description } = req.body;
      
      if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
      }

      // Save request to database
      const result = await database.query(`
        INSERT INTO scraper_requests (domain, description, requester_info, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id
      `, [domain, description || '', JSON.stringify({ userAgent: req.headers['user-agent'], timestamp: new Date() })]);

      const requestId = result.rows[0].id;

      // Send email notification
      try {
        await sendScraperRequestEmail(domain, description, requestId, req.app.locals.logger);
        req.app.locals.logger.info(`📧 Email notification sent for scraper request: ${domain} (ID: ${requestId})`);
      } catch (emailError) {
        req.app.locals.logger.error(`Failed to send email notification for scraper request ${domain}:`, emailError.message);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: 'Scraper request submitted successfully',
        requestId: requestId
      });

    } catch (error) {
      console.error('Error submitting scraper request:', error);
      res.status(500).json({ error: 'Failed to submit scraper request' });
    }
  });

  // Get automation rules (legacy - keeping for backward compatibility)
  router.get('/rules', async (req, res) => {
    try {
      if (!registrationAutomator || !registrationAutomator.adapters) {
        return res.json([]);
      }

      const rules = [];
      const adapters = registrationAutomator.adapters;

      // Get statistics for each adapter
      const registrationStats = await database.query(`
        SELECT 
          adapter_type,
          COUNT(*) as success_count,
          MAX(created_at) as last_triggered
        FROM registrations 
        WHERE success = true 
        GROUP BY adapter_type
      `);

      const statsMap = {};
      registrationStats.rows.forEach(row => {
        statsMap[row.adapter_type] = {
          successCount: parseInt(row.success_count),
          lastTriggered: row.last_triggered
        };
      });

      // Create rule entries for major adapters
      const adapterConfigs = [
        {
          name: 'CalAcademyAdapter',
          displayName: 'Auto-register for Cal Academy events under $25',
          description: 'Auto-register for California Academy events under $25 for kids',
          conditions: ['Venue: Cal Academy', 'Cost: < $25', 'Science category'],
          actions: ['Auto-register', 'Add to calendar', 'Send confirmation'],
          domains: ['calacademy.org', 'www.calacademy.org']
        },
        {
          name: 'SFLibraryAdapter', 
          displayName: 'Auto-register for free SF Library events',
          description: 'Automatically register for approved free events at SF Library locations',
          conditions: ['Venue: SF Library', 'Cost: Free', 'Age appropriate'],
          actions: ['Auto-register', 'Set reminder', 'Send confirmation'],
          domains: ['sfpl.org', 'www.sfpl.org']
        },
        {
          name: 'SFRecParksAdapter',
          displayName: 'SF Recreation & Parks registration',
          description: 'Auto-register for SF Recreation & Parks family activities',
          conditions: ['Venue: SF Rec Parks', 'Family friendly', 'Available slots'],
          actions: ['Auto-register', 'Calendar sync', 'Email confirmation'],
          domains: ['sfrecpark.org', 'www.sfrecpark.org']
        }
      ];

      adapterConfigs.forEach((config, index) => {
        const stats = statsMap[config.name] || { successCount: 0, lastTriggered: null };
        const hasAdapter = config.domains.some(domain => adapters[domain]);
        
        rules.push({
          id: (index + 1).toString(),
          name: config.displayName,
          description: config.description,
          enabled: hasAdapter,
          trigger: 'New event discovered',
          conditions: config.conditions,
          actions: config.actions,
          successCount: stats.successCount,
          lastTriggered: stats.lastTriggered ? formatTimeAgo(stats.lastTriggered) : null
        });
      });

      res.json(rules);

    } catch (error) {
      console.error('Error getting automation rules:', error);
      res.status(500).json({ error: 'Failed to get automation rules' });
    }
  });

  // Get detailed scraper runs with discovered events and filter outcomes
  router.get('/scraper-runs', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      // Get recent discovery runs from the new table
      const discoveryRuns = await database.getDiscoveryRuns(limit);
      
      // Get discovered events stats for each discovery run
      const discoveryRunsWithScrapers = [];
      for (const discoveryRun of discoveryRuns) {
        // Get actual discovered events count for the discovery run summary
        const totalEventsResult = await database.query(`
          SELECT COUNT(*) as total_events
          FROM discovered_events
          WHERE discovery_run_id = $1
        `, [discoveryRun.id]);
        
        const totalEventsFound = parseInt(totalEventsResult.rows[0]?.total_events || 0);
        
        // Get scraper stats for scrapers that actually participated in this discovery run
        const scraperStats = await database.query(`
          SELECT 
            s.id as scraper_id,
            s.name as scraper_name,
            s.display_name as scraper_display_name,
            s.scrape_url as scraper_url,
            COALESCE(de.events_found, ss.events_found, 0) as events_found,
            COALESCE(ss.success, true) as success,
            ss.error_message,
            COALESCE(ss.execution_time_ms, 0) as execution_time_ms,
            ss.started_at,
            ss.completed_at
          FROM scraper_stats ss
          JOIN scrapers s ON s.id = ss.scraper_id
          LEFT JOIN (
            SELECT 
              scraper_name,
              COUNT(*) as events_found
            FROM discovered_events 
            WHERE discovery_run_id = $1
            GROUP BY scraper_name
          ) de ON s.name = de.scraper_name
          WHERE ss.discovery_run_id = $1
          ORDER BY ss.completed_at DESC
        `, [discoveryRun.id]);
        
        discoveryRunsWithScrapers.push({
          discoveryRunId: discoveryRun.id,
          startedAt: discoveryRun.started_at,
          completedAt: discoveryRun.completed_at,
          totalEventsFound: totalEventsFound,
          triggerType: discoveryRun.trigger_type,
          status: discoveryRun.status,
          scraperRuns: scraperStats.rows
        });
      }

      res.json(discoveryRunsWithScrapers);

    } catch (error) {
      console.error('Error getting scraper runs:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      res.status(500).json({ 
        error: 'Failed to get scraper runs',
        details: error.message,
        type: error.name
      });
    }
  });

  // Get discovered events for a specific discovery run with filter outcomes
  router.get('/discovery-run/:runId/events', async (req, res) => {
    try {
      const discoveryRunId = parseInt(req.params.runId);
      
      // Get all discovered events for this run from the new table
      const discoveredEvents = await database.getDiscoveredEventsByRun(discoveryRunId);
      
      // Transform to match expected frontend format
      const eventsWithFilterResults = discoveredEvents.map(event => {
        // Handle both string and object cases for event_data
        let eventData = {};
        if (event.event_data) {
          try {
            eventData = typeof event.event_data === 'string' ? 
              JSON.parse(event.event_data) : 
              event.event_data;
          } catch (e) {
            console.log('Event data parsing error:', e.message);
            eventData = { title: event.event_title }; // fallback
          }
        }
        
        let filterResults = { passed: false, reasons: ['No filter data'] };
        
        if (event.filter_results) {
          try {
            // Handle both string and object cases
            filterResults = typeof event.filter_results === 'string' ? 
              JSON.parse(event.filter_results) : 
              event.filter_results;
          } catch (e) {
            console.log('Filter results parsing error:', e.message, 'Data:', event.filter_results);
            filterResults = { passed: false, reasons: ['Invalid filter data'] };
          }
        }
        
        return {
          id: `${event.id}-${event.event_id}`, // Use discovered_events.id + event_id for unique React key
          event_id: event.event_id, // Keep original event_id for reference
          title: event.event_title,
          date: event.event_date,
          cost: event.event_cost,
          source: event.scraper_name,
          venue_name: event.venue_name,
          filterResults: filterResults,
          emailStatus: event.is_duplicate ? 
            "🔄 Duplicate event (not processed)" : 
            (filterResults.passed ? "📧 Eligible for approval" : "❌ Filtered out"),
          isDuplicate: event.is_duplicate,
          duplicateOf: event.duplicate_of,
          discovered_at: event.discovered_at,
          total_score: eventData.total_score || null
        };
      });

      res.json(eventsWithFilterResults);

    } catch (error) {
      console.error('Error getting discovery run events:', error);
      res.status(500).json({ error: 'Failed to get discovery run events' });
    }
  });

  // Get recent automation activity
  router.get('/activity', async (req, res) => {
    try {
      const activities = [];

      // Get recent registrations
      const recentRegistrations = await database.query(`
        SELECT 
          r.*,
          e.title as event_title,
          e.venue_name
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        ORDER BY r.created_at DESC
        LIMIT 20
      `);

      // Get recent event discoveries  
      const recentDiscoveries = await database.query(`
        SELECT *
        FROM events 
        WHERE status = 'discovered'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Get recent email approvals (fallback to events table if email_approvals doesn't exist)
      let recentEmailApprovals = { rows: [] };
      let recentEmailsSent = { rows: [] };
      
      try {
        recentEmailApprovals = await database.query(`
          SELECT ea.*, e.title as event_title
          FROM email_approvals ea
          JOIN events e ON ea.event_id = e.id 
          WHERE ea.status = 'approved'
          ORDER BY ea.response_at DESC
          LIMIT 10
        `);
        
        recentEmailsSent = await database.query(`
          SELECT ea.*, e.title as event_title
          FROM email_approvals ea
          JOIN events e ON ea.event_id = e.id 
          WHERE ea.status = 'sent'
          ORDER BY ea.sent_at DESC
          LIMIT 5
        `);
      } catch (error) {
        // Fallback to events table for now
        recentEmailApprovals = await database.query(`
          SELECT id, title as event_title, updated_at as response_at
          FROM events 
          WHERE status = 'approved'
          ORDER BY updated_at DESC
          LIMIT 10
        `);
      }

      // Process registrations
      recentRegistrations.rows.forEach(reg => {
        activities.push({
          id: `reg-${reg.id}`,
          type: reg.success ? 'registration' : 'failure',
          message: reg.success 
            ? `Successfully registered for "${reg.event_title}"`
            : `Failed to register for "${reg.event_title}" - ${reg.error_message || 'unknown error'}`,
          timestamp: new Date(reg.created_at),
          status: reg.success ? 'success' : 'error',
          rule: getAdapterDisplayName(reg.adapter_type)
        });
      });

      // Process discoveries (limit to recent ones with count)
      const discoveryCount = recentDiscoveries.rows.length;
      if (discoveryCount > 0) {
        const latestDiscovery = recentDiscoveries.rows[0];
        activities.push({
          id: `discovery-${latestDiscovery.id}`,
          type: 'discovery',
          message: `Discovered ${discoveryCount} new events including "${latestDiscovery.title}"`,
          timestamp: new Date(latestDiscovery.created_at),
          status: 'success',
          rule: 'Event discovery system'
        });
      }

      // Process email approvals
      recentEmailApprovals.rows.forEach(approval => {
        activities.push({
          id: `email-approval-${approval.id}`,
          type: 'email_approved', 
          message: `Approved via email: "${approval.event_title}"`,
          timestamp: new Date(approval.response_at || approval.updated_at),
          status: 'success',
          rule: 'Email response processing'
        });
      });
      
      // Process emails sent for approval (only if we have actual email_approvals data)
      if (recentEmailsSent.rows.length > 0 && recentEmailsSent.rows[0].sent_at) {
        recentEmailsSent.rows.forEach(approval => {
          activities.push({
            id: `email-sent-${approval.id}`,
            type: 'email_sent',
            message: `Email sent for approval: "${approval.event_title}"`,
            timestamp: new Date(approval.sent_at),
            status: 'success',
            rule: 'Email approval workflow'
          });
        });
      }

      // Sort by timestamp (newest first) and limit
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.json(activities.slice(0, 15));

    } catch (error) {
      console.error('Error getting automation activity:', error);
      res.status(500).json({ error: 'Failed to get automation activity' });
    }
  });

  // Get system health
  router.get('/health', async (req, res) => {
    try {
      if (!taskScheduler) {
        return res.json({
          systemStatus: 'unavailable',
          components: {},
          lastHealthCheck: new Date().toISOString()
        });
      }

      // Get system health score
      const healthScore = await taskScheduler.calculateSystemHealthScore();
      const schedulerStatus = taskScheduler.getStatus();
      
      // Check external service health
      const weatherServiceHealthy = await checkWeatherService();
      const googleIntegrationHealthy = await checkGoogleIntegration();
      
      // Get recent statistics for performance metrics  
      const registrationStats = await database.getRegistrationStats('24 hours');
      
      res.json({
        systemStatus: healthScore.description.toLowerCase(),
        healthScore: healthScore.score,
        components: {
          database: healthScore.details.database?.healthy || false,
          scrapers: healthScore.details.discoveryEngine?.healthy || false, 
          googleIntegration: googleIntegrationHealthy,
          emailService: healthScore.details.emailService?.healthy || false,
          calendarIntegration: healthScore.details.calendarIntegration?.healthy || false,
          databasePerformance: healthScore.details.databasePerformance?.healthy || false,
          systemResources: healthScore.details.systemResources?.healthy || false,
          scheduler: schedulerStatus.running,
          weatherService: weatherServiceHealthy
        },
        performance: {
          discoveryEngineScore: healthScore.details.discoveryEngine?.score || 0,
          basicDatabaseResponseTime: `${healthScore.details.databasePerformance?.details?.basicQueryTime || 0}ms`,
          complexDatabaseResponseTime: `${healthScore.details.databasePerformance?.details?.complexQueryTime || 0}ms`,
          memoryUsageMB: healthScore.details.systemResources?.details?.memoryUsageMB || 0,
          memoryTotalMB: healthScore.details.systemResources?.details?.memoryTotalMB || 0,
          uptimeHours: healthScore.details.systemResources?.details?.uptimeHours || 0
        },
        lastHealthCheck: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({ error: 'Failed to get system health' });
    }
  });

  // Get current discovery progress
  router.get('/discovery-progress', async (req, res) => {
    try {
      const { scheduler } = req.app.locals;
      
      if (!scheduler) {
        return res.json({
          running: false,
          progress: null
        });
      }
      
      const progress = scheduler.getDiscoveryProgress();
      res.json(progress);
      
    } catch (error) {
      console.error('Error getting discovery progress:', error);
      res.status(500).json({ error: 'Failed to get discovery progress' });
    }
  });

  // Get latest discovery run with comprehensive breakdown
  router.get('/latest-discovery-run', async (req, res) => {
    try {
      // Get the latest discovery run with full details
      const latestRunResult = await database.query(`
        SELECT
          id,
          trigger_type,
          started_at,
          completed_at,
          CASE
            WHEN completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))
            ELSE NULL
          END as duration_seconds,
          scrapers_count,
          events_found,
          events_saved,
          events_duplicated,
          status,
          error_message
        FROM discovery_runs
        ORDER BY started_at DESC
        LIMIT 1
      `);

      if (latestRunResult.rows.length === 0) {
        return res.json({
          hasData: false,
          message: 'No discovery runs found'
        });
      }

      const latestRun = latestRunResult.rows[0];
      const runId = latestRun.id;

      // Get events breakdown: passed vs filtered
      const eventsBreakdownResult = await database.query(`
        SELECT
          COUNT(*) as total_events,
          SUM(CASE WHEN (filter_results ->> 'passed')::boolean = true THEN 1 ELSE 0 END) as events_passed_filters,
          SUM(CASE WHEN (filter_results ->> 'passed')::boolean = false THEN 1 ELSE 0 END) as events_filtered_out
        FROM discovered_events
        WHERE discovery_run_id = $1
      `, [runId]);

      const eventsBreakdown = eventsBreakdownResult.rows[0];

      // Get approval pipeline breakdown
      const approvalBreakdownResult = await database.query(`
        SELECT
          COUNT(CASE WHEN status = 'proposed' THEN 1 END) as events_sent_for_approval,
          COUNT(CASE WHEN status IN ('proposed', 'sent') THEN 1 END) as events_pending_approval,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as events_approved
        FROM events
        WHERE discovery_run_id = $1
      `, [runId]);

      const approvalBreakdown = approvalBreakdownResult.rows[0];

      // Get scraper breakdown
      const scraperBreakdownResult = await database.query(`
        SELECT
          s.display_name as scraper_name,
          ss.events_found,
          ss.success,
          ss.error_message,
          ss.execution_time_ms,
          COALESCE(de.events_discovered, 0) as events_saved
        FROM scraper_stats ss
        JOIN scrapers s ON s.id = ss.scraper_id
        LEFT JOIN (
          SELECT 
            scraper_name,
            COUNT(*) as events_discovered
          FROM discovered_events 
          WHERE discovery_run_id = $1
          GROUP BY scraper_name
        ) de ON s.name = de.scraper_name
        WHERE ss.discovery_run_id = $1
        ORDER BY ss.events_found DESC
      `, [runId]);

      const response = {
        hasData: true,
        discoveryRun: {
          id: latestRun.id,
          triggerType: latestRun.trigger_type,
          startedAt: latestRun.started_at,
          completedAt: latestRun.completed_at,
          durationSeconds: latestRun.duration_seconds,
          scrapersCount: latestRun.scrapers_count,
          eventsFound: latestRun.events_found,
          eventsSaved: latestRun.events_saved,
          eventsDuplicated: latestRun.events_duplicated,
          status: latestRun.status,
          errorMessage: latestRun.error_message
        },
        eventsBreakdown: {
          totalEvents: parseInt(eventsBreakdown.total_events || 0),
          eventsPassedFilters: parseInt(eventsBreakdown.events_passed_filters || 0),
          eventsFilteredOut: parseInt(eventsBreakdown.events_filtered_out || 0)
        },
        approvalPipeline: {
          eventsSentForApproval: parseInt(approvalBreakdown.events_sent_for_approval || 0),
          eventsPendingApproval: parseInt(approvalBreakdown.events_pending_approval || 0),
          eventsApproved: parseInt(approvalBreakdown.events_approved || 0)
        },
        scraperBreakdown: scraperBreakdownResult.rows.map(scraper => ({
          scraperName: scraper.scraper_name,
          eventsFound: parseInt(scraper.events_found || 0),
          eventsSaved: parseInt(scraper.events_saved || 0),
          success: scraper.success,
          errorMessage: scraper.error_message,
          executionTimeMs: parseInt(scraper.execution_time_ms || 0)
        }))
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting latest discovery run:', error);
      res.status(500).json({ error: 'Failed to get latest discovery run details' });
    }
  });

  // Manual discovery trigger endpoint
  router.post('/run-discovery', async (req, res) => {
    try {
      const { scheduler, logger } = req.app.locals;
      
      if (!scheduler) {
        return res.status(500).json({
          success: false,
          error: 'Scheduler not available'
        });
      }

      logger.info('🚀 Manual event discovery triggered via API');
      
      // Run discovery in background and return immediately (manual = true)
      scheduler.runEventDiscovery(true).then(() => {
        logger.info('✅ Manual event discovery completed successfully');
      }).catch(error => {
        logger.error('❌ Manual event discovery failed:', error.message);
      });
      
      res.json({
        success: true,
        message: 'Event discovery started successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      req.app.locals.logger.error('Error starting manual discovery:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to start event discovery'
      });
    }
  });

  return router;
}

// Helper functions
function calculateNextDiscoveryRun() {
  // Discovery runs every 6 hours at 0:00, 6:00, 12:00, 18:00
  const now = new Date();
  const currentHour = now.getHours();
  
  // Find next scheduled hour (0, 6, 12, 18)
  const scheduleHours = [0, 6, 12, 18];
  let nextHour = scheduleHours.find(hour => hour > currentHour);
  
  // If no hour found today, use first hour tomorrow
  if (!nextHour) {
    nextHour = scheduleHours[0];
  }
  
  // Calculate next run time
  const nextRun = new Date(now);
  if (nextHour === 0 && currentHour >= 18) {
    // Tomorrow at midnight
    nextRun.setDate(nextRun.getDate() + 1);
  }
  nextRun.setHours(nextHour, 0, 0, 0);
  
  // Calculate time difference
  const diffMs = nextRun.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours === 0) {
    return `${diffMinutes} minutes`;
  } else if (diffHours < 24) {
    return diffMinutes > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffHours}h`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

function getAdapterDisplayName(adapterType) {
  const displayNames = {
    'CalAcademyAdapter': 'Auto-register for Cal Academy events under $25',
    'SFLibraryAdapter': 'Auto-register for free SF Library events', 
    'SFRecParksAdapter': 'SF Recreation & Parks registration',
    'ExploraoriumAdapter': 'Exploratorium event automation',
    'CommunityEventsAdapter': 'Community events automation',
    'GenericAdapter': 'Generic registration automation'
  };
  
  return displayNames[adapterType] || adapterType || 'Unknown automation rule';
}

// Email notification function for scraper requests
async function sendScraperRequestEmail(domain, description, requestId, logger) {
  const gmailClient = new GmailMCPClient(logger);
  
  try {
    await gmailClient.init();
    
    const subject = `🤖 New Scraper Request: ${domain}`;
    const body = `Hi Sheridan,

A new scraper has been requested for the family event planner system:

**Domain:** ${domain}
**Description:** ${description || 'No description provided'}
**Request ID:** ${requestId}
**Timestamp:** ${new Date().toLocaleString()}

You can review this request and create the scraper when you have time.

Thanks!
Family Event Planner System`;

    const emailResult = await gmailClient.sendEmail(
      ['sheridan.gray@gmail.com'], 
      subject, 
      body
    );
    
    logger.info(`✅ Scraper request email sent successfully for ${domain}`);
    return emailResult;
    
  } catch (error) {
    logger.error(`❌ Failed to send scraper request email for ${domain}:`, error.message);
    throw error;
  }
}

module.exports = createAutomationRouter;