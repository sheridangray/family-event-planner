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
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      this.logger.info('Registration automator initialized');
    } catch (error) {
      this.logger.error('Failed to initialize registration automator:', error.message);
      throw error;
    }
  }

  async registerForEvent(event) {
    if (!event.registrationUrl) {
      throw new Error('No registration URL provided');
    }

    if (event.cost > 0) {
      this.logger.error(`CRITICAL SAFETY: Attempted to auto-register for PAID event: ${event.title} ($${event.cost})`);
      throw new Error('SAFETY VIOLATION: Cannot auto-register for paid events');
    }

    this.logger.info(`Starting registration for FREE event: ${event.title}`);

    const page = await this.browser.newPage();
    const screenshotDir = path.join(__dirname, '../../logs/screenshots');
    
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1280, height: 720 });

      this.logger.info(`Navigating to registration URL: ${event.registrationUrl}`);
      await page.goto(event.registrationUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await page.screenshot({ 
        path: path.join(screenshotDir, `${event.id}_initial.png`),
        fullPage: true 
      });

      const detectedPayment = await this.detectPaymentFields(page);
      if (detectedPayment.hasPayment) {
        this.logger.error(`CRITICAL SAFETY: Payment fields detected on supposedly FREE event: ${event.title}`);
        await this.saveRegistrationResult(event.id, {
          success: false,
          errorMessage: 'SAFETY STOP: Payment fields detected',
          screenshotPath: path.join(screenshotDir, `${event.id}_payment_detected.png`),
          paymentRequired: true,
          paymentAmount: detectedPayment.amount
        });
        
        await page.screenshot({ 
          path: path.join(screenshotDir, `${event.id}_payment_detected.png`),
          fullPage: true 
        });
        
        throw new Error('SAFETY STOP: Payment fields detected on free event');
      }

      const registrationResult = await this.fillRegistrationForm(page, event);
      
      if (registrationResult.success) {
        await page.screenshot({ 
          path: path.join(screenshotDir, `${event.id}_success.png`),
          fullPage: true 
        });
        
        await this.database.updateEventStatus(event.id, 'booked');
        this.logger.info(`Successfully registered for event: ${event.title}`);
        
        await this.saveRegistrationResult(event.id, {
          success: true,
          confirmationNumber: registrationResult.confirmationNumber,
          screenshotPath: path.join(screenshotDir, `${event.id}_success.png`),
          paymentRequired: false
        });
        
        return registrationResult;
      } else {
        throw new Error(registrationResult.error || 'Registration failed');
      }

    } catch (error) {
      this.logger.error(`Registration failed for ${event.title}:`, error.message);
      
      await page.screenshot({ 
        path: path.join(screenshotDir, `${event.id}_error.png`),
        fullPage: true 
      });
      
      await this.saveRegistrationResult(event.id, {
        success: false,
        errorMessage: error.message,
        screenshotPath: path.join(screenshotDir, `${event.id}_error.png`)
      });
      
      throw error;
    } finally {
      await page.close();
    }
  }

  async detectPaymentFields(page) {
    try {
      const paymentSelectors = [
        'input[type="number"][name*="card"]',
        'input[name*="credit"]',
        'input[name*="payment"]',
        'input[placeholder*="card"]',
        'input[placeholder*="payment"]',
        'input[id*="card"]',
        'input[id*="payment"]',
        '.payment-form',
        '.credit-card',
        '[class*="payment"]',
        '[class*="checkout"]',
        'stripe-card',
        'iframe[src*="stripe"]',
        'iframe[src*="paypal"]',
        'iframe[src*="payment"]'
      ];

      const priceSelectors = [
        '.price',
        '.cost',
        '.amount',
        '.total',
        '[class*="price"]',
        '[class*="cost"]',
        '[class*="amount"]',
        '[class*="total"]'
      ];

      for (const selector of paymentSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          this.logger.warn(`Payment field detected: ${selector}`);
          
          let amount = null;
          for (const priceSelector of priceSelectors) {
            try {
              const priceElement = await page.$(priceSelector);
              if (priceElement) {
                const priceText = await page.evaluate(el => el.textContent, priceElement);
                const priceMatch = priceText.match(/\$(\d+(?:\.\d{2})?)/);
                if (priceMatch) {
                  amount = parseFloat(priceMatch[1]);
                  break;
                }
              }
            } catch (e) {
              // Continue checking other selectors
            }
          }
          
          return { hasPayment: true, amount, selector };
        }
      }

      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const paymentKeywords = ['credit card', 'payment required', 'checkout', '$', 'total:', 'amount:'];
      
      for (const keyword of paymentKeywords) {
        if (pageText.includes(keyword)) {
          this.logger.warn(`Payment keyword detected: ${keyword}`);
          return { hasPayment: true, amount: null, keyword };
        }
      }

      return { hasPayment: false };
    } catch (error) {
      this.logger.error('Error detecting payment fields:', error.message);
      return { hasPayment: true }; // Err on the side of caution
    }
  }

  async fillRegistrationForm(page, event) {
    try {
      const forms = await this.detectRegistrationForms(page);
      
      if (forms.length === 0) {
        return { success: false, error: 'No registration form found' };
      }

      const form = forms[0];
      await this.fillCommonFields(page, form);
      
      const submitButton = await this.findSubmitButton(page);
      if (!submitButton) {
        return { success: false, error: 'No submit button found' };
      }

      await submitButton.click();
      
      await page.waitForTimeout(3000);
      
      const confirmationNumber = await this.extractConfirmationNumber(page);
      
      const isSuccess = await this.detectSuccessPage(page);
      
      return {
        success: isSuccess,
        confirmationNumber,
        error: isSuccess ? null : 'Registration may have failed'
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async detectRegistrationForms(page) {
    const formSelectors = [
      'form',
      '[class*="registration"]',
      '[class*="signup"]',
      '[class*="form"]',
      '[id*="registration"]',
      '[id*="signup"]',
      '[id*="form"]'
    ];

    const forms = [];
    for (const selector of formSelectors) {
      try {
        const elements = await page.$$(selector);
        forms.push(...elements);
      } catch (error) {
        // Continue with other selectors
      }
    }

    return forms.slice(0, 1); // Return first form only
  }

  async fillCommonFields(page, form) {
    const fieldMappings = [
      // Names
      { selectors: ['input[name*="first"]', 'input[placeholder*="first"]', '#firstName', '#first_name'], value: config.family.parent1Name.split(' ')[0] },
      { selectors: ['input[name*="last"]', 'input[placeholder*="last"]', '#lastName', '#last_name'], value: config.family.parent1Name.split(' ').pop() },
      { selectors: ['input[name*="name"]', 'input[placeholder*="name"]', '#name'], value: config.family.parent1Name },
      
      // Contact
      { selectors: ['input[type="email"]', 'input[name*="email"]', '#email'], value: config.gmail.parent1Email },
      { selectors: ['input[type="tel"]', 'input[name*="phone"]', '#phone'], value: config.family.emergencyContact },
      
      // Children info
      { selectors: ['input[name*="child"]', 'input[placeholder*="child"]', '#children'], value: `${config.family.child1Name} (${config.family.child1Age}), ${config.family.child2Name} (${config.family.child2Age})` },
      { selectors: ['input[name*="age"]', 'input[placeholder*="age"]'], value: `${config.family.child1Age}, ${config.family.child2Age}` },
      { selectors: ['select[name*="attendee"]', 'input[name*="attendee"]'], value: '4' }, // 2 adults + 2 children
      
      // Numbers
      { selectors: ['input[name*="adult"]', 'input[placeholder*="adult"]'], value: '2' },
      { selectors: ['input[name*="participant"]', 'input[placeholder*="participant"]'], value: '4' }
    ];

    for (const mapping of fieldMappings) {
      for (const selector of mapping.selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.clear();
            await element.type(mapping.value.toString());
            this.logger.debug(`Filled field ${selector} with ${mapping.value}`);
            break; // Move to next mapping once filled
          }
        } catch (error) {
          // Continue with next selector
        }
      }
    }
  }

  async findSubmitButton(page) {
    const submitSelectors = [
      'input[type="submit"]',
      'button[type="submit"]',
      'button:contains("register")',
      'button:contains("submit")',
      'button:contains("sign up")',
      'button:contains("book")',
      '.submit-btn',
      '.register-btn',
      '#submit',
      '#register'
    ];

    for (const selector of submitSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }, element);
          
          if (isVisible) {
            return element;
          }
        }
      } catch (error) {
        // Continue with next selector
      }
    }

    return null;
  }

  async extractConfirmationNumber(page) {
    try {
      const confirmationSelectors = [
        '[class*="confirmation"]',
        '[id*="confirmation"]',
        '[class*="reference"]',
        '[id*="reference"]'
      ];

      for (const selector of confirmationSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await page.evaluate(el => el.textContent, element);
            const match = text.match(/([A-Z0-9]{6,})/);
            if (match) {
              return match[1];
            }
          }
        } catch (error) {
          // Continue with next selector
        }
      }

      const bodyText = await page.evaluate(() => document.body.textContent);
      const confirmationMatch = bodyText.match(/confirmation.*?([A-Z0-9]{6,})/i);
      if (confirmationMatch) {
        return confirmationMatch[1];
      }

      return null;
    } catch (error) {
      this.logger.warn('Error extracting confirmation number:', error.message);
      return null;
    }
  }

  async detectSuccessPage(page) {
    try {
      const successIndicators = [
        'thank you',
        'confirmed',
        'successful',
        'registered',
        'complete',
        'confirmation'
      ];

      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      
      return successIndicators.some(indicator => pageText.includes(indicator));
    } catch (error) {
      this.logger.warn('Error detecting success page:', error.message);
      return false;
    }
  }

  async saveRegistrationResult(eventId, result) {
    try {
      await this.database.saveRegistration({
        eventId,
        success: result.success,
        confirmationNumber: result.confirmationNumber || null,
        errorMessage: result.errorMessage || null,
        screenshotPath: result.screenshotPath || null,
        paymentRequired: result.paymentRequired || false,
        paymentAmount: result.paymentAmount || null,
        paymentCompleted: result.paymentCompleted || false
      });
    } catch (error) {
      this.logger.error(`Error saving registration result for ${eventId}:`, error.message);
    }
  }

  async processApprovedEvents() {
    try {
      const approvedEvents = await this.database.getEventsByStatus('approved');
      const freeEvents = approvedEvents.filter(event => event.cost === 0);
      
      this.logger.info(`Processing ${freeEvents.length} approved free events for registration`);
      
      const results = [];
      for (const event of freeEvents) {
        try {
          const result = await this.registerForEvent(event);
          results.push({ event, result, success: true });
        } catch (error) {
          this.logger.error(`Failed to register for ${event.title}:`, error.message);
          results.push({ event, error: error.message, success: false });
        }
      }
      
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