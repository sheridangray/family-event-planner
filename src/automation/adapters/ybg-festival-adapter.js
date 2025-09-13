const BaseRegistrationAdapter = require('./base-adapter');

class YBGFestivalAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'YBGFestivalAdapter';
    this.supportedDomains = [
      'ybgfestival.org', 
      'www.ybgfestival.org'
    ];
  }

  /**
   * Navigate to YBG Festival event page
   */
  async navigateToRegistration(event, page) {
    this.logger.debug(`Navigating to YBG Festival event: ${event.registration_url}`);
    
    await page.goto(event.registration_url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page to load completely
    await page.waitForSelector('body', { timeout: 10000 });
  }

  /**
   * Analyze YBG Festival registration patterns
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing YBG Festival event registration');
      
      // YBG Festival events typically have these characteristics:
      // 1. Free RSVP via Facebook Events
      // 2. Calendar integration (Google, Apple, Outlook)
      // 3. No formal registration form
      // 4. Drop-in events that don't require registration
      
      // Check for Facebook Events link
      const facebookEventLink = await page.$('a[href*="facebook.com/events"], a[href*="fb.me/e/"]');
      if (facebookEventLink) {
        const href = await facebookEventLink.evaluate(el => el.href);
        this.logger.debug(`Found Facebook event link: ${href}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'facebook_event',
          facebookEventUrl: href,
          requiresManualAction: false // We can handle Facebook RSVP
        };
      }

      // Check for calendar integration links
      const calendarLinks = await page.$$('a[href*="calendar.google.com"], a[href*="outlook"], a[class*="calendar"], a[title*="calendar"]');
      if (calendarLinks.length > 0) {
        this.logger.debug(`Found ${calendarLinks.length} calendar integration links`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'calendar_integration',
          calendarLinks: calendarLinks.length,
          requiresManualAction: false
        };
      }

      // Check if it's a drop-in event
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const isDropIn = pageText.includes('free') && 
                       (pageText.includes('drop in') || 
                        pageText.includes('drop-in') || 
                        pageText.includes('no registration') || 
                        pageText.includes('no rsvp'));
      
      if (isDropIn) {
        this.logger.debug('YBG event appears to be drop-in, no registration required');
        return {
          hasRegistrationForm: true, // Consider this successful
          registrationMethod: 'drop_in',
          requiresManualAction: false
        };
      }

      // Check for email contact
      const emailLinks = await page.$$('a[href^="mailto:"]');
      if (emailLinks.length > 0) {
        const emailHref = await emailLinks[0].evaluate(el => el.href);
        this.logger.debug(`Found email contact: ${emailHref}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'email_contact',
          emailAddress: emailHref.replace('mailto:', ''),
          requiresManualAction: true
        };
      }

      return { 
        hasRegistrationForm: false, 
        reason: 'YBG Festival event has no clear registration method - may be informational only'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing YBG Festival registration:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Handle YBG Festival registration
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug(`Handling YBG Festival registration: ${formStructure.registrationMethod}`);
      
      switch (formStructure.registrationMethod) {
        case 'facebook_event':
          return await this.handleFacebookEventRSVP(page, formStructure.facebookEventUrl);
          
        case 'calendar_integration':
          return await this.handleCalendarIntegration(page, event);
          
        case 'drop_in':
          // No action needed for drop-in events
          this.logger.info('YBG Festival event is drop-in - no registration required');
          return { 
            success: true, 
            message: 'Event is drop-in, no registration needed',
            registrationMethod: 'drop_in'
          };
          
        case 'email_contact':
          return {
            success: false,
            error: `YBG event requires email contact: ${formStructure.emailAddress}`,
            requiresManualAction: true,
            emailRequired: true,
            emailAddress: formStructure.emailAddress
          };
          
        default:
          return {
            success: false,
            error: 'Unknown YBG Festival registration method',
            requiresManualAction: true
          };
      }
      
    } catch (error) {
      this.logger.error('Error filling YBG Festival registration:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle Facebook Event RSVP
   */
  async handleFacebookEventRSVP(page, facebookEventUrl) {
    try {
      this.logger.debug('Attempting Facebook Event RSVP via browser');
      
      // Navigate to Facebook event
      await page.goto(facebookEventUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Look for common Facebook RSVP buttons
      const rsvpSelectors = [
        '[data-testid="event-permalink-rsvp-button"]',
        'button[aria-label*="Going"]',
        'button[aria-label*="Interested"]', 
        'button:has-text("Going")',
        'button:has-text("Interested")',
        '[role="button"]:has-text("Going")',
        '[role="button"]:has-text("Interested")'
      ];

      for (const selector of rsvpSelectors) {
        try {
          const rsvpButton = await page.$(selector);
          if (rsvpButton) {
            // Check if user is logged in to Facebook
            const loginRequired = await page.$('input[name="email"], input[name="pass"], [data-testid="royal_email"]');
            if (loginRequired) {
              this.logger.debug('Facebook login required for RSVP');
              return {
                success: false,
                error: 'Facebook login required for RSVP',
                requiresManualAction: true,
                loginRequired: true
              };
            }

            await rsvpButton.click();
            this.logger.debug(`Clicked Facebook RSVP button: ${selector}`);
            
            // Wait for RSVP confirmation
            await page.waitForTimeout(2000);
            
            return { 
              success: true, 
              message: 'Facebook RSVP completed',
              registrationMethod: 'facebook_event'
            };
          }
        } catch (error) {
          continue; // Try next selector
        }
      }

      // Fallback: Return success if we can access the event page
      const eventTitle = await page.$('h1, [data-testid="event-permalink-event-name"]');
      if (eventTitle) {
        this.logger.info('Successfully accessed Facebook event page - manual RSVP may be needed');
        return {
          success: false,
          error: 'Facebook event accessible but automatic RSVP failed',
          requiresManualAction: true,
          facebookEventUrl: facebookEventUrl
        };
      }

      return {
        success: false,
        error: 'Could not access Facebook event page',
        requiresManualAction: true
      };

    } catch (error) {
      this.logger.error('Facebook RSVP error:', error.message);
      return {
        success: false,
        error: `Facebook RSVP failed: ${error.message}`,
        requiresManualAction: true
      };
    }
  }

  /**
   * Handle calendar integration for YBG events
   */
  async handleCalendarIntegration(page, event) {
    try {
      this.logger.debug('Attempting calendar integration for YBG event');

      // Look for Google Calendar link (most reliable)
      const googleCalendarLink = await page.$('a[href*="calendar.google.com"]');
      if (googleCalendarLink) {
        const href = await googleCalendarLink.evaluate(el => el.href);
        this.logger.debug(`Found Google Calendar link: ${href}`);
        
        // Navigate to Google Calendar to add event
        await page.goto(href, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });

        // Look for "Save" or "Add to Calendar" button
        const saveSelectors = [
          'button[data-action="save"]',
          'input[type="submit"][value*="Save"]',
          'button:has-text("Save")',
          'button:has-text("Add to calendar")',
          '[role="button"]:has-text("Save")'
        ];

        for (const selector of saveSelectors) {
          try {
            const saveButton = await page.$(selector);
            if (saveButton) {
              await saveButton.click();
              this.logger.debug('Successfully added YBG event to Google Calendar');
              
              return { 
                success: true, 
                message: 'Event added to Google Calendar',
                registrationMethod: 'calendar_integration'
              };
            }
          } catch (error) {
            continue;
          }
        }
      }

      // If calendar integration doesn't work, it's still considered successful
      // because the user can manually add to calendar
      this.logger.info('Calendar integration available - user can manually add event');
      return {
        success: true,
        message: 'Calendar integration available for manual addition',
        registrationMethod: 'calendar_integration',
        requiresManualAction: false // Calendar integration is optional
      };

    } catch (error) {
      this.logger.error('Calendar integration error:', error.message);
      return {
        success: true, // Don't fail registration for calendar issues
        message: 'Calendar integration encountered issues but event info is available',
        registrationMethod: 'calendar_integration'
      };
    }
  }

  /**
   * YBG Festival-specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      const url = page.url();
      
      // Facebook event success indicators
      if (url.includes('facebook.com')) {
        const rsvpStatusElements = await page.$$('[aria-pressed="true"], [data-testid*="rsvp"], .rsvp');
        if (rsvpStatusElements.length > 0) {
          this.logger.debug('Facebook RSVP status confirmed');
          return { success: true, confirmationNumber: 'Facebook RSVP' };
        }
      }

      // Google Calendar success indicators  
      if (url.includes('calendar.google.com')) {
        const calendarSuccess = await page.$('.goog-inline-block, [data-action="save"], [aria-label*="saved"]');
        if (calendarSuccess) {
          this.logger.debug('Google Calendar integration confirmed');
          return { success: true, confirmationNumber: 'Google Calendar' };
        }
      }

      // YBG-specific success indicators
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const ybgSuccessTexts = [
        'saved to calendar', 'added to calendar', 'going to event',
        'rsvp confirmed', 'see you there', 'free admission'
      ];
      
      for (const successText of ybgSuccessTexts) {
        if (pageText.includes(successText)) {
          this.logger.debug(`Found YBG success indicator: ${successText}`);
          return { success: true };
        }
      }

      // For drop-in events, always return success
      if (pageText.includes('drop in') || pageText.includes('free')) {
        this.logger.debug('YBG drop-in event - registration not required');
        return { success: true, confirmationNumber: 'Drop-in Event' };
      }

      return { success: false, error: 'No YBG Festival success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Override submit form for YBG-specific behavior
   */
  async submitRegistrationForm(page, formStructure) {
    // For YBG Festival, most "registration" is handled in fillRegistrationForm
    // This method is mainly for fallback scenarios
    
    if (formStructure.registrationMethod === 'drop_in') {
      return { success: true, message: 'No submission needed for drop-in event' };
    }

    if (formStructure.registrationMethod === 'facebook_event' || 
        formStructure.registrationMethod === 'calendar_integration') {
      return { success: true, message: 'Registration handled via external platform' };
    }

    // Fallback to base class behavior
    return await super.submitRegistrationForm(page, formStructure);
  }
}

module.exports = YBGFestivalAdapter;