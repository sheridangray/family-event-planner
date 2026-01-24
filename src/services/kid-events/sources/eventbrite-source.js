/**
 * Eventbrite Source - Eventbrite API for Kid Events
 * 
 * Uses Eventbrite API v3 to fetch structured event data.
 * Returns fully structured event data (no LLM extraction needed).
 */

const axios = require('axios');

class EventbriteSource {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.apiKey = process.env.EVENTBRITE_API_KEY;
    
    // Configuration with defaults
    this.config = {
      location: config.location || 'San Francisco, CA',
      radiusMiles: config.radiusMiles || 25,
      daysAhead: config.daysAhead || 14,
      ...config
    };
    
    this.baseUrl = 'https://www.eventbriteapi.com/v3';
  }

  /**
   * Search for kid events on Eventbrite
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of structured event data
   */
  async search(options = {}) {
    const searchConfig = { ...this.config, ...options };
    
    if (!this.apiKey) {
      this.logger.warn('Eventbrite Source: Missing API key (EVENTBRITE_API_KEY)');
      return [];
    }

    try {
      const events = await this.searchEvents(searchConfig);
      
      this.logger.info(`Eventbrite Source: Found ${events.length} events`);
      return events.map(event => this.transformEvent(event));
    } catch (error) {
      this.logger.error('Eventbrite search failed:', error.message);
      return [];
    }
  }

  /**
   * Execute Eventbrite API search
   */
  async searchEvents(config) {
    const { location, radiusMiles, daysAhead } = config;
    
    // Calculate date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const params = {
      'location.address': location,
      'location.within': `${radiusMiles}mi`,
      'start_date.range_start': startDate.toISOString().replace('Z', ''),
      'start_date.range_end': endDate.toISOString().replace('Z', ''),
      'categories': '115', // Family & Education category ID
      'expand': 'venue,ticket_availability',
    };

    const allEvents = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 3) { // Limit to 3 pages
      try {
        const response = await axios.get(`${this.baseUrl}/events/search/`, {
          params: { ...params, page },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        if (response.data.events) {
          allEvents.push(...response.data.events);
        }

        hasMore = response.data.pagination?.has_more_items || false;
        page++;
      } catch (error) {
        if (error.response?.status === 401) {
          this.logger.error('Eventbrite: Invalid API key');
        } else if (error.response?.status === 429) {
          this.logger.warn('Eventbrite: Rate limited');
        }
        hasMore = false;
      }
    }

    return allEvents;
  }

  /**
   * Transform Eventbrite event to our standard format
   */
  transformEvent(event) {
    const venue = event.venue || {};
    
    // Parse date/time
    const startDate = new Date(event.start?.utc || event.start?.local);
    const endDate = event.end ? new Date(event.end?.utc || event.end?.local) : null;
    
    // Determine cost
    let costAdult = null;
    let costChild = null;
    let isFree = event.is_free || false;
    
    if (!isFree && event.ticket_availability) {
      const minPrice = event.ticket_availability.minimum_ticket_price;
      if (minPrice) {
        costAdult = parseFloat(minPrice.major_value) || 0;
      }
    }

    return {
      sourceType: 'eventbrite',
      sourceId: event.id,
      sourceUrl: event.url,
      
      title: event.name?.text || event.name,
      description: event.description?.text || event.summary,
      
      eventDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().substring(0, 5),
      endTime: endDate ? endDate.toTimeString().substring(0, 5) : null,
      
      venueName: venue.name,
      address: venue.address?.localized_address_display,
      city: venue.address?.city || 'San Francisco',
      latitude: venue.latitude ? parseFloat(venue.latitude) : null,
      longitude: venue.longitude ? parseFloat(venue.longitude) : null,
      
      costAdult,
      costChild,
      isFree,
      
      eventUrl: event.url,
      registrationUrl: event.url,
      
      // High confidence since this is structured API data
      extractionConfidence: 0.95,
      extractionModel: 'eventbrite-api',
      
      rawData: event
    };
  }

  /**
   * Get detailed event information
   */
  async getEventDetails(eventId) {
    try {
      const response = await axios.get(`${this.baseUrl}/events/${eventId}/`, {
        params: { expand: 'venue,ticket_classes,category' },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return this.transformEvent(response.data);
    } catch (error) {
      this.logger.error(`Failed to get Eventbrite event ${eventId}:`, error.message);
      return null;
    }
  }
}

module.exports = EventbriteSource;
