/**
 * Brave Search Source - Web Search for Kid Events
 * 
 * Uses Brave Search API to find kid-friendly events.
 * Returns URLs to actual event pages (ground truth, not LLM-generated).
 * 
 * Free tier: 2,000 queries/month
 * Docs: https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
 */

const axios = require('axios');

class BraveSearchSource {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY;
    
    // Configuration with defaults
    this.config = {
      location: config.location || 'San Francisco',
      radiusMiles: config.radiusMiles || 25,
      daysAhead: config.daysAhead || 14,
      maxResults: config.maxResults || 20,
      ...config
    };
    
    this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
  }

  /**
   * Search for kid events using Brave Search API
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of raw search results with URLs
   */
  async search(options = {}) {
    const searchConfig = { ...this.config, ...options };
    
    console.log('🔍 [Brave] ========== BRAVE SEARCH STARTING ==========');
    console.log('🔍 [Brave] Config:', JSON.stringify(searchConfig, null, 2));
    console.log('🔍 [Brave] API Key present:', !!this.apiKey);
    console.log('🔍 [Brave] API Key (first 10 chars):', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'MISSING');
    
    if (!this.apiKey) {
      console.log('❌ [Brave] Missing API key - aborting search');
      this.logger.warn('Brave Search Source: Missing API key');
      return [];
    }

    const queries = this.buildSearchQueries(searchConfig);
    console.log('🔍 [Brave] Generated queries:', queries);
    
    const allResults = [];

    for (const query of queries) {
      try {
        console.log('🔍 [Brave] Executing query:', query);
        const results = await this.executeSearch(query, searchConfig.maxResults);
        console.log('🔍 [Brave] Query returned:', results.length, 'results');
        allResults.push(...results);
        
        // Rate limiting - Brave free tier is 1 query/second
        await this.sleep(1100);
      } catch (error) {
        console.log('❌ [Brave] Query failed:', query, '-', error.message);
        if (error.response) {
          console.log('❌ [Brave] Response status:', error.response.status);
          console.log('❌ [Brave] Response data:', JSON.stringify(error.response.data));
        }
        this.logger.error(`Brave search failed for query "${query}":`, error.message);
      }
    }

    // Deduplicate by URL
    const uniqueResults = this.deduplicateByUrl(allResults);
    
    console.log('🔍 [Brave] Total unique results:', uniqueResults.length);
    console.log('🔍 [Brave] ========== BRAVE SEARCH COMPLETE ==========');
    this.logger.info(`Brave Search Source: Found ${uniqueResults.length} unique results`);
    return uniqueResults;
  }

  /**
   * Build search queries based on configuration
   */
  buildSearchQueries(config) {
    const { location, ageMin, ageMax, startDate, endDate } = config;
    
    // Parse dates from config (they come as YYYY-MM-DD strings)
    const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
    const end = endDate ? new Date(endDate + 'T00:00:00') : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    
    // Generate multiple date query formats for better coverage
    const dateQueries = this.generateDateQueries(start, end);
    
    // Build age-appropriate queries
    const queries = [];
    
    // Use the primary date query format for main searches
    const primaryDateStr = dateQueries.primary;
    
    // Base query for kids events
    queries.push(`kids events ${location} ${primaryDateStr}`);
    queries.push(`family activities ${location} ${primaryDateStr}`);
    
    // Age-specific queries
    if (ageMin !== undefined && ageMax !== undefined) {
      if (ageMin <= 3) {
        queries.push(`toddler events ${location} ${primaryDateStr}`);
      }
      if (ageMin <= 5 && ageMax >= 3) {
        queries.push(`preschool activities ${location} ${primaryDateStr}`);
      }
      if (ageMax >= 5 && ageMax <= 12) {
        queries.push(`kids activities ${location} ${primaryDateStr}`);
      }
    }
    
    // Free events query
    queries.push(`free kids events ${location} ${primaryDateStr}`);
    
    // Add alternative date format queries for better coverage
    if (dateQueries.weekend) {
      queries.push(`kids events ${location} ${dateQueries.weekend}`);
    }
    if (dateQueries.alternative) {
      queries.push(`family events ${location} ${dateQueries.alternative}`);
    }
    
    return queries;
  }
  
  /**
   * Generate multiple date query formats for better search coverage
   */
  generateDateQueries(startDate, endDate) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    const startMonth = months[startDate.getMonth()];
    const endMonth = months[endDate.getMonth()];
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    const result = {
      primary: null,
      alternative: null,
      weekend: null
    };
    
    // Primary: specific date range (e.g., "January 26 - February 9 2026")
    if (startMonth === endMonth) {
      result.primary = `${startMonth} ${startDay}-${endDay} ${year}`;
    } else {
      result.primary = `${startMonth} ${startDay} - ${endMonth} ${endDay} ${year}`;
    }
    
    // Alternative: month-based for broader results
    if (startMonth === endMonth) {
      result.alternative = `${startMonth} ${year}`;
    } else {
      result.alternative = `${startMonth} ${endMonth} ${year}`;
    }
    
    // Weekend query if range is short (7 days or less)
    if (daysDiff <= 7) {
      result.weekend = 'this weekend';
    } else if (daysDiff <= 14) {
      result.weekend = 'upcoming weekend';
    }
    
    return result;
  }

  /**
   * Execute a single search query using Brave Search API
   */
  async executeSearch(query, maxResults = 10) {
    const params = {
      q: query,
      count: Math.min(maxResults, 20), // Brave max is 20 per request
      safesearch: 'moderate',
      freshness: 'pm', // Past month - good for finding upcoming events
    };

    try {
      const response = await axios.get(this.baseUrl, {
        params,
        headers: {
          'X-Subscription-Token': this.apiKey,
          'Accept': 'application/json'
        }
      });
      
      // Brave response structure: { web: { results: [...] } }
      if (!response.data?.web?.results) {
        console.log('🔍 [Brave] No results in response');
        return [];
      }

      return response.data.web.results.map(item => ({
        sourceType: 'brave',
        title: item.title,
        url: item.url,
        snippet: item.description,
        displayLink: new URL(item.url).hostname,
        searchQuery: query,
        rawData: item
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.warn('Brave Search Source: Rate limited, waiting...');
        await this.sleep(5000);
      }
      throw error;
    }
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

module.exports = BraveSearchSource;
