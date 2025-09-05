const BaseRegistrationAdapter = require('./base-adapter');

class SFRecParksAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'SFRecParksAdapter';
    this.supportedDomains = ['sfrecpark.org', 'www.sfrecpark.org'];
  }

  /**
   * Navigate to SF Rec & Parks registration page
   */
  async navigateToRegistration(event, page) {
    const registrationUrl = event.registration_url || event.registrationUrl;
    
    this.logger.debug(`Navigating to SF Rec & Parks registration: ${registrationUrl}`);
    
    await page.goto(registrationUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // SF Rec & Parks specific: Wait for their system to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we're on a valid SF Rec & Parks page
    const title = await page.title();
    const url = page.url();
    if (!title.toLowerCase().includes('recreation') && !url.includes('sfrecpark.org')) {
      throw new Error('Not on a valid SF Recreation & Parks page');
    }
  }

  /**
   * Analyze SF Rec & Parks registration form structure
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing SF Rec & Parks registration form');
      
      // SF Rec & Parks often uses their CLASS system for registration
      // Look for CLASS registration forms and links
      
      const classLinks = await page.$$('a[href*="class"], a[href*="register"], a[href*="signup"], button:has-text("Register"), a:has-text("Register")');
      const forms = await page.$$('form');
      
      this.logger.debug(`Found ${forms.length} forms and ${classLinks.length} registration links`);
      
      // Check if we're on a CLASS registration page
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const isClassPage = pageText.includes('class') || pageText.includes('program') || pageText.includes('register');
      
      if (classLinks.length > 0 && !isClassPage) {
        // We're on an event page, need to navigate to registration
        this.logger.debug('Found registration links on event page');
        
        return {
          hasRegistrationForm: true,
          needsNavigation: true,
          registrationLinks: classLinks.length,
          registrationMethod: 'navigate_to_registration'
        };
      }
      
      // Analyze forms on current page
      if (forms.length > 0) {
        let bestForm = null;
        let bestScore = 0;
        
        for (let i = 0; i < forms.length; i++) {
          const form = forms[i];
          const formAnalysis = await this.analyzeSFRecParksForm(page, form, i);
          
          if (formAnalysis.score > bestScore) {
            bestScore = formAnalysis.score;
            bestForm = formAnalysis;
          }
        }
        
        if (bestScore > 0) {
          this.logger.debug(`Found SF Rec & Parks registration form with score ${bestScore}`);
          return {
            hasRegistrationForm: true,
            needsNavigation: false,
            formIndex: bestForm.formIndex,
            fields: bestForm.fields,
            submitButton: bestForm.submitButton,
            formScore: bestScore,
            registrationMethod: 'direct_form'
          };
        }
      }
      
      // Check for SF Rec & Parks specific registration patterns
      if (pageText.includes('register') || pageText.includes('sign up') || pageText.includes('enroll')) {
        return {
          hasRegistrationForm: true,
          requiresAnalysis: true,
          registrationMethod: 'sf_recparks_system'
        };
      }
      
      return { 
        hasRegistrationForm: false, 
        reason: 'No SF Rec & Parks registration form or links found'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing SF Rec & Parks registration form:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Analyze a specific form on SF Rec & Parks page
   */
  async analyzeSFRecParksForm(page, form, formIndex) {
    try {
      const inputs = await form.$$('input, select, textarea');
      const formText = await form.evaluate(el => el.textContent.toLowerCase());
      const formAction = await form.evaluate(el => el.action || '');
      
      let score = 0;
      const fields = {};
      
      // SF Rec & Parks specific keywords
      const sfRecParksKeywords = [
        'register', 'registration', 'sign up', 'enroll', 'participant',
        'class', 'program', 'activity', 'resident', 'non-resident',
        'first name', 'last name', 'email', 'phone', 'address',
        'emergency', 'contact', 'guardian', 'parent'
      ];
      
      for (const keyword of sfRecParksKeywords) {
        if (formText.includes(keyword)) {
          score += 8;
        }
      }
      
      // Check form action for SF Rec & Parks patterns
      if (formAction.includes('register') || formAction.includes('class') || formAction.includes('signup')) {
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
      this.logger.warn(`Error analyzing SF Rec & Parks form ${formIndex}:`, error.message);
      return { formIndex, fields: {}, score: 0 };
    }
  }

  /**
   * SF Rec & Parks specific form filling logic
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling SF Rec & Parks registration form');
      
      // Handle navigation to registration if needed
      if (formStructure.needsNavigation) {
        const success = await this.navigateToRegistration(page);
        if (!success) {
          return {
            success: false,
            error: 'Could not navigate to SF Rec & Parks registration form',
            requiresManualAction: true
          };
        }
        
        // Re-analyze form after navigation
        const newFormStructure = await this.analyzeRegistrationForm(page);
        if (!newFormStructure.hasRegistrationForm) {
          return {
            success: false,
            error: 'No registration form found after navigation',
            requiresManualAction: true
          };
        }
        
        return await this.fillRegistrationForm(page, event, newFormStructure);
      }
      
      // Handle direct form filling
      if (formStructure.registrationMethod === 'direct_form') {
        return await this.fillSFRecParksForm(page, event, formStructure);
      }
      
      // Handle SF Rec & Parks system-specific registration
      if (formStructure.registrationMethod === 'sf_recparks_system') {
        return await this.handleSFRecParksSystem(page, event);
      }
      
      return {
        success: false,
        error: 'Unknown SF Rec & Parks registration method',
        requiresManualAction: true
      };
      
    } catch (error) {
      this.logger.error('Error filling SF Rec & Parks registration form:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Navigate to registration link from event page
   */
  async navigateToRegistrationLink(page) {
    try {
      // Look for registration links
      const registrationLink = await page.$('a[href*="register"], a[href*="class"], a[href*="signup"], a:has-text("Register")');
      
      if (registrationLink) {
        this.logger.debug('Clicking SF Rec & Parks registration link');
        await registrationLink.click();
        
        // Wait for navigation
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.logger.debug('Could not navigate to SF Rec & Parks registration:', error.message);
      return false;
    }
  }

  /**
   * Fill SF Rec & Parks specific form
   */
  async fillSFRecParksForm(page, event, formStructure) {
    const familyData = this.getFamilyData();
    const fields = formStructure.fields;
    
    let filledCount = 0;
    const errors = [];
    
    // Fill participant information (typically the child)
    if (fields.firstName) {
      // For kids' events, use first child's name if available
      const participantName = familyData.children.length > 0 ? 
        familyData.children[0].name : 
        familyData.parent1Name;
      
      const firstName = participantName.split(' ')[0];
      const success = await this.fillFieldBySelector(page, fields.firstName.selector, firstName);
      if (success) filledCount++;
      else errors.push('Failed to fill participant first name');
    }
    
    if (fields.lastName) {
      const participantName = familyData.children.length > 0 ? 
        familyData.children[0].name : 
        familyData.parent1Name;
      
      const nameParts = participantName.split(' ');
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      if (lastName) {
        const success = await this.fillFieldBySelector(page, fields.lastName.selector, lastName);
        if (success) filledCount++;
        else errors.push('Failed to fill participant last name');
      }
    }
    
    // Fill parent/guardian information
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
    
    // Fill emergency contact (often required for kids' activities)
    if (fields.emergency && familyData.emergencyContact) {
      const success = await this.fillFieldBySelector(page, fields.emergency.selector, familyData.emergencyContact);
      if (success) filledCount++;
      else errors.push('Failed to fill emergency contact');
    }
    
    // Handle age field for children's programs
    if (fields.age && familyData.children.length > 0) {
      const age = familyData.children[0].age?.toString() || '';
      if (age) {
        const success = await this.fillFieldBySelector(page, fields.age.selector, age);
        if (success) filledCount++;
        else errors.push('Failed to fill age');
      }
    }
    
    this.logger.debug(`Filled ${filledCount} SF Rec & Parks form fields`);
    
    if (filledCount === 0) {
      return { success: false, error: 'No fields could be filled: ' + errors.join(', ') };
    }
    
    // SF Rec & Parks forms may need time to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { success: true, filledFields: filledCount };
  }

  /**
   * Handle SF Rec & Parks CLASS system
   */
  async handleSFRecParksSystem(page, event) {
    try {
      this.logger.debug('Handling SF Rec & Parks CLASS system');
      
      // SF Rec & Parks often requires account login for registration
      // Check if login is required
      const loginElements = await page.$$('input[type="password"], input[name*="login"], input[name*="username"], a:has-text("Login"), a:has-text("Sign In")');
      
      if (loginElements.length > 0) {
        this.logger.info('SF Rec & Parks requires account login for registration');
        return {
          success: false,
          error: 'SF Rec & Parks registration requires account login',
          requiresManualAction: true,
          loginRequired: true
        };
      }
      
      // Look for resident/non-resident selection
      const residentElements = await page.$$('input[name*="resident"], select[name*="resident"], input[value*="resident"]');
      if (residentElements.length > 0) {
        this.logger.debug('Found resident/non-resident selection');
        // Default to San Francisco resident
        const residentOption = await page.$('input[value*="resident"][value*="yes"], input[value*="resident"]:not([value*="non"])');
        if (residentOption) {
          await residentOption.click();
          this.logger.debug('Selected SF resident option');
        }
      }
      
      return {
        success: false,
        error: 'SF Rec & Parks CLASS system requires specific handling',
        requiresManualAction: true,
        systemType: 'class_registration'
      };
      
    } catch (error) {
      this.logger.error('Error handling SF Rec & Parks system:', error.message);
      return {
        success: false,
        error: error.message,
        requiresManualAction: true
      };
    }
  }

  /**
   * SF Rec & Parks specific success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      this.logger.debug('Verifying SF Rec & Parks registration success');
      
      // SF Rec & Parks specific success indicators
      const sfRecParksSuccessSelectors = [
        '.confirmation', '.success', '.thank-you', '.registered',
        '[class*="confirm"]', '[class*="success"]', '[class*="complete"]'
      ];
      
      const sfRecParksSuccessTexts = [
        'registration complete', 'successfully registered', 'confirmation',
        'thank you', 'registered for', 'enrollment complete',
        'class registration', 'your spot is reserved'
      ];
      
      // Check for success elements
      for (const selector of sfRecParksSuccessSelectors) {
        const element = await page.$(selector);
        if (element) {
          this.logger.debug(`Found SF Rec & Parks success element: ${selector}`);
          
          const text = await element.evaluate(el => el.textContent) || '';
          const confirmationNumber = this.extractConfirmationNumber(text);
          
          return { success: true, confirmationNumber };
        }
      }
      
      // Check page text for success indicators
      const pageText = await page.evaluate(() => document.body.textContent);
      const lowerText = pageText.toLowerCase();
      
      for (const successText of sfRecParksSuccessTexts) {
        if (lowerText.includes(successText)) {
          this.logger.debug(`Found SF Rec & Parks success text: ${successText}`);
          
          const confirmationNumber = this.extractConfirmationNumber(pageText);
          return { success: true, confirmationNumber };
        }
      }
      
      // Check URL for success patterns
      const url = page.url();
      if (url.includes('confirmation') || url.includes('success') || url.includes('complete')) {
        this.logger.debug(`SF Rec & Parks success indicated by URL: ${url}`);
        return { success: true };
      }
      
      return { success: false, error: 'No SF Rec & Parks success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create SF Rec & Parks specific failure result
   */
  createFailureResult(type, message, timeTaken = 0) {
    const result = super.createFailureResult(type, message, timeTaken);
    
    // Add SF Rec & Parks specific context
    if (type === 'login_required') {
      result.loginRequired = true;
      result.message = 'SF Rec & Parks registration requires account login';
      result.registrationUrl = 'https://sfrecpark.org/';
    }
    
    return result;
  }
}

module.exports = SFRecParksAdapter;