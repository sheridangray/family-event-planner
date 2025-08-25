const BaseScraper = require('./base');
const cheerio = require('cheerio');

class SanFranKidsOutAndAboutScraper extends BaseScraper {
  constructor(logger) {
    super('San Francisco Kids Out and About', 'https://sanfran.kidsoutandabout.com/', logger);
    this.eventListUrl = 'https://sanfran.kidsoutandabout.com/event-list';
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      const events = [];
      
      // Scrape both the homepage featured events and event list page
      const pagesToScrape = [
        { url: this.url, name: 'Homepage Featured Events' },
        { url: this.eventListUrl, name: 'Event List Page' }
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

      // Remove duplicates based on event title and date
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

    // Different strategies for homepage vs event list page
    if (url.includes('event-list')) {
      return this.scrapeEventListPage($);
    } else {
      return this.scrapeHomepage($);
    }
  }

  scrapeHomepage($) {
    const events = [];
    
    // Look for featured events section
    const featuredEventsSection = $('.field-enhanced-activity-image, .featured-events, .view-content, .views-row').parent();
    
    // Find event containers - Kids Out and About uses various patterns
    const eventSelectors = [
      '.views-row',
      '.field-enhanced-activity-image',
      '.event-item',
      '.node-activity',
      '[class*="activity"]',
      '[class*="event"]'
    ];

    let eventElements = $();
    for (const selector of eventSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        this.logger.debug(`Found ${elements.length} events using selector: ${selector}`);
        eventElements = elements;
        break;
      }
    }

    // If no specific event containers found, look for divs with links and content
    if (eventElements.length === 0) {
      eventElements = $('div').filter((index, element) => {
        const $elem = $(element);
        const hasLink = $elem.find('a[href*="/content/"]').length > 0;
        const hasImage = $elem.find('img').length > 0;
        const hasText = $elem.text().trim().length > 50;
        
        return hasLink && (hasImage || hasText);
      });
      this.logger.debug(`Found ${eventElements.length} potential events using content pattern matching`);
    }

    eventElements.each((index, element) => {
      try {
        const event = this.parseEventElement($, $(element));
        if (event) {
          events.push(event);
        }
      } catch (error) {
        this.logger.warn(`Error parsing homepage event ${index}:`, error.message);
      }
    });

    return events;
  }

  scrapeEventListPage($) {
    const events = [];
    
    // Event list page has a more structured format
    // Look for event containers with organization and date information
    const eventContainers = $('div').filter((index, element) => {
      const $elem = $(element);
      const text = $elem.text();
      
      // Look for elements that contain date patterns and organization info
      const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/.test(text);
      const hasAddress = /\d+.*(?:street|st|avenue|ave|blvd|boulevard|road|rd|way|drive|dr)\b/i.test(text);
      const hasPhone = /\(\d{3}\)\s*\d{3}-\d{4}/.test(text);
      
      return (hasDatePattern || hasAddress || hasPhone) && text.length > 100;
    });

    this.logger.debug(`Found ${eventContainers.length} potential event containers on event list page`);

    eventContainers.each((index, element) => {
      try {
        const event = this.parseEventListElement($, $(element));
        if (event) {
          events.push(event);
        }
      } catch (error) {
        this.logger.warn(`Error parsing event list event ${index}:`, error.message);
      }
    });

    return events;
  }

  parseEventElement($, $element) {
    // Extract title - look for links to content pages
    const titleLink = $element.find('a[href*="/content/"]').first();
    if (titleLink.length === 0) return null;
    
    const title = titleLink.text().trim();
    if (!title || title.length < 3) return null;
    
    const registrationUrl = titleLink.attr('href');
    const fullRegistrationUrl = registrationUrl && registrationUrl.startsWith('http') ? 
      registrationUrl : `https://sanfran.kidsoutandabout.com${registrationUrl}`;

    // Extract date from surrounding text
    const elementText = $element.text();
    const dateText = this.extractDateFromText(elementText);
    const date = this.parseDate(dateText);
    if (!date) return null;

    // Extract location
    const location = this.extractLocationFromText(elementText);

    // Extract description
    const description = this.extractDescription($element, title);

    // Extract image
    const imageEl = $element.find('img').first();
    let imageUrl = null;
    if (imageEl.length > 0) {
      const src = imageEl.attr('src');
      if (src) {
        imageUrl = src.startsWith('http') ? src : `https://sanfran.kidsoutandabout.com${src}`;
      }
    }

    // Determine cost
    const cost = this.extractCost(elementText + ' ' + description);
    
    // Extract age information
    const ageRange = this.extractAge(elementText + ' ' + title + ' ' + description);

    if (this.isValidFamilyEvent(title, description, ageRange)) {
      return this.createEvent({
        title,
        date,
        location: {
          address: location || 'San Francisco, CA'
        },
        ageRange,
        cost,
        registrationUrl: fullRegistrationUrl,
        description: description || title,
        imageUrl
      });
    }

    return null;
  }

  parseEventListElement($, $element) {
    const text = $element.text();
    
    // First, extract all MM/DD/YYYY dates
    const dateMatches = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g);
    if (!dateMatches || dateMatches.length === 0) return null;
    
    // Use the first date found
    const firstDate = this.parseDate(dateMatches[0]);
    if (!firstDate) return null;
    
    // Look for patterns like "Activity Name - Organization"
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let title = '';
    let organization = '';
    let address = '';
    
    // Find organization name (usually contains "Location:" or has address patterns)
    const organizationLine = lines.find(line => 
      line.includes('Organization:') || 
      (line.length > 10 && line.length < 100 && !line.includes('Phone:') && !line.includes('Time:'))
    );
    
    if (organizationLine) {
      organization = organizationLine.replace('Organization:', '').trim();
    }
    
    // Find activity/event title (look for lines that end with organization name or are standalone descriptive lines)
    for (const line of lines) {
      if (line.length > 10 && line.length < 150 && 
          !line.includes('Organization:') && 
          !line.includes('Location:') && 
          !line.includes('Phone:') && 
          !line.includes('Time:') && 
          !line.includes('Dates:') &&
          !/\d{1,2}\/\d{1,2}\/\d{4}/.test(line) &&
          !line.includes('See map:') &&
          !line.includes('Show more dates') &&
          !line.includes('jQuery')) {
        
        // If line ends with organization name, extract the activity part
        if (organization && line.endsWith(organization)) {
          title = line.replace(organization, '').replace(/\s*-\s*$/, '').trim();
          break;
        } else if (!title) {
          title = line;
        }
      }
    }
    
    // Fallback to organization name if no specific title found
    if (!title && organization) {
      title = organization;
    }
    
    if (!title || title.length < 3) return null;
    
    // Find address
    const addressLine = lines.find(line => 
      /\d+.*(?:street|st|avenue|ave|blvd|boulevard|road|rd|way|drive|dr)\b/i.test(line) ||
      line.includes('Location:')
    );
    
    if (addressLine) {
      address = addressLine.replace('Location:', '').trim();
    }
    
    // Extract cost and age info from full text
    const cost = this.extractCost(text);
    const ageRange = this.extractAge(text + ' ' + title);

    if (this.isValidFamilyEvent(title, text, ageRange)) {
      return this.createEvent({
        title,
        date: firstDate,
        location: {
          address: address || 'San Francisco, CA'
        },
        ageRange,
        cost,
        registrationUrl: null, // Event list page doesn't provide direct links
        description: title !== organization ? `${title} at ${organization}` : title,
        imageUrl: null
      });
    }

    return null;
  }

  extractDateFromText(text) {
    // Kids Out and About date patterns - prioritize the MM/DD/YYYY format they use
    const patterns = [
      // MM/DD/YYYY format (most common on this site)
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
      // "January 15, 2025" format
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i,
      // "Jan 15" format
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})\b/i,
      // "Saturday, January 15"
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i
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
    // Look for San Francisco area location patterns
    const locationPatterns = [
      // Full addresses
      /\d+.*?(?:street|st|avenue|ave|blvd|boulevard|road|rd|way|drive|dr).*?(?:san francisco|sf|oakland|berkeley)\b/i,
      // Venue names with "at"
      /\bat\s+([^,\n\r\.]+)/i,
      // SF neighborhoods and areas
      /\b(castro|mission|haight|pacific heights|nob hill|russian hill|north beach|chinatown|soma|financial district|tenderloin|richmond|sunset|presidio|marina|fillmore|potrero hill|bernal heights|glen park|noe valley|twin peaks)\b/i,
      // Bay Area cities
      /\b(san francisco|sf|oakland|berkeley|alameda|sausalito|mill valley|san rafael|palo alto|mountain view|san jose|fremont|hayward|redwood city)\b/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        let location = match[1] || match[0];
        location = location.trim();
        if (location.length > 3 && location.length < 100) {
          return location;
        }
      }
    }

    return null;
  }

  extractDescription($element, title) {
    // Look for description in various elements
    const descriptionSelectors = [
      '.field-body, .description, .summary, .content, p'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = $element.find(selector).first();
      if (descElement.length > 0) {
        const desc = descElement.text().trim();
        if (desc.length > title.length && desc.length < 500) {
          return desc;
        }
      }
    }

    // Fallback to element text minus title
    const fullText = $element.text().trim();
    const descText = fullText.replace(title, '').trim();
    return descText.length > 20 ? descText.substring(0, 300) : '';
  }

  isValidFamilyEvent(title, description, ageRange) {
    const text = (title + ' ' + description).toLowerCase();
    
    const familyKeywords = [
      'family', 'kids', 'children', 'toddler', 'preschool', 'youth', 'baby', 'infant',
      'playground', 'story', 'craft', 'art', 'music', 'dance', 'puppet', 'magic',
      'nature', 'outdoor', 'park', 'garden', 'festival', 'fair', 'carnival',
      'zoo', 'aquarium', 'museum', 'library', 'science', 'discovery', 'interactive',
      'storytime', 'crafts', 'workshop', 'educational', 'hands-on', 'creative',
      'tot', 'little ones', 'ages', 'under', 'and up', 'all ages', 'family-friendly',
      'parent', 'child', 'fun for', 'kid-friendly', 'early childhood', 'summer camp'
    ];

    const adultOnlyKeywords = [
      'adults only', 'adult only', '21+', '18+', 'seniors only', 'mature audiences',
      'business', 'networking', 'conference', 'meeting', 'corporate', 'professional',
      'wine tasting', 'happy hour', 'nightclub', 'bar crawl', 'pub', 'cocktail',
      'dating', 'singles', 'night life', 'explicit', 'nsfw', 'mature content'
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

    // Kids Out and About is specifically for kids, so be more inclusive
    const suspiciousKeywords = [
      'alcohol', 'beer', 'wine', 'cocktail', 'nightlife', 'mature', 
      'explicit', 'violence', 'scary', 'horror', 'gambling'
    ];
    const hasSuspicious = suspiciousKeywords.some(keyword => text.includes(keyword));
    
    // Default to true for Kids Out and About unless suspicious
    return !hasSuspicious;
  }

  removeDuplicateEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title.toLowerCase()}-${event.date.toDateString()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Override parseDate to handle Kids Out and About specific formats
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Clean up the date string
      let cleanDateString = dateString.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim();
      
      const currentYear = new Date().getFullYear();
      
      // Handle MM/DD/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateString)) {
        const date = new Date(cleanDateString);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Handle "Jan 15" format - add current year
      if (/^[a-z]{3}\.?\s+\d{1,2}$/i.test(cleanDateString)) {
        cleanDateString += `, ${currentYear}`;
      }
      
      // Handle "Saturday, January 15" format - add current year
      if (/^[a-z]+,?\s+[a-z]+\s+\d{1,2}$/i.test(cleanDateString)) {
        cleanDateString += `, ${currentYear}`;
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

module.exports = SanFranKidsOutAndAboutScraper;