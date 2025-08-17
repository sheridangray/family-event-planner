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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Registration automator closed');
    }
  }
}

module.exports = RegistrationAutomator;