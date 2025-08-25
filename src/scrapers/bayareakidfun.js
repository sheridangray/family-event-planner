const BaseScraper = require('./base');
const cheerio = require('cheerio');

class BayAreaKidFunScraper extends BaseScraper {
  constructor(logger) {
    super('Bay Area Kid Fun', 'https://www.bayareakidfun.com/family-friendly-events-in-the-bay-area/', logger);
    this.weekendHighlightsUrl = 'https://www.bayareakidfun.com/weekend-highlights/';
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      const events = [];
      
      // Scrape both the main events page and weekend highlights
      const pagesToScrape = [
        { url: this.url, name: 'Main Events Page' },
        { url: this.weekendHighlightsUrl, name: 'Weekend Highlights' }
      ];
      
      for (const page of pagesToScrape) {
        try {
          this.logger.debug(`Scraping ${page.name}: ${page.url}`);
          const pageEvents = await this.scrapePage(page.url);
          events.push(...pageEvents);
        } catch (error) {
          this.logger.warn(`Error scraping ${page.name}:`, error.message);
        }
      }

      // Remove duplicates based on event ID
      const uniqueEvents = this.removeDuplicateEvents(events);
      
      this.logger.info(`Found ${uniqueEvents.length} family events from ${this.name}`);
      return uniqueEvents;

    } catch (error) {
      this.logger.error(`Error scraping ${this.name}:`, error.message);
      this.logger.error('Full error stack:', error.stack);
      return [];
    }
  }

  async scrapePage(url) {
    const html = await this.fetchWithPuppeteer(url);
    this.logger.debug(`Fetched HTML length: ${html.length} characters`);
    const $ = cheerio.load(html);
    const events = [];

    // Find the main content area
    const contentArea = $('.entry-content, .content, .main-content, main, article').first();
    if (contentArea.length === 0) {
      this.logger.debug('No main content area found, using body');
    }

    const searchArea = contentArea.length > 0 ? contentArea : $('body');

    // Look for event entries - Bay Area Kid Fun uses simple paragraph structure
    const eventElements = searchArea.find('p, div').filter((index, element) => {
      const $elem = $(element);
      const text = $elem.text().trim();
      
      // Look for elements that contain both a link and date/location patterns
      const hasLink = $elem.find('a').length > 0;
      const hasDatePattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i.test(text);
      const hasLocationPattern = /\b(sf|san francisco|oakland|berkeley|alameda|fremont|san jose|palo alto|mountain view|redwood city|bay area)\b/i.test(text);
      
      return hasLink && (hasDatePattern || hasLocationPattern) && text.length > 20;
    });

    this.logger.debug(`Found ${eventElements.length} potential event elements`);

    eventElements.each((index, element) => {
      try {
        const $event = $(element);
        const text = $event.text().trim();
        
        // Extract the main link (event title and URL)
        const linkElement = $event.find('a').first();
        if (linkElement.length === 0) return;
        
        const title = linkElement.text().trim();
        if (!title || title.length < 3) return;
        
        const registrationUrl = linkElement.attr('href');
        
        // Extract date information from the text
        const dateText = this.extractDateFromText(text);
        const date = this.parseDate(dateText);
        if (!date) return;
        
        // Extract location from the text
        const location = this.extractLocationFromText(text);
        
        // Extract description (text after the link)
        let description = text.replace(title, '').trim();
        // Remove location from description if it's at the beginning
        if (description.startsWith('~')) {
          const parts = description.split('~');
          if (parts.length > 1) {
            description = parts.slice(1).join('~').trim();
          }
        }
        
        // Check for free event indicator
        const isFree = /\(free\)/i.test(text) || /free admission/i.test(text) || /no cost/i.test(text);
        const cost = isFree ? 0 : this.extractCost(text);
        
        // Extract age information
        const ageRange = this.extractAge(text + ' ' + title);
        
        // Extract image if present
        const imageEl = $event.find('img').first();
        let imageUrl = null;
        if (imageEl.length > 0) {
          const src = imageEl.attr('src');
          if (src) {
            imageUrl = src.startsWith('http') ? src : `https://www.bayareakidfun.com${src}`;
          }
        }

        if (this.isValidFamilyEvent(title, description, ageRange)) {
          const event = this.createEvent({
            title,
            date,
            location: {
              address: location || 'Bay Area, CA'
            },
            ageRange,
            cost,
            registrationUrl: registrationUrl && registrationUrl.startsWith('http') ? registrationUrl : 
                           registrationUrl ? `https://www.bayareakidfun.com${registrationUrl}` : null,
            description: description || title,
            imageUrl
          });

          events.push(event);
          this.logger.debug(`Scraped event: ${title} on ${date.toDateString()}`);
        }
      } catch (error) {
        this.logger.warn(`Error parsing event ${index}:`, error.message);
      }
    });

    return events;
  }

  extractDateFromText(text) {
    // Look for various date patterns in Bay Area Kid Fun format
    const patterns = [
      // "Saturday, August 23" or "Friday, Aug 23"
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
      // "August 23" or "Aug 23"
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
      // "8/23" or "08/23"
      /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
      // "Aug 23rd" or "August 23rd"
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)\b/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  extractLocationFromText(text) {
    // Look for location patterns in Bay Area Kid Fun format
    const locationPatterns = [
      // "~ Location Name" format
      /~\s*([^~\n\r]+?)(?:\s*\||$)/,
      // City names
      /\b(san francisco|sf|oakland|berkeley|alameda|fremont|san jose|palo alto|mountain view|redwood city|cupertino|sunnyvale|santa clara|milpitas|union city|hayward|castro valley|dublin|pleasanton|livermore|walnut creek|concord|antioch|pittsburg|richmond|el cerrito|albany|emeryville|piedmont|san leandro|san lorenzo|castro valley)\b/i,
      // Venue patterns
      /\bat\s+([^,\n\r\.]+)/i,
      // Address patterns
      /\b\d+\s+[a-zA-Z\s]+(?:street|st|avenue|ave|blvd|boulevard|road|rd|way|drive|dr|lane|ln)\b/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        let location = match[1] || match[0];
        // Clean up the location
        location = location.replace(/^[~\s]+|[~\s]+$/g, '').trim();
        if (location.length > 3) {
          return location;
        }
      }
    }

    return null;
  }

  isValidFamilyEvent(title, description, ageRange) {
    const text = (title + ' ' + description).toLowerCase();
    
    const familyKeywords = [
      'family', 'kids', 'children', 'toddler', 'preschool', 'youth', 'baby', 'infant',
      'playground', 'story', 'craft', 'art', 'music', 'dance', 'puppet', 'magic',
      'nature', 'outdoor', 'park', 'garden', 'festival', 'fair', 'carnival',
      'zoo', 'aquarium', 'museum', 'library', 'science', 'discovery',
      'storytime', 'crafts', 'workshop', 'educational', 'hands-on', 'interactive',
      'tot', 'little ones', 'ages', 'under', 'and up', 'all ages',
      'fun for', 'kid-friendly', 'family-friendly', 'child', 'parent'
    ];

    const adultOnlyKeywords = [
      'adults only', 'adult only', '21+', '18+', 'seniors only', 'mature audiences',
      'business', 'networking', 'conference', 'meeting', 'corporate', 'professional',
      'wine tasting', 'happy hour', 'nightclub', 'bar crawl', 'pub', 'cocktail hour',
      'dating', 'singles', 'night life', 'explicit', 'nsfw'
    ];

    // Exclude adult-only events
    const hasAdultOnly = adultOnlyKeywords.some(keyword => text.includes(keyword));
    if (hasAdultOnly) return false;

    // Include events with family keywords
    const hasFamilyKeyword = familyKeywords.some(keyword => text.includes(keyword));
    if (hasFamilyKeyword) return true;

    // Include events with appropriate age ranges for our kids (Apollo: 4, Athena: 2)
    const hasAppropriateAge = ageRange.min <= 4 && ageRange.max >= 2;
    if (hasAppropriateAge) return true;

    // Bay Area Kid Fun is specifically a kids site, so assume most events are family-friendly
    // unless they contain suspicious keywords
    const suspiciousKeywords = [
      'alcohol', 'beer', 'wine', 'cocktail', 'nightlife', 'mature', 
      'explicit', 'violence', 'scary', 'horror'
    ];
    const hasSuspicious = suspiciousKeywords.some(keyword => text.includes(keyword));
    
    // Default to true for Bay Area Kid Fun since it's a curated kids site
    return !hasSuspicious;
  }

  removeDuplicateEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title.toLowerCase()}-${event.date}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Override parseDate to handle Bay Area Kid Fun specific formats
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Clean up the date string
      let cleanDateString = dateString.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim();
      
      // Remove ordinal suffixes (1st, 2nd, 3rd, 4th)
      cleanDateString = cleanDateString.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
      
      // Handle specific Bay Area Kid Fun date patterns
      const currentYear = new Date().getFullYear();
      
      // Pattern: "Saturday, August 23" -> add current year
      if (/^[a-z]+,?\s+[a-z]+\s+\d{1,2}$/i.test(cleanDateString)) {
        cleanDateString += `, ${currentYear}`;
      }
      // Pattern: "August 23" -> add current year
      else if (/^[a-z]+\s+\d{1,2}$/i.test(cleanDateString)) {
        cleanDateString += `, ${currentYear}`;
      }
      // Pattern: "8/23" -> add current year
      else if (/^\d{1,2}\/\d{1,2}$/.test(cleanDateString)) {
        cleanDateString += `/${currentYear}`;
      }
      
      const date = new Date(cleanDateString);
      
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      this.logger.warn(`Could not parse date: ${dateString}`);
      return null;
      
    } catch (error) {
      this.logger.error(`Error parsing date ${dateString}:`, error.message);
      return null;
    }
  }
}

module.exports = BayAreaKidFunScraper;