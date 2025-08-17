const BaseScraper = require('./base');
const cheerio = require('cheerio');

class SFRecParksScraper extends BaseScraper {
  constructor(logger) {
    super('SF Recreation & Parks', 'https://sfrecpark.org/calendar.aspx', logger);
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      // Try without waiting for specific selector first, then look for calendar events
      const html = await this.fetchWithPuppeteer(this.url);
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      const $ = cheerio.load(html);
      const events = [];

      // Look for calendar events in li elements
      const eventItems = $('li').filter((index, element) => {
        return $(element).find('h3 a[href*="Calendar.aspx"]').length > 0;
      });
      
      this.logger.debug(`Found ${eventItems.length} calendar event items`);
      
      if (eventItems.length === 0) {
        this.logger.warn('No calendar events found. Checking for any content...');
        this.logger.debug('Page title:', $('title').text());
        this.logger.debug('Body text preview:', $('body').text().substring(0, 200));
      }

      eventItems.each((index, element) => {
        try {
          const $event = $(element);
          
          // Extract title from h3 a span
          const title = $event.find('h3 a span').first().text().trim();
          if (!title) return;

          // Extract date from .date div
          const dateText = $event.find('.date').first().text().trim();
          const date = this.parseDate(dateText);
          if (!date) return;

          // Extract location from .eventLocation .name
          const locationText = $event.find('.eventLocation .name').first().text().trim();
          
          // Extract description from itemprop="description" or regular p tag
          const descriptionText = $event.find('[itemprop="description"]').first().text().trim() || 
                                  $event.find('p').first().text().trim();
          
          // Extract registration link from Calendar.aspx href
          const registrationLink = $event.find('a[href*="Calendar.aspx"]').first().attr('href');
          const fullRegistrationUrl = registrationLink ? 
            (registrationLink.startsWith('http') ? registrationLink : `https://sfrecpark.org${registrationLink}`) : 
            null;

          const imageUrl = $event.find('img').first().attr('src');
          const fullImageUrl = imageUrl ? 
            (imageUrl.startsWith('http') ? imageUrl : `https://sfrecpark.org${imageUrl}`) : 
            null;

          const ageRange = this.extractAge(descriptionText + ' ' + title);
          const cost = this.extractCost(descriptionText);

          if (this.isValidFamilyEvent(title, descriptionText, ageRange)) {
            const event = this.createEvent({
              title,
              date,
              location: {
                address: locationText || 'San Francisco, CA'
              },
              ageRange,
              cost,
              registrationUrl: fullRegistrationUrl,
              description: descriptionText,
              imageUrl: fullImageUrl
            });

            events.push(event);
          }
        } catch (error) {
          this.logger.warn(`Error parsing event ${index}:`, error.message);
        }
      });

      this.logger.info(`Found ${events.length} events from ${this.name}`);
      return events;

    } catch (error) {
      this.logger.error(`Error scraping ${this.name}:`, error.message);
      this.logger.error('Full error stack:', error.stack);
      return [];
    }
  }

  isValidFamilyEvent(title, description, ageRange) {
    const text = (title + ' ' + description).toLowerCase();
    
    const familyKeywords = [
      'family', 'kids', 'children', 'toddler', 'preschool', 'youth',
      'playground', 'story', 'craft', 'art', 'music', 'dance',
      'nature', 'outdoor', 'park', 'garden', 'festival', 'fair'
    ];

    const adultOnlyKeywords = [
      'adults only', 'adult', '21+', '18+', 'seniors', 'retirement',
      'business', 'networking', 'conference', 'meeting'
    ];

    const hasAdultOnly = adultOnlyKeywords.some(keyword => text.includes(keyword));
    if (hasAdultOnly) return false;

    const hasFamilyKeyword = familyKeywords.some(keyword => text.includes(keyword));
    const hasAppropriateAge = ageRange.min <= 4 && ageRange.max >= 2;

    return hasFamilyKeyword || hasAppropriateAge;
  }
}

module.exports = SFRecParksScraper;