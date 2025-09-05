const RegistrationAutomator = require('../automation/registration');
const { EmailNotificationClient } = require('../mcp/email-notifications');
const CalendarManager = require('./calendar-manager');
const { config } = require('../config');

class RegistrationOrchestrator {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.registrationAutomator = new RegistrationAutomator(logger, database);
    this.emailClient = new EmailNotificationClient(logger, database);
    this.calendarManager = new CalendarManager(logger);
  }

  async init() {
    await this.registrationAutomator.init();
    await this.emailClient.init();
    await this.calendarManager.init();
    this.logger.info('Registration orchestrator initialized');
  }

  /**
   * Main entry point: Process auto-registration after email "YES" reply
   */
  async processAutoRegistration(eventId, approvalId) {
    try {
      this.logger.info(`Processing auto-registration for event ${eventId}, approval ${approvalId}`);
      
      // Get event details
      const event = await this.database.getEventById(eventId);
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      // Update status to registering
      await this.database.updateEventStatus(eventId, 'registering');
      this.logger.debug(`Updated event ${eventId} status to 'registering'`);

      // Get family data for registration
      const familyData = await this.getFamilyRegistrationData();

      // Attempt automated registration
      const registrationResult = await this.attemptRegistration(event, familyData);

      // Handle the result
      await this.handleRegistrationResult(event, registrationResult, approvalId);

      // Record analytics
      await this.recordRegistrationAttempt(eventId, approvalId, registrationResult);

      return registrationResult;

    } catch (error) {
      this.logger.error(`Error in processAutoRegistration for event ${eventId}:`, error.message);
      
      // Fallback to manual registration on any error
      await this.handleRegistrationFailure(eventId, approvalId, error.message);
      throw error;
    }
  }

  /**
   * Attempt automated registration using available adapters
   */
  async attemptRegistration(event, familyData) {
    // Get registration URL (handle both possible field names) 
    const registrationUrl = event.registration_url || event.registrationUrl;
    
    try {
      this.logger.info(`Attempting automated registration for: ${event.title}`);
      
      // Safety check - never auto-register for paid events
      if (event.cost > 0) {
        this.logger.warn(`Skipping auto-registration for paid event: ${event.title} ($${event.cost})`);
        return {
          success: false,
          type: 'paid_event',
          message: 'Paid events require manual registration after payment',
          requiresManualAction: true,
          registrationUrl: registrationUrl
        };
      }

      // Check if registration URL exists
      this.logger.debug(`Event fields - registration_url: ${event.registration_url}, registrationUrl: ${event.registrationUrl}, final: ${registrationUrl}`);
      
      if (!registrationUrl) {
        this.logger.warn(`No registration URL for event: ${event.title}`);
        return {
          success: false,
          type: 'no_registration_url',
          message: 'No registration URL provided',
          requiresManualAction: true
        };
      }

      // Attempt automated registration
      const startTime = Date.now();
      const result = await this.registrationAutomator.registerForEvent(event);
      const timeTaken = Date.now() - startTime;

      // Enhance result with timing and metadata
      result.timeTaken = timeTaken;
      result.siteDomain = this.extractDomain(registrationUrl);
      result.eventId = event.id;

      this.logger.info(`Registration attempt completed in ${timeTaken}ms: ${result.success ? 'SUCCESS' : 'FAILED'}`);

      return result;

    } catch (error) {
      this.logger.error(`Registration attempt failed:`, error.message);
      return {
        success: false,
        type: 'automation_error',
        message: error.message,
        requiresManualAction: true,
        registrationUrl: registrationUrl
      };
    }
  }

  /**
   * Handle registration result - success, failure, or partial
   */
  async handleRegistrationResult(event, result, approvalId) {
    if (result.success) {
      await this.handleRegistrationSuccess(event, result, approvalId);
    } else {
      await this.handleRegistrationFailure(event.id, approvalId, result.message, result);
    }
  }

  /**
   * Handle successful registration
   */
  async handleRegistrationSuccess(event, result, approvalId) {
    try {
      // Update event status
      await this.database.updateEventStatus(event.id, 'registered');

      // Create calendar event automatically
      const calendarResult = await this.calendarManager.createEventForRegistration(event, result);
      
      // Save registration record with calendar info
      await this.database.saveRegistration({
        eventId: event.id,
        success: true,
        confirmationNumber: result.confirmationNumber,
        adapterUsed: result.adapterType || 'default',
        triggeredBy: 'email_approval',
        approvalId: approvalId,
        calendarEventCreated: calendarResult.success,
        calendarEventId: calendarResult.calendarEventId,
        calendarEventLink: calendarResult.eventLink
      });

      // Send success confirmation email with calendar info
      await this.sendSuccessConfirmation(event, result, calendarResult);

      this.logger.info(`Successfully registered for event: ${event.title}${calendarResult.success ? ' (calendar event created)' : ''}`);

    } catch (error) {
      this.logger.error(`Error handling registration success:`, error.message);
      // Still treat as success, but log the post-processing error
    }
  }

  /**
   * Handle registration failure - send smart manual registration
   */
  async handleRegistrationFailure(eventId, approvalId, errorMessage, result = {}) {
    try {
      const event = await this.database.getEventById(eventId);
      
      // Determine final status based on retry behavior
      const finalStatus = result.skipReason === 'recent_failure' ? 'registration_failed' : 'manual_registration_sent';
      
      // Update event status
      await this.database.updateEventStatus(eventId, finalStatus);

      // Save failed registration attempt with retry information
      await this.database.saveRegistration({
        eventId: eventId,
        success: false,
        errorMessage: errorMessage,
        adapterUsed: result.adapterType || 'none',
        triggeredBy: 'email_approval',
        approvalId: approvalId,
        requiresManualCompletion: true,
        retriedFailed: result.retriedFailed || false,
        skipReason: result.skipReason || null
      });

      // Don't send manual registration for recent failures
      if (result.skipReason === 'recent_failure') {
        this.logger.info(`Skipped manual registration for recently failed event: ${event.title}`);
        return;
      }

      // Generate smart manual registration
      const familyData = await this.getFamilyRegistrationData();
      await this.sendSmartManualRegistration(event, familyData, result);

      this.logger.info(`Sent smart manual registration for event: ${event.title}`);

    } catch (error) {
      this.logger.error(`Error handling registration failure:`, error.message);
    }
  }

  /**
   * Send success confirmation with calendar invite
   */
  async sendSuccessConfirmation(event, result, calendarResult = null) {
    const recipient = this.getRecipientEmail();
    const subject = `✅ Registration Confirmed: ${event.title}`;
    
    const emailBody = this.buildSuccessConfirmationBody(event, result, calendarResult);
    
    await this.emailClient.gmailClient.sendEmail([recipient], subject, emailBody);
    
    this.logger.info(`Success confirmation sent for: ${event.title}`);
  }

  /**
   * Send smart manual registration with pre-filled family data
   */
  async sendSmartManualRegistration(event, familyData, failureResult) {
    const recipient = this.getRecipientEmail();
    const subject = `🎯 Complete Registration: ${event.title}`;
    
    const emailBody = this.buildManualRegistrationBody(event, familyData, failureResult);
    
    await this.emailClient.gmailClient.sendEmail([recipient], subject, emailBody);
    
    this.logger.info(`Smart manual registration sent for: ${event.title}`);
  }

  /**
   * Build success confirmation email body
   */
  buildSuccessConfirmationBody(event, result, calendarResult = null) {
    const recipientName = config.app.nodeEnv === 'production' ? config.family.parent1Name : config.family.parent2Name;
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    let body = `Hi ${recipientName}!\n\n`;
    body += `🎉 Great news! I successfully registered your family for:\n\n`;
    body += `**${event.title}**\n`;
    body += `📅 ${formattedDate}\n`;
    body += `📍 ${event.location_address}\n`;
    
    if (result.confirmationNumber) {
      body += `🎫 Confirmation: ${result.confirmationNumber}\n`;
    }
    
    body += `\n`;

    if (event.cost === 0) {
      body += `💰 FREE Event - No payment required!\n\n`;
    }

    // Calendar integration status
    if (calendarResult && calendarResult.success) {
      body += `📅 **Calendar Event**: ✅ Automatically added to your calendar!\n`;
      if (calendarResult.eventLink) {
        body += `View/Edit Event: ${calendarResult.eventLink}\n`;
      }
      body += `\n`;
    } else {
      // Provide manual calendar link as fallback
      const manualCalendarUrl = this.calendarManager.generateCalendarUrl(event);
      if (manualCalendarUrl) {
        body += `📅 **Add to Calendar**: Click here to add manually → ${manualCalendarUrl}\n\n`;
      } else {
        body += `📅 **Calendar**: Please add this event to your calendar manually.\n\n`;
      }
    }
    
    if (event.description) {
      body += `📝 **About the Event:**\n${event.description}\n\n`;
    }

    body += `📍 **Getting There:**\n`;
    body += `Address: ${event.location_address}\n`;
    body += `Plan to arrive 10-15 minutes early for check-in.\n\n`;

    body += `⏰ **Reminders**: `;
    if (calendarResult && calendarResult.success) {
      body += `I've set up automatic reminders (1 day, 2 hours, and 30 minutes before).\n\n`;
    } else {
      body += `Set personal reminders for 1 day and 2 hours before the event.\n\n`;
    }

    body += `❓ **Questions?** Just reply to this email.\n\n`;
    body += `Have a wonderful time!\n`;
    body += `Your Family Event Assistant 🤖`;

    return body;
  }

  /**
   * Build manual registration email body with family data
   */
  buildManualRegistrationBody(event, familyData, failureResult) {
    const recipientName = config.app.nodeEnv === 'production' ? config.family.parent1Name : config.family.parent2Name;
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    let body = `Hi ${recipientName}!\n\n`;
    body += `I tried to register you automatically for "${event.title}", but the registration requires some manual steps.\n\n`;
    
    body += `**Event Details:**\n`;
    body += `📅 ${formattedDate}\n`;
    body += `📍 ${event.location_address}\n`;
    body += `💰 ${event.cost === 0 ? 'FREE!' : `$${event.cost}`}\n\n`;

    body += `🎯 **Quick Registration Link:**\n`;
    body += `${event.registration_url || event.registrationUrl}\n\n`;

    body += `📋 **Your Family Info (for easy copy/paste):**\n`;
    body += `• **Adult 1:** ${familyData.parent1Name} - ${familyData.parent1Email}\n`;
    body += `• **Adult 2:** ${familyData.parent2Name} - ${familyData.parent2Email}\n`;
    
    familyData.children.forEach(child => {
      body += `• **Child:** ${child.name}, Age ${child.age}\n`;
    });
    
    body += `• **Phone:** ${familyData.emergencyContact}\n\n`;

    if (failureResult.type === 'automation_error') {
      if (failureResult.retriedFailed) {
        body += `💡 **Why Manual?** I tried multiple times but couldn't complete the registration automatically. The form needed specific information I couldn't fill.\n\n`;
      } else {
        body += `💡 **Why Manual?** The registration form needed some specific information I couldn't automatically fill.\n\n`;
      }
    } else if (failureResult.type === 'paid_event') {
      body += `💡 **Why Manual?** This is a paid event requiring secure payment processing.\n\n`;
    } else if (failureResult.retriedFailed) {
      body += `💡 **Why Manual?** I attempted registration multiple times but encountered persistent issues. Manual registration will be most reliable.\n\n`;
    } else {
      body += `💡 **Why Manual?** Some registration forms require human verification.\n\n`;
    }

    // Add calendar link for manual events too
    const manualCalendarUrl = this.calendarManager.generateCalendarUrl(event);
    if (manualCalendarUrl) {
      body += `📅 **Add to Calendar**: Once you register, click here to add the event → ${manualCalendarUrl}\n\n`;
    }

    body += `⏰ **Registration Tip:** Most events fill up quickly, so register as soon as possible!\n\n`;
    body += `📱 **Need Help?** Just reply to this email with any questions.\n\n`;
    body += `Thanks!\n`;
    body += `Your Family Event Assistant 🤖`;

    return body;
  }

  /**
   * Get family data for registration forms
   */
  async getFamilyRegistrationData() {
    const familyMembers = await this.database.getFamilyMembers(true);
    
    const parents = familyMembers.filter(member => member.role === 'parent');
    const children = familyMembers.filter(member => member.role === 'child');

    return {
      parent1Name: parents[0]?.name || config.family.parent1Name,
      parent1Email: config.gmail.parent1Email,
      parent2Name: parents[1]?.name || config.family.parent2Name, 
      parent2Email: config.gmail.parent2Email,
      children: children.map(child => ({
        name: child.name,
        age: this.calculateAge(child.birthdate)
      })),
      emergencyContact: config.family.emergencyContact
    };
  }

  /**
   * Calculate age from birthdate
   */
  calculateAge(birthdate) {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get recipient email address
   */
  getRecipientEmail() {
    return config.app.nodeEnv === 'production' ? config.gmail.parent1Email : config.gmail.parent2Email;
  }

  /**
   * Record registration attempt for analytics
   */
  async recordRegistrationAttempt(eventId, approvalId, result) {
    try {
      // This will be implemented when we add the database schema
      this.logger.debug(`Recording registration attempt: ${eventId} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      // TODO: Implement database logging when schema is added
      // await this.database.recordRegistrationAttempt({
      //   eventId,
      //   approvalId, 
      //   siteDomain: result.siteDomain,
      //   adapterType: result.adapterType || 'default',
      //   attemptResult: result.success ? 'success' : 'failed',
      //   failureReason: result.message,
      //   timeTakenMs: result.timeTaken
      // });
      
    } catch (error) {
      this.logger.warn('Could not record registration attempt:', error.message);
    }
  }

  /**
   * Get retry statistics for monitoring
   */
  getRetryStatistics() {
    return this.registrationAutomator.getRetryStats();
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats() {
    return await this.calendarManager.getCalendarStats();
  }

  /**
   * Clean up resources
   */
  async close() {
    await this.registrationAutomator.close();
    
    // Only call close if the method exists
    if (this.emailClient && typeof this.emailClient.close === 'function') {
      await this.emailClient.close();
    }
    
    // Calendar manager doesn't need explicit cleanup
    this.logger.info('Registration orchestrator closed');
  }
}

module.exports = RegistrationOrchestrator;