const BaseScraper = require('./base');
const cheerio = require('cheerio');

class YBGFestivalScraper extends BaseScraper {
  constructor(logger) {
    super('YBG Festival', 'https://ybgfestival.org/', logger);
    this.eventsUrl = 'https://ybgfestival.org/';
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      
      let html;
      try {
        html = await this.fetchWithPuppeteer(this.eventsUrl);
      } catch (error) {
        this.logger.warn('Puppeteer failed, falling back to HTTP request:', error.message);
        html = await this.fetchHTML(this.eventsUrl);
      }
      this.logger.debug(`Fetched HTML length: ${html.length} characters`);
      const $ = cheerio.load(html);
      const events = [];

      // YBG Festival uses structured JSON-LD data, try to extract that first
      const jsonLdScripts = $('script[type="application/ld+json"]');
      let jsonLdEvents = [];
      
      jsonLdScripts.each((index, element) => {
        try {
          const jsonData = JSON.parse($(element).html());
          if (jsonData['@type'] === 'Event' || (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Event'))) {
            const eventArray = Array.isArray(jsonData) ? jsonData : [jsonData];
            jsonLdEvents = jsonLdEvents.concat(eventArray.filter(item => item['@type'] === 'Event'));
          }
        } catch (error) {
          this.logger.debug(`Error parsing JSON-LD data: ${error.message}`);
        }
      });

      this.logger.debug(`Found ${jsonLdEvents.length} events in JSON-LD data`);

      // Process JSON-LD events
      jsonLdEvents.forEach((eventData, index) => {
        try {
          const title = eventData.name || '';
          if (!title || title.length < 3) return;

          const startDate = eventData.startDate ? new Date(eventData.startDate) : null;
          if (!startDate || isNaN(startDate.getTime())) return;

          // YBG Festival is located at Yerba Buena Gardens
          let locationAddress = 'Yerba Buena Gardens, San Francisco, CA';
          if (eventData.location) {
            if (typeof eventData.location === 'string') {
              locationAddress = eventData.location;
            } else if (eventData.location.address) {
              locationAddress = typeof eventData.location.address === 'string' 
                ? eventData.location.address 
                : eventData.location.address.streetAddress || locationAddress;
            }
          }
          const location = { address: locationAddress };

          const description = eventData.description || '';
          const imageUrl = eventData.image?.[0]?.url || eventData.image?.url || null;
          
          // YBG Festival events are free
          const cost = 0;
          
          // Extract age range from description or default to all ages
          const ageRange = this.extractAge(description + ' ' + title);
          
          // YBG Festival has many family-friendly events, especially Children's Garden Series
          if (this.isValidFamilyEvent(title, description, ageRange)) {
            const event = this.createEvent({
              title,
              date: startDate,
              location,
              ageRange,
              cost,
              registrationUrl: eventData.url || this.eventsUrl,
              description,
              imageUrl
            });

            events.push(event);
            this.logger.debug(`Scraped JSON-LD event: ${title} on ${startDate.toDateString()}`);
          }
        } catch (error) {
          this.logger.warn(`Error parsing JSON-LD event ${index}:`, error.message);
        }
      });

      // If no JSON-LD events found, fall back to HTML parsing
      if (events.length === 0) {
        this.logger.debug('No JSON-LD events found, trying HTML parsing...');
        
        // Look for event listings using common selectors
        const eventSelectors = [
          '.event-card',
          '.event-item', 
          '.event-listing',
          '.event',
          '[class*="event"]',
          '.listing',
          '.card',
          'article',
          '.post',
          '.entry'
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

        // If no specific event containers found, look for content patterns
        if (eventItems.length === 0) {
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
            
            // Extract title
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

            // Extract date
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

            // YBG Festival location is always Yerba Buena Gardens
            const location = {
              address: 'Yerba Buena Gardens, San Francisco, CA'
            };

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
                  descriptionText = desc.substring(0, 500);
                  break;
                }
              }
            }

            // Extract registration URL
            const linkEl = $event.find('a').first();
            let registrationUrl = this.eventsUrl;
            if (linkEl.length > 0) {
              const href = linkEl.attr('href');
              if (href) {
                registrationUrl = href.startsWith('http') ? href : `https://ybgfestival.org${href}`;
              }
            }

            // Extract image
            const imageEl = $event.find('img').first();
            let imageUrl = null;
            if (imageEl.length > 0) {
              const src = imageEl.attr('src');
              if (src) {
                imageUrl = src.startsWith('http') ? src : `https://ybgfestival.org${src}`;
              }
            }

            const ageRange = this.extractAge(descriptionText + ' ' + title);
            const cost = 0; // YBG Festival events are free

            if (this.isValidFamilyEvent(title, descriptionText, ageRange)) {
              const event = this.createEvent({
                title,
                date,
                location,
                ageRange,
                cost,
                registrationUrl,
                description: descriptionText,
                imageUrl
              });

              events.push(event);
              this.logger.debug(`Scraped HTML event: ${title} on ${date.toDateString()}`);
            }
          } catch (error) {
            this.logger.warn(`Error parsing HTML event ${index}:`, error.message);
          }
        });
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
    
    // YBG Festival has specific family-friendly series
    const ybgFamilyKeywords = [
      "children's garden", 'kids', 'family', 'children', 'toddler', 'youth',
      'halloween hoopla', 'interactive', 'half-hour shows', 'kids under 10',
      'family-friendly', 'all ages'
    ];

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

    // Include YBG Festival specific family events
    const hasYBGFamilyKeyword = ybgFamilyKeywords.some(keyword => text.includes(keyword));
    if (hasYBGFamilyKeyword) return true;

    // Include events with family keywords
    const hasFamilyKeyword = familyKeywords.some(keyword => text.includes(keyword));
    if (hasFamilyKeyword) return true;

    // Include events with appropriate age ranges (Apollo: 4, Athena: 2)
    const hasAppropriateAge = ageRange.min <= 4 && ageRange.max >= 2;
    if (hasAppropriateAge) return true;

    // YBG Festival events are free and often family-friendly
    if (text.includes('free') && !text.includes('alcohol') && !text.includes('bar')) {
      return true;
    }

    // Exclude clearly adult-oriented events
    const suspiciousKeywords = ['cocktail', 'wine', 'beer', 'alcohol', 'nightlife', 'dating'];
    const hasSuspicious = suspiciousKeywords.some(keyword => text.includes(keyword));
    
    return !hasSuspicious;
  }

  // Override parseDate to handle YBG Festival specific date formats
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Clean up the date string
      let cleanDateString = dateString.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim();
      
      // Handle ISO date strings from JSON-LD
      if (cleanDateString.includes('T') && cleanDateString.includes('-')) {
        const date = new Date(cleanDateString);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Handle YBG Festival specific patterns like "Sat, Aug 23, 2:00pm – 3:30pm"
      // First extract just the date part before time
      const dateTimeMatch = cleanDateString.match(/^([^,]+,\s*[^,]+,\s*\d+)/);
      if (dateTimeMatch) {
        cleanDateString = dateTimeMatch[1];
      } else {
        // Try to extract date part before time indicators
        const beforeTimeMatch = cleanDateString.match(/^(.+?)(?:\s+\d{1,2}:\d{2}|,\s*\d{1,2}:\d{2})/);
        if (beforeTimeMatch) {
          cleanDateString = beforeTimeMatch[1];
        }
      }
      
      // Handle YBG Festival specific date patterns
      const patterns = [
        // "Sat, Aug 23" -> add current year
        /^[a-z]{3},?\s+[a-z]{3}\s+\d{1,2}$/i,
        // "Aug 23" -> add current year
        /^[a-z]{3}\s+\d{1,2}$/i,
        // "November 1" -> add current year
        /^[a-z]{3,9}\s+\d{1,2}$/i,
        // "11/1" -> add current year
        /^\d{1,2}\/\d{1,2}$/,
        // "11-1" -> add current year
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

module.exports = YBGFestivalScraper;