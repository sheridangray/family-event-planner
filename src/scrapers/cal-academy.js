const BaseScraper = require('./base');
const cheerio = require('cheerio');

class CalAcademyScraper extends BaseScraper {
  constructor(logger) {
    super('California Academy of Sciences', 'https://www.calacademy.org/daily-calendar', logger);
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      // Fetch the daily calendar page
      const html = await this.fetchWithPuppeteer(this.url);
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      
      const $ = cheerio.load(html);
      
      // Find all event containers
      const eventContainers = $('.event-container, .event-item, .daily-event, .program-listing').filter((index, element) => {
        // Filter for containers that have event-like content
        const $el = $(element);
        return $el.find('time, .time').length > 0 || $el.find('h3, .title').length > 0;
      });
      
      this.logger.info(`Found ${eventContainers.length} potential events on Cal Academy daily calendar`);
      
      // Look for actual program/event links, but be more selective
      let eventLinks = $('a[href*="/events/programs/"], a[href*="/events/planetarium-show/"]');
      
      // Also look for links that mention specific programs/shows in their text
      const programLinks = $('a').filter((index, element) => {
        const text = $(element).text().toLowerCase();
        const href = $(element).attr('href') || '';
        return (href.includes('/events/') || href.includes('/programs/')) && 
               (text.includes('storytime') || text.includes('feeding') || 
                text.includes('show') || text.includes('theater') || 
                text.includes('adventure') || text.includes('dive') ||
                text.includes('talk') || text.length > 10); // Avoid short generic links
      });
      
      eventLinks = eventLinks.add(programLinks);
      
      this.logger.info(`Found ${eventLinks.length} potential program/event links`);
      
      const events = [];
      const seenTitles = new Set(); // Avoid duplicates
      const today = new Date();
      
      // Process event containers if found
      if (eventContainers.length > 0) {
        eventContainers.each((index, element) => {
          const event = this.processEventContainer($, $(element), today);
          if (event && !seenTitles.has(event.title)) {
            events.push(event);
            seenTitles.add(event.title);
          }
        });
      } 
      // Process event links
      if (eventLinks.length > 0) {
        eventLinks.each((index, element) => {
          const event = this.processEventLink($, $(element), today);
          if (event && !seenTitles.has(event.title)) {
            events.push(event);
            seenTitles.add(event.title);
          }
        });
      }
      
      this.logger.info(`Successfully processed ${events.length} events from Cal Academy`);
      return events;
      
    } catch (error) {
      this.logger.error(`Error scraping Cal Academy events:`, error.message);
      return [];
    }
  }
  
  processEventContainer($, $container, today) {
    try {
      // Extract time
      const timeElement = $container.find('time, .time');
      const timeText = timeElement.text().trim();
      
      // Extract title from link or heading
      const titleElement = $container.find('h3, .title, a h3');
      const title = titleElement.text().trim();
      
      // Extract link to full event page
      const linkElement = $container.find('a').first();
      const eventUrl = linkElement.attr('href');
      
      // Extract location
      const locationElement = $container.find('.location, .venue');
      const location = locationElement.text().trim();
      
      // Extract description
      const descElement = $container.find('p, .description');
      const description = descElement.text().trim();
      
      if (!title || !timeText) {
        this.logger.debug('Skipping event container - missing title or time');
        return null;
      }
      
      // Parse the time into a full date (assume today)
      const eventDate = this.parseCalAcademyTime(timeText, today);
      if (!eventDate) {
        this.logger.debug(`Skipping event with invalid time: ${title} (time: "${timeText}")`);
        return null;
      }
      
      // Create event data
      const eventData = {
        title: title,
        date: eventDate,
        location: {
          address: location || 'California Academy of Sciences, San Francisco, CA',
          lat: 37.7699, // Cal Academy coordinates
          lng: -122.4661
        },
        ageRange: this.extractCalAcademyAgeRange(title + ' ' + description),
        cost: this.extractCalAcademyCost(title + ' ' + description),
        registrationUrl: eventUrl ? `https://www.calacademy.org${eventUrl}` : this.url,
        registrationOpens: null,
        currentCapacity: {},
        description: description,
        imageUrl: null,
        isRecurring: this.isLikelyRecurring(title)
      };
      
      const event = this.createEvent(eventData);
      this.logger.debug(`Processed Cal Academy event: ${title} at ${eventDate}`);
      return event;
      
    } catch (error) {
      this.logger.error('Error processing Cal Academy event container:', error.message);
      return null;
    }
  }
  
  processEventLink($, $link, today) {
    try {
      const title = $link.text().trim();
      const eventUrl = $link.attr('href');
      
      if (!title || title.length < 5) {
        return null;
      }
      
      // Filter out generic/non-event links
      const lowerTitle = title.toLowerCase();
      const skipPatterns = [
        'museum opens', 'museum closes', 'lectures & workshops',
        'hours', 'admission', 'tickets', 'visit', 'calendar',
        'exhibits', 'about', 'contact', 'directions'
      ];
      
      if (skipPatterns.some(pattern => lowerTitle.includes(pattern))) {
        return null;
      }
      
      // For event links without time info, assume they're happening during normal hours
      const eventDate = new Date(today);
      eventDate.setHours(10, 0, 0, 0); // Default to 10 AM
      
      // Look for time info in parent elements
      const $parent = $link.parent();
      const parentText = $parent.text();
      const timeMatch = parentText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (timeMatch) {
        const timeDate = this.parseCalAcademyTime(timeMatch[0], today);
        if (timeDate) {
          eventDate.setTime(timeDate.getTime());
        }
      }
      
      const eventData = {
        title: title,
        date: eventDate,
        location: {
          address: 'California Academy of Sciences, San Francisco, CA',
          lat: 37.7699,
          lng: -122.4661
        },
        ageRange: this.extractCalAcademyAgeRange(title),
        cost: this.extractCalAcademyCost(title),
        registrationUrl: eventUrl ? `https://www.calacademy.org${eventUrl}` : this.url,
        registrationOpens: null,
        currentCapacity: {},
        description: '',
        imageUrl: null,
        isRecurring: this.isLikelyRecurring(title)
      };
      
      const event = this.createEvent(eventData);
      this.logger.debug(`Processed Cal Academy event link: ${title}`);
      return event;
      
    } catch (error) {
      this.logger.error('Error processing Cal Academy event link:', error.message);
      return null;
    }
  }
  
  parseCalAcademyTime(timeText, baseDate) {
    try {
      if (!timeText) return null;
      
      // Parse time formats like "10:30 am", "2:15 pm"
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (!timeMatch) {
        this.logger.debug(`Could not parse time format: ${timeText}`);
        return null;
      }
      
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toLowerCase();
      
      // Convert to 24-hour format
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      
      return date;
      
    } catch (error) {
      this.logger.error(`Error parsing Cal Academy time ${timeText}:`, error.message);
      return null;
    }
  }
  
  extractCalAcademyAgeRange(text) {
    if (!text) return { min: 0, max: 18 };
    
    const lowerText = text.toLowerCase();
    
    // Look for specific age mentions
    const ageMatch = text.match(/(\d+)[\s-]*(?:to|through|\-|–)[\s-]*(\d+)[\s-]*(?:years?|yrs?)?/i);
    if (ageMatch) {
      return { min: parseInt(ageMatch[1]), max: parseInt(ageMatch[2]) };
    }
    
    // Specific program types
    if (lowerText.includes('storytime') || lowerText.includes('story time')) {
      return { min: 2, max: 8 }; // Typical storytime age range
    }
    
    if (lowerText.includes('toddler')) {
      return { min: 1, max: 3 };
    }
    
    if (lowerText.includes('preschool')) {
      return { min: 3, max: 5 };
    }
    
    if (lowerText.includes('family')) {
      return { min: 0, max: 12 };
    }
    
    if (lowerText.includes('adult')) {
      return { min: 18, max: 99 };
    }
    
    // Science-focused activities are often good for school-age kids
    if (lowerText.includes('science') || lowerText.includes('planetarium') || lowerText.includes('exhibit')) {
      return { min: 4, max: 14 };
    }
    
    // Default to broad family range for Cal Academy
    return { min: 3, max: 12 };
  }
  
  extractCalAcademyCost(text) {
    if (!text) return 25; // Default Cal Academy admission
    
    const lowerText = text.toLowerCase();
    
    // Look for explicit cost mentions
    const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (costMatch) {
      return parseFloat(costMatch[1]);
    }
    
    if (lowerText.includes('free') || lowerText.includes('included')) {
      return 0;
    }
    
    if (lowerText.includes('additional') || lowerText.includes('extra')) {
      return 35; // Assume higher cost for special events
    }
    
    // Most Cal Academy events require general admission
    return 25; // Approximate general admission cost
  }
  
  isLikelyRecurring(title) {
    if (!title) return false;
    
    const lowerTitle = title.toLowerCase();
    
    // Common recurring event patterns
    const recurringPatterns = [
      'daily', 'feeding', 'storytime', 'demonstration', 
      'planetarium', 'show', 'tour', 'talk'
    ];
    
    return recurringPatterns.some(pattern => lowerTitle.includes(pattern));
  }
}

module.exports = CalAcademyScraper;