const BaseScraper = require('./base');
const cheerio = require('cheerio');

class FunCheapSFScraper extends BaseScraper {
  constructor(logger) {
    super('funcheapsf', 'https://sf.funcheap.com/city/san-francisco', logger);
    this.familyEventsUrl = 'https://sf.funcheap.com/city/san-francisco';
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      const html = await this.fetchWithPuppeteer(this.familyEventsUrl);
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      const $ = cheerio.load(html);
      const events = [];

      // Look for event listings - common patterns for event sites
      const eventSelectors = [
        '.event-card',
        '.event-item',
        '.event-listing',
        '.event',
        '[class*="event"]',
        '.listing',
        '.card',
        'article'
      ];

      let eventItems = $();
      for (const selector of eventSelectors) {
        const items = $(selector);
        if (items.length > 0) {
          this.logger.debug(`Found ${items.length} events using selector: ${selector}`);
          eventItems = items;
          break;
        }
      }

      // If no specific event containers found, look for common content patterns
      if (eventItems.length === 0) {
        // Look for divs that contain both date and title patterns
        eventItems = $('div').filter((index, element) => {
          const text = $(element).text();
          const hasDatePattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i.test(text);
          const hasTimePattern = /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(text);
          const hasTitle = $(element).find('h1, h2, h3, h4, h5, h6, .title, [class*="title"]').length > 0;
          
          return (hasDatePattern || hasTimePattern) && hasTitle && text.length > 50;
        });
        this.logger.debug(`Found ${eventItems.length} potential events using content pattern matching`);
      }

      eventItems.each((index, element) => {
        try {
          const $event = $(element);
          
          // Extract title from various possible selectors
          const titleSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.title', '.event-title', '.name', '.heading',
            '[class*="title"]', '[class*="name"]', '[class*="heading"]',
            'a[href*="/event"]', 'a[href*="/events"]'
          ];
          
          let title = '';
          for (const selector of titleSelectors) {
            const titleEl = $event.find(selector).first();
            if (titleEl.length > 0) {
              title = titleEl.text().trim();
              if (title.length > 0) break;
            }
          }
          
          if (!title || title.length < 3) return;

          // Extract date from various possible selectors
          const dateSelectors = [
            '.date', '.event-date', '.when', '.time',
            '[class*="date"]', '[class*="time"]', '[class*="when"]',
            '.datetime', '.schedule'
          ];
          
          let dateText = '';
          for (const selector of dateSelectors) {
            const dateEl = $event.find(selector).first();
            if (dateEl.length > 0) {
              dateText = dateEl.text().trim();
              if (dateText.length > 0) break;
            }
          }
          
          // If no date element found, look for date patterns in the text
          if (!dateText) {
            const allText = $event.text();
            const dateMatch = allText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}-\d{1,2}(?:-\d{2,4})?/i);
            if (dateMatch) {
              dateText = dateMatch[0];
            }
          }
          
          const date = this.parseDate(dateText);
          if (!date) return;

          // Extract location
          const locationSelectors = [
            '.location', '.venue', '.where', '.address',
            '[class*="location"]', '[class*="venue"]', '[class*="address"]'
          ];
          
          let locationText = 'San Francisco, CA';
          for (const selector of locationSelectors) {
            const locationEl = $event.find(selector).first();
            if (locationEl.length > 0) {
              const loc = locationEl.text().trim();
              if (loc.length > 0) {
                locationText = loc;
                break;
              }
            }
          }

          // Extract description
          const descriptionSelectors = [
            '.description', '.details', '.summary', '.content',
            '[class*="description"]', '[class*="details"]', '[class*="summary"]',
            'p'
          ];
          
          let descriptionText = '';
          for (const selector of descriptionSelectors) {
            const descEl = $event.find(selector).first();
            if (descEl.length > 0) {
              const desc = descEl.text().trim();
              if (desc.length > title.length) {
                descriptionText = desc.substring(0, 500); // Limit description length
                break;
              }
            }
          }

          // Extract cost information
          const costSelectors = [
            '.price', '.cost', '.fee', '.admission',
            '[class*="price"]', '[class*="cost"]', '[class*="fee"]'
          ];
          
          let costText = '';
          for (const selector of costSelectors) {
            const costEl = $event.find(selector).first();
            if (costEl.length > 0) {
              costText = costEl.text().trim();
              break;
            }
          }
          
          // Check for "free" in the description or text if no cost element found
          if (!costText) {
            const allText = $event.text().toLowerCase();
            if (allText.includes('free') || allText.includes('no cost') || allText.includes('complimentary')) {
              costText = 'free';
            }
          }

          // Extract registration URL
          const linkEl = $event.find('a').first();
          let registrationUrl = null;
          if (linkEl.length > 0) {
            const href = linkEl.attr('href');
            if (href) {
              registrationUrl = href.startsWith('http') ? href : `https://sf.funcheap.com${href}`;
            }
          }

          // Extract image
          const imageEl = $event.find('img').first();
          let imageUrl = null;
          if (imageEl.length > 0) {
            const src = imageEl.attr('src');
            if (src) {
              imageUrl = src.startsWith('http') ? src : `https://sf.funcheap.com${src}`;
            }
          }

          const ageRange = this.extractAge(descriptionText + ' ' + title);
          const cost = this.extractCost(costText + ' ' + descriptionText);

          if (this.isValidFamilyEvent(title, descriptionText, ageRange)) {
            const event = this.createEvent({
              title,
              date,
              location: {
                address: locationText
              },
              ageRange,
              cost,
              registrationUrl,
              description: descriptionText,
              imageUrl
            });

            events.push(event);
            this.logger.debug(`Scraped event: ${title} on ${date.toDateString()}`);
          }
        } catch (error) {
          this.logger.warn(`Error parsing event ${index}:`, error.message);
        }
      });

      // If we didn't find many events, try alternative scraping strategies
      if (events.length === 0) {
        this.logger.warn('No events found with primary strategy, trying fallback approaches...');
        
        // Try to find links to specific event pages
        const eventLinks = $('a[href*="/event"], a[href*="/events"]');
        if (eventLinks.length > 0) {
          this.logger.debug(`Found ${eventLinks.length} event links, could implement detail page scraping`);
        }
        
        // Log some debug information about page structure
        this.logger.debug('Page title:', $('title').text());
        this.logger.debug('Main content classes:', $('main, .main, .content, .container').attr('class'));
        this.logger.debug('Number of divs:', $('div').length);
        this.logger.debug('Number of articles:', $('article').length);
      }

      this.logger.info(`Found ${events.length} family events from ${this.name}`);
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
      'nature', 'outdoor', 'park', 'garden', 'festival', 'fair',
      'puppet', 'magic', 'circus', 'zoo', 'aquarium', 'museum',
      'storytime', 'crafts', 'workshop', 'educational', 'hands-on',
      'interactive', 'baby', 'infant', 'tot', 'little ones'
    ];

    const adultOnlyKeywords = [
      'adults only', 'adult only', '21+', '18+', 'seniors only', 'retirement',
      'business', 'networking', 'conference', 'meeting', 'corporate',
      'wine tasting', 'happy hour', 'nightclub', 'bar crawl', 'pub',
      'mature audiences', 'explicit', 'nsfw'
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

    // Include events that mention "free" (family-friendly indicator)
    if (text.includes('free') && !text.includes('alcohol') && !text.includes('bar')) {
      return true;
    }

    // Exclude if it seems clearly adult-oriented
    const suspiciousKeywords = ['cocktail', 'wine', 'beer', 'alcohol', 'nightlife', 'dating'];
    const hasSuspicious = suspiciousKeywords.some(keyword => text.includes(keyword));
    
    return !hasSuspicious;
  }

  // Override parseDate to handle FunCheapSF specific date formats
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Clean up the date string
      let cleanDateString = dateString.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim();
      
      // Handle specific FunCheapSF date patterns
      // Example: "Sat, Dec 23" or "December 23, 2023"
      const patterns = [
        // "Sat, Dec 23" -> add current year
        /^[a-z]{3},?\s+[a-z]{3}\s+\d{1,2}$/i,
        // "Dec 23" -> add current year  
        /^[a-z]{3}\s+\d{1,2}$/i,
        // "12/23" -> add current year
        /^\d{1,2}\/\d{1,2}$/,
        // "12-23" -> add current year
        /^\d{1,2}-\d{1,2}$/
      ];
      
      const currentYear = new Date().getFullYear();
      
      for (const pattern of patterns) {
        if (pattern.test(cleanDateString)) {
          cleanDateString += `, ${currentYear}`;
          break;
        }
      }
      
      // Try parsing the cleaned date
      const date = new Date(cleanDateString);
      
      // If parsing failed, try to extract just the date part
      if (isNaN(date.getTime())) {
        const dateMatch = cleanDateString.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
        if (dateMatch) {
          const month = dateMatch[1];
          const day = dateMatch[2];
          const year = dateMatch[3] || currentYear;
          const testDate = new Date(`${month} ${day}, ${year}`);
          if (!isNaN(testDate.getTime())) {
            return testDate;
          }
        }
      }
      
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

module.exports = FunCheapSFScraper;