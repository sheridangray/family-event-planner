const BaseRegistrationAdapter = require('./base-adapter');

class SFLibraryAdapter extends BaseRegistrationAdapter {
  constructor(logger, familyData) {
    super(logger, familyData);
    this.name = 'SFLibraryAdapter';
    this.supportedDomains = ['sfpl.org', 'www.sfpl.org'];
  }

  /**
   * Analyze SF Library registration form structure
   */
  async analyzeRegistrationForm(page) {
    try {
      this.logger.debug('Analyzing SF Library registration form');
      
      // SF Library events are typically free and require simple registration
      const forms = await page.$$('form');
      const registerLinks = await page.$$('a[href*="register"], button:has-text("Register"), a:has-text("Register")');
      
      this.logger.debug(`Found ${forms.length} forms and ${registerLinks.length} registration links`);
      
      // Check for Eventbrite integration (common for SF Library)
      const eventbriteElements = await page.$$('[src*="eventbrite"], [href*="eventbrite"], a[href*="eventbrite.com"]');
      if (eventbriteElements.length > 0) {
        this.logger.debug('SF Library event uses Eventbrite registration');
        return {
          hasRegistrationForm: true,
          registrationMethod: 'eventbrite',
          isThirdParty: true
        };
      }
      
      // Standard form analysis for SF Library
      if (forms.length > 0) {
        const formAnalysis = await this.analyzeLibraryForm(page, forms[0], 0);
        if (formAnalysis.score > 20) {
          return {
            hasRegistrationForm: true,
            registrationMethod: 'direct_form',
            formIndex: 0,
            fields: formAnalysis.fields,
            formScore: formAnalysis.score
          };
        }
      }
      
      return { 
        hasRegistrationForm: false, 
        reason: 'Most SF Library events are free and drop-in, no registration required'
      };
      
    } catch (error) {
      this.logger.error('Error analyzing SF Library registration form:', error.message);
      return { hasRegistrationForm: false, reason: error.message };
    }
  }

  async analyzeLibraryForm(page, form, formIndex) {
    const inputs = await form.$$('input, select, textarea');
    const formText = await form.evaluate(el => el.textContent.toLowerCase());
    
    let score = 0;
    const fields = {};
    
    const libraryKeywords = ['register', 'sign up', 'library', 'event', 'program', 'name', 'email', 'phone'];
    
    for (const keyword of libraryKeywords) {
      if (formText.includes(keyword)) {
        score += 5;
      }
    }
    
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const fieldAnalysis = await this.analyzeFormField(page, input);
      
      if (fieldAnalysis.type !== 'unknown') {
        fields[fieldAnalysis.type] = fieldAnalysis;
        score += fieldAnalysis.confidence / 10;
      }
    }
    
    return { formIndex, fields, score, inputCount: inputs.length };
  }

  /**
   * Fill SF Library form (typically simple contact info)
   */
  async fillRegistrationForm(page, event, formStructure) {
    try {
      this.logger.debug('Filling SF Library registration form');
      
      if (formStructure.isThirdParty || formStructure.registrationMethod === 'eventbrite') {
        return {
          success: false,
          error: 'SF Library event uses third-party registration (Eventbrite)',
          requiresManualAction: true,
          thirdParty: 'Eventbrite'
        };
      }
      
      const familyData = this.getFamilyData();
      const fields = formStructure.fields;
      let filledCount = 0;
      
      if (fields.name && familyData.parent1Name) {
        await this.fillFieldBySelector(page, fields.name.selector, familyData.parent1Name);
        filledCount++;
      }
      
      if (fields.email && familyData.parent1Email) {
        await this.fillFieldBySelector(page, fields.email.selector, familyData.parent1Email);
        filledCount++;
      }
      
      if (fields.phone && familyData.emergencyContact) {
        await this.fillFieldBySelector(page, fields.phone.selector, familyData.emergencyContact);
        filledCount++;
      }
      
      return filledCount > 0 ? 
        { success: true, filledFields: filledCount } : 
        { success: false, error: 'No fields could be filled' };
        
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = SFLibraryAdapter;