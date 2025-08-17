const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');

class RegistrationAutomator {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.browser = null;
  }

  async init() {
    try {
      // Render-friendly Puppeteer configuration
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      });
      this.logger.info('Registration automator initialized with Puppeteer');
    } catch (error) {
      this.logger.error('Failed to initialize registration automator:', error.message);
      this.logger.warn('Continuing without registration automation');
      this.browser = null;
    }
  }

  async registerForEvent(event) {
    if (!this.browser) {
      this.logger.warn(`Cannot auto-register for ${event.title} - browser automation unavailable`);
      return {
        success: false,
        message: 'Browser automation not available',
        registrationUrl: event.registrationUrl,
        requiresManualAction: true
      };
    }

    if (!event.registrationUrl) {
      throw new Error('No registration URL provided');
    }

    if (event.cost > 0) {
      this.logger.error(`CRITICAL SAFETY: Attempted to auto-register for PAID event: ${event.title} ($${event.cost})`);
      throw new Error('SAFETY VIOLATION: Cannot auto-register for paid events');
    }

    this.logger.info(`Starting registration for FREE event: ${event.title}`);
    
    // For MVP: Just navigate to the page and log the URL
    const page = await this.browser.newPage();
    try {
      await page.goto(event.registrationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      this.logger.info(`Successfully loaded registration page for: ${event.title}`);
      
      return {
        success: true,
        message: 'Registration page loaded successfully (auto-fill not implemented yet)',
        registrationUrl: event.registrationUrl,
        requiresManualAction: true
      };
    } catch (error) {
      this.logger.error(`Failed to load registration page: ${error.message}`);
      return {
        success: false,
        message: `Failed to load registration page: ${error.message}`,
        registrationUrl: event.registrationUrl,
        requiresManualAction: true
      };
    } finally {
      await page.close();
    }
  }

  async processApprovedEvents() {
    try {
      this.logger.info('Processing approved events for registration...');
      
      const approvedEvents = await this.database.getEventsByStatus('approved');
      const readyEvents = await this.database.getEventsByStatus('ready_for_registration');
      
      const eventsToProcess = [...approvedEvents, ...readyEvents];
      const results = [];
      
      for (const event of eventsToProcess) {
        try {
          this.logger.info(`Processing event: ${event.title}`);
          
          // Check if event requires payment
          if (event.cost > 0 && event.status === 'approved') {
            // Paid events need payment confirmation first
            this.logger.info(`Event ${event.title} requires payment ($${event.cost}) - skipping auto-registration`);
            results.push({
              eventId: event.id,
              title: event.title,
              success: false,
              requiresPayment: true,
              message: 'Waiting for payment confirmation'
            });
            continue;
          }
          
          // Process free events or events that are ready for registration
          const registrationResult = await this.registerForEvent(event);
          
          if (registrationResult.success) {
            await this.database.updateEventStatus(event.id, 'booked');
            this.logger.info(`Successfully processed registration for: ${event.title}`);
          }
          
          results.push({
            eventId: event.id,
            title: event.title,
            success: registrationResult.success,
            requiresPayment: false,
            message: registrationResult.message,
            registrationUrl: registrationResult.registrationUrl,
            requiresManualAction: registrationResult.requiresManualAction
          });
          
        } catch (error) {
          this.logger.error(`Error processing event ${event.title}:`, error.message);
          
          // Save failed registration attempt
          await this.database.saveRegistration({
            eventId: event.id,
            success: false,
            errorMessage: error.message,
            paymentRequired: event.cost > 0,
            paymentAmount: event.cost
          });
          
          results.push({
            eventId: event.id,
            title: event.title,
            success: false,
            requiresPayment: event.cost > 0,
            message: error.message,
            error: true
          });
        }
      }
      
      this.logger.info(`Processed ${results.length} events: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);
      return results;
      
    } catch (error) {
      this.logger.error('Error processing approved events:', error.message);
      return [];
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Registration automator closed');
    }
  }
}

module.exports = RegistrationAutomator;