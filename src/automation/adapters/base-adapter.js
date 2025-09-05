class BaseRegistrationAdapter {
  constructor(logger, familyData) {
    this.logger = logger;
    this.familyData = familyData;
    this.name = this.constructor.name;
  }

  /**
   * Main entry point for attempting registration
   * @param {Object} event - Event object with registration details
   * @param {Object} page - Puppeteer page instance
   * @returns {Object} Registration result
   */
  async attemptRegistration(event, page) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting registration attempt with ${this.name} for: ${event.title}`);
      
      // Navigate to registration page
      await this.navigateToRegistration(event, page);
      
      // Detect form structure
      const formStructure = await this.analyzeRegistrationForm(page);
      
      if (!formStructure.hasRegistrationForm) {
        return this.createFailureResult('no_form_detected', 'No registration form found on page');
      }
      
      // Fill the registration form
      const fillResult = await this.fillRegistrationForm(page, event, formStructure);
      
      if (!fillResult.success) {
        return this.createFailureResult('form_fill_failed', fillResult.error);
      }
      
      // Submit the form
      const submitResult = await this.submitRegistrationForm(page, formStructure);
      
      if (!submitResult.success) {
        return this.createFailureResult('form_submit_failed', submitResult.error);
      }
      
      // Verify registration success
      const verificationResult = await this.verifyRegistrationSuccess(page);
      
      const timeTaken = Date.now() - startTime;
      
      if (verificationResult.success) {
        this.logger.info(`Registration successful with ${this.name} in ${timeTaken}ms`);
        return this.createSuccessResult(verificationResult.confirmationNumber, timeTaken);
      } else {
        return this.createFailureResult('verification_failed', verificationResult.error, timeTaken);
      }
      
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      this.logger.error(`Registration attempt failed with ${this.name}:`, error.message);
      return this.createFailureResult('adapter_error', error.message, timeTaken);
    }
  }

  /**
   * Navigate to registration page - can be overridden by specific adapters
   */
  async navigateToRegistration(event, page) {
    this.logger.debug(`Navigating to registration URL: ${event.registration_url}`);
    
    await page.goto(event.registration_url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page to be interactive
    await page.waitForLoadState?.('domcontentloaded') || 
          page.waitForSelector('body', { timeout: 10000 });
  }

  /**
   * Analyze the registration form structure - MUST be implemented by subclasses
   */
  async analyzeRegistrationForm(page) {
    throw new Error('analyzeRegistrationForm must be implemented by subclass');
  }

  /**
   * Fill the registration form - MUST be implemented by subclasses
   */
  async fillRegistrationForm(page, event, formStructure) {
    throw new Error('fillRegistrationForm must be implemented by subclass');
  }

  /**
   * Submit the registration form - can be overridden by specific adapters
   */
  async submitRegistrationForm(page, formStructure) {
    try {
      this.logger.debug('Submitting registration form');
      
      // Look for submit buttons
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Register")',
        'button:has-text("Sign Up")',
        'button:has-text("Submit")',
        '.submit-btn',
        '.register-btn'
      ];
      
      for (const selector of submitSelectors) {
        try {
          const submitButton = await page.$(selector);
          if (submitButton) {
            await submitButton.click();
            this.logger.debug(`Clicked submit button: ${selector}`);
            
            // Wait for navigation or form processing
            await Promise.race([
              page.waitForNavigation({ timeout: 10000 }),
              page.waitForSelector('.success, .confirmation, .thank-you', { timeout: 10000 })
            ]).catch(() => {
              // Ignore timeout - form might submit without navigation
            });
            
            return { success: true };
          }
        } catch (error) {
          // Continue trying other selectors
          continue;
        }
      }
      
      return { success: false, error: 'No submit button found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify registration success - can be overridden by specific adapters
   */
  async verifyRegistrationSuccess(page) {
    try {
      this.logger.debug('Verifying registration success');
      
      // Common success indicators
      const successSelectors = [
        '.success', '.confirmation', '.thank-you',
        '[class*="success"]', '[class*="confirmation"]',
        '[id*="success"]', '[id*="confirmation"]'
      ];
      
      // Common success text patterns
      const successTexts = [
        'thank you', 'confirmation', 'registered', 'success',
        'we have received', 'registration complete', 'you are registered'
      ];
      
      // Check for success elements
      for (const selector of successSelectors) {
        const element = await page.$(selector);
        if (element) {
          this.logger.debug(`Found success element: ${selector}`);
          
          // Try to extract confirmation number
          const text = await element.evaluate(el => el.textContent) || '';
          const confirmationNumber = this.extractConfirmationNumber(text);
          
          return { success: true, confirmationNumber };
        }
      }
      
      // Check page text for success indicators
      const pageText = await page.evaluate(() => document.body.textContent);
      const lowerText = pageText.toLowerCase();
      
      for (const successText of successTexts) {
        if (lowerText.includes(successText)) {
          this.logger.debug(`Found success text: ${successText}`);
          
          const confirmationNumber = this.extractConfirmationNumber(pageText);
          return { success: true, confirmationNumber };
        }
      }
      
      // Check URL for success indicators
      const url = page.url();
      if (url.includes('success') || url.includes('confirmation') || url.includes('thank')) {
        this.logger.debug(`Success indicated by URL: ${url}`);
        return { success: true };
      }
      
      return { success: false, error: 'No success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract confirmation number from text
   */
  extractConfirmationNumber(text) {
    if (!text) return null;
    
    // Common confirmation number patterns
    const patterns = [
      /confirmation\s*(?:number|code|id):\s*([a-zA-Z0-9\-]+)/i,
      /reference\s*(?:number|code|id):\s*([a-zA-Z0-9\-]+)/i,
      /registration\s*(?:number|code|id):\s*([a-zA-Z0-9\-]+)/i,
      /(?:conf|ref|reg)#?\s*:?\s*([a-zA-Z0-9\-]{6,})/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Create success result object
   */
  createSuccessResult(confirmationNumber = null, timeTaken = 0) {
    return {
      success: true,
      adapterType: this.name,
      confirmationNumber,
      timeTaken,
      requiresManualAction: false
    };
  }

  /**
   * Create failure result object
   */
  createFailureResult(type, message, timeTaken = 0) {
    return {
      success: false,
      type,
      message,
      adapterType: this.name,
      timeTaken,
      requiresManualAction: true
    };
  }

  /**
   * Get family data formatted for form filling
   */
  getFamilyData() {
    return this.familyData || {
      parent1Name: 'Parent Name',
      parent1Email: 'parent@example.com',
      parent2Name: 'Parent 2 Name',
      parent2Email: 'parent2@example.com',
      children: [],
      emergencyContact: '555-123-4567'
    };
  }

  /**
   * Utility: Fill form field by various selectors
   */
  async fillField(page, value, ...selectors) {
    if (!value) return false;
    
    for (const selector of selectors) {
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
        continue;
      }
    }
    
    return false;
  }

  /**
   * Utility: Click element by various selectors
   */
  async clickElement(page, ...selectors) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          this.logger.debug(`Clicked element: ${selector}`);
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    
    return false;
  }
}

module.exports = BaseRegistrationAdapter;