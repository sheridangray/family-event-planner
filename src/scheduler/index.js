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
  }

  start() {
    this.logger.info('Starting task scheduler...');
    
    this.scheduleEventDiscovery();
    this.scheduleEventProcessing();
    this.scheduleApprovalTimeouts();
    this.scheduleRegistrationProcessing();
    this.scheduleCalendarSync();
    this.scheduleDailyReports();
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

  scheduleDailyReports() {
    const task = cron.schedule('0 18 * * *', async () => {
      try {
        this.logger.info('Generating daily report...');
        await this.generateDailyReport();
      } catch (error) {
        this.logger.error('Error generating daily report:', error.message);
      }
    });
    
    this.tasks.push({ name: 'Daily Reports', task, frequency: 'Daily at 6:00 PM' });
    this.logger.info('Scheduled daily reports: daily at 6:00 PM');
  }

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

  async runEventDiscovery() {
    const startTime = Date.now();
    
    try {
      const events = await this.scraperManager.scrapeAll();
      
      if (events.length > 0) {
        const filteredEvents = await this.eventFilter.filterAndSort(events, {
          calendarChecker: this.calendarManager,
          database: this.database,
          prioritizeUrgent: true
        });
        
        const scoredEvents = await this.eventScorer.scoreEvents(filteredEvents);
        
        const topEvents = scoredEvents.slice(0, 10);
        let sentCount = 0;
        
        for (const event of topEvents) {
          // Use unified notification service if SMS manager is not available
          if (this.smsManager) {
            // SMS available - use SMS manager
            if (await this.smsManager.shouldSendEvent()) {
              await this.smsManager.sendEventForApproval(event);
              sentCount++;
            }
          } else if (this.unifiedNotifications) {
            // Email-only mode - use unified notification service
            if (await this.unifiedNotifications.shouldSendEvent()) {
              await this.unifiedNotifications.sendEventForApproval(event);
              sentCount++;
            }
          } else {
            this.logger.error('No notification service available - cannot send approval requests');
            break;
          }
          
          if (sentCount >= config.discovery.eventsPerDayMax) {
            break;
          }
          
          await this.delay(2000);
        }
        
        this.logger.info(`Event discovery completed: ${events.length} discovered, ${filteredEvents.length} filtered, ${sentCount} sent for approval`);
      } else {
        this.logger.info('Event discovery completed: no new events found');
      }
      
    } catch (error) {
      this.logger.error('Event discovery failed:', error.message);
    }
    
    const duration = Date.now() - startTime;
    this.logger.info(`Event discovery took ${duration}ms`);
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
      // Check SMS timeouts if SMS manager available
      let timeoutCount = 0;
      let reminderCount = 0;
      
      if (this.smsManager) {
        timeoutCount = await this.smsManager.checkTimeouts();
        reminderCount = await this.smsManager.sendReminders();
      } else {
        // Email-only mode - use unified notification service
        const emailTimeouts = await this.unifiedNotifications.checkTimeouts();
        timeoutCount = emailTimeouts.email ? emailTimeouts.email.length : 0;
        
        const emailReminders = await this.unifiedNotifications.sendReminders();
        reminderCount = emailReminders || 0;
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
        scrapers: await this.checkScrapersHealth(),
        mcp: await this.checkMCPHealth(),
        automation: await this.checkAutomationHealth()
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
    // Basic check - more comprehensive checks could be added
    return { healthy: true };
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

  async checkAutomationHealth() {
    try {
      // Check recent registration success rate
      const registrationStats = await this.database.getRegistrationStats('24 hours');
      const successRate = parseFloat(registrationStats.successRate) || 100;
      
      // Check if registration automator is responsive
      const isResponsive = this.registrationAutomator && typeof this.registrationAutomator.processApprovedEvents === 'function';
      
      return {
        healthy: successRate >= 70 && isResponsive,
        details: {
          registrationSuccessRate: successRate,
          isResponsive: isResponsive,
          recentAttempts: registrationStats.totalAttempts
        }
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async calculateSystemHealthScore() {
    try {
      const healthChecks = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkScrapersHealth(),
        this.checkMCPHealth(),
        this.checkAutomationHealth()
      ]);

      const [database, scrapers, mcp, automation] = healthChecks;
      
      // Calculate weighted health score
      let score = 0;
      let maxScore = 0;
      
      // Database health (40% weight)
      maxScore += 40;
      if (database.healthy) score += 40;
      else score += 0;
      
      // Scrapers health (20% weight)
      maxScore += 20;
      if (scrapers.healthy) score += 20;
      else score += 0;
      
      // MCP health (20% weight)
      maxScore += 20;
      if (mcp.healthy) score += 20;
      else score += 0;
      
      // Automation health (20% weight)
      maxScore += 20;
      if (automation.healthy) score += 20;
      else score += 0;
      
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
        details: { database, scrapers, mcp, automation }
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
}

module.exports = TaskScheduler;