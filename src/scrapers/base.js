const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('crypto').randomUUID || (() => uuidv4());

class BaseScraper {
  constructor(name, url, logger) {
    this.name = name;
    this.url = url;
    this.logger = logger;
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async fetchHTML(url) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching ${url}:`, error.message);
      throw error;
    }
  }

  async fetchWithPuppeteer(url, waitFor = null) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 10000 });
      }
      
      const html = await page.content();
      return html;
    } finally {
      await page.close();
    }
  }

  generateEventId(title, date, location) {
    const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    const cleanLocation = location ? location.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'unknown';
    return `${this.name.toLowerCase().replace(/\s+/g, '')}-${cleanTitle}-${dateStr}-${cleanLocation}`;
  }

  parseDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid date string: ${dateString}`);
        return null;
      }
      return date;
    } catch (error) {
      this.logger.error(`Error parsing date ${dateString}:`, error.message);
      return null;
    }
  }

  extractAge(text) {
    const ageMatch = text.match(/(\d+)[\s-]*(?:to|through|\-|–)[\s-]*(\d+)[\s-]*(?:years?|yrs?)?/i);
    if (ageMatch) {
      return { min: parseInt(ageMatch[1]), max: parseInt(ageMatch[2]) };
    }
    
    const singleAgeMatch = text.match(/(?:ages?|for)[\s]*(\d+)[\s]*(?:years?|yrs?|\+)?/i);
    if (singleAgeMatch) {
      const age = parseInt(singleAgeMatch[1]);
      return { min: age, max: age + 2 };
    }
    
    return { min: 0, max: 18 };
  }

  extractCost(text) {
    if (!text) return 0;
    
    if (text.toLowerCase().includes('free') || text.toLowerCase().includes('no cost')) {
      return 0;
    }
    
    const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (costMatch) {
      return parseFloat(costMatch[1]);
    }
    
    return 0;
  }

  createEvent(data) {
    const event = {
      id: this.generateEventId(data.title, data.date, data.location?.address),
      source: this.name,
      title: data.title,
      date: data.date,
      location: data.location || {},
      ageRange: data.ageRange || { min: 0, max: 18 },
      cost: data.cost || 0,
      registrationUrl: data.registrationUrl,
      registrationOpens: data.registrationOpens,
      currentCapacity: data.currentCapacity || {},
      description: data.description || '',
      imageUrl: data.imageUrl,
      status: 'discovered',
      isRecurring: data.isRecurring || false,
      previouslyAttended: false
    };

    return event;
  }

  async scrape() {
    throw new Error('scrape() method must be implemented by subclasses');
  }
}

module.exports = BaseScraper;