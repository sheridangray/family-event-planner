const { EmailApprovalManager } = require('../mcp/email-notifications');

/**
 * Multi-user email notification service
 * Supports both single-user mode (backwards compatibility) and multi-user mode
 */
class UnifiedNotificationService {
  constructor(logger, database, calendarManager = null, userId = null) {
    this.logger = logger;
    this.database = database;
    this.calendarManager = calendarManager;
    this.userId = userId; // For multi-user support
    this.emailManagers = new Map(); // userId -> EmailApprovalManager
    this.emailAvailable = false;
  }

  async init() {
    if (this.userId) {
      this.logger.info(`Initializing email notification service for user ${this.userId}...`);
      await this._initializeUserEmailManager(this.userId);
    } else {
      this.logger.info('Initializing email-only notification service (single-user mode)...');
      await this._initializeSingleUserEmailManager();
    }
    
    this.logger.info('Email notification service initialized successfully');
  }

  /**
   * Initialize email manager for single-user mode (backwards compatibility)
   */
  async _initializeSingleUserEmailManager() {
    try {
      const emailManager = new EmailApprovalManager(this.logger, this.database, this.calendarManager);
      await emailManager.init();
      this.emailManagers.set('default', emailManager);
      this.emailAvailable = true;
      this.logger.info('Single-user email notifications available');
    } catch (error) {
      this.logger.error('Single-user email initialization failed:', error.message);
      this.emailAvailable = false;
      throw new Error('Email notification initialization failed - no notification methods available');
    }
  }

  /**
   * Initialize email manager for a specific user
   */
  async _initializeUserEmailManager(userId) {
    try {
      const emailManager = new EmailApprovalManager(this.logger, this.database, this.calendarManager, userId);
      await emailManager.init();
      this.emailManagers.set(userId, emailManager);
      this.emailAvailable = true;
      this.logger.info(`Email notifications available for user ${userId}`);
    } catch (error) {
      this.logger.error(`Email initialization failed for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get email manager for a user (or default single-user manager)
   */
  async _getEmailManager(userId = null) {
    const managerKey = userId || this.userId || 'default';
    
    if (!this.emailManagers.has(managerKey)) {
      if (userId) {
        await this._initializeUserEmailManager(userId);
      } else {
        throw new Error('No email manager available for the requested user');
      }
    }
    
    return this.emailManagers.get(managerKey);
  }

  async sendEventForApproval(event, userId = null) {
    try {
      this.logger.info(`📧 UnifiedNotificationService: Sending approval request for event: ${event.title} (user: ${userId || this.userId || 'default'})`);
      this.logger.info(`📧 Email service available: ${this.emailAvailable}`);
      
      if (!this.emailAvailable) {
        this.logger.error(`❌ Email notifications not available for: ${event.title}`);
        throw new Error('Email notifications not available');
      }

      const emailManager = await this._getEmailManager(userId);
      
      this.logger.info(`📤 Calling emailManager.sendEventForApproval for: ${event.title}`);
      const result = await emailManager.sendEventForApproval(event);
      this.logger.info(`✅ Email notification sent successfully for: ${event.title}`);
      this.logger.info(`📊 Email result:`, result);
      return { ...result, method: 'email', userId: userId || this.userId };
      
    } catch (error) {
      this.logger.error(`❌ UnifiedNotificationService error sending approval request for ${event.title}:`, error.message);
      this.logger.error(`📍 Error stack:`, error.stack);
      throw error;
    }
  }

  async handleIncomingResponse(from, messageContent, messageId, isEmail = true, userId = null) {
    try {
      // Only handle email responses now
      if (!isEmail) {
        throw new Error('SMS responses not supported in email-only mode');
      }

      const emailManager = await this._getEmailManager(userId);
      
      // Handle email response - messageContent should be { subject, body }
      return await emailManager.handleIncomingResponse(
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

  async processApprovedEvent(eventId, approvalId, method = 'email', userId = null) {
    try {
      // Only process email approvals
      if (method !== 'email' && method !== null) {
        this.logger.warn(`Unsupported approval method '${method}', treating as email`);
      }

      const emailManager = await this._getEmailManager(userId);
      
      return await emailManager.processApprovedEvent(eventId, approvalId);
    } catch (error) {
      this.logger.error(`Error processing approved event ${eventId}:`, error.message);
      throw error;
    }
  }

  async detectApprovalMethod(approvalId) {
    // In email-only mode, all approvals are email
    return 'email';
  }

  /**
   * Send event for approval to all active users
   * @param {Object} event - Event to send for approval
   * @returns {Array} Array of results, one per user
   */
  async sendEventForApprovalToAllUsers(event) {
    try {
      // Get all active users
      const { getAllUserAuthStatus } = require('../mcp/gmail-multi-user-singleton');
      const userStatuses = await getAllUserAuthStatus();
      const authenticatedUsers = userStatuses.filter(user => user.isAuthenticated);

      if (authenticatedUsers.length === 0) {
        this.logger.warn('No authenticated users found for event approval');
        return [];
      }

      const results = [];
      
      for (const user of authenticatedUsers) {
        try {
          this.logger.info(`Sending event ${event.title} for approval to user ${user.userId} (${user.email})`);
          const result = await this.sendEventForApproval(event, user.userId);
          results.push({
            userId: user.userId,
            email: user.email,
            success: true,
            result
          });
        } catch (error) {
          this.logger.error(`Failed to send event ${event.title} to user ${user.userId}:`, error.message);
          results.push({
            userId: user.userId,
            email: user.email,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error sending event for approval to all users:', error.message);
      throw error;
    }
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