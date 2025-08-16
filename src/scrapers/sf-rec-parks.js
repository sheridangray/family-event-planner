const BaseScraper = require('./base');
const cheerio = require('cheerio');

class SFRecParksScraper extends BaseScraper {
  constructor(logger) {
    super('SF Recreation & Parks', 'https://www.sfrecpark.org/events/', logger);
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      const html = await this.fetchWithPuppeteer(this.url, '.event-item');
      const $ = cheerio.load(html);
      const events = [];

      $('.event-item, .event-card, [class*="event"]').each((index, element) => {
        try {
          const $event = $(element);
          
          const title = $event.find('h2, h3, .event-title, .title').first().text().trim();
          if (!title) return;

          const dateText = $event.find('.event-date, .date, .when, [class*="date"]').first().text().trim();
          const date = this.parseDate(dateText);
          if (!date) return;

          const locationText = $event.find('.event-location, .location, .where, [class*="location"]').first().text().trim();
          
          const descriptionText = $event.find('.event-description, .description, .summary, p').first().text().trim();
          
          const registrationLink = $event.find('a[href*="register"], a[href*="signup"], a[href*="event"]').first().attr('href');
          const fullRegistrationUrl = registrationLink ? 
            (registrationLink.startsWith('http') ? registrationLink : `https://www.sfrecpark.org${registrationLink}`) : 
            null;

          const imageUrl = $event.find('img').first().attr('src');
          const fullImageUrl = imageUrl ? 
            (imageUrl.startsWith('http') ? imageUrl : `https://www.sfrecpark.org${imageUrl}`) : 
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