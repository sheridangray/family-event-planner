const { config } = require('../config');
const { GmailMCPClient } = require('./gmail');

class EmailNotificationClient {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.gmailClient = new GmailMCPClient(logger);
    this.isInitialized = false;
  }

  async init() {
    try {
      this.logger.info('Initializing Email notification client...');
      
      if (!config.gmail.parent1Email && !config.gmail.parent2Email) {
        throw new Error('No parent email addresses configured');
      }
      
      // Initialize Gmail client
      await this.gmailClient.init();
      this.isInitialized = true;
      
      this.logger.info('Email notification client initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Email notification client:', error.message);
      throw error;
    }
  }

  async sendApprovalRequest(event) {
    try {
      this.logger.info(`Sending email approval request for event: ${event.title}`);
      
      if (!this.isInitialized) {
        try {
          this.logger.debug('Initializing Gmail client...');
          await this.init();
          this.logger.debug('Gmail client initialized successfully');
        } catch (error) {
          this.logger.error('Error initializing Gmail client:', error.message, { stack: error.stack });
          throw error;
        }
      }

      const recipient = this.getRecipientEmail();
      const subject = this.buildEmailSubject(event);
      const emailBody = this.buildApprovalEmailBody(event);
      
      let emailResult;
      try {
        this.logger.debug(`Sending email to ${recipient} with subject: ${subject}`);
        emailResult = await this.gmailClient.sendEmail([recipient], subject, emailBody);
        this.logger.debug('Email sent successfully, result:', emailResult);
      } catch (error) {
        this.logger.error('Error sending email via Gmail client:', error.message, { stack: error.stack });
        throw error;
      }
      
      let approvalId;
      try {
        this.logger.debug('Saving SMS approval record to database...');
        approvalId = await this.database.saveSMSApproval(
          event.id,
          recipient, // Store email instead of phone for tracking
          emailBody
        );
        this.logger.debug(`SMS approval saved with ID: ${approvalId}`);
      } catch (error) {
        this.logger.error('Error saving SMS approval to database:', error.message, { stack: error.stack });
        throw error;
      }
      
      try {
        this.logger.debug(`Storing message ID for approval ${approvalId}...`);
        await this.storeMessageId(approvalId, emailResult.messageId);
        this.logger.debug('Message ID stored successfully');
      } catch (error) {
        this.logger.error('Error storing message ID:', error.message, { stack: error.stack });
        throw error;
      }
      
      this.logger.info(`Email approval request sent for ${event.title}, approval ID: ${approvalId}`);
      
      return {
        approvalId,
        messageId: emailResult.messageId,
        message: emailBody,
        sentAt: new Date(),
        recipient
      };
      
    } catch (error) {
      this.logger.error(`Error sending email approval request for ${event.title}:`, error.message, { stack: error.stack });
      throw error;
    }
  }

  getRecipientEmail() {
    // Always send to Sheridan Gray for now
    return config.gmail.parent2Email; // Sheridan in all environments
  }

  buildEmailSubject(event) {
    const eventDate = new Date(event.date);
    const weeksAway = Math.round((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
    
    let subject = `New Family Event: ${event.title}`;
    
    if (event.cost === 0) {
      subject += ' (FREE)';
    } else {
      subject += ` ($${event.cost})`;
    }
    
    if (weeksAway <= 2) {
      const timePhrase = weeksAway === 1 ? '1 week away' : `${weeksAway} weeks away`;
      subject = `URGENT: ${subject} - ${timePhrase}!`;
    }
    
    return subject;
  }

  buildApprovalEmailBody(event) {
    const eventDate = new Date(event.date);
    const weeksAway = Math.round((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
    const dateFormatted = eventDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    
    let emailBody = `Hi ${config.app.nodeEnv === 'production' ? config.family.parent1Name : config.family.parent2Name}!\n\n`;
    
    emailBody += `I found a great family event that looks perfect for ${config.family.child1Name} and ${config.family.child2Name}:\n\n`;
    
    emailBody += `**${event.title}**\n`;
    
    if (event.socialProof?.yelpRating || event.socialProof?.googleRating) {
      const rating = event.socialProof.yelpRating || event.socialProof.googleRating;
      emailBody += `⭐ Rating: ${rating.toFixed(1)}/5\n`;
    }
    
    const timePhrase = weeksAway === 1 ? '1 week away' : `${weeksAway} weeks away`;
    emailBody += `📅 **Date:** ${dateFormatted} (${timePhrase})\n`;
    emailBody += `📍 **Location:** ${event.location?.address || 'San Francisco, CA'}\n`;
    
    if (event.cost === 0) {
      emailBody += `💰 **Cost:** FREE! 🎉\n`;
    } else {
      emailBody += `💰 **Cost:** $${event.cost} per person\n`;
    }
    
    if (event.ageRange) {
      emailBody += `👶 **Ages:** ${event.ageRange.min}-${event.ageRange.max} years old\n`;
    }
    
    if (event.description) {
      emailBody += `\n📝 **Description:**\n${event.description}\n`;
    }
    
    emailBody += this.addSpecialNotesEmail(event);
    
    if (event.registrationUrl) {
      emailBody += `\n🔗 **Registration:** ${event.registrationUrl}\n`;
    }
    
    emailBody += `\n---\n\n`;
    
    if (event.cost === 0) {
      emailBody += `**Should I book this event for the family?**\n\n`;
      emailBody += `Reply with:\n`;
      emailBody += `• **YES** - I'll book it automatically\n`;
      emailBody += `• **NO** - Skip this event\n\n`;
    } else {
      emailBody += `**This event requires payment. Should I proceed?**\n\n`;
      emailBody += `Reply with:\n`;
      emailBody += `• **YES** - Send me the payment link\n`;
      emailBody += `• **NO** - Skip this event\n\n`;
    }
    
    emailBody += `💡 *Just reply to this email with YES or NO - I'll handle the rest!*\n\n`;
    emailBody += `Best,\n`;
    emailBody += `Your Family Event Assistant 🤖`;
    
    return emailBody;
  }

  addSpecialNotesEmail(event) {
    let notes = '';
    
    if (this.isUrgentEvent(event)) {
      if (event.registrationOpens) {
        notes += `\n🔥 **URGENT:** Registration just opened!\n`;
      } else if (event.currentCapacity && event.currentCapacity.available < event.currentCapacity.total * 0.3) {
        const available = event.currentCapacity.available;
        notes += `\n⚡ **FILLING FAST:** Only ${available} spots remaining\n`;
      }
    }
    
    if (event.socialProof?.influencerMentions?.length > 0) {
      notes += `\n📸 **Trending:** Popular on Instagram\n`;
    }
    
    if (this.isNewVenue(event)) {
      notes += `\n✨ **New Venue:** We haven't been here before!\n`;
    }
    
    return notes;
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

  async handleIncomingEmail(from, subject, body, messageId) {
    try {
      this.logger.info(`Received email response from ${from}: ${subject}`);
      
      const response = this.parseEmailResponse(body);
      
      const pendingApprovals = await this.getPendingApprovals(from);
      
      if (pendingApprovals.length === 0) {
        this.logger.warn(`No pending approvals found for ${from}`);
        
        // Send helpful response if no pending approvals
        await this.sendConfirmationEmail(from, {
          type: 'no_pending',
          message: "No pending event approvals found. You'll receive new event suggestions soon! 🎉"
        });
        
        return null;
      }
      
      const latestApproval = pendingApprovals[0];
      
      // Handle unclear responses
      if (response.confidence === 'low' || response.status === 'unclear') {
        this.logger.warn(`Unclear email response from ${from}: "${body.substring(0, 100)}..."`);
        
        await this.sendConfirmationEmail(from, {
          type: 'unclear',
          eventTitle: latestApproval.event_title,
          message: `I didn't understand your response. Please reply with YES to book "${latestApproval.event_title}" or NO to skip it.`
        });
        
        return { unclear: true, eventId: latestApproval.event_id };
      }
      
      // Update response in database (reusing SMS table structure)
      await this.database.updateSMSResponse(
        latestApproval.id,
        body.substring(0, 500), // Truncate long emails
        response.status
      );
      
      if (response.approved) {
        await this.database.updateEventStatus(latestApproval.event_id, 'approved');
        this.logger.info(`✅ Event ${latestApproval.event_id} (${latestApproval.event_title}) approved via email`);
        
        // Send confirmation
        await this.sendConfirmationEmail(from, {
          type: 'approved',
          eventTitle: latestApproval.event_title,
          eventCost: latestApproval.event_cost,
          message: latestApproval.event_cost > 0 
            ? `✅ Great! "${latestApproval.event_title}" approved. I'll send the payment link next...`
            : `✅ Perfect! "${latestApproval.event_title}" approved and will be booked automatically. You'll get a calendar invite soon! 🎉`
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
        this.logger.info(`❌ Event ${latestApproval.event_id} (${latestApproval.event_title}) rejected via email`);
        
        // Send confirmation
        await this.sendConfirmationEmail(from, {
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
        this.logger.info(`💳 Payment confirmation received via email for ${latestApproval.event_title}`);
        
        await this.database.updateEventStatus(latestApproval.event_id, 'ready_for_registration');
        
        await this.sendConfirmationEmail(from, {
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
      this.logger.error(`Error handling incoming email from ${from}:`, error.message);
      
      // Send error message to user
      try {
        await this.sendConfirmationEmail(from, {
          type: 'error',
          message: "Sorry, there was an error processing your email response. Please try again or contact support."
        });
      } catch (confirmError) {
        this.logger.error('Failed to send error confirmation email:', confirmError.message);
      }
      
      throw error;
    }
  }

  parseEmailResponse(body) {
    // Handle null/undefined/empty input
    if (!body || typeof body !== 'string') {
      return { 
        approved: false, 
        rejected: false, 
        status: 'unclear', 
        originalText: body || '', 
        confidence: 'low' 
      };
    }
    
    // Clean up email body - remove quoted text and signatures
    let cleanBody = this.cleanEmailBody(body);
    const text = cleanBody.toLowerCase().trim();
    
    // Use the same parsing logic as SMS
    return this.parseResponseText(text, body);
  }

  cleanEmailBody(body) {
    // Remove common email artifacts
    let cleaned = body;
    
    // Remove quoted text (lines starting with >)
    cleaned = cleaned.replace(/^>.*$/gm, '');
    
    // Remove common email signatures
    cleaned = cleaned.replace(/--\s*$/gm, '');
    cleaned = cleaned.replace(/Best regards?.*$/is, '');
    cleaned = cleaned.replace(/Thanks?.*$/is, '');
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    
    // Take only the first few lines (likely the actual response)
    const lines = cleaned.split('\n');
    if (lines.length > 3) {
      cleaned = lines.slice(0, 3).join('\n');
    }
    
    return cleaned;
  }

  parseResponseText(text, originalBody) {
    // Reuse the same parsing logic from SMS
    const exactApprovalKeywords = [
      'yes', 'y', 'yeah', 'yep', 'yup', 'yas', 'ya', 'yea', 'sure', 'ok', 'okay', 
      'good', 'great', 'perfect', 'awesome', 'approve', 'book', 'register', 'go',
      '1', 'true', 'accept', '✓', '👍'
    ];
    
    const exactRejectionKeywords = [
      'no', 'n', 'nope', 'nah', 'na', 'nay', 'pass', 'skip', 'reject', 'decline',
      '0', 'false', '❌', '👎'
    ];
    
    const approvalPhrases = [
      'sounds good', 'sure thing', 'do it', 'lets do it', 'let\'s do it',
      'love it', 'want it', 'sign us up', 'count me in'
    ];
    
    const rejectionPhrases = [
      'not interested', 'not now', 'next time', 'not this time', 'maybe later',
      'no thanks', 'not really'
    ];
    
    const ambiguousKeywords = [
      'maybe', 'perhaps', 'possibly', 'might', 'not sure', 'hmm', 'dunno'
    ];
    
    const paymentKeywords = ['pay', 'paid', 'payment', 'complete', 'done'];
    const cancelKeywords = ['cancel', 'cancelled', 'abort'];
    
    // Check for exact matches first
    if (['yes', 'y', '1', 'ok'].includes(text)) {
      return { approved: true, rejected: false, status: 'approved', originalText: originalBody.trim(), confidence: 'high' };
    }
    
    if (['no', 'n', '0'].includes(text)) {
      return { approved: false, rejected: true, status: 'rejected', originalText: originalBody.trim(), confidence: 'high' };
    }
    
    // Check for payment confirmation
    if (paymentKeywords.some(keyword => text.includes(keyword))) {
      return { 
        approved: false, 
        rejected: false, 
        status: 'payment_confirmed', 
        originalText: originalBody.trim(),
        isPaymentConfirmation: true,
        confidence: 'high'
      };
    }
    
    // Check for ambiguous responses
    if (ambiguousKeywords.some(keyword => text.includes(keyword))) {
      return { approved: false, rejected: false, status: 'unclear', originalText: originalBody.trim(), confidence: 'low' };
    }
    
    // Check for rejection patterns
    const hasRejectionPhrase = rejectionPhrases.some(phrase => text.includes(phrase));
    const hasRejectionWord = exactRejectionKeywords.some(keyword => {
      if (['❌', '👎'].includes(keyword)) {
        return text.includes(keyword);
      }
      const wordPattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      return wordPattern.test(text);
    });
    const rejected = hasRejectionPhrase || hasRejectionWord;
    
    // Check for approval patterns
    let approved = false;
    if (!hasRejectionPhrase) {
      const hasApprovalPhrase = approvalPhrases.some(phrase => text.includes(phrase));
      const hasApprovalWord = exactApprovalKeywords.some(keyword => {
        if (['✓', '👍'].includes(keyword)) {
          return text.includes(keyword);
        }
        const wordPattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        return wordPattern.test(text);
      });
      approved = hasApprovalPhrase || hasApprovalWord;
    }
    
    // Handle cancellation
    const hasCancellation = cancelKeywords.some(keyword => text.includes(keyword));
    
    if ((approved && hasCancellation) || (approved && rejected)) {
      return { approved: false, rejected: false, status: 'unclear', originalText: originalBody.trim(), confidence: 'low' };
    }
    
    if (hasCancellation && !approved) {
      return { 
        approved: false, 
        rejected: true, 
        status: 'cancelled', 
        originalText: originalBody.trim(),
        confidence: 'high'
      };
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
      originalText: originalBody.trim(),
      confidence,
      isPaymentConfirmation: false
    };
  }

  async getPendingApprovals(emailAddress) {
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
        const pgSql = `
          SELECT sa.*, e.title as event_title, e.date as event_date, e.cost as event_cost
          FROM sms_approvals sa
          LEFT JOIN events e ON sa.event_id = e.id  
          WHERE sa.phone_number = $1 
          AND sa.status = 'sent'
          AND sa.sent_at + INTERVAL '24 hours' > NOW()
          ORDER BY sa.sent_at DESC
        `;
        
        const result = await this.database.postgres.query(pgSql, [emailAddress]);
        return result.rows;
      } else {
        return new Promise((resolve, reject) => {
          this.database.db.all(sql, [emailAddress], (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
      }
    } catch (error) {
      this.logger.error(`Error getting pending approvals for ${emailAddress}:`, error.message);
      return [];
    }
  }

  async sendConfirmationEmail(emailAddress, confirmation) {
    try {
      const subject = this.buildConfirmationSubject(confirmation);
      const body = this.buildConfirmationBody(confirmation);
      
      const messageId = await this.gmailClient.sendEmail([emailAddress], subject, body);
      this.logger.info(`Sent confirmation email to ${emailAddress}: ${confirmation.type}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to send confirmation email:`, error.message);
      // Don't throw - confirmation failures shouldn't break the main flow
    }
  }

  buildConfirmationSubject(confirmation) {
    switch (confirmation.type) {
      case 'approved':
        return `✅ Event Approved: ${confirmation.eventTitle}`;
      case 'rejected':
        return `👍 Event Skipped: ${confirmation.eventTitle}`;
      case 'payment_confirmed':
        return `💳 Payment Confirmed: ${confirmation.eventTitle}`;
      case 'unclear':
        return `❓ Please clarify your response`;
      case 'no_pending':
        return `🎉 No pending approvals`;
      case 'error':
        return `❌ Error processing response`;
      default:
        return `🤖 Family Event Update`;
    }
  }

  buildConfirmationBody(confirmation) {
    const recipientName = config.app.nodeEnv === 'production' ? config.family.parent1Name : config.family.parent2Name;
    
    let body = `Hi ${recipientName}!\n\n${confirmation.message}\n\n`;
    
    if (confirmation.type === 'approved' && confirmation.eventCost === 0) {
      body += `I'll handle the registration automatically and send you a calendar invite once it's confirmed.\n\n`;
    } else if (confirmation.type === 'approved' && confirmation.eventCost > 0) {
      body += `I'll send the payment details in a separate email.\n\n`;
    }
    
    body += `Best,\n`;
    body += `Your Family Event Assistant 🤖`;
    
    return body;
  }

  async sendPaymentLink(event, approvalId) {
    try {
      this.logger.info(`Sending payment link email for event: ${event.title}`);
      
      const recipient = this.getRecipientEmail();
      const subject = `💳 Payment Required: ${event.title}`;
      const emailBody = this.buildPaymentEmailBody(event);
      
      const messageId = await this.gmailClient.sendEmail([recipient], subject, emailBody);
      
      this.logger.info(`Payment link email sent for ${event.title}`);
      
      return {
        messageId,
        message: emailBody,
        sentAt: new Date(),
        recipient
      };
      
    } catch (error) {
      this.logger.error(`Error sending payment link email for ${event.title}:`, error.message);
      throw error;
    }
  }

  buildPaymentEmailBody(event) {
    const recipientName = config.app.nodeEnv === 'production' ? config.family.parent1Name : config.family.parent2Name;
    
    let emailBody = `Hi ${recipientName}!\n\n`;
    emailBody += `Great news! You've approved "${event.title}" for the family.\n\n`;
    emailBody += `**Payment Details:**\n`;
    emailBody += `• Event: ${event.title}\n`;
    emailBody += `• Amount: $${event.cost}\n`;
    
    if (event.registrationUrl) {
      emailBody += `• Payment Link: ${event.registrationUrl}\n\n`;
    } else {
      emailBody += `\n`;
    }
    
    emailBody += `**Next Steps:**\n`;
    emailBody += `1. Click the payment link above to complete your registration\n`;
    emailBody += `2. Complete the payment process\n`;
    emailBody += `3. Reply to this email with "PAID" to confirm completion\n\n`;
    
    emailBody += `⚠️ **Important:** Please complete payment manually and reply "PAID" when done.\n\n`;
    emailBody += `If you've changed your mind, just reply "CANCEL" and I'll skip this event.\n\n`;
    
    emailBody += `Thanks!\n`;
    emailBody += `Your Family Event Assistant 🤖`;
    
    return emailBody;
  }

  async storeMessageId(approvalId, messageId) {
    try {
      // Store Message-ID in approval record for reply detection
      // We'll store it in the message_sent field as JSON with the messageId
      const existingMessage = await this.database.query(
        'SELECT message_sent FROM sms_approvals WHERE id = $1',
        [approvalId]
      );
      
      const messageData = {
        messageId: messageId,
        originalBody: existingMessage.rows?.[0]?.message_sent || ''
      };
      
      await this.database.query(
        'UPDATE sms_approvals SET message_sent = $1 WHERE id = $2',
        [JSON.stringify(messageData), approvalId]
      );
      
      this.logger.debug(`Stored Message-ID ${messageId} for approval ${approvalId}`);
      
    } catch (error) {
      this.logger.warn('Could not store Message-ID for approval:', error.message);
    }
  }
}

class EmailApprovalManager {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.emailClient = new EmailNotificationClient(logger, database);
    this.dailyEventCount = 0;
    this.lastResetDate = new Date().toDateString();
  }

  async init() {
    await this.emailClient.init();
  }

  async sendEventForApproval(event) {
    try {
      if (!this.shouldSendEvent()) {
        this.logger.info(`Daily event limit reached, queuing event: ${event.title}`);
        return null;
      }
      
      const result = await this.emailClient.sendApprovalRequest(event);
      await this.database.updateEventStatus(event.id, 'proposed');
      
      this.incrementDailyCount();
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error sending event for email approval: ${event.title}`, error.message);
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
      this.logger.debug('Reset daily event count for email notifications');
    }
  }

  incrementDailyCount() {
    this.dailyEventCount++;
    this.logger.debug(`Daily email event count: ${this.dailyEventCount}/${config.discovery.eventsPerDayMax}`);
  }

  async handleIncomingResponse(from, subject, body, messageId) {
    return await this.emailClient.handleIncomingEmail(from, subject, body, messageId);
  }

  async processApprovedEvent(eventId, approvalId) {
    try {
      const events = await this.database.getEventsByStatus('approved');
      const event = events.find(e => e.id === eventId);
      
      if (!event) {
        throw new Error(`Approved event not found: ${eventId}`);
      }
      
      if (event.cost > 0) {
        await this.emailClient.sendPaymentLink(event, approvalId);
        this.logger.info(`Payment link email sent for paid event: ${event.title}`);
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

}

module.exports = { EmailNotificationClient, EmailApprovalManager };