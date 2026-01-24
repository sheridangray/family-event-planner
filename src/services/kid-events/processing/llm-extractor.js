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
   * @returns {Promise<Object>} Extracted event data with confidence
   */
  async extract(source) {
    if (!this.apiKey) {
      this.logger.warn('LLM Extractor: Missing OPENAI_API_KEY');
      return null;
    }

    try {
      // Clean and truncate content
      const cleanContent = this.cleanContent(source.htmlContent || source.snippet || '');
      
      if (cleanContent.length < 50) {
        return null;
      }

      const prompt = this.buildExtractionPrompt(cleanContent, source);
      const response = await this.callOpenAI(prompt);
      
      if (!response) {
        return null;
      }

      const extracted = this.parseResponse(response, source);
      return extracted;
    } catch (error) {
      this.logger.error('LLM extraction failed:', error.message);
      return null;
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
   * Build extraction prompt for single event
   */
  buildExtractionPrompt(content, source) {
    return `Extract kid-friendly event information from this webpage content.
If this is NOT an event page, return {"isEvent": false}.

WEBPAGE URL: ${source.url || source.sourceUrl || 'Unknown'}
CONTENT:
${content.substring(0, 4000)}

Return a JSON object with EXACTLY these fields:
{
  "isEvent": true/false,
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
        }
      });

      return response.data.choices[0]?.message?.content;
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.warn('OpenAI rate limited, waiting...');
        await this.sleep(5000);
      }
      throw error;
    }
  }

  /**
   * Parse LLM response into structured event
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

      const data = JSON.parse(cleaned);
      
      if (!data.isEvent || data.isEvent === false) {
        return null;
      }

      return {
        sourceType: source.sourceType || 'serp',
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
        
        eventUrl: source.url || source.sourceUrl,
        registrationUrl: data.registrationUrl,
        
        extractionConfidence: data.confidence || 0.5,
        extractionModel: this.model,
        
        rawContent: source.snippet || source.htmlContent?.substring(0, 1000)
      };
    } catch (error) {
      this.logger.warn('Failed to parse LLM response:', error.message);
      return null;
    }
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
