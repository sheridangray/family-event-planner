const BaseRegistrationAdapter = require('./base-adapter');

class FuncheapSFAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'FuncheapSFAdapter';
    this.supportedDomains = [
      'sf.funcheap.com',
      'funcheap.com'
    ];
  }

  /**
   * Navigate to Funcheap event page
   */
  async navigateToRegistration(event, page) {
    this.logger.debug(`Navigating to Funcheap event: ${event.registration_url}`);
    
    await page.goto(event.registration_url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page content to load
    await page.waitForSelector('body', { timeout: 10000 });
  }

  /**
   * Analyze Funcheap registration patterns
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing Funcheap event registration');
      
      // Funcheap events have several patterns:
      // 1. Eventbrite integration (most common for RSVP events)
      // 2. External website redirects (YBG Festival, etc.)
      // 3. Direct RSVP forms (rare)
      // 4. Promo code instructions
      // 5. Drop-in events with no registration
      
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      
      // Check for Eventbrite integration
      const eventbriteLinks = await page.$$('a[href*="eventbrite.com"]');
      if (eventbriteLinks.length > 0) {
        const href = await eventbriteLinks[0].evaluate(el => el.href);
        this.logger.debug(`Found Eventbrite link: ${href}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'eventbrite',
          eventbriteUrl: href,
          requiresManualAction: false // We can handle Eventbrite
        };
      }

      // Check for external website redirects
      const externalRSVPLinks = await page.$$('a[href*="rsvp"], a[href*="register"], a[href*="tickets"]');
      for (const link of externalRSVPLinks) {
        const href = await link.evaluate(el => el.href);
        const linkText = await link.evaluate(el => el.textContent.toLowerCase());
        
        if (linkText.includes('rsvp') || linkText.includes('register') || linkText.includes('tickets')) {
          const domain = new URL(href).hostname;
          
          // Check if it's a known external site we can handle
          if (domain.includes('ybgfestival.org')) {
            this.logger.debug(`Found YBG Festival redirect: ${href}`);
            return {
              hasRegistrationForm: true,
              registrationMethod: 'external_redirect',
              externalUrl: href,
              externalDomain: 'ybgfestival.org',
              requiresManualAction: false // We have YBG adapter
            };
          } else {
            this.logger.debug(`Found external registration: ${href}`);
            return {
              hasRegistrationForm: true,
              registrationMethod: 'external_redirect', 
              externalUrl: href,
              externalDomain: domain,
              requiresManualAction: true // Unknown external site
            };
          }
        }
      }

      // Check for direct RSVP forms on the page
      const forms = await page.$$('form');
      if (forms.length > 0) {
        const formAnalysis = await this.analyzeFuncheapForm(page, forms[0]);
        if (formAnalysis.score > 10) {
          this.logger.debug('Found direct RSVP form on Funcheap page');
          return {
            hasRegistrationForm: true,
            registrationMethod: 'direct_form',
            formIndex: 0,
            fields: formAnalysis.fields,
            formScore: formAnalysis.score
          };
        }
      }

      // Check for promo code instructions
      const hasPromoCode = pageText.includes('promo code') || 
                          pageText.includes('discount code') || 
                          pageText.includes('funcheap') ||
                          pageText.includes('code:');
      
      if (hasPromoCode) {
        const promoCode = this.extractPromoCode(pageText);
        this.logger.debug(`Found promo code instruction: ${promoCode}`);
        
        return {
          hasRegistrationForm: true,
          registrationMethod: 'promo_code',
          promoCode: promoCode,
          requiresManualAction: true
        };
      }

      // Check if it's a drop-in event
      const isDropIn = pageText.includes('drop in') || 
                       pageText.includes('drop-in') || 
                       pageText.includes('no registration') || 
                       pageText.includes('no rsvp') ||
                       pageText.includes('walk-in') ||
                       pageText.includes('just show up');
      
      if (isDropIn) {
        this.logger.debug('Funcheap event is drop-in, no registration required');
        return {
          hasRegistrationForm: true, // Consider successful
          registrationMethod: 'drop_in',
          requiresManualAction: false
        };
      }

      return { 
        hasRegistrationForm: false, 
        reason: 'No clear registration method found on Funcheap event page'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing Funcheap registration:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Extract promo code from page text
   */
  extractPromoCode(pageText) {
    // Common promo code patterns
    const patterns = [
      /(?:promo )?code:?\s*[""']?(\w+)[""']?/i,
      /use (?:promo )?code\s*[""']?(\w+)[""']?/i,
      /discount code:?\s*[""']?(\w+)[""']?/i,
      /enter code\s*[""']?(\w+)[""']?/i,
      /\b(funcheap)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = pageText.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return null;
  }

  /**
   * Analyze direct form on Funcheap page
   */
  async analyzeFuncheapForm(page, form) {
    const inputs = await form.$$('input, select, textarea');
    const formText = await form.evaluate(el => el.textContent.toLowerCase());
    
    let score = 0;
    const fields = {};
    
    // Funcheap-specific keywords
    const funcheapKeywords = [
      'rsvp', 'register', 'email', 'name', 'subscribe',
      'newsletter', 'notification', 'event', 'free'
    ];
    
    for (const keyword of funcheapKeywords) {
      if (formText.includes(keyword)) {
        score += 3;
      }
    }
    
    // Analyze form fields
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const fieldAnalysis = await this.analyzeFormField(page, input);
      
      if (fieldAnalysis.type !== 'unknown') {
        fields[fieldAnalysis.type] = fieldAnalysis;
        score += fieldAnalysis.confidence / 10;
      }
    }
    
    return { fields, score, inputCount: inputs.length };
  }

  /**
   * Handle Funcheap registration
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug(`Handling Funcheap registration: ${formStructure.registrationMethod}`);
      
      switch (formStructure.registrationMethod) {
        case 'eventbrite':
          return await this.handleEventbriteRSVP(page, formStructure.eventbriteUrl);
          
        case 'external_redirect':
          return await this.handleExternalRedirect(page, formStructure);
          
        case 'direct_form':
          return await this.fillDirectForm(page, event, formStructure);
          
        case 'drop_in':
          this.logger.info('Funcheap event is drop-in - no registration required');
          return { 
            success: true, 
            message: 'Event is drop-in, no registration needed',
            registrationMethod: 'drop_in'
          };
          
        case 'promo_code':
          return {
            success: false,
            error: `Event requires promo code: ${formStructure.promoCode}`,
            requiresManualAction: true,
            promoCode: formStructure.promoCode,
            instructions: `Use promo code "${formStructure.promoCode}" when purchasing tickets`
          };
          
        default:
          return {
            success: false,
            error: 'Unknown Funcheap registration method',
            requiresManualAction: true
          };
      }
      
    } catch (error) {
      this.logger.error('Error filling Funcheap registration:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle Eventbrite RSVP
   */
  async handleEventbriteRSVP(page, eventbriteUrl) {
    try {
      this.logger.debug('Attempting Eventbrite RSVP');
      
      // Navigate to Eventbrite
      await page.goto(eventbriteUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Look for free ticket registration
      const freeTicketSelectors = [
        'button[data-spec="eds-ticket-card-action-buy-button"]',
        'button[aria-label*="Get tickets"]',
        'button[aria-label*="Register"]',
        '.eds-btn--button:has-text("Register")',
        '.eds-btn--button:has-text("Get tickets")',
        '.ticket-card button',
        '[data-automation="ticket-select-button"]'
      ];

      for (const selector of freeTicketSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            // Check if it's for free tickets
            const buttonText = await button.evaluate(el => el.textContent.toLowerCase());
            const parentText = await button.evaluate(el => {
              const parent = el.closest('.ticket-card, .eds-card, [class*="ticket"]');
              return parent ? parent.textContent.toLowerCase() : '';
            });
            
            if (buttonText.includes('free') || parentText.includes('free') || 
                buttonText.includes('register') || parentText.includes('$0')) {
              
              await button.click();
              this.logger.debug(`Clicked Eventbrite registration button: ${selector}`);
              
              // Wait for checkout process or form
              await page.waitForTimeout(3000);
              
              // Look for email/checkout form and fill if needed
              return await this.fillEventbriteCheckout(page);
            }
          }
        } catch (error) {
          continue; // Try next selector
        }
      }

      return {
        success: false,
        error: 'Could not find free ticket registration on Eventbrite',
        requiresManualAction: true,
        eventbriteUrl: eventbriteUrl
      };

    } catch (error) {
      this.logger.error('Eventbrite RSVP error:', error.message);
      return {
        success: false,
        error: `Eventbrite RSVP failed: ${error.message}`,
        requiresManualAction: true
      };
    }
  }

  /**
   * Fill Eventbrite checkout form
   */
  async fillEventbriteCheckout(page) {
    try {
      const familyData = this.getFamilyData();
      
      // Common Eventbrite checkout form fields
      const emailFilled = await this.fillField(page, familyData.parent1Email,
        'input[name="email"]',
        'input[type="email"]',
        '#email',
        '.checkout-form input[type="email"]'
      );
      
      const firstNameFilled = await this.fillField(page, familyData.parent1Name.split(' ')[0],
        'input[name="first_name"]',
        'input[name="firstName"]',
        '#first_name',
        '.checkout-form input[placeholder*="First"]'
      );
      
      const lastNameFilled = await this.fillField(page, familyData.parent1Name.split(' ').slice(1).join(' '),
        'input[name="last_name"]',
        'input[name="lastName"]',
        '#last_name',
        '.checkout-form input[placeholder*="Last"]'
      );

      if (emailFilled) {
        this.logger.debug('Filled Eventbrite checkout form');
        
        // Look for submit button
        const submitted = await this.clickElement(page,
          'button[data-automation="checkout-order-complete-button"]',
          'button[type="submit"]',
          '.checkout-form button[type="submit"]',
          'button:has-text("Complete")',
          'button:has-text("Register")'
        );
        
        if (submitted) {
          await page.waitForTimeout(3000);
          return { success: true, message: 'Eventbrite registration completed' };
        }
      }
      
      return { success: true, message: 'Eventbrite form accessed, may require manual completion' };
      
    } catch (error) {
      return { success: false, error: `Eventbrite checkout failed: ${error.message}` };
    }
  }

  /**
   * Handle external redirects
   */
  async handleExternalRedirect(page, formStructure) {
    if (formStructure.externalDomain === 'ybgfestival.org') {
      // We have a dedicated YBG adapter that can handle this
      this.logger.debug('Redirecting to YBG Festival - will be handled by YBG adapter');
      return {
        success: false,
        error: 'Event redirects to YBG Festival',
        requiresManualAction: true,
        redirectUrl: formStructure.externalUrl,
        suggestion: 'This will be handled automatically by the YBG Festival adapter'
      };
    }
    
    return {
      success: false,
      error: `Event redirects to external site: ${formStructure.externalDomain}`,
      requiresManualAction: true,
      redirectUrl: formStructure.externalUrl
    };
  }

  /**
   * Fill direct RSVP form on Funcheap
   */
  async fillDirectForm(page, event, formStructure) {
    const familyData = this.getFamilyData();
    const fields = formStructure.fields;
    let filledCount = 0;
    
    // Fill common RSVP fields
    if (fields.email && familyData.parent1Email) {
      await this.fillFieldBySelector(page, fields.email.selector, familyData.parent1Email);
      filledCount++;
    }
    
    if (fields.name && familyData.parent1Name) {
      await this.fillFieldBySelector(page, fields.name.selector, familyData.parent1Name);
      filledCount++;
    }
    
    this.logger.debug(`Filled ${filledCount} Funcheap RSVP fields`);
    
    return filledCount > 0 ? 
      { success: true, filledFields: filledCount } : 
      { success: false, error: 'No RSVP fields could be filled' };
  }

  /**
   * Funcheap-specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      const url = page.url();
      
      // Eventbrite success indicators
      if (url.includes('eventbrite.com')) {
        const successSelectors = [
          '.confirmation',
          '.order-confirmation',
          '[data-automation="checkout-confirmation"]',
          '.checkout-success',
          'h1:has-text("Order confirmed")'
        ];
        
        for (const selector of successSelectors) {
          const element = await page.$(selector);
          if (element) {
            this.logger.debug('Eventbrite registration confirmed');
            return { success: true, confirmationNumber: 'Eventbrite Order' };
          }
        }
      }

      // General success text patterns for Funcheap
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const funcheapSuccessTexts = [
        'thank you', 'rsvp confirmed', 'registered', 'confirmation',
        'order confirmed', 'tickets confirmed', 'see you there',
        'registration complete', 'you are registered'
      ];
      
      for (const successText of funcheapSuccessTexts) {
        if (pageText.includes(successText)) {
          this.logger.debug(`Found Funcheap success indicator: ${successText}`);
          return { success: true };
        }
      }

      // For drop-in events, always return success
      if (pageText.includes('drop in') || pageText.includes('no registration')) {
        this.logger.debug('Funcheap drop-in event - no registration needed');
        return { success: true, confirmationNumber: 'Drop-in Event' };
      }

      return { success: false, error: 'No Funcheap success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper to fill form field by selector
   */
  async fillFieldBySelector(page, selector, value) {
    if (!selector || !value) return false;
    
    try {
      const field = await page.$(selector);
      if (field) {
        await field.click();
        await field.evaluate(el => el.value = '');
        await field.type(value);
        this.logger.debug(`Filled field ${selector} with: ${value}`);
        return true;
      }
    } catch (error) {
      this.logger.debug(`Could not fill field ${selector}:`, error.message);
    }
    
    return false;
  }

  /**
   * Analyze individual form field
   */
  async analyzeFormField(page, input) {
    try {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.evaluate(el => el.type || '');
      const name = await input.evaluate(el => el.name || '');
      const id = await input.evaluate(el => el.id || '');
      const placeholder = await input.evaluate(el => el.placeholder || '');
      const className = await input.evaluate(el => el.className || '');
      
      const fieldInfo = `${name} ${id} ${placeholder} ${className}`.toLowerCase();
      
      let fieldType = 'unknown';
      let confidence = 0;
      
      if (fieldInfo.includes('email') || type === 'email') {
        fieldType = 'email';
        confidence = 90;
      } else if (fieldInfo.includes('name') && !fieldInfo.includes('last')) {
        fieldType = 'firstName';
        confidence = 80;
      } else if (fieldInfo.includes('last') || fieldInfo.includes('surname')) {
        fieldType = 'lastName';
        confidence = 80;
      } else if (fieldInfo.includes('phone') || type === 'tel') {
        fieldType = 'phone';
        confidence = 85;
      } else if (fieldInfo.includes('message') || fieldInfo.includes('comment') || tagName === 'textarea') {
        fieldType = 'message';
        confidence = 70;
      }
      
      const selector = id ? `#${id}` : (name ? `[name="${name}"]` : `${tagName}[type="${type}"]`);
      
      return {
        type: fieldType,
        selector: selector,
        confidence: confidence,
        element: { tagName, type, name, id }
      };
      
    } catch (error) {
      return { type: 'unknown', selector: '', confidence: 0 };
    }
  }
}

module.exports = FuncheapSFAdapter;