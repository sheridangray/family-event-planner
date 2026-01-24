/**
 * SERP Source - Google Custom Search for Kid Events
 * 
 * Uses Google Custom Search API to find kid-friendly events.
 * Returns URLs to actual event pages (ground truth, not LLM-generated).
 */

const axios = require('axios');

class SerpSource {
  constructor(logger, config = {}) {
    this.logger = logger;
    // Google API key - can use YOUTUBE_API_KEY since it's a standard Google API key
    this.apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.YOUTUBE_API_KEY;
    this.searchEngineId = process.env.GOOGLE_CSE_ID;
    
    // Configuration with defaults
    this.config = {
      location: config.location || 'San Francisco',
      radiusMiles: config.radiusMiles || 25,
      daysAhead: config.daysAhead || 14,
      maxResults: config.maxResults || 20,
      ...config
    };
    
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  /**
   * Search for kid events using Google Custom Search
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of raw search results with URLs
   */
  async search(options = {}) {
    const searchConfig = { ...this.config, ...options };
    
    if (!this.apiKey || !this.searchEngineId) {
      this.logger.warn('SERP Source: Missing API key or CSE ID');
      return [];
    }

    const queries = this.buildSearchQueries(searchConfig);
    const allResults = [];

    for (const query of queries) {
      try {
        const results = await this.executeSearch(query, searchConfig.maxResults);
        allResults.push(...results);
      } catch (error) {
        this.logger.error(`SERP search failed for query "${query}":`, error.message);
      }
    }

    // Deduplicate by URL
    const uniqueResults = this.deduplicateByUrl(allResults);
    
    this.logger.info(`SERP Source: Found ${uniqueResults.length} unique results`);
    return uniqueResults;
  }

  /**
   * Build search queries based on configuration
   */
  buildSearchQueries(config) {
    const { location, ageMin, ageMax, daysAhead } = config;
    
    // Calculate date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    const dateStr = this.formatDateRange(startDate, endDate);
    
    // Build age-appropriate queries
    const queries = [];
    
    // Base query for kids events
    queries.push(`kids events ${location} ${dateStr}`);
    queries.push(`family activities ${location} ${dateStr}`);
    
    // Age-specific queries
    if (ageMin !== undefined && ageMax !== undefined) {
      if (ageMin <= 3) {
        queries.push(`toddler events ${location} ${dateStr}`);
      }
      if (ageMin <= 5 && ageMax >= 3) {
        queries.push(`preschool activities ${location} ${dateStr}`);
      }
      if (ageMax >= 5 && ageMax <= 12) {
        queries.push(`kids activities ${location} ${dateStr}`);
      }
    }
    
    // Free events query
    queries.push(`free kids events ${location} ${dateStr}`);
    
    return queries;
  }

  /**
   * Execute a single search query
   */
  async executeSearch(query, maxResults = 10) {
    const params = {
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: Math.min(maxResults, 10), // Google CSE max is 10 per request
    };

    try {
      const response = await axios.get(this.baseUrl, { params });
      
      if (!response.data.items) {
        return [];
      }

      return response.data.items.map(item => ({
        sourceType: 'serp',
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
        searchQuery: query,
        rawData: item
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.warn('SERP Source: Rate limited, waiting...');
        await this.sleep(5000);
      }
      throw error;
    }
  }

  /**
   * Verify that a URL is accessible
   */
  async verifyUrl(url) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FamilyEventBot/1.0)'
        }
      });
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format date range for search query
   */
  formatDateRange(start, end) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[start.getMonth()]} ${start.getFullYear()}`;
  }

  /**
   * Remove duplicate results by URL
   */
  deduplicateByUrl(results) {
    const seen = new Set();
    return results.filter(result => {
      const normalized = result.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  /**
   * Filter out non-event URLs (homepage, about pages, etc.)
   */
  filterEventUrls(results) {
    const excludePatterns = [
      /\/(about|contact|faq|privacy|terms|login|signup)/i,
      /\/category\//i,
      /\/tag\//i,
      /\?page=/i
    ];

    return results.filter(result => {
      return !excludePatterns.some(pattern => pattern.test(result.url));
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SerpSource;
