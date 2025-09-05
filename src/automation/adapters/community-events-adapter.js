const BaseRegistrationAdapter = require('./base-adapter');

class CommunityEventsAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'CommunityEventsAdapter';
    this.supportedDomains = [
      'bayareakidfun.com', 'www.bayareakidfun.com',
      'sf.funcheap.com', 'funcheap.com',
      'kidsoutandabout.com', 'sanfran.kidsoutandabout.com',
      'ybgfestival.org', 'www.ybgfestival.org'
    ];
  }

  /**
   * Analyze community event site registration patterns
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing community event site registration form');
      
      const url = page.url();
      const domain = new URL(url).hostname.toLowerCase();
      
      // Check for common third-party registration systems
      const thirdPartyPatterns = [
        { name: 'Eventbrite', selectors: ['[src*="eventbrite"]', '[href*="eventbrite"]', 'a[href*="eventbrite.com"]'] },
        { name: 'Facebook Events', selectors: ['[href*="facebook.com/events"]', '[src*="facebook"]'] },
        { name: 'Meetup', selectors: ['[href*="meetup.com"]', '[src*="meetup"]'] },
        { name: 'External Registration', selectors: ['a[href*="register"]:not([href*="' + domain + '"])'] }
      ];
      
      for (const pattern of thirdPartyPatterns) {
        const elements = await page.$$(pattern.selectors.join(', '));
        if (elements.length > 0) {
          this.logger.debug(`Community event uses ${pattern.name} registration`);
          return {
            hasRegistrationForm: true,
            registrationMethod: 'third_party',
            thirdParty: pattern.name,
            requiresManualAction: true
          };
        }
      }
      
      // Check for direct registration forms
      const forms = await page.$$('form');
      const registerElements = await page.$$('button:has-text("Register"), a:has-text("Register"), input[value*="Register"]');
      
      this.logger.debug(`Found ${forms.length} forms and ${registerElements.length} registration elements`);
      
      if (forms.length > 0) {
        const formAnalysis = await this.analyzeCommunityForm(page, forms[0], 0);
        if (formAnalysis.score > 15) {
          return {
            hasRegistrationForm: true,
            registrationMethod: 'direct_form',
            formIndex: 0,
            fields: formAnalysis.fields,
            formScore: formAnalysis.score
          };
        }
      }
      
      // Check for email-based registration (common for community events)
      const emailLinks = await page.$$('a[href^="mailto:"]');
      if (emailLinks.length > 0) {
        this.logger.debug('Community event uses email registration');
        return {
          hasRegistrationForm: true,
          registrationMethod: 'email',
          requiresManualAction: true
        };
      }
      
      // Many community events are drop-in or informational only
      const pageText = await page.evaluate(() => document.body.textContent.toLowerCase());
      const isDropIn = pageText.includes('drop in') || pageText.includes('drop-in') || 
                       pageText.includes('no registration') || pageText.includes('free admission');
      
      if (isDropIn) {
        return {
          hasRegistrationForm: false,
          reason: 'Community event appears to be drop-in, no registration required'
        };
      }
      
      return { 
        hasRegistrationForm: false, 
        reason: 'No clear registration method found for community event'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing community event registration:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  async analyzeCommunityForm(page, form, formIndex) {
    const inputs = await form.$$('input, select, textarea');
    const formText = await form.evaluate(el => el.textContent.toLowerCase());
    
    let score = 0;
    const fields = {};
    
    // Community event keywords
    const communityKeywords = [
      'register', 'sign up', 'rsvp', 'contact', 'event', 'family',
      'name', 'email', 'phone', 'message', 'comment'
    ];
    
    for (const keyword of communityKeywords) {
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
        score += fieldAnalysis.confidence / 15;
      }
    }
    
    return { formIndex, fields, score, inputCount: inputs.length };
  }

  /**
   * Fill community event registration form
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling community event registration form');
      
      // Handle third-party registrations
      if (formStructure.registrationMethod === 'third_party') {
        return {
          success: false,
          error: `Community event uses ${formStructure.thirdParty} registration`,
          requiresManualAction: true,
          thirdParty: formStructure.thirdParty
        };
      }
      
      // Handle email registration
      if (formStructure.registrationMethod === 'email') {
        return {
          success: false,
          error: 'Community event requires email registration',
          requiresManualAction: true,
          emailRequired: true
        };
      }
      
      // Handle direct form
      if (formStructure.registrationMethod === 'direct_form') {
        return await this.fillCommunityForm(page, event, formStructure);
      }
      
      return {
        success: false,
        error: 'Unknown community event registration method',
        requiresManualAction: true
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fillCommunityForm(page, event, formStructure) {
    const familyData = this.getFamilyData();
    const fields = formStructure.fields;
    let filledCount = 0;
    
    // Fill basic contact information
    if (fields.name && familyData.parent1Name) {
      await this.fillFieldBySelector(page, fields.name.selector, familyData.parent1Name);
      filledCount++;
    }
    
    if (fields.firstName && familyData.parent1Name) {
      await this.fillFieldBySelector(page, fields.firstName.selector, familyData.parent1Name.split(' ')[0]);
      filledCount++;
    }
    
    if (fields.lastName && familyData.parent1Name) {
      const lastName = familyData.parent1Name.split(' ').slice(1).join(' ');
      if (lastName) {
        await this.fillFieldBySelector(page, fields.lastName.selector, lastName);
        filledCount++;
      }
    }
    
    if (fields.email && familyData.parent1Email) {
      await this.fillFieldBySelector(page, fields.email.selector, familyData.parent1Email);
      filledCount++;
    }
    
    if (fields.phone && familyData.emergencyContact) {
      await this.fillFieldBySelector(page, fields.phone.selector, familyData.emergencyContact);
      filledCount++;
    }
    
    // Fill message/comment fields with family info
    if (fields.message || fields.comment) {
      const messageField = fields.message || fields.comment;
      const message = `Family of ${1 + familyData.children.length} (${familyData.children.length} children). Looking forward to the event!`;
      await this.fillFieldBySelector(page, messageField.selector, message);
      filledCount++;
    }
    
    this.logger.debug(`Filled ${filledCount} community event form fields`);
    
    return filledCount > 0 ? 
      { success: true, filledFields: filledCount } : 
      { success: false, error: 'No fields could be filled' };
  }

  /**
   * Community events success verification
   */
  async verifyRegistrationSuccess(page) {
    try {
      const communitySuccessTexts = [
        'thank you', 'thanks', 'registered', 'signed up', 'rsvp confirmed',
        'we received', 'confirmation', 'see you there', 'looking forward'
      ];
      
      const pageText = await page.evaluate(() => document.body.textContent);
      const lowerText = pageText.toLowerCase();
      
      for (const successText of communitySuccessTexts) {
        if (lowerText.includes(successText)) {
          this.logger.debug(`Found community event success text: ${successText}`);
          return { success: true };
        }
      }
      
      return { success: false, error: 'No community event success indicators found' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = CommunityEventsAdapter;