/**
 * LLM Content Extractor - GPT-4o-mini Event Extraction
 * 
 * Extracts structured event data from raw HTML/text using LLM.
 * Provides confidence scores for extraction quality.
 */

const axios = require('axios');

class LLMExtractor {
  constructor(logger, config = {}) {
    this.logger = logger;
    // Support both OPENAI_API_KEY and OPEN_AI_API_KEY naming conventions
    this.apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    
    this.config = {
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.1,
      ...config
    };
  }

  /**
   * Extract event information from content
   * @param {Object} source - Source data with URL and content
   * @returns {Promise<Array>} Array of extracted events (may contain 0, 1, or multiple events)
   */
  async extract(source) {
    if (!this.apiKey) {
      console.log('   ❌ [LLM] Missing OPENAI_API_KEY');
      this.logger.warn('LLM Extractor: Missing OPENAI_API_KEY');
      return [];
    }

    try {
      // Clean and truncate content
      let cleanContent = this.cleanContent(source.htmlContent || source.snippet || '');
      
      if (cleanContent.length < 50) {
        console.log(`   ⚠️  [LLM] Content too short after cleaning: ${cleanContent.length} chars`);
        return [];
      }
      
      // Truncate to avoid OpenAI timeouts on very large pages
      const maxContentLength = this.config.maxContentLength || 15000;
      const wasTruncated = cleanContent.length > maxContentLength;
      if (wasTruncated) {
        cleanContent = cleanContent.substring(0, maxContentLength);
      }
      
      console.log(`   📝 [LLM] Cleaned content: ${cleanContent.length} chars${wasTruncated ? ' (truncated)' : ''}, sending to GPT...`);

      const prompt = this.buildExtractionPrompt(cleanContent, source);
      const response = await this.callOpenAI(prompt);
      
      if (!response) {
        console.log('   ❌ [LLM] No response from OpenAI');
        return [];
      }
      
      console.log(`   📄 [LLM] Got response: ${response.substring(0, 100)}...`);

      const extracted = this.parseResponse(response, source);
      return extracted;
    } catch (error) {
      console.log(`   ❌ [LLM] Extraction error: ${error.message}`);
      this.logger.error('LLM extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Extract multiple events from a newsletter
   * @param {Object} newsletter - Newsletter source data
   * @returns {Promise<Array>} Array of extracted events
   */
  async extractFromNewsletter(newsletter) {
    if (!this.apiKey) {
      this.logger.warn('LLM Extractor: Missing OPENAI_API_KEY');
      return [];
    }

    try {
      const cleanContent = this.cleanContent(newsletter.htmlContent || '');
      
      if (cleanContent.length < 100) {
        return [];
      }

      const prompt = this.buildNewsletterPrompt(cleanContent, newsletter);
      const response = await this.callOpenAI(prompt);
      
      if (!response) {
        return [];
      }

      return this.parseNewsletterResponse(response, newsletter);
    } catch (error) {
      this.logger.error('Newsletter extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Build extraction prompt for events (handles single or multiple)
   */
  buildExtractionPrompt(content, source) {
    return `Extract kid-friendly event information from this webpage content.

RULES:
- If this page has NO events, return: {"isEvent": false}
- If this page has ONE event, return a single JSON object
- If this page has MULTIPLE events (like an event calendar or roundup), return a JSON ARRAY of events

WEBPAGE URL: ${source.url || source.sourceUrl || 'Unknown'}
CONTENT:
${content}

For each event, use this structure:
{
  "isEvent": true,
  "title": "Event title",
  "description": "Brief description (max 200 chars)",
  "date": "YYYY-MM-DD or null",
  "startTime": "HH:MM (24hr) or null",
  "endTime": "HH:MM (24hr) or null",
  "venueName": "Venue name or null",
  "address": "Full address or null",
  "city": "City name",
  "costAdult": number or null,
  "costChild": number or null,
  "isFree": true/false,
  "ageMin": number or null,
  "ageMax": number or null,
  "eventUrl": "Direct URL to this specific event or null",
  "registrationUrl": "URL or null",
  "confidence": 0.0-1.0
}

Be conservative with confidence - only use 0.8+ if data is clearly stated.
Return ONLY valid JSON, no explanation.`;
  }

  /**
   * Build extraction prompt for newsletter with multiple events
   */
  buildNewsletterPrompt(content, newsletter) {
    return `Extract ALL kid-friendly events mentioned in this newsletter.
For each event, extract as much information as possible.

NEWSLETTER FROM: ${newsletter.from}
SUBJECT: ${newsletter.subject}
CONTENT:
${content.substring(0, 6000)}

Return a JSON array of events. Each event should have:
{
  "title": "Event title",
  "description": "Brief description",
  "date": "YYYY-MM-DD or null",
  "startTime": "HH:MM or null",
  "venueName": "Venue or null",
  "address": "Address or null",
  "city": "City (default: San Francisco)",
  "isFree": true/false,
  "costAdult": number or null,
  "eventUrl": "URL to event page or null",
  "confidence": 0.0-1.0
}

Return ONLY valid JSON array, no explanation.
If no events found, return empty array: []`;
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    try {
      const response = await axios.post(this.baseUrl, {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an event data extraction assistant. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.config.timeout || 60000  // 60 second timeout for large pages
      });

      return response.data.choices[0]?.message?.content;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('   ⏳ [LLM] Rate limited, waiting 5s...');
        this.logger.warn('OpenAI rate limited, waiting...');
        await this.sleep(5000);
        // Retry once after rate limit
        return this.callOpenAI(prompt);
      }
      if (error.response?.status) {
        console.log(`   ❌ [LLM] OpenAI API error: HTTP ${error.response.status}`);
        if (error.response.data?.error?.message) {
          console.log(`   ❌ [LLM] Message: ${error.response.data.error.message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   ⏱️  [LLM] OpenAI request timeout (${this.config.timeout || 60000}ms)`);
      }
      throw error;
    }
  }

  /**
   * Parse LLM response into structured events
   * Handles both single event objects and arrays of events
   * @returns {Array} Array of extracted events
   */
  parseResponse(response, source) {
    try {
      // Clean up response (remove markdown code blocks if present)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      const data = JSON.parse(cleaned);
      
      // Handle array of events (e.g., event roundup articles)
      if (Array.isArray(data)) {
        const events = data.filter(item => item.isEvent !== false);
        if (events.length === 0) {
          console.log('   ℹ️  [LLM] Array response but no valid events');
          return [];
        }
        console.log(`   📋 [LLM] Found ${events.length} events in array response`);
        return events.map(event => this.formatEvent(event, source));
      }
      
      // Handle single event object
      if (!data.isEvent || data.isEvent === false) {
        console.log('   ℹ️  [LLM] Page is not an event (isEvent: false)');
        return [];
      }

      return [this.formatEvent(data, source)];
    } catch (error) {
      console.log(`   ❌ [LLM] JSON parse error: ${error.message}`);
      console.log(`   ❌ [LLM] Raw response: ${response.substring(0, 200)}...`);
      this.logger.warn('Failed to parse LLM response:', error.message);
      return [];
    }
  }
  
  /**
   * Format a single event object into the standard structure
   */
  formatEvent(data, source) {
    return {
      sourceType: source.sourceType || 'brave',
      sourceUrl: source.url || source.sourceUrl,
      
      title: data.title,
      description: data.description,
      eventDate: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      
      venueName: data.venueName,
      address: data.address,
      city: data.city || 'San Francisco',
      
      costAdult: data.costAdult,
      costChild: data.costChild,
      isFree: data.isFree || false,
      
      ageMin: data.ageMin,
      ageMax: data.ageMax,
      
      eventUrl: data.eventUrl || source.url || source.sourceUrl,
      registrationUrl: data.registrationUrl,
      
      extractionConfidence: data.confidence || 0.5,
      extractionModel: this.model,
      
      rawContent: source.snippet || source.htmlContent?.substring(0, 1000)
    };
  }

  /**
   * Parse newsletter response with multiple events
   */
  parseNewsletterResponse(response, newsletter) {
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }

      const events = JSON.parse(cleaned);
      
      if (!Array.isArray(events)) {
        return [];
      }

      return events.map(event => ({
        sourceType: 'newsletter',
        sourceUrl: newsletter.messageId,
        sourceId: newsletter.messageId,
        
        title: event.title,
        description: event.description,
        eventDate: event.date,
        startTime: event.startTime,
        
        venueName: event.venueName,
        address: event.address,
        city: event.city || 'San Francisco',
        
        isFree: event.isFree || false,
        costAdult: event.costAdult,
        
        eventUrl: event.eventUrl,
        
        extractionConfidence: event.confidence || 0.5,
        extractionModel: this.model,
        
        rawContent: `From: ${newsletter.from}, Subject: ${newsletter.subject}`
      }));
    } catch (error) {
      this.logger.warn('Failed to parse newsletter response:', error.message);
      return [];
    }
  }

  /**
   * Clean HTML content for processing
   */
  cleanContent(html) {
    if (!html) return '';
    
    return html
      // Remove script and style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // Clean whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LLMExtractor;
