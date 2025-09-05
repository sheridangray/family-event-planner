const BaseRegistrationAdapter = require('./base-adapter');

class ExploraoriumAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'ExploraoriumAdapter';
    this.supportedDomains = ['exploratorium.edu', 'www.exploratorium.edu'];
  }

  /**
   * Navigate to Exploratorium registration page
   */
  async navigateToRegistration(event, page) {
    const registrationUrl = event.registration_url || event.registrationUrl;
    
    this.logger.debug(`Navigating to Exploratorium registration: ${registrationUrl}`);
    
    await page.goto(registrationUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Exploratorium specific: Wait for their content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're on a valid Exploratorium page
    const title = await page.title();
    const url = page.url();
    if (!title.toLowerCase().includes('exploratorium') && !url.includes('exploratorium.edu')) {
      throw new Error('Not on a valid Exploratorium page');
    }
  }

  /**
   * Analyze Exploratorium registration form structure
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing Exploratorium registration form');
      
      // Exploratorium often uses ticketing systems for events
      // Look for ticket purchase and event registration
      
      const ticketElements = await page.$$('a[href*="ticket"], button:has-text("Buy Tickets"), a:has-text("Get Tickets"), a:has-text("Reserve"), button:has-text("Register")');
      const forms = await page.$$('form');
      
      this.logger.debug(`Found ${forms.length} forms and ${ticketElements.length} ticket/registration elements`);
      
      // Check if this is a ticketed event
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const isTicketedEvent = pageText.includes('ticket') || pageText.includes('admission') || 
                              pageText.includes('member') || pageText.includes('non-member');
      
      if (ticketElements.length > 0) {
        this.logger.debug('Found Exploratorium ticket/registration elements');
        
        return {
          hasRegistrationForm: true,
          isTicketBased: isTicketedEvent,
          ticketElements: ticketElements.length,
          registrationMethod: isTicketedEvent ? 'ticket_purchase' : 'event_registration'
        };
      }
      
      // Analyze forms on current page
      if (forms.length > 0) {
        let bestForm = null;
        let bestScore = 0;
        
        for (let i = 0; i < forms.length; i++) {
          const form = forms[i];
          const formAnalysis = await this.analyzeExploraoriumForm(page, form, i);
          
          if (formAnalysis.score > bestScore) {
            bestScore = formAnalysis.score;
            bestForm = formAnalysis;
          }
        }
        
        if (bestScore > 0) {
          this.logger.debug(`Found Exploratorium registration form with score ${bestScore}`);
          return {
            hasRegistrationForm: true,
            isTicketBased: false,
            formIndex: bestForm.formIndex,
            fields: bestForm.fields,
            submitButton: bestForm.submitButton,
            formScore: bestScore,
            registrationMethod: 'direct_form'
          };
        }
      }
      
      // Check for Exploratorium specific patterns
      if (pageText.includes('register') || pageText.includes('sign up') || pageText.includes('rsvp')) {
        return {
          hasRegistrationForm: true,
          requiresAnalysis: true,
          registrationMethod: 'exploratorium_system'
        };
      }
      
      return { 
        hasRegistrationForm: false, 
        reason: 'No Exploratorium registration form or elements found'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing Exploratorium registration form:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Analyze a specific form on Exploratorium page
   */
  async analyzeExploraoriumForm(page, form, formIndex) {
    try {
      const inputs = await form.$$('input, select, textarea');
      const formText = await form.evaluate(el => el.textContent.toLowerCase());
      const formAction = await form.evaluate(el => el.action || '');
      
      let score = 0;
      const fields = {};
      
      // Exploratorium specific keywords
      const exploraoriumKeywords = [
        'register', 'registration', 'sign up', 'rsvp', 'reserve',
        'ticket', 'member', 'non-member', 'visitor', 'guest',
        'first name', 'last name', 'email', 'phone', 'contact',
        'adult', 'child', 'student', 'educator', 'group'
      ];
      
      for (const keyword of exploraoriumKeywords) {
        if (formText.includes(keyword)) {
          score += 8;
        }
      }
      
      // Check form action for Exploratorium patterns
      if (formAction.includes('register') || formAction.includes('ticket') || 
          formAction.includes('event') || formAction.includes('rsvp')) {
        score += 20;
      }
      
      // Analyze form fields
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const fieldAnalysis = await this.analyzeFormField(page, input);
        
        if (fieldAnalysis.type !== 'unknown') {
          fields[fieldAnalysis.type] = fieldAnalysis;
          score += fieldAnalysis.confidence / 8;
        }
      }
      
      // Look for submit buttons
      const submitButtons = await form.$$('button[type="submit"], input[type="submit"], button:not([type])');
      let submitButton = null;
      
      if (submitButtons.length > 0) {
        submitButton = { formIndex, buttonIndex: 0 };
        score += 15;
      }
      
      return {
        formIndex,
        fields,
        submitButton,
        score,
        inputCount: inputs.length,
        formAction
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing Exploratorium form ${formIndex}:`, error.message);
      return { formIndex, fields: {}, score: 0 };
    }
  }

  /**
   * Exploratorium specific form filling logic
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling Exploratorium registration form');
      
      // Handle ticket-based events
      if (formStructure.isTicketBased && formStructure.registrationMethod === 'ticket_purchase') {
        this.logger.info('Exploratorium event requires ticket purchase');
        return {
          success: false,
          error: 'Event requires ticket purchase - cannot auto-register',
          requiresManualAction: true,
          ticketRequired: true
        };
      }
      
      // Handle direct form filling
      if (formStructure.registrationMethod === 'direct_form') {
        return await this.fillExploraoriumForm(page, event, formStructure);
      }
      
      // Handle event registration
      if (formStructure.registrationMethod === 'event_registration') {
        return await this.handleEventRegistration(page, event);
      }
      
      // Handle Exploratorium system-specific registration
      if (formStructure.registrationMethod === 'exploratorium_system') {
        return await this.handleExploraoriumSystem(page, event);
      }
      
      return {
        success: false,
        error: 'Unknown Exploratorium registration method',
        requiresManualAction: true
      };
      
    } catch (error) {
      this.logger.error('Error filling Exploratorium registration form:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill Exploratorium specific form
   */
  async fillExploraoriumForm(page, event, formStructure) {
    const familyData = this.getFamilyData();
    const fields = formStructure.fields;
    
    let filledCount = 0;
    const errors = [];
    
    // Fill standard registration fields
    if (fields.firstName && familyData.parent1Name) {
      const success = await this.fillFieldBySelector(page, fields.firstName.selector, familyData.parent1Name.split(' ')[0]);
      if (success) filledCount++;
      else errors.push('Failed to fill first name');
    }
    
    if (fields.lastName && familyData.parent1Name) {
      const nameParts = familyData.parent1Name.split(' ');
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      if (lastName) {
        const success = await this.fillFieldBySelector(page, fields.lastName.selector, lastName);
        if (success) filledCount++;
        else errors.push('Failed to fill last name');
      }
    }
    
    if (fields.name && familyData.parent1Name) {
      const success = await this.fillFieldBySelector(page, fields.name.selector, familyData.parent1Name);
      if (success) filledCount++;
      else errors.push('Failed to fill full name');
    }
    
    if (fields.email && familyData.parent1Email) {
      const success = await this.fillFieldBySelector(page, fields.email.selector, familyData.parent1Email);
      if (success) filledCount++;
      else errors.push('Failed to fill email');
    }
    
    if (fields.phone && familyData.emergencyContact) {
      const success = await this.fillFieldBySelector(page, fields.phone.selector, familyData.emergencyContact);
      if (success) filledCount++;
      else errors.push('Failed to fill phone');
    }
    
    // Handle group size for family events
    const groupSizeField = await page.$('input[name*="size"], select[name*="size"], input[name*="count"], select[name*="count"]');
    if (groupSizeField) {
      const groupSize = (1 + familyData.children.length).toString(); // Adults + children
      try {
        await groupSizeField.click();
        await groupSizeField.evaluate(el => el.value = '');
        await groupSizeField.type(groupSize);
        filledCount++;
        this.logger.debug(`Filled group size: ${groupSize}`);
      } catch (error) {
        errors.push('Failed to fill group size');
      }
    }
    
    this.logger.debug(`Filled ${filledCount} Exploratorium form fields`);
    
    if (filledCount === 0) {
      return { success: false, error: 'No fields could be filled: ' + errors.join(', ') };
    }
    
    // Exploratorium forms may need time to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { success: true, filledFields: filledCount };
  }

  /**
   * Handle Exploratorium event registration
   */
  async handleEventRegistration(page, event) {
    try {
      this.logger.debug('Handling Exploratorium event registration');
      
      // Look for registration buttons
      const registerButton = await page.$('button:has-text("Register"), a:has-text("Register"), button:has-text("Sign Up"), a:has-text("Sign Up")');
      
      if (registerButton) {
        this.logger.debug('Found Exploratorium registration button');
        await registerButton.click();
        
        // Wait for form or next step to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Re-analyze the page after clicking
        const newFormStructure = await this.analyzeRegistrationForm(page);
        
        if (newFormStructure.hasRegistrationForm && newFormStructure.registrationMethod === 'direct_form') {
          return await this.fillExploraoriumForm(page, event, newFormStructure);
        }
      }
      
      return {
        success: false,
        error: 'Could not complete Exploratorium event registration',
        requiresManualAction: true
      };
      
    } catch (error) {
      this.logger.error('Error handling Exploratorium event registration:', error.message);
      return {
        success: false,
        error: error.message,
        requiresManualAction: true
      };
    }
  }

  /**
   * Handle Exploratorium system-specific registration
   */
  async handleExploraoriumSystem(page, event) {
    try {
      this.logger.debug('Handling Exploratorium system');
      
      // Check for member/non-member selection
      const memberElements = await page.$$('input[name*="member"], select[name*="member"], button:has-text("Member"), button:has-text("Non-Member")');
      
      if (memberElements.length > 0) {
        this.logger.debug('Found member/non-member selection');
        // Default to non-member unless we have membership info
        const nonMemberOption = await page.$('input[value*="non-member"], button:has-text("Non-Member"), option:has-text("Non-Member")');
        if (nonMemberOption) {
          await nonMemberOption.click();
          this.logger.debug('Selected non-member option');
        }
      }
      
      // Look for age group selection
      const ageElements = await page.$$('select[name*="age"], input[name*="age"], button:has-text("Adult"), button:has-text("Child")');
      if (ageElements.length > 0) {
        this.logger.debug('Found age group selection - requires manual handling');
      }
      
      return {
        success: false,
        error: 'Exploratorium system requires specific member/age selection',
        requiresManualAction: true,
        systemType: 'exploratorium_membership'
      };
      
    } catch (error) {
      this.logger.error('Error handling Exploratorium system:', error.message);
      return {
        success: false,
        error: error.message,
        requiresManualAction: true
      };
    }
  }

  /**
   * Exploratorium specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      this.logger.debug('Verifying Exploratorium registration success');
      
      // Exploratorium specific success indicators
      const exploraoriumSuccessSelectors = [
        '.confirmation', '.success', '.thank-you', '.registered',
        '[class*="confirm"]', '[class*="success"]', '[class*="complete"]',
        '.reservation-confirmed', '.ticket-confirmed'
      ];
      
      const exploraoriumSuccessTexts = [
        'registration confirmed', 'successfully registered', 'confirmation',
        'thank you', 'reserved', 'ticket confirmed',
        'registration complete', 'see you at the exploratorium'
      ];
      
      // Check for success elements
      for (const selector of exploraoriumSuccessSelectors) {
        const element = await page.$(selector);
        if (element) {
          this.logger.debug(`Found Exploratorium success element: ${selector}`);
          
          const text = await element.evaluate(el => el.textContent) || '';
          const confirmationNumber = this.extractConfirmationNumber(text);
          
          return { success: true, confirmationNumber };
        }
      }
      
      // Check page text for success indicators
      const pageText = await page.evaluate(() => document.body.textContent);
      const lowerText = pageText.toLowerCase();
      
      for (const successText of exploraoriumSuccessTexts) {
        if (lowerText.includes(successText)) {
          this.logger.debug(`Found Exploratorium success text: ${successText}`);
          
          const confirmationNumber = this.extractConfirmationNumber(pageText);
          return { success: true, confirmationNumber };
        }
      }
      
      // Check URL for success patterns
      const url = page.url();
      if (url.includes('confirmation') || url.includes('success') || url.includes('complete') || url.includes('reserved')) {
        this.logger.debug(`Exploratorium success indicated by URL: ${url}`);
        return { success: true };
      }
      
      return { success: false, error: 'No Exploratorium success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create Exploratorium specific failure result
   */
  createFailureResult(type, message, timeTaken = 0) {
    const result = super.createFailureResult(type, message, timeTaken);
    
    // Add Exploratorium specific context
    if (type === 'ticket_required') {
      result.ticketRequired = true;
      result.message = 'Exploratorium event requires ticket purchase';
      result.registrationUrl = 'https://www.exploratorium.edu/visit/tickets';
    }
    
    return result;
  }
}

module.exports = ExploraoriumAdapter;