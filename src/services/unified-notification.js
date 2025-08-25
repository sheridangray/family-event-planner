const { SMSApprovalManager } = require('../mcp/twilio');
const { EmailApprovalManager } = require('../mcp/email-notifications');

class UnifiedNotificationService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.smsManager = new SMSApprovalManager(logger, database);
    this.emailManager = new EmailApprovalManager(logger, database);
    this.useEmailFallback = process.env.FORCE_EMAIL_NOTIFICATIONS === 'true' || process.env.USE_EMAIL_FALLBACK === 'true';
    this.smsAvailable = false;
    this.emailAvailable = false;
  }

  async init() {
    this.logger.info('Initializing unified notification service...');
    
    // Try to initialize SMS first
    try {
      await this.smsManager.init();
      this.smsAvailable = true;
      this.logger.info('SMS notifications available');
    } catch (error) {
      this.logger.warn('SMS initialization failed, will use email fallback:', error.message);
      this.smsAvailable = false;
    }
    
    // Initialize email as backup or primary
    try {
      await this.emailManager.init();
      this.emailAvailable = true;
      this.logger.info('Email notifications available');
    } catch (error) {
      this.logger.error('Email initialization failed:', error.message);
      this.emailAvailable = false;
    }
    
    // Check if we have at least one notification method
    if (!this.smsAvailable && !this.emailAvailable) {
      throw new Error('No notification methods available - both SMS and Email failed to initialize');
    }
    
    if (this.useEmailFallback) {
      this.logger.info('Email notifications forced via environment variable');
    }
    
    this.logger.info(`Unified notification service initialized - SMS: ${this.smsAvailable}, Email: ${this.emailAvailable}`);
  }

  async sendEventForApproval(event) {
    try {
      this.logger.info(`Sending approval request for event: ${event.title}`);
      
      // Determine which notification method to use
      const useEmail = this.useEmailFallback || !this.smsAvailable;
      
      if (!useEmail && this.smsAvailable) {
        this.logger.debug('Attempting SMS notification...');
        try {
          const result = await this.smsManager.sendEventForApproval(event);
          this.logger.info(`✅ SMS notification sent for: ${event.title}`);
          return { ...result, method: 'sms' };
        } catch (smsError) {
          this.logger.warn(`SMS notification failed for ${event.title}, falling back to email:`, smsError.message);
          
          if (!this.emailAvailable) {
            throw new Error('SMS failed and email not available');
          }
          
          // Fall back to email
          const emailResult = await this.emailManager.sendEventForApproval(event);
          this.logger.info(`✅ Email fallback notification sent for: ${event.title}`);
          return { ...emailResult, method: 'email', smsFailure: smsError.message };
        }
      } else if (this.emailAvailable) {
        this.logger.debug('Using email notification...');
        const result = await this.emailManager.sendEventForApproval(event);
        this.logger.info(`✅ Email notification sent for: ${event.title}`);
        return { ...result, method: 'email' };
      } else {
        throw new Error('No notification methods available');
      }
      
    } catch (error) {
      this.logger.error(`Error sending approval request for ${event.title}:`, error.message);
      throw error;
    }
  }

  async handleIncomingResponse(from, messageContent, messageId, isEmail = false) {
    try {
      if (isEmail) {
        // Handle email response - messageContent should be { subject, body }
        return await this.emailManager.handleIncomingResponse(
          from, 
          messageContent.subject, 
          messageContent.body, 
          messageId
        );
      } else {
        // Handle SMS response
        return await this.smsManager.handleIncomingResponse(from, messageContent, messageId);
      }
    } catch (error) {
      this.logger.error(`Error handling incoming ${isEmail ? 'email' : 'SMS'} from ${from}:`, error.message);
      throw error;
    }
  }

  async processApprovedEvent(eventId, approvalId, method = null) {
    try {
      // If method is not specified, try to determine from database
      if (!method) {
        method = await this.detectApprovalMethod(approvalId);
      }
      
      if (method === 'email') {
        return await this.emailManager.processApprovedEvent(eventId, approvalId);
      } else {
        return await this.smsManager.processApprovedEvent(eventId, approvalId);
      }
    } catch (error) {
      this.logger.error(`Error processing approved event ${eventId}:`, error.message);
      throw error;
    }
  }

  async detectApprovalMethod(approvalId) {
    try {
      // Query the database to check if the phone_number contains @ (email) or not (SMS)
      const sql = `SELECT phone_number FROM sms_approvals WHERE id = ?`;
      
      let phoneNumber;
      
      if (this.database.usePostgres) {
        const result = await this.database.postgres.query(
          `SELECT phone_number FROM sms_approvals WHERE id = $1`, 
          [approvalId]
        );
        phoneNumber = result.rows[0]?.phone_number;
      } else {
        phoneNumber = await new Promise((resolve, reject) => {
          this.database.db.get(sql, [approvalId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.phone_number);
          });
        });
      }
      
      return phoneNumber?.includes('@') ? 'email' : 'sms';
    } catch (error) {
      this.logger.warn(`Could not detect approval method for ${approvalId}, defaulting to SMS:`, error.message);
      return 'sms';
    }
  }

  async checkTimeouts() {
    const results = {
      sms: [],
      email: []
    };
    
    if (this.smsAvailable) {
      try {
        results.sms = await this.smsManager.checkTimeouts();
      } catch (error) {
        this.logger.error('Error checking SMS timeouts:', error.message);
      }
    }
    
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
    
    if (this.smsAvailable) {
      try {
        const smsReminders = await this.smsManager.sendReminders();
        totalReminders += smsReminders;
        this.logger.info(`Sent ${smsReminders} SMS reminders`);
      } catch (error) {
        this.logger.error('Error sending SMS reminders:', error.message);
      }
    }
    
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
      smsAvailable: this.smsAvailable,
      emailAvailable: this.emailAvailable,
      useEmailFallback: this.useEmailFallback,
      primaryMethod: this.useEmailFallback || !this.smsAvailable ? 'email' : 'sms'
    };
  }

  /**
   * Force email mode for testing
   */
  forceEmailMode(force = true) {
    this.useEmailFallback = force;
    this.logger.info(`Email fallback mode ${force ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if a specific notification method should send events
   */
  shouldSendEvent(method = null) {
    if (method === 'sms') {
      return this.smsManager.shouldSendEvent();
    } else if (method === 'email') {
      return this.emailManager.shouldSendEvent();
    } else {
      // Check the active method
      const activeMethod = this.useEmailFallback || !this.smsAvailable ? 'email' : 'sms';
      return this.shouldSendEvent(activeMethod);
    }
  }

  /**
   * Get daily event counts for monitoring
   */
  getDailyEventCounts() {
    return {
      sms: this.smsManager.dailyEventCount,
      email: this.emailManager.dailyEventCount,
      activeMethod: this.useEmailFallback || !this.smsAvailable ? 'email' : 'sms'
    };
  }
}

module.exports = UnifiedNotificationService;