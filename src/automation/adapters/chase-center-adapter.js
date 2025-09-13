const BaseRegistrationAdapter = require('./base-adapter');

class ChaseCenterAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'ChaseCenterAdapter';
    this.supportedDomains = [
      'chasecenter.com',
      'www.chasecenter.com'
    ];
  }

  /**
   * Navigate to Chase Center event page
   */
  async navigateToRegistration(event, page) {
    this.logger.debug(`Navigating to Chase Center event: ${event.registration_url}`);
    
    await page.goto(event.registration_url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page content to load
    await page.waitForSelector('body', { timeout: 10000 });
  }

  /**
   * Analyze Chase Center ticketing patterns
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing Chase Center event ticketing');
      
      // Chase Center events typically:
      // 1. Use Ticketmaster for most ticket sales (Warriors, concerts, major events)
      // 2. Have direct Chase Center ticket sales for some events
      // 3. Offer group ticket packages
      // 4. Have season ticket options
      // 5. Some free events (Thrive City activities)
      
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const url = page.url();
      
      // Check for Ticketmaster integration (most common)
      const ticketmasterLinks = await page.$$('a[href*="ticketmaster.com"]');
      if (ticketmasterLinks.length > 0) {
        const href = await ticketmasterLinks[0].evaluate(el => el.href);
        this.logger.debug(`Found Ticketmaster link: ${href}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'ticketmaster',
          ticketmasterUrl: href,
          requiresManualAction: true, // Ticketmaster is complex and has anti-bot measures
          reason: 'Ticketmaster integration requires manual ticket selection and purchase'
        };
      }

      // Check for direct Chase Center ticket sales
      const buyTicketButtons = await page.$$('a[href*="tickets"], button:has-text("Buy Tickets"), a:has-text("Get Tickets")');
      if (buyTicketButtons.length > 0) {
        const directTicketLinks = [];
        
        for (const button of buyTicketButtons) {
          const href = await button.evaluate(el => el.href || '');
          const text = await button.evaluate(el => el.textContent.toLowerCase());
          
          if (href && !href.includes('ticketmaster.com') && text.includes('ticket')) {
            directTicketLinks.push(href);
          }
        }
        
        if (directTicketLinks.length > 0) {
          this.logger.debug(`Found direct ticket sales: ${directTicketLinks[0]}`);
          return {
            hasRegistrationForm: true,
            registrationMethod: 'direct_purchase',
            ticketUrl: directTicketLinks[0],
            requiresManualAction: false
          };
        }
      }

      // Check for group ticket options
      const groupTicketLinks = await page.$$('a[href*="group"], a:has-text("Group Tickets")');
      if (groupTicketLinks.length > 0) {
        const href = await groupTicketLinks[0].evaluate(el => el.href);
        this.logger.debug(`Found group ticket option: ${href}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'group_tickets',
          groupTicketUrl: href,
          requiresManualAction: false,
          suggestion: 'Group tickets may offer family discounts'
        };
      }

      // Check for free events (Thrive City, community events)
      const isFreeEvent = pageText.includes('free admission') || 
                         pageText.includes('free event') || 
                         pageText.includes('no cost') ||
                         pageText.includes('complimentary') ||
                         pageText.includes('thrive city') ||
                         url.includes('thrive-city');
      
      if (isFreeEvent) {
        // Look for RSVP or registration for free events
        const rsvpLinks = await page.$$('a[href*="rsvp"], a:has-text("RSVP"), button:has-text("Register")');
        if (rsvpLinks.length > 0) {
          const href = await rsvpLinks[0].evaluate(el => el.href || '');
          this.logger.debug('Found free event with RSVP');
          
          return {
            hasRegistrationForm: true,
            registrationMethod: 'free_event_rsvp',
            rsvpUrl: href,
            requiresManualAction: false
          };
        } else {
          this.logger.debug('Free event with no registration required');
          return {
            hasRegistrationForm: true,
            registrationMethod: 'free_event_no_rsvp',
            requiresManualAction: false
          };
        }
      }

      // Check for season ticket or membership sales
      const seasonTicketLinks = await page.$$('a[href*="season"], a:has-text("Season Tickets"), a:has-text("Membership")');
      if (seasonTicketLinks.length > 0) {
        const href = await seasonTicketLinks[0].evaluate(el => el.href);
        this.logger.debug(`Found season ticket option: ${href}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'season_tickets',
          seasonTicketUrl: href,
          requiresManualAction: true,
          reason: 'Season ticket purchases require detailed consultation'
        };
      }

      // Check for email notification signup (sold out events)
      const notifyButtons = await page.$$('button:has-text("Notify"), a:has-text("Notify"), input[value*="Notify"]');
      if (notifyButtons.length > 0) {
        this.logger.debug('Found notification signup for sold out event');
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'notification_signup',
          requiresManualAction: false
        };
      }

      return { 
        hasRegistrationForm: false, 
        reason: 'No clear ticketing method found on Chase Center event page'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing Chase Center ticketing:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Handle Chase Center ticket purchase/registration
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug(`Handling Chase Center ticketing: ${formStructure.registrationMethod}`);
      
      switch (formStructure.registrationMethod) {
        case 'ticketmaster':
          return {
            success: false,
            error: 'Ticketmaster integration requires manual ticket selection',
            requiresManualAction: true,
            ticketmasterUrl: formStructure.ticketmasterUrl,
            instructions: 'Please visit Ticketmaster link to select seats and complete purchase'
          };
          
        case 'direct_purchase':
          return await this.handleDirectTicketPurchase(page, formStructure.ticketUrl);
          
        case 'group_tickets':
          return await this.handleGroupTickets(page, formStructure.groupTicketUrl);
          
        case 'free_event_rsvp':
          return await this.handleFreeEventRSVP(page, formStructure.rsvpUrl);
          
        case 'free_event_no_rsvp':
          this.logger.info('Chase Center free event - no registration required');
          return { 
            success: true, 
            message: 'Free event, no registration needed',
            registrationMethod: 'free_event'
          };
          
        case 'notification_signup':
          return await this.handleNotificationSignup(page);
          
        case 'season_tickets':
          return {
            success: false,
            error: 'Season ticket purchases require consultation',
            requiresManualAction: true,
            seasonTicketUrl: formStructure.seasonTicketUrl,
            instructions: 'Contact Chase Center sales team for season ticket information'
          };
          
        default:
          return {
            success: false,
            error: 'Unknown Chase Center ticketing method',
            requiresManualAction: true
          };
      }
      
    } catch (error) {
      this.logger.error('Error handling Chase Center ticketing:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle direct ticket purchase through Chase Center
   */
  async handleDirectTicketPurchase(page, ticketUrl) {
    try {
      this.logger.debug('Attempting direct Chase Center ticket purchase');
      
      if (ticketUrl && ticketUrl !== page.url()) {
        await page.goto(ticketUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      }

      // Look for ticket quantity selectors
      const quantitySelectors = [
        'select[name*="quantity"]',
        'select[id*="quantity"]',
        'input[name*="quantity"]',
        '.quantity-selector select',
        '.ticket-quantity select'
      ];

      for (const selector of quantitySelectors) {
        try {
          const quantityField = await page.$(selector);
          if (quantityField) {
            // Select 2 tickets for family
            await quantityField.select('2');
            this.logger.debug('Selected 2 tickets for family');
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Look for add to cart or purchase buttons
      const purchaseButtons = await page.$$('button:has-text("Add to Cart"), button:has-text("Purchase"), button:has-text("Buy Now")');
      if (purchaseButtons.length > 0) {
        await purchaseButtons[0].click();
        this.logger.debug('Clicked purchase button');
        
        await page.waitForTimeout(3000);
        
        // This would typically lead to a checkout form
        return await this.fillCheckoutForm(page);
      }

      return {
        success: false,
        error: 'Could not find ticket purchase interface',
        requiresManualAction: true
      };

    } catch (error) {
      this.logger.error('Direct ticket purchase error:', error.message);
      return {
        success: false,
        error: `Direct purchase failed: ${error.message}`,
        requiresManualAction: true
      };
    }
  }

  /**
   * Handle group ticket inquiry
   */
  async handleGroupTickets(page, groupUrl) {
    try {
      this.logger.debug('Processing group ticket inquiry');
      
      if (groupUrl && groupUrl !== page.url()) {
        await page.goto(groupUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      }

      const familyData = this.getFamilyData();
      
      // Fill group ticket inquiry form
      const emailFilled = await this.fillField(page, familyData.parent1Email,
        'input[name*="email"]',
        'input[type="email"]',
        '#email',
        '.contact-form input[type="email"]'
      );
      
      const nameFilled = await this.fillField(page, familyData.parent1Name,
        'input[name*="name"]',
        '#name',
        '.contact-form input[placeholder*="Name"]'
      );
      
      const phoneFilled = await this.fillField(page, familyData.emergencyContact,
        'input[name*="phone"]',
        'input[type="tel"]',
        '#phone'
      );

      // Fill group size (typically 4-6 for family with friends)
      const groupSizeFilled = await this.fillField(page, '4-6',
        'input[name*="group"]',
        'input[name*="size"]',
        'select[name*="group"]'
      );

      // Fill message about family event interest
      const messageFilled = await this.fillField(page, 
        'Interested in family-friendly group tickets for Warriors games or family shows. Family of 4 looking for good seating options.',
        'textarea[name*="message"]',
        'textarea[name*="comment"]',
        '#message'
      );

      if (emailFilled && nameFilled) {
        this.logger.debug('Filled group ticket inquiry form');
        
        const submitted = await this.clickElement(page,
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Submit")',
          '.submit-btn'
        );
        
        if (submitted) {
          await page.waitForTimeout(2000);
          return { success: true, message: 'Group ticket inquiry submitted' };
        }
      }
      
      return { success: true, message: 'Group ticket form accessed, manual completion may be needed' };
      
    } catch (error) {
      return { success: false, error: `Group ticket inquiry failed: ${error.message}` };
    }
  }

  /**
   * Handle free event RSVP
   */
  async handleFreeEventRSVP(page, rsvpUrl) {
    try {
      this.logger.debug('Processing free event RSVP');
      
      if (rsvpUrl && rsvpUrl !== page.url()) {
        await page.goto(rsvpUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      }

      const familyData = this.getFamilyData();
      
      // Fill RSVP form
      const emailFilled = await this.fillField(page, familyData.parent1Email,
        'input[type="email"]',
        'input[name*="email"]',
        '#email'
      );
      
      const nameFilled = await this.fillField(page, familyData.parent1Name,
        'input[name*="name"]',
        '#name'
      );

      // Fill number of attendees (family size)
      const attendeeCount = 1 + familyData.children.length;
      await this.fillField(page, attendeeCount.toString(),
        'input[name*="attendees"]',
        'select[name*="count"]',
        'input[name*="guests"]'
      );

      if (emailFilled) {
        const submitted = await this.clickElement(page,
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("RSVP")',
          'button:has-text("Register")'
        );
        
        if (submitted) {
          await page.waitForTimeout(2000);
          return { success: true, message: 'Free event RSVP completed' };
        }
      }
      
      return { success: true, message: 'Free event RSVP form accessed' };
      
    } catch (error) {
      return { success: false, error: `Free event RSVP failed: ${error.message}` };
    }
  }

  /**
   * Handle notification signup for sold out events
   */
  async handleNotificationSignup(page) {
    try {
      const familyData = this.getFamilyData();
      
      const emailFilled = await this.fillField(page, familyData.parent1Email,
        'input[type="email"]',
        'input[name*="email"]',
        '#email',
        '.notify-form input[type="email"]'
      );

      if (emailFilled) {
        const submitted = await this.clickElement(page,
          'button:has-text("Notify")',
          'button[type="submit"]',
          'input[type="submit"]'
        );
        
        if (submitted) {
          return { success: true, message: 'Signed up for ticket availability notifications' };
        }
      }
      
      return { success: true, message: 'Notification signup form accessed' };
      
    } catch (error) {
      return { success: false, error: `Notification signup failed: ${error.message}` };
    }
  }

  /**
   * Fill checkout form for direct purchases
   */
  async fillCheckoutForm(page) {
    try {
      const familyData = this.getFamilyData();
      
      // Fill billing information
      const emailFilled = await this.fillField(page, familyData.parent1Email,
        'input[name*="email"]',
        'input[type="email"]'
      );
      
      const firstNameFilled = await this.fillField(page, familyData.parent1Name.split(' ')[0],
        'input[name*="firstName"]',
        'input[name*="first"]'
      );
      
      const lastNameFilled = await this.fillField(page, familyData.parent1Name.split(' ').slice(1).join(' '),
        'input[name*="lastName"]',
        'input[name*="last"]'
      );

      if (emailFilled) {
        this.logger.debug('Filled checkout form contact information');
        return { 
          success: false, 
          error: 'Payment information required for ticket purchase',
          requiresManualAction: true,
          message: 'Contact information filled, payment details need manual entry'
        };
      }
      
      return { success: false, error: 'Could not fill checkout form' };
      
    } catch (error) {
      return { success: false, error: `Checkout failed: ${error.message}` };
    }
  }

  /**
   * Chase Center-specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      const url = page.url();
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      
      // Success indicators for various Chase Center flows
      const chaseCenterSuccessTexts = [
        'confirmation', 'thank you', 'rsvp confirmed', 'inquiry submitted',
        'notification setup', 'tickets added', 'order confirmed',
        'registration complete', 'signed up successfully'
      ];
      
      for (const successText of chaseCenterSuccessTexts) {
        if (pageText.includes(successText)) {
          this.logger.debug(`Found Chase Center success indicator: ${successText}`);
          return { success: true };
        }
      }

      // URL-based success detection
      if (url.includes('confirmation') || url.includes('success') || url.includes('thank-you')) {
        this.logger.debug('Chase Center success indicated by URL');
        return { success: true };
      }

      // For free events with no registration, always successful
      if (pageText.includes('free admission') || pageText.includes('no registration required')) {
        this.logger.debug('Chase Center free event - no registration needed');
        return { success: true, confirmationNumber: 'Free Event' };
      }

      return { success: false, error: 'No Chase Center success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChaseCenterAdapter;