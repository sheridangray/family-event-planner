const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');
const RetryManager = require('../services/retry-manager');

// Import adapters
const GenericRegistrationAdapter = require('./adapters/generic-adapter');
const CalAcademyAdapter = require('./adapters/cal-academy-adapter');
const SFRecParksAdapter = require('./adapters/sf-recparks-adapter');
const ExploraoriumAdapter = require('./adapters/exploratorium-adapter');
const SFLibraryAdapter = require('./adapters/sf-library-adapter');
const CommunityEventsAdapter = require('./adapters/community-events-adapter');

class RegistrationAutomator {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.browser = null;
    this.adapters = {};
    this.familyData = null;
    this.retryManager = new RetryManager(logger);
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
      
      // Load family data for form filling
      await this.loadFamilyData();
      
      // Initialize registration adapters
      this.initializeAdapters();
      
      this.logger.info('Registration automator initialized with Puppeteer and adapters');
    } catch (error) {
      this.logger.error('Failed to initialize registration automator:', error.message);
      this.logger.warn('Continuing without registration automation');
      this.browser = null;
    }
  }

  /**
   * Load family data for form filling
   */
  async loadFamilyData() {
    try {
      const familyMembers = await this.database.getFamilyMembers(true);
      
      const parents = familyMembers.filter(member => member.role === 'parent');
      const children = familyMembers.filter(member => member.role === 'child');

      this.familyData = {
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
      
      this.logger.debug('Family data loaded for registration forms');
    } catch (error) {
      this.logger.warn('Could not load family data:', error.message);
      // Use fallback family data
      this.familyData = {
        parent1Name: config.family.parent1Name || 'Parent Name',
        parent1Email: config.gmail.parent1Email || 'parent@example.com',
        parent2Name: config.family.parent2Name || 'Parent 2 Name',
        parent2Email: config.gmail.parent2Email || 'parent2@example.com',
        children: [],
        emergencyContact: config.family.emergencyContact || '555-123-4567'
      };
    }
  }

  /**
   * Calculate age from birthdate
   */
  calculateAge(birthdate) {
    if (!birthdate) return null;
    
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
   * Initialize registration adapters
   */
  initializeAdapters() {
    // Generic adapter (fallback for all sites)
    this.adapters.generic = new GenericRegistrationAdapter(this.logger, this.familyData);
    
    // High-priority custom adapters
    this.adapters['calacademy.org'] = new CalAcademyAdapter(this.logger, this.familyData);
    this.adapters['www.calacademy.org'] = new CalAcademyAdapter(this.logger, this.familyData);
    
    this.adapters['sfrecpark.org'] = new SFRecParksAdapter(this.logger, this.familyData);
    this.adapters['www.sfrecpark.org'] = new SFRecParksAdapter(this.logger, this.familyData);
    
    this.adapters['exploratorium.edu'] = new ExploraoriumAdapter(this.logger, this.familyData);
    this.adapters['www.exploratorium.edu'] = new ExploraoriumAdapter(this.logger, this.familyData);
    
    this.adapters['sfpl.org'] = new SFLibraryAdapter(this.logger, this.familyData);
    this.adapters['www.sfpl.org'] = new SFLibraryAdapter(this.logger, this.familyData);
    
    // Community events adapter (handles multiple domains)
    const communityAdapter = new CommunityEventsAdapter(this.logger, this.familyData);
    this.adapters['bayareakidfun.com'] = communityAdapter;
    this.adapters['www.bayareakidfun.com'] = communityAdapter;
    this.adapters['sf.funcheap.com'] = communityAdapter;
    this.adapters['funcheap.com'] = communityAdapter;
    this.adapters['kidsoutandabout.com'] = communityAdapter;
    this.adapters['sanfran.kidsoutandabout.com'] = communityAdapter;
    this.adapters['ybgfestival.org'] = communityAdapter;
    this.adapters['www.ybgfestival.org'] = communityAdapter;
    
    // Chase Center - typically uses Ticketmaster (third-party)
    this.adapters['chasecenter.com'] = communityAdapter; // Uses community adapter for third-party detection
    this.adapters['www.chasecenter.com'] = communityAdapter;
    
    const customAdapterCount = Object.keys(this.adapters).filter(k => k !== 'generic').length;
    this.logger.debug(`Initialized ${Object.keys(this.adapters).length} registration adapters (${customAdapterCount} custom domains, 1 generic)`);
    this.logger.info(`Custom registration adapters active for: Cal Academy, SF Rec & Parks, Exploratorium, SF Library, and Community Events`);
  }

  /**
   * Get appropriate adapter for a registration URL
   */
  getAdapterForEvent(event) {
    try {
      const registrationUrl = event.registration_url || event.registrationUrl;
      if (!registrationUrl) {
        return this.adapters.generic;
      }
      
      const url = new URL(registrationUrl);
      const domain = url.hostname.toLowerCase();
      
      // Check for site-specific adapter
      if (this.adapters[domain]) {
        this.logger.debug(`Using site-specific adapter for: ${domain}`);
        return this.adapters[domain];
      }
      
      // Check for partial domain matches (e.g., subdomain.calacademy.org)
      for (const [adapterDomain, adapter] of Object.entries(this.adapters)) {
        if (adapterDomain !== 'generic' && domain.includes(adapterDomain)) {
          this.logger.debug(`Using partial match adapter ${adapterDomain} for: ${domain}`);
          return adapter;
        }
      }
      
      // Fallback to generic adapter
      this.logger.debug(`Using generic adapter for: ${domain}`);
      return this.adapters.generic;
      
    } catch (error) {
      this.logger.warn('Error selecting adapter, using generic:', error.message);
      return this.adapters.generic;
    }
  }

  async registerForEvent(event) {
    if (!this.browser) {
      this.logger.warn(`Cannot auto-register for ${event.title} - browser automation unavailable`);
      return {
        success: false,
        message: 'Browser automation not available',
        adapterType: 'none',
        requiresManualAction: true
      };
    }

    const registrationUrl = event.registration_url || event.registrationUrl;
    if (!registrationUrl) {
      throw new Error('No registration URL provided');
    }

    if (event.cost > 0) {
      this.logger.error(`CRITICAL SAFETY: Attempted to auto-register for PAID event: ${event.title} ($${event.cost})`);
      throw new Error('SAFETY VIOLATION: Cannot auto-register for paid events');
    }

    this.logger.info(`Starting automated registration for FREE event: ${event.title}`);
    this.logger.debug(`Registration URL: ${registrationUrl}`);
    
    // Get appropriate adapter for this event
    const adapter = this.getAdapterForEvent(event);
    
    // Check if event should be retried based on recent history
    if (!this.retryManager.shouldRetryEvent(event.id, adapter.name)) {
      return {
        success: false,
        message: 'Registration attempt skipped due to recent failure',
        adapterType: adapter.name,
        requiresManualAction: true,
        skipReason: 'recent_failure'
      };
    }
    
    // Prepare retry context
    const retryContext = {
      eventId: event.id,
      eventTitle: event.title,
      adapterName: adapter.name,
      registrationUrl: registrationUrl
    };
    
    // Execute registration with intelligent retry
    return await this.retryManager.executeWithRetry(
      async () => {
        const page = await this.browser.newPage();
        try {
          // Set user agent and other browser properties to appear more human-like
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
          
          // Attempt registration using selected adapter
          const result = await adapter.attemptRegistration(event, page);
          
          if (!result.success) {
            // Convert registration failure to retriable error based on the reason
            const error = new Error(result.message || 'Registration failed');
            error.registrationResult = result;
            throw error;
          }
          
          this.logger.info(`Registration completed successfully for ${event.title}`);
          return {
            ...result,
            adapterType: adapter.name
          };
          
        } finally {
          await page.close();
        }
      },
      retryContext,
      this.getRetryOptionsForEvent(event, adapter)
    ).catch(error => {
      this.logger.error(`Registration failed for ${event.title} after retries:`, error.message);
      
      // Return the original registration result if available, otherwise create error result
      if (error.registrationResult) {
        return {
          ...error.registrationResult,
          adapterType: adapter.name,
          retriedFailed: true
        };
      }
      
      return {
        success: false,
        message: error.message,
        adapterType: adapter.name,
        requiresManualAction: true,
        retriedFailed: true
      };
    });
  }

  /**
   * Get retry options customized for specific event and adapter
   */
  getRetryOptionsForEvent(event, adapter) {
    const baseOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    };

    // Customize retry behavior based on adapter type
    switch (adapter.name) {
      case 'CalAcademyAdapter':
        return {
          ...baseOptions,
          maxRetries: 2, // Fewer retries for ticketing systems
          baseDelay: 2000 // Longer initial delay
        };

      case 'SFRecParksAdapter':
        return {
          ...baseOptions,
          maxRetries: 4, // More retries for CLASS system
          baseDelay: 3000, // Longer delays due to system complexity
          retryableErrors: [
            'network_error', 'server_error', 'browser_error', 'unknown_error'
            // Don't retry 'rate_limit' for SF Rec Parks as they have strict limits
          ]
        };

      case 'ExploraoriumAdapter':
        return {
          ...baseOptions,
          maxRetries: 3,
          baseDelay: 1500
        };

      case 'SFLibraryAdapter':
        return {
          ...baseOptions,
          maxRetries: 5, // Libraries are usually patient with retries
          baseDelay: 1000
        };

      case 'CommunityEventsAdapter':
        return {
          ...baseOptions,
          maxRetries: 2, // Community sites vary widely in reliability
          baseDelay: 2000,
          retryableErrors: [
            'network_error', 'server_error', 'site_unavailable', 'unknown_error'
            // Skip 'browser_error' as community sites often have quirky JS
          ]
        };

      case 'GenericAdapter':
        return {
          ...baseOptions,
          maxRetries: 2, // Conservative for unknown sites
          baseDelay: 2500,
          maxDelay: 20000
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Get retry statistics for monitoring
   */
  getRetryStats() {
    return this.retryManager.getRetryStats();
  }

  /**
   * Clean up old retry history
   */
  cleanupRetryHistory(maxAgeHours = 24) {
    this.retryManager.cleanupHistory(maxAgeHours);
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
    // Clean up retry history before closing
    this.cleanupRetryHistory();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Registration automator closed');
    }
  }
}

module.exports = RegistrationAutomator;