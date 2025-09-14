const BaseScraper = require('./base');
const cheerio = require('cheerio');

class ExploratoriumScraper extends BaseScraper {
  constructor(logger) {
    super('exploratorium', 'https://www.exploratorium.edu/', logger);
    this.eventUrls = [
      'https://www.exploratorium.edu/events',
      'https://www.exploratorium.edu/programs',
      'https://www.exploratorium.edu/calendar',
      'https://www.exploratorium.edu/visit/calendar',
      'https://www.exploratorium.edu/learn/programs'
    ];
  }

  async scrape() {
    try {
      this.logger.info(`Scraping ${this.name}...`);
      const events = [];

      // Try each potential events URL
      for (const url of this.eventUrls) {
        try {
          this.logger.debug(`Trying URL: ${url}`);
          const urlEvents = await this.scrapeUrl(url);
          events.push(...urlEvents);
          
          if (urlEvents.length > 0) {
            this.logger.debug(`Found ${urlEvents.length} events from ${url}`);
            break; // Use the first successful URL
          }
        } catch (error) {
          this.logger.debug(`URL ${url} failed: ${error.message}`);
          continue;
        }
      }

      this.logger.info(`Found ${events.length} family events from ${this.name}`);
      return events;

    } catch (error) {
      this.logger.error(`Error scraping ${this.name}:`, error.message);
      this.logger.error('Full error stack:', error.stack);
      return [];
    }
  }

  async scrapeUrl(url) {
    let html;
    try {
      html = await this.fetchWithPuppeteer(url);
    } catch (error) {
      this.logger.warn(`Puppeteer failed for ${url}, falling back to HTTP request:`, error.message);
      html = await this.fetchHTML(url);
    }
    
    this.logger.debug(`Fetched HTML length from ${url}: ${html.length} characters`);
    const $ = cheerio.load(html);
    const events = [];

    // Check for JSON-LD structured data first
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

        // Exploratorium is located at Pier 15
        let locationAddress = 'Pier 15, The Embarcadero, San Francisco, CA';
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
        
        // Extract cost from offers or default to typical Exploratorium pricing
        let cost = 0;
        if (eventData.offers) {
          const offer = Array.isArray(eventData.offers) ? eventData.offers[0] : eventData.offers;
          if (offer.price) {
            cost = parseFloat(offer.price) || 0;
          }
        }
        
        const ageRange = this.extractAge(description + ' ' + title);
        
        if (this.isValidFamilyEvent(title, description, ageRange)) {
          const event = this.createEvent({
            title,
            date: startDate,
            location,
            ageRange,
            cost,
            registrationUrl: eventData.url || url,
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
      
      // Look for event listings using common selectors, excluding navigation and form elements
      const eventSelectors = [
        '.view-content .views-row',
        '.event-card',
        '.event-item:not(.menu-item)', 
        '.event-listing',
        '.program-card',
        '.program-item',
        '.listing:not(.menu-item)',
        '.card:not(.menu-item)',
        'article',
        '.post',
        '.entry',
        '.activity:not(.menu-item)',
        '.views-field'
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
          
          // Debug: log the first few events' HTML structure
          if (index < 3) {
            this.logger.debug(`Event ${index} HTML structure:`, $event.html().substring(0, 500));
            this.logger.debug(`Event ${index} text content:`, $event.text().substring(0, 200));
            this.logger.debug(`Event ${index} class names:`, $event.attr('class'));
          }
          
          // Extract title
          const titleSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.title', '.event-title', '.program-title', '.name', '.heading',
            '[class*="title"]', '[class*="name"]', '[class*="heading"]',
            'a[href*="/event"]', 'a[href*="/events"]', 'a[href*="/program"]',
            'a', 'label', '.field-content'
          ];
          
          let title = '';
          for (const selector of titleSelectors) {
            const titleEl = $event.find(selector).first();
            if (titleEl.length > 0) {
              title = titleEl.text().trim();
              if (title.length > 0) break;
            }
          }
          
          // If no title found in child elements, try the element's own text
          if (!title) {
            title = $event.text().trim();
            // Clean up the title if it's too long (likely contains description)
            if (title.length > 100) {
              const firstLine = title.split('\n')[0].trim();
              title = firstLine.length > 0 && firstLine.length < 100 ? firstLine : title.substring(0, 100);
            }
          }
          
          if (!title || title.length < 3) {
            this.logger.debug(`Skipping event with invalid title: "${title}"`);
            return;
          }
          this.logger.debug(`Found title: ${title}`);

          // Extract date
          const dateSelectors = [
            '.date', '.event-date', '.program-date', '.when', '.time',
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
          
          this.logger.debug(`Found date text: "${dateText}"`);
          const date = this.parseDate(dateText);
          if (!date) {
            this.logger.debug(`Skipping event with invalid date: "${dateText}"`);
            return;
          }
          this.logger.debug(`Parsed date: ${date}`);

          // Exploratorium location
          const location = {
            address: 'Pier 15, The Embarcadero, San Francisco, CA'
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

          // Extract registration URL
          const linkEl = $event.find('a').first();
          let registrationUrl = url;
          if (linkEl.length > 0) {
            const href = linkEl.attr('href');
            if (href) {
              registrationUrl = href.startsWith('http') ? href : `https://www.exploratorium.edu${href}`;
            }
          }

          // Extract image
          const imageEl = $event.find('img').first();
          let imageUrl = null;
          if (imageEl.length > 0) {
            const src = imageEl.attr('src');
            if (src) {
              imageUrl = src.startsWith('http') ? src : `https://www.exploratorium.edu${src}`;
            }
          }

          const ageRange = this.extractAge(descriptionText + ' ' + title);
          const cost = this.extractCost(costText + ' ' + descriptionText);

          const isValidFamily = this.isValidFamilyEvent(title, descriptionText, ageRange);
          this.logger.debug(`Event "${title}" family validation: ${isValidFamily}`);
          if (isValidFamily) {
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

    return events;
  }

  isValidFamilyEvent(title, description, ageRange) {
    const text = (title + ' ' + description).toLowerCase();
    
    // Exploratorium specific family-friendly keywords
    const exploratoriumFamilyKeywords = [
      'family', 'kids', 'children', 'toddler', 'youth', 'teens',
      'hands-on', 'interactive', 'explore', 'discovery', 'experiment',
      'science', 'tinkering', 'maker', 'workshop', 'lab',
      'after dark', 'evening for adults', 'school group'
    ];

    const familyKeywords = [
      'family', 'kids', 'children', 'toddler', 'preschool', 'youth',
      'playground', 'story', 'craft', 'art', 'music', 'dance',
      'nature', 'outdoor', 'park', 'garden', 'festival', 'fair',
      'puppet', 'magic', 'circus', 'zoo', 'aquarium', 'museum',
      'storytime', 'crafts', 'workshop', 'educational', 'hands-on',
      'interactive', 'baby', 'infant', 'tot', 'little ones',
      'science', 'experiment', 'discovery', 'explore'
    ];

    const adultOnlyKeywords = [
      'adults only', 'adult only', '21+', '18+', 'seniors only', 'retirement',
      'business', 'networking', 'conference', 'meeting', 'corporate',
      'wine tasting', 'happy hour', 'nightclub', 'bar crawl', 'pub',
      'mature audiences', 'explicit', 'nsfw', 'after dark'
    ];

    // Exclude adult-only events (but allow "After Dark" if it mentions families)
    const hasAdultOnly = adultOnlyKeywords.some(keyword => text.includes(keyword));
    if (hasAdultOnly && !text.includes('family') && !text.includes('kids')) return false;

    // Include Exploratorium specific family events
    const hasExploratoriumFamilyKeyword = exploratoriumFamilyKeywords.some(keyword => text.includes(keyword));
    if (hasExploratoriumFamilyKeyword && !text.includes('adults only')) return true;

    // Include events with family keywords
    const hasFamilyKeyword = familyKeywords.some(keyword => text.includes(keyword));
    if (hasFamilyKeyword) return true;

    // Include events with appropriate age ranges (Apollo: 4, Athena: 2)
    const hasAppropriateAge = ageRange.min <= 4 && ageRange.max >= 2;
    if (hasAppropriateAge) return true;

    // Include general science/educational events that aren't explicitly adult-only
    if ((text.includes('science') || text.includes('educational') || text.includes('workshop')) 
        && !text.includes('alcohol') && !text.includes('bar')) {
      return true;
    }

    // Exclude clearly adult-oriented events
    const suspiciousKeywords = ['cocktail', 'wine', 'beer', 'alcohol', 'nightlife', 'dating'];
    const hasSuspicious = suspiciousKeywords.some(keyword => text.includes(keyword));
    
    return !hasSuspicious;
  }

  // Override parseDate to handle Exploratorium specific date formats
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
      
      // Handle Exploratorium specific patterns
      
      // Remove "Next:" prefix if present
      cleanDateString = cleanDateString.replace(/^Next:\s*/i, '');
      
      // Handle patterns like "Thu, Aug 21 2025 • 6 - 10pm" - extract just the date part
      const exploratoriumDateMatch = cleanDateString.match(/^([A-Z][a-z]{2},?\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4})/i);
      if (exploratoriumDateMatch) {
        cleanDateString = exploratoriumDateMatch[1];
      } else {
        // Handle patterns like "Sun, Oct 5 2025 • 12:30 - 5pm" - extract just the date part
        const altMatch = cleanDateString.match(/^([A-Z][a-z]{2},?\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4})/i);
        if (altMatch) {
          cleanDateString = altMatch[1];
        } else {
          // Handle duplicate date patterns like "Sat, Aug 16 2025 • 12 - 1pmSat, Aug 16 2025 • 2 - 3pm"
          const duplicateMatch = cleanDateString.match(/^([A-Z][a-z]{2},?\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4})/i);
          if (duplicateMatch) {
            cleanDateString = duplicateMatch[1];
          } else {
            // Try to extract basic date patterns before time or bullet
            const beforeTimeMatch = cleanDateString.match(/^(.+?)(?:\s*•|\s+\d{1,2}:\d{2}|,\s*\d{1,2}:\d{2})/);
            if (beforeTimeMatch) {
              cleanDateString = beforeTimeMatch[1];
            }
          }
        }
      }
      
      // Clean up any remaining special characters
      cleanDateString = cleanDateString.replace(/[•]/g, '').trim();
      
      // Handle date ranges - take the first date
      if (cleanDateString.includes(' - ')) {
        const rangeParts = cleanDateString.split(' - ');
        if (rangeParts.length > 0) {
          cleanDateString = rangeParts[0].trim();
        }
      }
      
      // Handle common date patterns that need year added
      const patterns = [
        // "Sat, Aug 23" -> add current year  
        /^[a-z]{3},?\s+[a-z]{3}\s+\d{1,2}$/i,
        // "August 23" -> add current year
        /^[a-z]{3,9}\s+\d{1,2}$/i,
        // "Aug 23" -> add current year
        /^[a-z]{3}\s+\d{1,2}$/i,
        // "8/23" -> add current year
        /^\d{1,2}\/\d{1,2}$/,
        // "8-23" -> add current year
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
      
      this.logger.warn(`Could not parse date: ${dateString} -> cleaned: ${cleanDateString}`);
      return null;
      
    } catch (error) {
      this.logger.error(`Error parsing date ${dateString}:`, error.message);
      return null;
    }
  }
}

module.exports = ExploratoriumScraper;