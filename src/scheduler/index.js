const cron = require('node-cron');
const { config } = require('../config');
const ReportingService = require('../services/reporting');

class TaskScheduler {
  constructor(logger, database, scraperManager, eventScorer, eventFilter, smsManager, registrationAutomator, calendarManager, unifiedNotifications) {
    this.logger = logger;
    this.database = database;
    this.scraperManager = scraperManager;
    this.eventScorer = eventScorer;
    this.eventFilter = eventFilter;
    this.smsManager = smsManager;
    this.registrationAutomator = registrationAutomator;
    this.calendarManager = calendarManager;
    this.unifiedNotifications = unifiedNotifications;
    this.reportingService = new ReportingService(logger);
    this.tasks = [];
    
    // Discovery progress tracking
    this.discoveryProgress = {
      running: false,
      discoveryRunId: null,
      totalScrapers: 0,
      completedScrapers: 0,
      currentScraper: null,
      scraperResults: [],
      startTime: null
    };
  }

  start() {
    this.logger.info('Starting task scheduler...');
    
    this.scheduleEventDiscovery();
    this.scheduleEventProcessing();
    this.scheduleApprovalTimeouts();
    this.scheduleRegistrationProcessing();
    this.scheduleCalendarSync();
    // this.scheduleDailyReports(); // Disabled - daily report emails removed
    this.scheduleHealthChecks();
    
    this.logger.info(`Task scheduler started with ${this.tasks.length} scheduled tasks`);
  }

  scheduleEventDiscovery() {
    const scanFrequency = config.discovery.scanFrequencyHours;
    const cronExpression = `0 */${scanFrequency} * * *`; // Every N hours
    
    const task = cron.schedule(cronExpression, async () => {
      try {
        this.logger.info('Starting scheduled event discovery...');
        await this.runEventDiscovery();
      } catch (error) {
        this.logger.error('Error in scheduled event discovery:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Event Discovery', task, frequency: `Every ${scanFrequency} hours` });
    this.logger.info(`Scheduled event discovery: every ${scanFrequency} hours`);
  }

  scheduleEventProcessing() {
    const task = cron.schedule('0 9 * * *', async () => {
      try {
        this.logger.info('Starting scheduled event processing...');
        await this.runEventProcessing();
      } catch (error) {
        this.logger.error('Error in scheduled event processing:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Event Processing', task, frequency: 'Daily at 9:00 AM' });
    this.logger.info('Scheduled event processing: daily at 9:00 AM');
  }

  scheduleApprovalTimeouts() {
    const task = cron.schedule('0 */4 * * *', async () => {
      try {
        this.logger.info('Checking for approval timeouts...');
        await this.checkApprovalTimeouts();
      } catch (error) {
        this.logger.error('Error checking approval timeouts:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Approval Timeouts', task, frequency: 'Every 4 hours' });
    this.logger.info('Scheduled approval timeout checks: every 4 hours');
  }

  scheduleRegistrationProcessing() {
    const task = cron.schedule('*/30 * * * *', async () => {
      try {
        this.logger.info('Processing approved events for registration...');
        await this.processRegistrations();
      } catch (error) {
        this.logger.error('Error processing registrations:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Registration Processing', task, frequency: 'Every 30 minutes' });
    this.logger.info('Scheduled registration processing: every 30 minutes');
  }

  scheduleCalendarSync() {
    const task = cron.schedule('0 10 * * *', async () => {
      try {
        this.logger.info('Syncing booked events to calendars...');
        await this.syncCalendars();
      } catch (error) {
        this.logger.error('Error syncing calendars:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Calendar Sync', task, frequency: 'Daily at 10:00 AM' });
    this.logger.info('Scheduled calendar sync: daily at 10:00 AM');
  }

  // scheduleDailyReports() {
  //   const task = cron.schedule('0 18 * * *', async () => {
  //     try {
  //       this.logger.info('Generating daily report...');
  //       await this.generateDailyReport();
  //     } catch (error) {
  //       this.logger.error('Error generating daily report:', error.message);
  //     }
  //   });
  //   
  //   this.tasks.push({ name: 'Daily Reports', task, frequency: 'Daily at 6:00 PM' });
  //   this.logger.info('Scheduled daily reports: daily at 6:00 PM');
  // }

  scheduleHealthChecks() {
    const task = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        this.logger.error('Error in health check:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Health Checks', task, frequency: 'Every 15 minutes' });
    this.logger.debug('Scheduled health checks: every 15 minutes');
  }

  async runEventDiscovery(isManual = false) {
    const startTime = Date.now();
    let discoveryRunId;
    let enabledScrapers = [];
    
    try {
      // Create a new discovery run record
      discoveryRunId = await this.database.createDiscoveryRun(isManual ? 'manual' : 'scheduled');
      
      // Get enabled scrapers from database with their IDs
      const enabledScrapersResult = await this.database.query(`
        SELECT id, name, display_name FROM scrapers WHERE enabled = true ORDER BY name
      `);
      enabledScrapers = enabledScrapersResult.rows;
      
      // Initialize progress tracking
      this.discoveryProgress = {
        running: true,
        discoveryRunId: discoveryRunId,
        totalScrapers: enabledScrapers.length,
        completedScrapers: 0,
        currentScraper: null,
        scraperResults: [],
        startTime: new Date()
      };
      
      this.logger.info(`Running discovery #${discoveryRunId} with ${enabledScrapers.length} enabled scrapers: ${enabledScrapers.map(s => s.name).join(', ')}`);
      
      // Scrape all enabled sources and track performance
      const allEvents = [];
      for (const scraper of enabledScrapers) {
        const scraperStartTime = Date.now();
        let success = false;
        let errorMessage = null;
        let eventsFound = 0;
        
        // Update progress - scraper starting
        this.discoveryProgress.currentScraper = {
          name: scraper.name,
          displayName: scraper.display_name,
          status: 'running',
          startedAt: new Date()
        };
        
        try {
          const events = await this.scraperManager.scrapeSource(scraper.name, discoveryRunId);
          allEvents.push(...events);
          eventsFound = events.length;
          success = true;
          this.logger.info(`${scraper.name}: ${events.length} events found`);
        } catch (error) {
          errorMessage = error.message;
          this.logger.error(`Error with scraper ${scraper.name}:`, error.message);
          this.logger.error(`Full error details for ${scraper.name}:`, error);
          this.logger.error(`Error stack for ${scraper.name}:`, error.stack);
        }
        
        const executionTime = Date.now() - scraperStartTime;
        
        // Update progress - scraper completed
        this.discoveryProgress.completedScrapers++;
        this.discoveryProgress.scraperResults.push({
          name: scraper.name,
          displayName: scraper.display_name,
          success: success,
          eventsFound: eventsFound,
          executionTime: executionTime,
          errorMessage: errorMessage
        });
        this.discoveryProgress.currentScraper = null;
        
        // Record scraper statistics
        try {
          await this.database.query(`
            INSERT INTO scraper_stats (scraper_id, discovery_run_id, events_found, success, error_message, execution_time_ms, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [scraper.id, discoveryRunId, eventsFound, success, errorMessage, executionTime, new Date(scraperStartTime), new Date()]);
        } catch (statsError) {
          this.logger.error(`Failed to record stats for ${scraper.name}:`, statsError.message);
        }
      }
      
      if (allEvents.length > 0) {
        const filteredEvents = await this.eventFilter.filterAndSort(allEvents, {
          calendarChecker: this.calendarManager,
          database: this.database,
          prioritizeUrgent: true
        });
        
        const scoredEvents = await this.eventScorer.scoreEvents(filteredEvents);
        
        const topEvents = scoredEvents.slice(0, 10);
        let sentCount = 0;
        const maxEventsToSend = isManual ? topEvents.length : config.discovery.eventsPerDayMax;
        
        this.logger.info(`${isManual ? 'Manual' : 'Scheduled'} discovery: sending up to ${maxEventsToSend} events for approval`);
        this.logger.info(`📊 Notification service status: unifiedNotifications=${!!this.unifiedNotifications}, smsManager=${!!this.smsManager}`);
        
        for (let i = 0; i < topEvents.length; i++) {
          const event = topEvents[i];
          this.logger.info(`📧 Processing event ${i+1}/${topEvents.length}: "${event.title}" (${event.date})`);
          
          try {
            // Always prefer email-only unified notification service over SMS
            if (this.unifiedNotifications) {
              // Email-only mode - use unified notification service
              this.logger.info(`✅ Using unified notification service for: ${event.title}`);
              
              const shouldSend = isManual || await this.unifiedNotifications.shouldSendEvent();
              this.logger.info(`🔍 Should send event? ${shouldSend} (isManual=${isManual})`);
              
              if (shouldSend) {
                this.logger.info(`📤 Sending approval request for: ${event.title}`);
                await this.unifiedNotifications.sendEventForApproval(event);
                sentCount++;
                this.logger.info(`✅ Successfully sent email for: ${event.title} (count: ${sentCount}/${maxEventsToSend})`);
              } else {
                this.logger.info(`⏭️ Skipping event due to rate limiting: ${event.title}`);
              }
            } else if (this.smsManager) {
              // Fallback to SMS only if email notifications unavailable
              this.logger.warn(`📱 Falling back to SMS for: ${event.title} (email notifications unavailable)`);
              if (isManual || await this.smsManager.shouldSendEvent()) {
                await this.smsManager.sendEventForApproval(event);
                sentCount++;
                this.logger.info(`✅ Successfully sent SMS for: ${event.title} (count: ${sentCount}/${maxEventsToSend})`);
              }
            } else {
              this.logger.error('❌ No notification service available - cannot send approval requests (smsManager and unifiedNotifications are both null)');
              break;
            }
            
            if (sentCount >= maxEventsToSend) {
              this.logger.info(`🛑 Reached maximum events to send (${maxEventsToSend}), stopping`);
              break;
            }
            
            this.logger.info(`⏰ Waiting 2 seconds before next event...`);
            await this.delay(2000);
            
          } catch (emailError) {
            this.logger.error(`❌ Failed to send notification for "${event.title}":`, emailError.message);
            this.logger.error(`📍 Error stack:`, emailError.stack);
            // Continue with next event rather than failing entire discovery
          }
        }
        
        this.logger.info(`Event discovery completed: ${allEvents.length} discovered, ${filteredEvents.length} filtered, ${sentCount} sent for approval`);
        
        // Update discovery run with final stats
        await this.database.updateDiscoveryRun(discoveryRunId, {
          status: 'completed',
          scrapers_count: enabledScrapers.length,
          events_found: allEvents.length,
          events_saved: filteredEvents.length,
          events_duplicated: allEvents.length - filteredEvents.length
        });
      } else {
        this.logger.info('Event discovery completed: no new events found');
        
        // Update discovery run with zero stats
        await this.database.updateDiscoveryRun(discoveryRunId, {
          status: 'completed',
          scrapers_count: enabledScrapers.length,
          events_found: 0,
          events_saved: 0,
          events_duplicated: 0
        });
      }
      
      // Mark discovery as completed
      this.discoveryProgress.running = false;
      
    } catch (error) {
      this.logger.error('Event discovery failed:', error.message);
      
      // Mark discovery run as failed
      try {
        await this.database.updateDiscoveryRun(discoveryRunId, {
          status: 'failed',
          error_message: error.message
        });
      } catch (updateError) {
        this.logger.error('Failed to update discovery run status:', updateError.message);
      }
      
      // Mark discovery as failed
      this.discoveryProgress.running = false;
    }
    
    const duration = Date.now() - startTime;
    this.logger.info(`Event discovery took ${duration}ms`);
  }

  async runSingleScraper(scraperName, isManual = true) {
    const startTime = Date.now();
    let discoveryRunId;
    let success = false;
    let eventsFound = 0;
    let errorMessage = null;
    
    try {
      // Get scraper ID from database
      const scraperResult = await this.database.query(`
        SELECT id FROM scrapers WHERE name = $1
      `, [scraperName]);
      
      if (scraperResult.rows.length === 0) {
        throw new Error(`Scraper ${scraperName} not found in database`);
      }
      
      const scraperId = scraperResult.rows[0].id;
      
      // Create a discovery run for this individual scraper
      discoveryRunId = await this.database.createDiscoveryRun('manual');
      this.logger.info(`Running individual scraper discovery #${discoveryRunId} for ${scraperName}`);
      
      // Run the scraper with discovery run tracking
      const events = await this.scraperManager.scrapeSource(scraperName, discoveryRunId);
      eventsFound = events.length;
      success = true;
      
      if (events.length > 0) {
        const filteredEvents = await this.eventFilter.filterAndSort(events, {
          calendarChecker: this.calendarManager,
          database: this.database,
          prioritizeUrgent: true
        });
        
        const scoredEvents = await this.eventScorer.scoreEvents(filteredEvents);
        
        const topEvents = scoredEvents.slice(0, 5);
        let sentCount = 0;
        const maxEventsToSend = isManual ? topEvents.length : Math.min(5, config.discovery.eventsPerDayMax);
        
        this.logger.info(`${isManual ? 'Manual' : 'Scheduled'} single scraper: sending up to ${maxEventsToSend} events for approval`);
        
        for (const event of topEvents) {
          if (this.unifiedNotifications) {
            this.logger.info(`Using email-only notification service for: ${event.title}`);
            if (isManual || await this.unifiedNotifications.shouldSendEvent()) {
              await this.unifiedNotifications.sendEventForApproval(event);
              sentCount++;
            }
          } else if (this.smsManager) {
            this.logger.warn(`Falling back to SMS for: ${event.title} (email notifications unavailable)`);
            if (isManual || await this.smsManager.shouldSendEvent()) {
              await this.smsManager.sendEventForApproval(event);
              sentCount++;
            }
          } else {
            this.logger.error('No notification service available - cannot send approval requests');
            break;
          }
          
          if (sentCount >= maxEventsToSend) {
            break;
          }
          
          await this.delay(2000);
        }
        
        this.logger.info(`Single scraper discovery completed for ${scraperName}: ${events.length} discovered, ${filteredEvents.length} filtered, ${sentCount} sent for approval`);
        
        // Record scraper statistics with discovery run ID
        const executionTime = Date.now() - startTime;
        try {
          await this.database.query(`
            INSERT INTO scraper_stats (scraper_id, discovery_run_id, events_found, success, error_message, execution_time_ms, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [scraperId, discoveryRunId, eventsFound, success, errorMessage, executionTime, new Date(startTime), new Date()]);
        } catch (statsError) {
          this.logger.error(`Failed to record stats for ${scraperName}:`, statsError.message);
        }
        
        // Complete the discovery run with success
        await this.database.updateDiscoveryRun(discoveryRunId, {
          status: 'completed',
          scrapers_count: 1,
          events_found: events.length,
          events_saved: filteredEvents.length,
          events_duplicated: events.length - filteredEvents.length
        });
        
        return {
          success: true,
          scraperName,
          eventsFound: events.length,
          eventsFiltered: filteredEvents.length,
          eventsSent: sentCount,
          discoveryRunId: discoveryRunId
        };
        
      } else {
        this.logger.info(`Single scraper discovery completed for ${scraperName}: no new events found`);
        
        // Record scraper statistics with discovery run ID
        const executionTime = Date.now() - startTime;
        try {
          await this.database.query(`
            INSERT INTO scraper_stats (scraper_id, discovery_run_id, events_found, success, error_message, execution_time_ms, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [scraperId, discoveryRunId, eventsFound, success, errorMessage, executionTime, new Date(startTime), new Date()]);
        } catch (statsError) {
          this.logger.error(`Failed to record stats for ${scraperName}:`, statsError.message);
        }
        
        // Complete the discovery run with zero results
        await this.database.updateDiscoveryRun(discoveryRunId, {
          status: 'completed',
          scrapers_count: 1,
          events_found: 0,
          events_saved: 0,
          events_duplicated: 0
        });
        
        return {
          success: true,
          scraperName,
          eventsFound: 0,
          eventsFiltered: 0,
          eventsSent: 0,
          discoveryRunId: discoveryRunId
        };
      }
      
    } catch (error) {
      errorMessage = error.message;
      this.logger.error(`Single scraper discovery failed for ${scraperName}:`, error.message);
      
      // Record failed scraper statistics
      const executionTime = Date.now() - startTime;
      try {
        if (discoveryRunId) {
          await this.database.query(`
            INSERT INTO scraper_stats (scraper_id, discovery_run_id, events_found, success, error_message, execution_time_ms, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [scraperId, discoveryRunId, eventsFound, success, errorMessage, executionTime, new Date(startTime), new Date()]);
        }
      } catch (statsError) {
        this.logger.error(`Failed to record failed stats for ${scraperName}:`, statsError.message);
      }
      
      // Mark discovery run as failed
      try {
        if (discoveryRunId) {
          await this.database.updateDiscoveryRun(discoveryRunId, {
            status: 'failed',
            error_message: error.message
          });
        }
      } catch (updateError) {
        this.logger.error('Failed to update discovery run status:', updateError.message);
      }
      
      return {
        success: false,
        scraperName,
        error: error.message,
        discoveryRunId: discoveryRunId
      };
    }
    
    const duration = Date.now() - startTime;
    this.logger.info(`Single scraper discovery for ${scraperName} took ${duration}ms`);
  }

  async runEventProcessing() {
    try {
      const discoveredEvents = await this.database.getEventsByStatus('discovered');
      
      if (discoveredEvents.length > 0) {
        const filteredEvents = await this.eventFilter.filterAndSort(discoveredEvents, {
          calendarChecker: this.calendarManager,
          database: this.database
        });
        
        const scoredEvents = await this.eventScorer.scoreEvents(filteredEvents);
        
        this.logger.info(`Processed ${discoveredEvents.length} events: ${scoredEvents.length} remain viable`);
      }
      
    } catch (error) {
      this.logger.error('Event processing failed:', error.message);
    }
  }

  async checkApprovalTimeouts() {
    try {
      // Always prefer email-only unified notifications over SMS
      let timeoutCount = 0;
      let reminderCount = 0;
      
      if (this.unifiedNotifications) {
        // Email-only mode - use unified notification service
        const emailTimeouts = await this.unifiedNotifications.checkTimeouts();
        timeoutCount = emailTimeouts.email ? emailTimeouts.email.length : 0;
        
        const emailReminders = await this.unifiedNotifications.sendReminders();
        reminderCount = emailReminders || 0;
      } else if (this.smsManager) {
        // Fallback to SMS timeouts if email notifications unavailable
        this.logger.warn('Using SMS for timeout checks (email notifications unavailable)');
        timeoutCount = await this.smsManager.checkTimeouts();
        reminderCount = await this.smsManager.sendReminders();
      }
      
      if (timeoutCount > 0 || reminderCount > 0) {
        this.logger.info(`Approval timeout check: ${timeoutCount} timeouts, ${reminderCount} reminders sent`);
      }
      
    } catch (error) {
      this.logger.error('Approval timeout check failed:', error.message);
    }
  }

  async processRegistrations() {
    try {
      const results = await this.registrationAutomator.processApprovedEvents();
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (results.length > 0) {
        this.logger.info(`Registration processing: ${successCount} successful, ${failureCount} failed`);
        
        // Clear LLM cache periodically to prevent memory buildup
        if (this.eventFilter && this.eventFilter.llmEvaluator) {
          this.eventFilter.llmEvaluator.clearCache();
        }
        
        for (const result of results) {
          if (result.success) {
            try {
              await this.calendarManager.createCalendarEvent(result.event);
              await this.database.updateEventStatus(result.event.id, 'scheduled');
            } catch (error) {
              this.logger.error(`Failed to create calendar event for ${result.event.title}:`, error.message);
            }
          }
        }
      }
      
    } catch (error) {
      this.logger.error('Registration processing failed:', error.message);
    }
  }

  async syncCalendars() {
    try {
      const bookedEvents = await this.database.getEventsByStatus('booked');
      
      for (const event of bookedEvents) {
        try {
          await this.calendarManager.createCalendarEvent(event);
          await this.database.updateEventStatus(event.id, 'scheduled');
          this.logger.info(`Created calendar event for: ${event.title}`);
        } catch (error) {
          this.logger.error(`Failed to sync calendar for ${event.title}:`, error.message);
        }
      }
      
      if (bookedEvents.length > 0) {
        this.logger.info(`Calendar sync completed: ${bookedEvents.length} events processed`);
      }
      
    } catch (error) {
      this.logger.error('Calendar sync failed:', error.message);
    }
  }

  async generateDailyReport() {
    try {
      const stats = await this.getDailyStats();
      
      const report = `
=== Daily Family Event Planner Report ===
Date: ${new Date().toDateString()}

📊 Events Summary:
- Discovered: ${stats.discovered}
- Proposed: ${stats.proposed}
- Approved: ${stats.approved}
- Booked: ${stats.booked}
- Scheduled: ${stats.scheduled}

🎯 Today's Activity:
- New events found: ${stats.newToday}
- Approval requests sent: ${stats.sentToday}
- Events registered: ${stats.registeredToday}

⚠️ Attention Needed:
- Pending approvals: ${stats.pendingApprovals}
- Failed registrations: ${stats.failedRegistrations}
- Registration success rate: ${stats.registrationSuccessRate}%

💰 Cost Summary:
- Free events: ${stats.freeEvents}
- Paid events: ${stats.paidEvents}
- Total pending cost: $${stats.totalPendingCost}

🔄 System Health: ${stats.systemHealth}
      `;
      
      this.logger.info('Daily Report:\n' + report);
      
      // Save report to file
      try {
        const savedPath = await this.reportingService.saveDailyReport(report);
        this.logger.info(`Daily report saved to: ${savedPath}`);
        
        // Email the report
        const emailResult = await this.reportingService.emailReport(report);
        if (emailResult.success) {
          this.logger.info(`Daily report emailed to: ${emailResult.recipients.join(', ')}`);
        } else {
          this.logger.warn(`Email failed (${emailResult.reason}), but report saved to file`);
        }
      } catch (error) {
        this.logger.error('Error saving/emailing daily report:', error.message);
      }
      
    } catch (error) {
      this.logger.error('Daily report generation failed:', error.message);
    }
  }

  async getDailyStats() {
    const today = new Date().toDateString();
    
    try {
      const [allEvents, registrationStats] = await Promise.all([
        Promise.all([
          this.database.getEventsByStatus('discovered'),
          this.database.getEventsByStatus('proposed'),
          this.database.getEventsByStatus('approved'),
          this.database.getEventsByStatus('booked'),
          this.database.getEventsByStatus('scheduled')
        ]),
        this.database.getRegistrationStats('24 hours')
      ]);
      
      const [discovered, proposed, approved, booked, scheduled] = allEvents;
      
      // Calculate system health score
      const healthScore = await this.calculateSystemHealthScore();
      
      return {
        discovered: discovered.length,
        proposed: proposed.length,
        approved: approved.length,
        booked: booked.length,
        scheduled: scheduled.length,
        newToday: discovered.filter(e => new Date(e.created_at).toDateString() === today).length,
        sentToday: proposed.filter(e => new Date(e.updated_at).toDateString() === today).length,
        registeredToday: booked.filter(e => new Date(e.updated_at).toDateString() === today).length,
        pendingApprovals: proposed.length,
        failedRegistrations: registrationStats.failed,
        registrationSuccessRate: registrationStats.successRate,
        freeEvents: [...approved, ...booked].filter(e => e.cost === 0).length,
        paidEvents: [...approved, ...booked].filter(e => e.cost > 0).length,
        totalPendingCost: [...approved, ...booked].reduce((sum, e) => sum + (e.cost || 0), 0),
        systemHealth: healthScore.description
      };
    } catch (error) {
      this.logger.error('Error calculating daily stats:', error.message);
      return {};
    }
  }

  async runHealthCheck() {
    try {
      const health = {
        database: await this.checkDatabaseHealth(),
        discoveryEngine: await this.checkScrapersHealth(),
        mcp: await this.checkMCPHealth(),
        emailService: await this.checkEmailServiceHealth(),
        calendarIntegration: await this.checkCalendarIntegrationHealth(),
        databasePerformance: await this.checkDatabasePerformanceHealth(),
        systemResources: await this.checkSystemResourcesHealth()
      };
      
      const issues = Object.entries(health).filter(([key, value]) => !value.healthy);
      
      if (issues.length > 0) {
        this.logger.warn(`Health check issues: ${issues.map(([key]) => key).join(', ')}`);
      }
      
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
    }
  }

  async checkDatabaseHealth() {
    try {
      await this.database.getEventsByStatus('discovered');
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkScrapersHealth() {
    try {
      // Check recent scraper success rates from scraper_stats table
      const recentStatsQuery = `
        SELECT 
          s.name as scraper_name,
          s.enabled,
          COUNT(ss.id) as total_runs,
          COUNT(CASE WHEN ss.success = true THEN 1 END) as successful_runs,
          AVG(ss.execution_time_ms) as avg_execution_time,
          MAX(ss.completed_at) as last_run
        FROM scrapers s
        LEFT JOIN scraper_stats ss ON s.id = ss.scraper_id 
          AND ss.completed_at >= NOW() - INTERVAL '7 days'
        GROUP BY s.id, s.name, s.enabled
        ORDER BY s.name
      `;
      
      const statsResult = await this.database.query(recentStatsQuery);
      const scraperStats = statsResult.rows;
      
      // Check last discovery run status
      const lastRunQuery = `
        SELECT status, completed_at, error_message, events_found
        FROM discovery_runs 
        WHERE completed_at IS NOT NULL
        ORDER BY completed_at DESC 
        LIMIT 1
      `;
      
      const lastRunResult = await this.database.query(lastRunQuery);
      const lastRun = lastRunResult.rows[0];
      
      // Calculate overall health metrics
      const enabledScrapers = scraperStats.filter(s => s.enabled);
      const totalEnabledScrapers = enabledScrapers.length;
      
      // Count scrapers with recent successful runs (within 7 days)
      const recentlySuccessful = enabledScrapers.filter(s => 
        s.total_runs > 0 && (s.successful_runs / s.total_runs) >= 0.5
      ).length;
      
      // Check if last discovery run was successful and recent (within 24 hours)
      const lastRunSuccessful = lastRun && lastRun.status === 'completed' && !lastRun.error_message;
      const lastRunRecent = lastRun && 
        (new Date() - new Date(lastRun.completed_at)) < (24 * 60 * 60 * 1000);
      
      // Calculate health percentage
      let healthScore = 0;
      
      // 50% weight: Recent scraper success rate
      if (totalEnabledScrapers > 0) {
        healthScore += (recentlySuccessful / totalEnabledScrapers) * 50;
      }
      
      // 30% weight: Last discovery run successful
      if (lastRunSuccessful) {
        healthScore += 30;
      }
      
      // 20% weight: Last discovery run recent
      if (lastRunRecent) {
        healthScore += 20;
      }
      
      const isHealthy = healthScore >= 70; // Healthy if 70% or higher
      
      return {
        healthy: isHealthy,
        score: Math.round(healthScore),
        details: {
          totalScrapers: totalEnabledScrapers,
          recentlySuccessful: recentlySuccessful,
          lastRunStatus: lastRun ? lastRun.status : 'no runs',
          lastRunTime: lastRun ? lastRun.completed_at : null,
          lastRunRecent: lastRunRecent,
          scraperBreakdown: scraperStats.map(s => ({
            name: s.scraper_name,
            enabled: s.enabled,
            successRate: s.total_runs > 0 ? Math.round((s.successful_runs / s.total_runs) * 100) : 0,
            totalRuns: parseInt(s.total_runs),
            avgExecutionTime: s.avg_execution_time ? Math.round(s.avg_execution_time) : 0,
            lastRun: s.last_run
          }))
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        score: 0,
        details: {
          totalScrapers: 0,
          recentlySuccessful: 0,
          scraperBreakdown: []
        }
      };
    }
  }

  async checkMCPHealth() {
    try {
      const healthChecks = {
        gmail: { healthy: false, error: null },
        twilio: { healthy: false, error: null }
      };

      // Check Gmail MCP health
      try {
        if (this.calendarManager && typeof this.calendarManager.hasConflict === 'function') {
          // Test with a future date that won't have conflicts
          const testDate = new Date();
          testDate.setDate(testDate.getDate() + 365); // Test 1 year from now
          await this.calendarManager.hasConflict(testDate.toISOString());
          healthChecks.gmail.healthy = true;
        } else {
          healthChecks.gmail.error = 'Calendar manager not initialized or missing methods';
        }
      } catch (error) {
        healthChecks.gmail.error = error.message;
      }

      // Check Twilio MCP health
      try {
        if (this.smsManager && typeof this.smsManager.shouldSendEvent === 'function') {
          // Test basic functionality without sending actual SMS
          const canSend = await this.smsManager.shouldSendEvent();
          healthChecks.twilio.healthy = typeof canSend === 'boolean';
        } else {
          healthChecks.twilio.error = 'SMS manager not initialized or missing methods';
        }
      } catch (error) {
        healthChecks.twilio.error = error.message;
      }

      const overallHealthy = healthChecks.gmail.healthy && healthChecks.twilio.healthy;
      
      return {
        healthy: overallHealthy,
        details: healthChecks
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        details: { gmail: { healthy: false }, twilio: { healthy: false } }
      };
    }
  }

  async checkEmailServiceHealth() {
    try {
      // Check if unified notifications service is available and functional
      if (!this.unifiedNotifications) {
        return { 
          healthy: false, 
          error: 'Unified notifications service not initialized',
          details: { serviceAvailable: false }
        };
      }
      
      // Test basic functionality without sending actual emails
      const canSend = await this.unifiedNotifications.shouldSendEvent();
      const isResponsive = typeof canSend === 'boolean';
      
      // Check recent email sending success rate (if available)
      let recentSuccess = true;
      try {
        // This would check email_approvals table if it exists
        const emailStats = await this.database.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent
          FROM email_approvals 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        `);
        
        if (emailStats.rows[0] && emailStats.rows[0].total > 0) {
          const successRate = (emailStats.rows[0].sent / emailStats.rows[0].total) * 100;
          recentSuccess = successRate >= 80;
        }
      } catch (error) {
        // Table might not exist, that's ok
      }
      
      return {
        healthy: isResponsive && recentSuccess,
        details: {
          serviceAvailable: true,
          isResponsive: isResponsive,
          recentSuccess: recentSuccess
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        details: { serviceAvailable: false }
      };
    }
  }

  async checkCalendarIntegrationHealth() {
    try {
      // Check if calendar manager is available and functional
      if (!this.calendarManager) {
        return { 
          healthy: false, 
          error: 'Calendar manager not initialized',
          details: { serviceAvailable: false }
        };
      }
      
      // Test calendar functionality with a future date
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 365); // Test 1 year from now
      
      const hasConflictMethod = typeof this.calendarManager.hasConflict === 'function';
      let canCheckConflicts = false;
      
      if (hasConflictMethod) {
        try {
          await this.calendarManager.hasConflict(testDate.toISOString());
          canCheckConflicts = true;
        } catch (error) {
          // Calendar check failed
        }
      }
      
      return {
        healthy: hasConflictMethod && canCheckConflicts,
        details: {
          serviceAvailable: true,
          hasConflictMethod: hasConflictMethod,
          canCheckConflicts: canCheckConflicts
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        details: { serviceAvailable: false }
      };
    }
  }

  async checkDatabasePerformanceHealth() {
    try {
      const startTime = Date.now();
      
      // Test basic database operations
      await this.database.query('SELECT 1');
      const basicQueryTime = Date.now() - startTime;
      
      // Test more complex query (events table)
      const complexStart = Date.now();
      await this.database.query(`
        SELECT COUNT(*) FROM events 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
      const complexQueryTime = Date.now() - complexStart;
      
      // Check database size and table counts
      const tableStats = await this.database.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes
        FROM pg_stat_user_tables 
        WHERE tablename IN ('events', 'discovery_runs', 'scraper_stats')
      `);
      
      const isHealthy = basicQueryTime < 100 && complexQueryTime < 500; // ms thresholds
      
      return {
        healthy: isHealthy,
        details: {
          basicQueryTime: basicQueryTime,
          complexQueryTime: complexQueryTime,
          tableStats: tableStats.rows,
          responsive: basicQueryTime < 1000
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        details: { responsive: false }
      };
    }
  }

  async checkSystemResourcesHealth() {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = memUsage.heapUsed / 1024 / 1024;
      const memTotalMB = memUsage.heapTotal / 1024 / 1024;
      const memUsagePercent = (memUsedMB / memTotalMB) * 100;
      
      // Check uptime
      const uptimeSeconds = process.uptime();
      const uptimeHours = uptimeSeconds / 3600;
      
      // Check if process is responsive (uptime > 0 and memory not excessive)
      const memoryHealthy = memUsagePercent < 85; // Alert if heap usage > 85%
      const uptimeHealthy = uptimeSeconds > 10; // Must be running for at least 10 seconds
      
      return {
        healthy: memoryHealthy && uptimeHealthy,
        details: {
          memoryUsageMB: Math.round(memUsedMB),
          memoryTotalMB: Math.round(memTotalMB),
          memoryUsagePercent: Math.round(memUsagePercent),
          uptimeHours: Math.round(uptimeHours * 100) / 100,
          memoryHealthy: memoryHealthy,
          uptimeHealthy: uptimeHealthy
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        details: {}
      };
    }
  }

  async calculateSystemHealthScore() {
    try {
      const healthChecks = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkScrapersHealth(),
        this.checkMCPHealth(),
        this.checkEmailServiceHealth(),
        this.checkCalendarIntegrationHealth(),
        this.checkDatabasePerformanceHealth(),
        this.checkSystemResourcesHealth()
      ]);

      const [database, discoveryEngine, mcp, emailService, calendarIntegration, databasePerformance, systemResources] = healthChecks;
      
      // Calculate weighted health score
      let score = 0;
      let maxScore = 0;
      
      // Database health (25% weight)
      maxScore += 25;
      if (database.healthy) score += 25;
      
      // Discovery Engine health (20% weight)
      maxScore += 20;
      if (discoveryEngine.healthy) score += 20;
      
      // Email Service health (15% weight)
      maxScore += 15;
      if (emailService.healthy) score += 15;
      
      // MCP health (15% weight)
      maxScore += 15;
      if (mcp.healthy) score += 15;
      
      // Calendar Integration health (10% weight)
      maxScore += 10;
      if (calendarIntegration.healthy) score += 10;
      
      // Database Performance health (10% weight)
      maxScore += 10;
      if (databasePerformance.healthy) score += 10;
      
      // System Resources health (5% weight)
      maxScore += 5;
      if (systemResources.healthy) score += 5;
      
      const healthPercentage = (score / maxScore) * 100;
      
      let description;
      if (healthPercentage >= 90) description = 'Excellent';
      else if (healthPercentage >= 75) description = 'Good';
      else if (healthPercentage >= 50) description = 'Fair';
      else if (healthPercentage >= 25) description = 'Poor';
      else description = 'Critical';
      
      return {
        score: healthPercentage,
        description: description,
        details: { 
          database, 
          discoveryEngine, 
          mcp, 
          emailService, 
          calendarIntegration, 
          databasePerformance, 
          systemResources 
        }
      };
      
    } catch (error) {
      this.logger.error('Error calculating system health score:', error.message);
      return { score: 0, description: 'Unknown', details: {} };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.logger.info('Stopping task scheduler...');
    
    for (const scheduledTask of this.tasks) {
      scheduledTask.task.stop();
    }
    
    this.logger.info('Task scheduler stopped');
  }

  getStatus() {
    return {
      running: true,
      taskCount: this.tasks.length,
      tasks: this.tasks.map(t => ({
        name: t.name,
        frequency: t.frequency,
        running: t.task.running
      }))
    };
  }
  
  getDiscoveryProgress() {
    return {
      ...this.discoveryProgress,
      // Calculate completion percentage
      progress: this.discoveryProgress.totalScrapers > 0 
        ? Math.round((this.discoveryProgress.completedScrapers / this.discoveryProgress.totalScrapers) * 100)
        : 0
    };
  }
}

module.exports = TaskScheduler;