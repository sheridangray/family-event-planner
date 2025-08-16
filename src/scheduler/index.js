const cron = require('node-cron');
const { config } = require('../config');

class TaskScheduler {
  constructor(logger, database, scraperManager, eventScorer, eventFilter, smsManager, registrationAutomator, calendarManager) {
    this.logger = logger;
    this.database = database;
    this.scraperManager = scraperManager;
    this.eventScorer = eventScorer;
    this.eventFilter = eventFilter;
    this.smsManager = smsManager;
    this.registrationAutomator = registrationAutomator;
    this.calendarManager = calendarManager;
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
          if (await this.smsManager.shouldSendEvent()) {
            await this.smsManager.sendEventForApproval(event);
            sentCount++;
            
            if (sentCount >= config.discovery.eventsPerDayMax) {
              break;
            }
            
            await this.delay(2000);
          }
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
      const timeoutCount = await this.smsManager.checkTimeouts();
      const reminderCount = await this.smsManager.sendReminders();
      
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

💰 Cost Summary:
- Free events: ${stats.freeEvents}
- Paid events: ${stats.paidEvents}
- Total pending cost: $${stats.totalPendingCost}

🔄 System Health: ${stats.systemHealth}
      `;
      
      this.logger.info('Daily Report:\n' + report);
      
      // TODO: Send report via email or save to file
      
    } catch (error) {
      this.logger.error('Daily report generation failed:', error.message);
    }
  }

  async getDailyStats() {
    const today = new Date().toDateString();
    
    try {
      const allEvents = await Promise.all([
        this.database.getEventsByStatus('discovered'),
        this.database.getEventsByStatus('proposed'),
        this.database.getEventsByStatus('approved'),
        this.database.getEventsByStatus('booked'),
        this.database.getEventsByStatus('scheduled')
      ]);
      
      const [discovered, proposed, approved, booked, scheduled] = allEvents;
      
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
        failedRegistrations: 0, // TODO: implement failed registration tracking
        freeEvents: [...approved, ...booked].filter(e => e.cost === 0).length,
        paidEvents: [...approved, ...booked].filter(e => e.cost > 0).length,
        totalPendingCost: [...approved, ...booked].reduce((sum, e) => sum + (e.cost || 0), 0),
        systemHealth: 'Good' // TODO: implement health scoring
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
    // TODO: Implement MCP health checks
    return { healthy: true };
  }

  async checkAutomationHealth() {
    // TODO: Implement automation health checks
    return { healthy: true };
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