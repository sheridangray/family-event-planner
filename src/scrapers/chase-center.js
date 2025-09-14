const BaseScraper = require('./base');
const cheerio = require('cheerio');

class ChaseCenterScraper extends BaseScraper {
  constructor(logger) {
    super('chase-center', 'https://www.chasecenter.com/events', logger);
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      // Fetch the events page with Puppeteer to handle JavaScript rendering
      const html = await this.fetchWithPuppeteer(this.url);
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      
      const $ = cheerio.load(html);
      
      // Find all event containers
      const eventContainers = $('.event');
      this.logger.info(`Found ${eventContainers.length} events on Chase Center page`);
      
      const events = [];
      const seenEvents = new Set(); // Avoid duplicates
      
      eventContainers.each((index, element) => {
        try {
          const $event = $(element);
          
          // Extract date and time from the text content
          const eventText = $event.text().trim();
          const dateTimeMatch = eventText.match(/(\w+,\s+\w+\s+\d{1,2})\s+-\s+(\d{1,2}:\d{2}\s+(?:AM|PM))/);
          
          if (!dateTimeMatch) {
            this.logger.debug('Skipping event - no date/time found');
            return;
          }
          
          const dateStr = dateTimeMatch[1]; // "Sun, August 17"
          const timeStr = dateTimeMatch[2]; // "5:30 PM"
          
          // Extract title from link within the event
          const titleLink = $event.find('a').filter((i, el) => {
            const text = $(el).text().trim();
            return text.length > 5 && !text.includes('Event Details') && !text.includes('Buy Tickets') && !text.includes('RSVP');
          }).first();
          
          const title = titleLink.text().trim();
          const eventUrl = titleLink.attr('href');
          
          if (!title) {
            this.logger.debug('Skipping event - no title found');
            return;
          }
          
          // Avoid processing the same event multiple times
          const eventKey = `${title}-${dateStr}`;
          if (seenEvents.has(eventKey)) {
            return;
          }
          seenEvents.add(eventKey);
          
          // Parse the date and time
          const eventDate = this.parseChaseCenterDateTime(dateStr, timeStr);
          if (!eventDate) {
            this.logger.debug(`Skipping event with invalid date: ${title}`);
            return;
          }
          
          // Determine event type and appropriate age range/cost
          const eventType = this.categorizeEvent(title);
          
          // Create event data
          const eventData = {
            title: title,
            date: eventDate,
            location: {
              address: 'Chase Center, 1 Warriors Way, San Francisco, CA',
              lat: 37.7679,
              lng: -122.3874
            },
            ageRange: eventType.ageRange,
            cost: eventType.cost,
            registrationUrl: eventUrl ? `https://www.chasecenter.com${eventUrl}` : this.url,
            registrationOpens: null,
            currentCapacity: {},
            description: this.generateEventDescription(title, eventType),
            imageUrl: null,
            isRecurring: eventType.isRecurring
          };
          
          const event = this.createEvent(eventData);
          events.push(event);
          
          this.logger.debug(`Processed Chase Center event: ${title} on ${eventDate}`);
          
        } catch (error) {
          this.logger.error('Error processing Chase Center event:', error.message);
        }
      });
      
      this.logger.info(`Successfully processed ${events.length} events from Chase Center`);
      return events;
      
    } catch (error) {
      this.logger.error(`Error scraping Chase Center events:`, error.message);
      return [];
    }
  }
  
  parseChaseCenterDateTime(dateStr, timeStr) {
    try {
      // Parse date like "Sun, August 17" and time like "5:30 PM"
      const currentYear = new Date().getFullYear();
      
      // Clean up the date string and add year
      const cleanDateStr = dateStr.replace(/,/, '') + `, ${currentYear}`;
      
      // Parse the date
      const date = new Date(cleanDateStr);
      if (isNaN(date.getTime())) {
        this.logger.warn(`Could not parse date: ${dateStr}`);
        return null;
      }
      
      // Parse the time
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s+(AM|PM)/);
      if (!timeMatch) {
        this.logger.warn(`Could not parse time: ${timeStr}`);
        return null;
      }
      
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3];
      
      // Convert to 24-hour format
      if (ampm === 'PM' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
      
      date.setHours(hours, minutes, 0, 0);
      return date;
      
    } catch (error) {
      this.logger.error(`Error parsing Chase Center date/time: ${dateStr} ${timeStr}`, error.message);
      return null;
    }
  }
  
  categorizeEvent(title) {
    const lowerTitle = title.toLowerCase();
    
    // Warriors games
    if (lowerTitle.includes('warriors') || lowerTitle.includes('gsw')) {
      return {
        type: 'sports',
        ageRange: { min: 5, max: 99 },
        cost: 50, // Estimated minimum ticket price
        isRecurring: true
      };
    }
    
    // Valkyries games (WNBA)
    if (lowerTitle.includes('valkyries') || lowerTitle.includes('gsv')) {
      return {
        type: 'sports',
        ageRange: { min: 5, max: 99 },
        cost: 25, // Generally less expensive than Warriors
        isRecurring: true
      };
    }
    
    // Family-friendly events - check for various keywords
    const familyFriendlyKeywords = [
      'disney', 'kids', 'family', 'children', 'sesame', 'paw patrol',
      'cocomelon', 'bluey', 'frozen', 'moana', 'little bears', 'music class',
      'hot wheels', 'monster trucks', 'paw patrol', 'thomas', 'toy story'
    ];
    
    const isFamilyFriendly = familyFriendlyKeywords.some(keyword => 
      lowerTitle.includes(keyword)
    );
    
    if (isFamilyFriendly) {
      return {
        type: 'family-event',
        ageRange: { min: 1, max: 10 },
        cost: 30,
        isRecurring: false
      };
    }
    
    // Fitness classes
    if (lowerTitle.includes('fitness') || lowerTitle.includes('workout') || 
        lowerTitle.includes('hiit') || lowerTitle.includes('pilates')) {
      return {
        type: 'fitness',
        ageRange: { min: 18, max: 99 },
        cost: 0, // Often free community events
        isRecurring: true
      };
    }
    
    // General concerts/shows
    return {
      type: 'concert',
      ageRange: { min: 13, max: 99 },
      cost: 60,
      isRecurring: false
    };
  }
  
  generateEventDescription(title, eventType) {
    const venue = 'Chase Center';
    
    switch (eventType.type) {
      case 'sports':
        if (title.toLowerCase().includes('warriors')) {
          return `Golden State Warriors game at ${venue}. Experience NBA basketball in San Francisco's premier sports venue.`;
        } else if (title.toLowerCase().includes('valkyries')) {
          return `Golden State Valkyries WNBA game at ${venue}. Professional women's basketball in an exciting atmosphere.`;
        }
        return `Professional sports event at ${venue}.`;
        
      case 'family-event':
        return `Family-friendly event at ${venue}. Perfect entertainment for children and families.`;
        
      case 'fitness':
        return `Community fitness class at ${venue}. Stay active with professional instruction in a world-class facility.`;
        
      case 'concert':
      default:
        return `Live concert at ${venue}. San Francisco's premier entertainment venue hosts top musical acts.`;
    }
  }
}

module.exports = ChaseCenterScraper;