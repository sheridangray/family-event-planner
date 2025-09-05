const BaseRegistrationAdapter = require('./base-adapter');

class CalAcademyAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'CalAcademyAdapter';
    this.supportedDomains = ['calacademy.org', 'www.calacademy.org'];
  }

  /**
   * Navigate to Cal Academy registration page with specific handling
   */
  async navigateToRegistration(event, page) {
    let registrationUrl = event.registration_url || event.registrationUrl;
    
    // Fix double URL issue in scraped data
    if (registrationUrl && registrationUrl.includes('https://www.calacademy.orghttps://')) {
      registrationUrl = registrationUrl.replace('https://www.calacademy.orghttps://', 'https://');
      this.logger.debug(`Fixed Cal Academy URL: ${registrationUrl}`);
    }
    
    this.logger.debug(`Navigating to Cal Academy registration: ${registrationUrl}`);
    
    await page.goto(registrationUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Cal Academy specific: Wait for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're on a valid Cal Academy page
    const title = await page.title();
    if (!title.toLowerCase().includes('california academy')) {
      throw new Error('Not on a valid Cal Academy page');
    }
  }

  /**
   * Analyze Cal Academy registration form structure
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing Cal Academy registration form');
      
      // Cal Academy typically uses general admission rather than specific event registration
      // Check for admission purchase options
      
      // Look for ticket/admission purchase forms
      const ticketForms = await page.$$('form[action*="ticket"], form[action*="admission"], form[class*="ticket"], form[class*="admission"]');
      const allForms = await page.$$('form');
      
      this.logger.debug(`Found ${allForms.length} total forms, ${ticketForms.length} ticket-related forms`);
      
      // Cal Academy events are typically included with general admission
      // Look for "Buy Tickets" or "Plan Your Visit" buttons instead of registration forms
      const ticketButtons = await page.$$('a[href*="ticket"], button:has-text("Buy Tickets"), a:has-text("Plan Your Visit"), a:has-text("Get Tickets")');
      
      if (ticketButtons.length > 0) {
        this.logger.debug(`Found ${ticketButtons.length} ticket purchase options`);
        
        // Cal Academy uses admission-based access rather than event-specific registration
        return {
          hasRegistrationForm: true,
          isAdmissionBased: true,
          ticketButtons: ticketButtons.length,
          eventInfo: await this.extractEventInfo(page),
          registrationMethod: 'admission_purchase'
        };
      }
      
      // Check for any forms that might be related to event signup
      if (allForms.length > 0) {
        let bestForm = null;
        let bestScore = 0;
        
        for (let i = 0; i < allForms.length; i++) {
          const form = allForms[i];
          const formAnalysis = await this.analyzeCalAcademyForm(page, form, i);
          
          if (formAnalysis.score > bestScore) {
            bestScore = formAnalysis.score;
            bestForm = formAnalysis;
          }
        }
        
        if (bestScore > 0) {
          this.logger.debug(`Found potential registration form with score ${bestScore}`);
          return {
            hasRegistrationForm: true,
            isAdmissionBased: false,
            formIndex: bestForm.formIndex,
            fields: bestForm.fields,
            submitButton: bestForm.submitButton,
            formScore: bestScore,
            registrationMethod: 'event_specific'
          };
        }
      }
      
      // No specific registration form found - this is common for Cal Academy
      // Most events are included with general admission
      return { 
        hasRegistrationForm: false, 
        reason: 'Cal Academy events typically require general admission purchase rather than specific registration',
        isAdmissionBased: true,
        registrationMethod: 'admission_required'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing Cal Academy registration form:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Analyze a specific form on Cal Academy page
   */
  async analyzeCalAcademyForm(page, form, formIndex) {
    try {
      const inputs = await form.$$('input, select, textarea');
      const formText = await form.evaluate(el => el.textContent.toLowerCase());
      
      let score = 0;
      const fields = {};
      
      // Cal Academy specific keywords
      const calAcademyKeywords = [
        'member', 'membership', 'register', 'sign up', 'reservation',
        'visitor', 'guest', 'contact', 'name', 'email', 'phone'
      ];
      
      for (const keyword of calAcademyKeywords) {
        if (formText.includes(keyword)) {
          score += 5;
        }
      }
      
      // Analyze form fields
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const fieldAnalysis = await this.analyzeFormField(page, input);
        
        if (fieldAnalysis.type !== 'unknown') {
          fields[fieldAnalysis.type] = fieldAnalysis;
          score += fieldAnalysis.confidence / 10; // Convert to smaller score contribution
        }
      }
      
      return {
        formIndex,
        fields,
        score,
        inputCount: inputs.length
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing Cal Academy form ${formIndex}:`, error.message);
      return { formIndex, fields: {}, score: 0 };
    }
  }

  /**
   * Extract event information from Cal Academy page
   */
  async extractEventInfo(page) {
    try {
      const info = {};
      
      // Extract event details from Cal Academy page structure
      const titleElement = await page.$('h1, .event-title, .program-title');
      if (titleElement) {
        info.title = await titleElement.evaluate(el => el.textContent.trim());
      }
      
      const timeElement = await page.$('.event-time, .program-time, time');
      if (timeElement) {
        info.time = await timeElement.evaluate(el => el.textContent.trim());
      }
      
      const locationElement = await page.$('.event-location, .program-location');
      if (locationElement) {
        info.location = await locationElement.evaluate(el => el.textContent.trim());
      }
      
      return info;
    } catch (error) {
      this.logger.debug('Could not extract event info:', error.message);
      return {};
    }
  }

  /**
   * Cal Academy specific form filling logic
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling Cal Academy registration form');
      
      // Handle admission-based events
      if (formStructure.isAdmissionBased) {
        this.logger.info('Cal Academy event requires admission purchase rather than registration');
        return {
          success: false,
          error: 'Event requires admission purchase - cannot auto-register',
          requiresManualAction: true,
          admissionRequired: true
        };
      }
      
      // Handle event-specific registration if available
      if (formStructure.registrationMethod === 'event_specific') {
        return await this.fillEventSpecificForm(page, event, formStructure);
      }
      
      return {
        success: false,
        error: 'No compatible registration method found',
        requiresManualAction: true
      };
      
    } catch (error) {
      this.logger.error('Error filling Cal Academy registration form:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill event-specific registration form
   */
  async fillEventSpecificForm(page, event, formStructure) {
    const familyData = this.getFamilyData();
    const fields = formStructure.fields;
    
    let filledCount = 0;
    const errors = [];
    
    // Fill standard fields using family data
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
    
    this.logger.debug(`Filled ${filledCount} Cal Academy form fields`);
    
    if (filledCount === 0) {
      return { success: false, error: 'No fields could be filled: ' + errors.join(', ') };
    }
    
    // Delay to let form process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { success: true, filledFields: filledCount };
  }

  /**
   * Fill field using selector with Cal Academy specific handling
   */
  async fillFieldBySelector(page, selector, value) {
    if (!selector || !value) return false;
    
    try {
      const field = await page.$(selector);
      if (!field) {
        this.logger.debug(`Cal Academy field not found: ${selector}`);
        return false;
      }
      
      // Cal Academy may have special field handling
      await field.click();
      await new Promise(resolve => setTimeout(resolve, 500)); // Cal Academy forms may be slow
      await field.evaluate(el => el.value = '');
      await field.type(value, { delay: 50 }); // Slower typing for Cal Academy forms
      
      const actualValue = await field.evaluate(el => el.value);
      const success = actualValue === value;
      
      this.logger.debug(`Cal Academy field ${selector}: ${success ? 'SUCCESS' : 'FAILED'} (expected: "${value}", actual: "${actualValue}")`);
      
      return success;
      
    } catch (error) {
      this.logger.debug(`Error filling Cal Academy field ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Cal Academy specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      this.logger.debug('Verifying Cal Academy registration success');
      
      // Cal Academy specific success indicators
      const calAcademySuccessSelectors = [
        '.confirmation', '.success-message', '.thank-you',
        '[class*="confirm"]', '[class*="success"]'
      ];
      
      const calAcademySuccessTexts = [
        'thank you', 'confirmation', 'registered', 'reserved',
        'we have received', 'your reservation', 'registration complete'
      ];
      
      // Check for Cal Academy specific success elements
      for (const selector of calAcademySuccessSelectors) {
        const element = await page.$(selector);
        if (element) {
          this.logger.debug(`Found Cal Academy success element: ${selector}`);
          
          const text = await element.evaluate(el => el.textContent) || '';
          const confirmationNumber = this.extractConfirmationNumber(text);
          
          return { success: true, confirmationNumber };
        }
      }
      
      // Check page text for success indicators
      const pageText = await page.evaluate(() => document.body.textContent);
      const lowerText = pageText.toLowerCase();
      
      for (const successText of calAcademySuccessTexts) {
        if (lowerText.includes(successText)) {
          this.logger.debug(`Found Cal Academy success text: ${successText}`);
          
          const confirmationNumber = this.extractConfirmationNumber(pageText);
          return { success: true, confirmationNumber };
        }
      }
      
      // Check URL for Cal Academy success patterns
      const url = page.url();
      if (url.includes('confirmation') || url.includes('success') || url.includes('thank')) {
        this.logger.debug(`Cal Academy success indicated by URL: ${url}`);
        return { success: true };
      }
      
      return { success: false, error: 'No Cal Academy success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create Cal Academy specific failure result
   */
  createFailureResult(type, message, timeTaken = 0) {
    const result = super.createFailureResult(type, message, timeTaken);
    
    // Add Cal Academy specific context
    if (type === 'admission_required') {
      result.admissionRequired = true;
      result.message = 'Cal Academy events require general admission purchase';
      result.registrationUrl = 'https://www.calacademy.org/plan-your-visit';
    }
    
    return result;
  }
}

module.exports = CalAcademyAdapter;