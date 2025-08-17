const BaseScraper = require('./base');
const cheerio = require('cheerio');

class SFLibraryScraper extends BaseScraper {
  constructor(logger) {
    super('SF Public Library', 'https://sfpl.org/events', logger);
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      // Fetch the events page with Puppeteer to handle any dynamic content
      const html = await this.fetchWithPuppeteer(this.url);
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      
      const $ = cheerio.load(html);
      
      // Find all event articles within the view
      const eventArticles = $('article.event');
      this.logger.info(`Found ${eventArticles.length} event articles on SF Library page`);
      
      const events = [];
      
      eventArticles.each((index, element) => {
        try {
          const $eventArticle = $(element);
          
          // Extract event title and URL from the article's about attribute or link
          const aboutUrl = $eventArticle.attr('about');
          const titleElement = $eventArticle.find('.event__title a, h2 a, .field--name-title a');
          let title = titleElement.text().trim();
          
          // If title element not found, try to extract from about URL
          if (!title && aboutUrl) {
            const urlParts = aboutUrl.split('/');
            title = urlParts[urlParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
          
          if (!title || !aboutUrl) {
            this.logger.debug(`Skipping event - no title or URL found`);
            return; // Skip if no title or URL
          }
          
          const eventUrl = `https://sfpl.org${aboutUrl}`;
          
          // Extract date and time from various possible selectors
          const dateTimeElement = $eventArticle.find('.event__date, .field--name-field-event-date-and-time, .event-date');
          const dateTimeText = dateTimeElement.text().trim();
          const eventDate = this.parseLibraryDate(dateTimeText);
          
          if (!eventDate) {
            this.logger.debug(`Skipping event with invalid date: ${title} (date text: "${dateTimeText}")`);
            return;
          }
          
          // Extract location from various possible selectors
          const locationElement = $eventArticle.find('.event__location a, .field--name-field-event-location a, .event-location a');
          const locationName = locationElement.text().trim();
          
          // Extract audience information from CSS classes and content
          const articleClasses = $eventArticle.attr('class') || '';
          const audienceFromClass = this.extractAudienceFromClasses(articleClasses);
          const audienceElement = $eventArticle.find('.event__audience, .field--name-field-event-audience, .event-audience');
          const audienceText = audienceElement.text().trim();
          const ageRange = this.extractLibraryAgeRange(audienceFromClass + ' ' + audienceText);
          
          // Extract image URL
          const imageElement = $eventArticle.find('.event__image img, .field--name-field-event-image img');
          const imageUrl = imageElement.attr('src');
          
          // Create event object
          const eventData = {
            title: title,
            date: eventDate,
            location: {
              address: locationName,
              lat: null,
              lng: null
            },
            ageRange: ageRange,
            cost: 0, // Library events are typically free
            registrationUrl: eventUrl,
            registrationOpens: null,
            currentCapacity: {},
            description: `${audienceText}`, // Use audience as description for now
            imageUrl: imageUrl ? `https://sfpl.org${imageUrl}` : null,
            isRecurring: false
          };
          
          const event = this.createEvent(eventData);
          events.push(event);
          
          this.logger.debug(`Processed library event: ${title} on ${eventDate}`);
          
        } catch (error) {
          this.logger.error(`Error processing individual library event:`, error.message);
        }
      });
      
      this.logger.info(`Successfully processed ${events.length} events from SF Library`);
      return events;
      
    } catch (error) {
      this.logger.error(`Error scraping SF Library events:`, error.message);
      return [];
    }
  }
  
  parseLibraryDate(dateTimeText) {
    try {
      if (!dateTimeText) return null;
      
      // Expected format: "Sunday, 8/17/2025, 1:00 - 2:00"
      // Extract the date part before the time
      const parts = dateTimeText.split(',');
      if (parts.length < 3) return null;
      
      const datePart = parts[1].trim(); // "8/17/2025"
      const timePart = parts[2].trim(); // "1:00 - 2:00"
      
      // Parse the date
      const date = new Date(datePart);
      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid library date format: ${dateTimeText}`);
        return null;
      }
      
      // Parse the start time if available
      if (timePart) {
        const timeMatch = timePart.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          
          // Set the time on the date
          date.setHours(hours, minutes, 0, 0);
        }
      }
      
      return date;
      
    } catch (error) {
      this.logger.error(`Error parsing library date ${dateTimeText}:`, error.message);
      return null;
    }
  }
  
  extractAudienceFromClasses(classString) {
    // Extract audience type from CSS classes like "event--family", "event--early-childhood"
    if (classString.includes('event--family')) return 'family';
    if (classString.includes('event--early-childhood')) return 'early-childhood';
    if (classString.includes('event--elementary-school-age')) return 'elementary';
    if (classString.includes('event--teen')) return 'teen';
    if (classString.includes('event--adult')) return 'adult';
    return '';
  }
  
  extractLibraryAgeRange(audienceText) {
    if (!audienceText) return { min: 0, max: 18 };
    
    const text = audienceText.toLowerCase();
    
    // Early childhood - perfect for our target
    if (text.includes('early-childhood') || text.includes('early childhood')) {
      return { min: 0, max: 5 };
    }
    
    // Family events - good for our target age range
    if (text.includes('family')) {
      return { min: 0, max: 12 };
    }
    
    // Elementary School Age
    if (text.includes('elementary')) {
      return { min: 5, max: 11 };
    }
    
    // Preschool
    if (text.includes('preschool')) {
      return { min: 2, max: 5 };
    }
    
    // Toddler/Baby
    if (text.includes('toddler') || text.includes('baby')) {
      return { min: 0, max: 3 };
    }
    
    // Teen
    if (text.includes('teen')) {
      return { min: 13, max: 18 };
    }
    
    // Adult only - outside our target
    if (text.includes('adult') && !text.includes('family')) {
      return { min: 18, max: 99 };
    }
    
    // Default to broad family range
    return { min: 0, max: 18 };
  }
}

module.exports = SFLibraryScraper;