const { EmailApprovalManager } = require('../mcp/email-notifications');

/**
 * Email-only notification service
 * Simplified service that only uses email notifications
 * SMS support removed while waiting for Twilio verification
 */
class UnifiedNotificationService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.emailManager = new EmailApprovalManager(logger, database);
    this.emailAvailable = false;
  }

  async init() {
    this.logger.info('Initializing email-only notification service...');
    
    // Initialize email notifications
    try {
      await this.emailManager.init();
      this.emailAvailable = true;
      this.logger.info('Email notifications available');
    } catch (error) {
      this.logger.error('Email initialization failed:', error.message);
      this.emailAvailable = false;
      throw new Error('Email notification initialization failed - no notification methods available');
    }
    
    this.logger.info('Email-only notification service initialized successfully');
  }

  async sendEventForApproval(event) {
    try {
      this.logger.info(`Sending approval request for event: ${event.title}`);
      
      if (!this.emailAvailable) {
        throw new Error('Email notifications not available');
      }
      
      const result = await this.emailManager.sendEventForApproval(event);
      this.logger.info(`✅ Email notification sent for: ${event.title}`);
      return { ...result, method: 'email' };
      
    } catch (error) {
      this.logger.error(`Error sending approval request for ${event.title}:`, error.message);
      throw error;
    }
  }

  async handleIncomingResponse(from, messageContent, messageId, isEmail = true) {
    try {
      // Only handle email responses now
      if (!isEmail) {
        throw new Error('SMS responses not supported in email-only mode');
      }
      
      // Handle email response - messageContent should be { subject, body }
      return await this.emailManager.handleIncomingResponse(
        from, 
        messageContent.subject, 
        messageContent.body, 
        messageId
      );
    } catch (error) {
      this.logger.error(`Error handling incoming email from ${from}:`, error.message);
      throw error;
    }
  }

  async processApprovedEvent(eventId, approvalId, method = 'email') {
    try {
      // Only process email approvals
      if (method !== 'email' && method !== null) {
        this.logger.warn(`Unsupported approval method '${method}', treating as email`);
      }
      
      return await this.emailManager.processApprovedEvent(eventId, approvalId);
    } catch (error) {
      this.logger.error(`Error processing approved event ${eventId}:`, error.message);
      throw error;
    }
  }

  async detectApprovalMethod(approvalId) {
    // In email-only mode, all approvals are email
    return 'email';
  }

  async checkTimeouts() {
    const results = {
      email: []
    };
    
    if (this.emailAvailable) {
      try {
        results.email = await this.emailManager.checkTimeouts();
      } catch (error) {
        this.logger.error('Error checking email timeouts:', error.message);
      }
    }
    
    return results;
  }

  async sendReminders() {
    let totalReminders = 0;
    
    if (this.emailAvailable) {
      try {
        const emailReminders = await this.emailManager.sendReminders();
        totalReminders += emailReminders;
        this.logger.info(`Sent ${emailReminders} email reminders`);
      } catch (error) {
        this.logger.error('Error sending email reminders:', error.message);
      }
    }
    
    return totalReminders;
  }

  getStatus() {
    return {
      emailAvailable: this.emailAvailable,
      primaryMethod: 'email',
      mode: 'email-only'
    };
  }

  /**
   * Check if a specific notification method should send events
   */
  shouldSendEvent(method = 'email') {
    if (method !== 'email' && method !== null) {
      this.logger.warn(`Unsupported method '${method}', checking email`);
    }
    return this.emailManager.shouldSendEvent();
  }

  /**
   * Get daily event counts for monitoring
   */
  getDailyEventCounts() {
    return {
      email: this.emailManager.dailyEventCount,
      activeMethod: 'email'
    };
  }
}

module.exports = UnifiedNotificationService;