const BaseRegistrationAdapter = require('./base-adapter');

class GenericRegistrationAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'GenericAdapter';
  }

  /**
   * Analyze the registration form structure using common patterns
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing registration form with generic heuristics');
      
      // Look for forms on the page
      const forms = await page.$$('form');
      
      if (forms.length === 0) {
        return { hasRegistrationForm: false, reason: 'No forms found on page' };
      }
      
      // Analyze each form to find the registration form
      let bestForm = null;
      let bestScore = 0;
      
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formAnalysis = await this.analyzeFormStructure(page, form, i);
        
        if (formAnalysis.score > bestScore) {
          bestScore = formAnalysis.score;
          bestForm = formAnalysis;
        }
      }
      
      if (bestScore === 0) {
        return { hasRegistrationForm: false, reason: 'No registration-like forms detected' };
      }
      
      this.logger.debug(`Best form found with score ${bestScore}:`, bestForm);
      
      return {
        hasRegistrationForm: true,
        formIndex: bestForm.formIndex,
        fields: bestForm.fields,
        submitButton: bestForm.submitButton,
        formScore: bestScore
      };
      
    } catch (error) {
      this.logger.error('Error analyzing registration form:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  /**
   * Analyze individual form structure
   */
  async analyzeFormStructure(page, form, formIndex) {
    try {
      // Get all input, select, and textarea elements in this form
      const inputs = await form.$$('input, select, textarea');
      
      let score = 0;
      const fields = {};
      let submitButton = null;
      
      // Check for registration-related keywords in form
      const formHtml = await form.evaluate(el => el.innerHTML);
      const formText = await form.evaluate(el => el.textContent);
      const combinedText = (formHtml + ' ' + formText).toLowerCase();
      
      // Score based on registration keywords
      const registrationKeywords = [
        'register', 'sign up', 'registration', 'event', 'rsvp',
        'first name', 'last name', 'email', 'phone', 'contact'
      ];
      
      for (const keyword of registrationKeywords) {
        if (combinedText.includes(keyword)) {
          score += 10;
        }
      }
      
      // Analyze form fields
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const fieldAnalysis = await this.analyzeFormField(page, input);
        
        if (fieldAnalysis.type !== 'unknown') {
          fields[fieldAnalysis.type] = fieldAnalysis;
          score += fieldAnalysis.confidence;
        }
      }
      
      // Look for submit button
      const submitButtons = await form.$$('button[type="submit"], input[type="submit"], button:not([type])');
      if (submitButtons.length > 0) {
        submitButton = { formIndex, buttonIndex: 0 };
        score += 20;
      }
      
      // Bonus points for having essential fields
      if (fields.firstName || fields.name) score += 15;
      if (fields.email) score += 25;
      if (fields.phone) score += 10;
      
      return {
        formIndex,
        fields,
        submitButton,
        score,
        inputCount: inputs.length
      };
      
    } catch (error) {
      this.logger.warn(`Error analyzing form ${formIndex}:`, error.message);
      return { formIndex, fields: {}, submitButton: null, score: 0 };
    }
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
      const label = await this.getFieldLabel(page, input);
      
      const combinedText = (name + ' ' + id + ' ' + placeholder + ' ' + label).toLowerCase();
      
      // Field type detection patterns
      const patterns = {
        firstName: /first.?name|fname|given.?name/i,
        lastName: /last.?name|lname|surname|family.?name/i,
        name: /^name$|full.?name|contact.?name/i,
        email: /email|e.?mail/i,
        phone: /phone|telephone|mobile|cell/i,
        children: /child|kid|participant/i,
        emergency: /emergency/i,
        age: /age|birth|dob/i,
        address: /address|street|city|zip|postal/i,
        special: /special|dietary|allerg|medical|note/i
      };
      
      // Detect field type and confidence
      for (const [fieldType, pattern] of Object.entries(patterns)) {
        if (pattern.test(combinedText)) {
          return {
            type: fieldType,
            selector: this.generateFieldSelector(name, id),
            tagName,
            inputType: type,
            confidence: this.calculateFieldConfidence(fieldType, combinedText, type),
            label: label
          };
        }
      }
      
      // Special case for email input type
      if (type === 'email') {
        return {
          type: 'email',
          selector: this.generateFieldSelector(name, id),
          tagName,
          inputType: type,
          confidence: 90,
          label: label
        };
      }
      
      return { type: 'unknown', confidence: 0 };
      
    } catch (error) {
      this.logger.warn('Error analyzing form field:', error.message);
      return { type: 'unknown', confidence: 0 };
    }
  }

  /**
   * Get label text for a form field
   */
  async getFieldLabel(page, input) {
    try {
      // Try to find associated label
      const id = await input.evaluate(el => el.id);
      if (id) {
        const label = await page.$(`label[for="${id}"]`);
        if (label) {
          return await label.evaluate(el => el.textContent) || '';
        }
      }
      
      // Try to find parent label
      const parentLabel = await input.evaluateHandle(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'FORM') {
          if (parent.tagName === 'LABEL') {
            return parent;
          }
          parent = parent.parentElement;
        }
        return null;
      });
      
      if (parentLabel && parentLabel.asElement) {
        return await parentLabel.evaluate(el => el.textContent) || '';
      }
      
      return '';
      
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate CSS selector for field
   */
  generateFieldSelector(name, id) {
    if (id) return `#${id}`;
    if (name) return `[name="${name}"]`;
    return null;
  }

  /**
   * Calculate confidence score for field detection
   */
  calculateFieldConfidence(fieldType, text, inputType) {
    let confidence = 50; // Base confidence
    
    // Boost confidence for exact matches
    if (text.includes(fieldType)) confidence += 20;
    
    // Boost for appropriate input types
    if (fieldType === 'email' && inputType === 'email') confidence += 30;
    if (fieldType === 'phone' && (inputType === 'tel' || inputType === 'phone')) confidence += 30;
    
    // Keywords boost confidence
    const keywordBoosts = {
      firstName: ['first', 'given'],
      lastName: ['last', 'surname', 'family'],
      email: ['email', 'e-mail'],
      phone: ['phone', 'telephone', 'mobile'],
    };
    
    if (keywordBoosts[fieldType]) {
      for (const keyword of keywordBoosts[fieldType]) {
        if (text.includes(keyword)) confidence += 10;
      }
    }
    
    return Math.min(confidence, 100);
  }

  /**
   * Fill the registration form using detected fields
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling registration form with family data');
      
      const familyData = this.getFamilyData();
      const fields = formStructure.fields;
      
      let filledCount = 0;
      const errors = [];
      
      // Fill detected fields
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
      
      // Handle children information if field detected
      if (fields.children && familyData.children.length > 0) {
        const childrenText = familyData.children.map(child => `${child.name} (age ${child.age})`).join(', ');
        const success = await this.fillFieldBySelector(page, fields.children.selector, childrenText);
        if (success) filledCount++;
        else errors.push('Failed to fill children information');
      }
      
      this.logger.debug(`Filled ${filledCount} fields successfully`);
      
      if (filledCount === 0) {
        return { success: false, error: 'No fields could be filled: ' + errors.join(', ') };
      }
      
      // Small delay to let form process the input (Puppeteer method)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true, filledFields: filledCount };
      
    } catch (error) {
      this.logger.error('Error filling registration form:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill field using selector with error handling
   */
  async fillFieldBySelector(page, selector, value) {
    if (!selector || !value) return false;
    
    try {
      const field = await page.$(selector);
      if (!field) {
        this.logger.debug(`Field not found: ${selector}`);
        return false;
      }
      
      // Clear existing value and type new value (Puppeteer methods)
      await field.click();
      await field.evaluate(el => el.value = ''); // Clear field
      await field.type(value);
      
      // Verify the value was set
      const actualValue = await field.evaluate(el => el.value);
      const success = actualValue === value;
      
      this.logger.debug(`Field ${selector}: ${success ? 'SUCCESS' : 'FAILED'} (expected: "${value}", actual: "${actualValue}")`);
      
      return success;
      
    } catch (error) {
      this.logger.debug(`Error filling field ${selector}:`, error.message);
      return false;
    }
  }
}

module.exports = GenericRegistrationAdapter;