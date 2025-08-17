const { config } = require('../config');
const twilio = require('twilio');

class TwilioMCPClient {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.twilioClient = null;
    this.twilioConfig = null;
  }

  async init() {
    try {
      this.logger.info('Initializing Twilio MCP client...');
      
      if (!config.twilio.mcpCredentials) {
        throw new Error('Twilio MCP credentials not configured');
      }
      
      if (!config.twilio.phoneTo) {
        throw new Error('Twilio phone number not configured');
      }
      
      // Parse Twilio credentials from JSON string or object
      this.twilioConfig = typeof config.twilio.mcpCredentials === 'string' 
        ? JSON.parse(config.twilio.mcpCredentials)
        : config.twilio.mcpCredentials;
      
      if (!this.twilioConfig.accountSid || !this.twilioConfig.authToken || !this.twilioConfig.phoneNumber) {
        throw new Error('Twilio credentials missing required fields: accountSid, authToken, phoneNumber');
      }
      
      // Initialize Twilio client
      this.twilioClient = twilio(this.twilioConfig.accountSid, this.twilioConfig.authToken);
      
      this.logger.info('Twilio MCP client initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Twilio MCP client:', error.message);
      throw error;
    }
  }

  async sendApprovalRequest(event) {
    try {
      this.logger.info(`Sending approval request for event: ${event.title}`);
      
      const message = this.buildApprovalMessage(event);
      const messageId = await this.sendSMS(config.twilio.phoneTo, message);
      
      const approvalId = await this.database.saveSMSApproval(
        event.id,
        config.twilio.phoneTo,
        message
      );
      
      this.logger.info(`Approval request sent for ${event.title}, approval ID: ${approvalId}`);
      
      return {
        approvalId,
        messageId,
        message,
        sentAt: new Date()
      };
      
    } catch (error) {
      this.logger.error(`Error sending approval request for ${event.title}:`, error.message);
      throw error;
    }
  }

  buildApprovalMessage(event) {
    const eventDate = new Date(event.date);
    const weeksAway = Math.round((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
    const dateFormatted = eventDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    
    let message = `New family event found!\n${event.title}`;
    
    if (event.socialProof?.yelpRating || event.socialProof?.googleRating) {
      const rating = event.socialProof.yelpRating || event.socialProof.googleRating;
      message += ` ⭐ ${rating.toFixed(1)}`;
    }
    
    message += `\nDate: ${dateFormatted} (${weeksAway} weeks away)`;
    message += `\nLocation: ${this.truncateLocation(event.location?.address)}`;
    
    if (event.cost === 0) {
      message += `\nCost: FREE`;
    } else {
      message += `\n⚠️ COST: $${event.cost} - REQUIRES PAYMENT`;
    }
    
    if (event.ageRange) {
      message += `\nAges: ${event.ageRange.min}-${event.ageRange.max}`;
    }
    
    message += this.addSpecialNotes(event);
    
    if (event.cost === 0) {
      message += `\n\nReply YES to book or NO to skip`;
    } else {
      message += `\n\nReply YES to receive payment link`;
      message += `\nReply NO to skip`;
    }
    
    return message;
  }

  addSpecialNotes(event) {
    let notes = '';
    
    if (this.isUrgentEvent(event)) {
      if (event.registrationOpens) {
        notes += `\n🔥 Registration just opened!`;
      } else if (event.currentCapacity && event.currentCapacity.available < event.currentCapacity.total * 0.3) {
        const available = event.currentCapacity.available;
        notes += `\n⚡ Filling fast - only ${available} spots left`;
      }
    }
    
    if (event.socialProof?.influencerMentions?.length > 0) {
      notes += `\n📸 Trending on Instagram`;
    }
    
    if (this.isNewVenue(event)) {
      notes += `\n✨ New venue for us!`;
    }
    
    return notes;
  }

  truncateLocation(address) {
    if (!address) return 'San Francisco, CA';
    
    const parts = address.split(',');
    if (parts.length > 1) {
      return parts[0].trim();
    }
    
    if (address.length > 30) {
      return address.substring(0, 27) + '...';
    }
    
    return address;
  }

  isUrgentEvent(event) {
    if (event.registrationOpens) {
      const now = new Date();
      const regOpens = new Date(event.registrationOpens);
      const timeDiff = regOpens.getTime() - now.getTime();
      const hoursUntilOpen = timeDiff / (1000 * 60 * 60);
      
      return hoursUntilOpen <= 2 && hoursUntilOpen >= -2;
    }
    
    if (event.currentCapacity && event.currentCapacity.total) {
      const capacityRatio = event.currentCapacity.available / event.currentCapacity.total;
      return capacityRatio <= 0.3;
    }
    
    return false;
  }

  isNewVenue(event) {
    return !event.previouslyAttended && !event.isRecurring;
  }

  async sendSMS(toNumber, message) {
    try {
      this.logger.debug(`Sending SMS to ${toNumber}: ${message.substring(0, 50)}...`);
      
      if (!this.twilioClient) {
        throw new Error('Twilio client not initialized. Call init() first.');
      }
      
      const messageResponse = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioConfig.phoneNumber,
        to: toNumber
      });
      
      this.logger.info(`SMS sent successfully, message SID: ${messageResponse.sid}`);
      return messageResponse.sid;
      
    } catch (error) {
      this.logger.error(`Error sending SMS to ${toNumber}:`, error.message);
      throw error;
    }
  }

  async handleIncomingSMS(from, body, messageId) {
    try {
      this.logger.info(`Received SMS from ${from}: ${body}`);
      
      const response = this.parseResponse(body);
      
      const pendingApprovals = await this.getPendingApprovals(from);
      
      if (pendingApprovals.length === 0) {
        this.logger.warn(`No pending approvals found for ${from}`);
        
        // Send helpful response if no pending approvals
        await this.sendConfirmationMessage(from, {
          type: 'no_pending',
          message: "No pending event approvals found. You'll receive new event suggestions soon! 🎉"
        });
        
        return null;
      }
      
      const latestApproval = pendingApprovals[0];
      
      // Handle unclear responses
      if (response.confidence === 'low' || response.status === 'unclear') {
        this.logger.warn(`Unclear response from ${from}: "${body}"`);
        
        await this.sendConfirmationMessage(from, {
          type: 'unclear',
          eventTitle: latestApproval.event_title,
          message: `I didn't understand "${body}". Please reply YES to book "${latestApproval.event_title}" or NO to skip it.`
        });
        
        return { unclear: true, eventId: latestApproval.event_id };
      }
      
      // Update SMS response in database
      await this.database.updateSMSResponse(
        latestApproval.id,
        body.trim(),
        response.status
      );
      
      if (response.approved) {
        await this.database.updateEventStatus(latestApproval.event_id, 'approved');
        this.logger.info(`✅ Event ${latestApproval.event_id} (${latestApproval.event_title}) approved via SMS`);
        
        // Send confirmation
        await this.sendConfirmationMessage(from, {
          type: 'approved',
          eventTitle: latestApproval.event_title,
          eventCost: latestApproval.event_cost,
          message: latestApproval.event_cost > 0 
            ? `✅ Great! "${latestApproval.event_title}" approved. Payment link coming next...`
            : `✅ Perfect! "${latestApproval.event_title}" approved and will be booked automatically. You'll get calendar invite soon! 🎉`
        });
        
        return {
          approved: true,
          eventId: latestApproval.event_id,
          approvalId: latestApproval.id,
          eventTitle: latestApproval.event_title,
          requiresPayment: latestApproval.event_cost > 0
        };
        
      } else if (response.rejected || response.status === 'cancelled') {
        await this.database.updateEventStatus(latestApproval.event_id, 'rejected');
        this.logger.info(`❌ Event ${latestApproval.event_id} (${latestApproval.event_title}) rejected via SMS`);
        
        // Send confirmation
        await this.sendConfirmationMessage(from, {
          type: 'rejected',
          eventTitle: latestApproval.event_title,
          message: `👍 Got it! Skipping "${latestApproval.event_title}". I'll keep looking for other great events for the family!`
        });
        
        return {
          approved: false,
          eventId: latestApproval.event_id,
          approvalId: latestApproval.id,
          eventTitle: latestApproval.event_title
        };
        
      } else if (response.isPaymentConfirmation) {
        // Handle payment confirmation for paid events
        this.logger.info(`💳 Payment confirmation received for ${latestApproval.event_title}`);
        
        await this.database.updateEventStatus(latestApproval.event_id, 'ready_for_registration');
        
        await this.sendConfirmationMessage(from, {
          type: 'payment_confirmed',
          eventTitle: latestApproval.event_title,
          message: `💳 Payment confirmed for "${latestApproval.event_title}"! Now processing registration...`
        });
        
        return {
          paymentConfirmed: true,
          eventId: latestApproval.event_id,
          approvalId: latestApproval.id,
          eventTitle: latestApproval.event_title
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.error(`Error handling incoming SMS from ${from}:`, error.message);
      
      // Send error message to user
      try {
        await this.sendConfirmationMessage(from, {
          type: 'error',
          message: "Sorry, there was an error processing your response. Please try again or contact support."
        });
      } catch (confirmError) {
        this.logger.error('Failed to send error confirmation:', confirmError.message);
      }
      
      throw error;
    }
  }

  async sendConfirmationMessage(phoneNumber, confirmation) {
    try {
      const messageId = await this.sendSMS(phoneNumber, confirmation.message);
      this.logger.info(`Sent confirmation to ${phoneNumber}: ${confirmation.type}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to send confirmation message:`, error.message);
      // Don't throw - confirmation failures shouldn't break the main flow
    }
  }

  parseResponse(body) {
    const text = body.toLowerCase().trim();
    
    // Comprehensive approval patterns
    const approvalKeywords = [
      // Basic yes variations
      'yes', 'y', 'yeah', 'yep', 'yup', 'yas', 'ya', 'yea',
      // Affirmative words  
      'sure', 'ok', 'okay', 'good', 'great', 'perfect', 'sounds good',
      // Action words
      'approve', 'book', 'register', 'go', 'do it', 'lets do it',
      // Enthusiastic
      'awesome', 'love it', 'want it', 'interested',
      // Numbers and symbols
      '1', 'true', 'accept', '✓', '👍'
    ];
    
    // Comprehensive rejection patterns  
    const rejectionKeywords = [
      // Basic no variations
      'no', 'n', 'nope', 'nah', 'na', 'nay',
      // Negative words
      'pass', 'skip', 'reject', 'decline', 'not interested',
      // Dismissive
      'not now', 'next time', 'not this time',
      // Numbers and symbols
      '0', 'false', '❌', '👎'
    ];
    
    // Special handling for payment-related responses
    const paymentKeywords = ['pay', 'paid', 'payment', 'complete', 'done'];
    const cancelKeywords = ['cancel', 'cancelled', 'abort'];
    
    // Check for exact matches first (highest priority)
    if (['yes', 'y', '1', 'ok'].includes(text)) {
      return { approved: true, rejected: false, status: 'approved', originalText: body.trim(), confidence: 'high' };
    }
    
    if (['no', 'n', '0'].includes(text)) {
      return { approved: false, rejected: true, status: 'rejected', originalText: body.trim(), confidence: 'high' };
    }
    
    // Check for payment confirmation
    if (paymentKeywords.some(keyword => text.includes(keyword))) {
      return { 
        approved: false, 
        rejected: false, 
        status: 'payment_confirmed', 
        originalText: body.trim(),
        isPaymentConfirmation: true,
        confidence: 'high'
      };
    }
    
    // Check for cancellation
    if (cancelKeywords.some(keyword => text.includes(keyword))) {
      return { 
        approved: false, 
        rejected: true, 
        status: 'cancelled', 
        originalText: body.trim(),
        confidence: 'high'
      };
    }
    
    // Check for approval patterns (medium confidence)
    const approved = approvalKeywords.some(keyword => 
      text === keyword || text.includes(keyword)
    );
    
    // Check for rejection patterns (medium confidence)  
    const rejected = rejectionKeywords.some(keyword =>
      text === keyword || text.includes(keyword)
    );
    
    // Handle ambiguous responses
    if (approved && rejected) {
      // If both patterns match, prioritize shorter/more direct responses
      const directApproval = ['yes', 'y', 'ok', 'sure'].some(word => text.includes(word));
      const directRejection = ['no', 'n', 'nope'].some(word => text.includes(word));
      
      if (directApproval && !directRejection) {
        return { approved: true, rejected: false, status: 'approved', originalText: body.trim(), confidence: 'medium' };
      } else if (directRejection && !directApproval) {
        return { approved: false, rejected: true, status: 'rejected', originalText: body.trim(), confidence: 'medium' };
      } else {
        return { approved: false, rejected: false, status: 'unclear', originalText: body.trim(), confidence: 'low' };
      }
    }
    
    let status = 'sent';
    let confidence = 'medium';
    
    if (approved) {
      status = 'approved';
    } else if (rejected) {
      status = 'rejected';
    } else {
      status = 'unclear';
      confidence = 'low';
    }
    
    return {
      approved,
      rejected,
      status,
      originalText: body.trim(),
      confidence,
      isPaymentConfirmation: false
    };
  }

  async getPendingApprovals(phoneNumber) {
    try {
      // Get pending approvals from database, ordered by most recent first
      const sql = `
        SELECT sa.*, e.title as event_title, e.date as event_date, e.cost as event_cost
        FROM sms_approvals sa
        LEFT JOIN events e ON sa.event_id = e.id  
        WHERE sa.phone_number = ? 
        AND sa.status = 'sent'
        AND datetime(sa.sent_at, '+24 hours') > datetime('now')
        ORDER BY sa.sent_at DESC
      `;
      
      // Use database connection through this.database
      if (this.database.usePostgres) {
        // For PostgreSQL, adjust the query
        const pgSql = `
          SELECT sa.*, e.title as event_title, e.date as event_date, e.cost as event_cost
          FROM sms_approvals sa
          LEFT JOIN events e ON sa.event_id = e.id  
          WHERE sa.phone_number = $1 
          AND sa.status = 'sent'
          AND sa.sent_at + INTERVAL '24 hours' > NOW()
          ORDER BY sa.sent_at DESC
        `;
        
        const result = await this.database.postgres.query(pgSql, [phoneNumber]);
        return result.rows;
      } else {
        // SQLite version
        return new Promise((resolve, reject) => {
          this.database.db.all(sql, [phoneNumber], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
      }
    } catch (error) {
      this.logger.error(`Error getting pending approvals for ${phoneNumber}:`, error.message);
      return [];
    }
  }

  async sendPaymentLink(event, approvalId) {
    try {
      this.logger.info(`Sending payment link for event: ${event.title}`);
      
      const message = this.buildPaymentMessage(event);
      const messageId = await this.sendSMS(config.twilio.phoneTo, message);
      
      this.logger.info(`Payment link sent for ${event.title}`);
      
      return {
        messageId,
        message,
        sentAt: new Date()
      };
      
    } catch (error) {
      this.logger.error(`Error sending payment link for ${event.title}:`, error.message);
      throw error;
    }
  }

  buildPaymentMessage(event) {
    let message = `Payment Required\n${event.title}\n`;
    message += `Amount: $${event.cost}\n`;
    
    if (event.registrationUrl) {
      message += `\nPayment Link: ${event.registrationUrl}\n`;
    }
    
    message += `\n⚠️ IMPORTANT: Complete payment manually`;
    message += `\nReply "PAY" after payment to confirm`;
    message += `\nReply "CANCEL" to cancel booking`;
    
    return message;
  }

  async checkApprovalTimeouts() {
    try {
      this.logger.debug('Checking for approval timeouts...');
      
      const timeoutHours = 24;
      const urgentTimeoutHours = 6;
      
      return [];
      
    } catch (error) {
      this.logger.error('Error checking approval timeouts:', error.message);
      return [];
    }
  }

  async sendReminderMessage(approval) {
    try {
      const reminderMessage = `Reminder: You have a pending event approval.\n\n"${approval.event_title}"\n\nReply YES to book or NO to skip`;
      
      const messageId = await this.sendSMS(approval.phone_number, reminderMessage);
      
      this.logger.info(`Reminder sent for approval ${approval.id}`);
      return messageId;
      
    } catch (error) {
      this.logger.error(`Error sending reminder for approval ${approval.id}:`, error.message);
      throw error;
    }
  }
}

class SMSApprovalManager {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.twilioClient = new TwilioMCPClient(logger, database);
    this.dailyEventCount = 0;
    this.lastResetDate = new Date().toDateString();
  }

  async init() {
    await this.twilioClient.init();
  }

  async sendEventForApproval(event) {
    try {
      if (!this.shouldSendEvent()) {
        this.logger.info(`Daily event limit reached, queuing event: ${event.title}`);
        return null;
      }
      
      const result = await this.twilioClient.sendApprovalRequest(event);
      await this.database.updateEventStatus(event.id, 'proposed');
      
      this.incrementDailyCount();
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error sending event for approval: ${event.title}`, error.message);
      throw error;
    }
  }

  shouldSendEvent() {
    this.resetDailyCountIfNeeded();
    return this.dailyEventCount < config.discovery.eventsPerDayMax;
  }

  resetDailyCountIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyEventCount = 0;
      this.lastResetDate = today;
      this.logger.debug('Reset daily event count');
    }
  }

  incrementDailyCount() {
    this.dailyEventCount++;
    this.logger.debug(`Daily event count: ${this.dailyEventCount}/${config.discovery.eventsPerDayMax}`);
  }

  async handleIncomingResponse(from, body, messageId) {
    return await this.twilioClient.handleIncomingSMS(from, body, messageId);
  }

  async processApprovedEvent(eventId, approvalId) {
    try {
      const events = await this.database.getEventsByStatus('approved');
      const event = events.find(e => e.id === eventId);
      
      if (!event) {
        throw new Error(`Approved event not found: ${eventId}`);
      }
      
      if (event.cost > 0) {
        await this.twilioClient.sendPaymentLink(event, approvalId);
        this.logger.info(`Payment link sent for paid event: ${event.title}`);
        return { requiresPayment: true };
      } else {
        await this.database.updateEventStatus(eventId, 'ready_for_registration');
        this.logger.info(`Free event ready for registration: ${event.title}`);
        return { requiresPayment: false };
      }
      
    } catch (error) {
      this.logger.error(`Error processing approved event ${eventId}:`, error.message);
      throw error;
    }
  }

  async checkTimeouts() {
    return await this.twilioClient.checkApprovalTimeouts();
  }

  async sendReminders() {
    try {
      const timeouts = await this.checkTimeouts();
      
      for (const approval of timeouts) {
        await this.twilioClient.sendReminderMessage(approval);
      }
      
      return timeouts.length;
      
    } catch (error) {
      this.logger.error('Error sending reminders:', error.message);
      return 0;
    }
  }
}

module.exports = { TwilioMCPClient, SMSApprovalManager };