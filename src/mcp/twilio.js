const { config } = require('../config');

class TwilioMCPClient {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.mcpClient = null;
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
      
      const messageId = 'mock-message-' + Date.now();
      
      this.logger.info(`SMS sent successfully, message ID: ${messageId}`);
      return messageId;
      
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
        return null;
      }
      
      const latestApproval = pendingApprovals[0];
      
      await this.database.updateSMSResponse(
        latestApproval.id,
        body.trim(),
        response.status
      );
      
      if (response.approved) {
        await this.database.updateEventStatus(latestApproval.event_id, 'approved');
        this.logger.info(`Event ${latestApproval.event_id} approved via SMS`);
        
        return {
          approved: true,
          eventId: latestApproval.event_id,
          approvalId: latestApproval.id
        };
      } else if (response.rejected) {
        await this.database.updateEventStatus(latestApproval.event_id, 'rejected');
        this.logger.info(`Event ${latestApproval.event_id} rejected via SMS`);
        
        return {
          approved: false,
          eventId: latestApproval.event_id,
          approvalId: latestApproval.id
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.error(`Error handling incoming SMS from ${from}:`, error.message);
      throw error;
    }
  }

  parseResponse(body) {
    const text = body.toLowerCase().trim();
    
    const approvalKeywords = ['yes', 'y', 'yeah', 'sure', 'ok', 'okay', 'yep', 'approve'];
    const rejectionKeywords = ['no', 'n', 'nope', 'pass', 'skip', 'reject'];
    
    const approved = approvalKeywords.some(keyword => text === keyword || text.includes(keyword));
    const rejected = rejectionKeywords.some(keyword => text === keyword || text.includes(keyword));
    
    let status = 'sent';
    if (approved) status = 'approved';
    else if (rejected) status = 'rejected';
    
    return {
      approved,
      rejected,
      status,
      originalText: body.trim()
    };
  }

  async getPendingApprovals(phoneNumber) {
    try {
      return [];
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