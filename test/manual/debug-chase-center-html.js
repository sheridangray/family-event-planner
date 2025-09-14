/**
 * Debug Chase Center HTML Structure
 * 
 * Examines the actual HTML structure to understand the events page layout.
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const BaseScraper = require('../src/scrapers/base');
const cheerio = require('cheerio');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function debugChaseCenterHTML() {
  console.log('🏀 Debugging Chase Center HTML structure...\n');
  
  try {
    const scraper = new BaseScraper('Chase Center Debug', 'https://www.chasecenter.com/events', logger);
    
    // Fetch the HTML with Puppeteer to handle JavaScript rendering
    const html = await scraper.fetchWithPuppeteer('https://www.chasecenter.com/events');
    const $ = cheerio.load(html);
    
    console.log('📄 HTML Analysis:');
    console.log(`Total HTML length: ${html.length} characters`);
    
    // Look for event containers with various possible patterns
    const selectors = [
      '.event-card', '.event-item', '.event', '.card',
      '[class*="event"]', '[class*="card"]', '[class*="ticket"]',
      '.listing', '.show', '.concert', '.game'
    ];
    
    console.log('\n🔍 Searching for event containers:');
    selectors.forEach(selector => {
      const elements = $(selector);
      console.log(`  ${selector}: ${elements.length} elements found`);
    });
    
    // Look for any links that might lead to individual events
    const eventLinks = $('a[href*="/events/"]');
    console.log(`\n🔗 Event links found: ${eventLinks.length}`);
    
    if (eventLinks.length > 0) {
      console.log('Sample event links:');
      eventLinks.slice(0, 5).each((index, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const text = $link.text().trim();
        console.log(`  ${index + 1}. "${text}" -> ${href}`);
      });
    }
    
    // Look for specific text patterns that indicate events
    console.log('\n📅 Looking for date/time patterns:');
    const textContent = $('body').text();
    const datePatterns = textContent.match(/\b\w+,?\s+\w+\s+\d{1,2}\b/g);
    if (datePatterns) {
      console.log('Date patterns found:', datePatterns.slice(0, 10));
    }
    
    // Look for ticket-related elements
    const ticketElements = $('[class*="ticket"], [class*="buy"], [class*="purchase"]');
    console.log(`\n🎫 Ticket-related elements: ${ticketElements.length}`);
    
    // Look for main content areas
    console.log('\n📋 Main content areas:');
    ['main', '.main-content', '.content', '.events-container', '.calendar'].forEach(selector => {
      const elements = $(selector);
      console.log(`  ${selector}: ${elements.length} elements`);
      if (elements.length > 0) {
        const children = elements.first().children();
        console.log(`    First element has ${children.length} direct children`);
      }
    });
    
    // Look for any calendar or grid structures
    const calendarElements = $('[class*="calendar"], [class*="grid"], [class*="list"]');
    console.log(`\n📅 Calendar/grid elements: ${calendarElements.length}`);
    
    // Look more specifically at the .event elements
    const eventElements = $('.event');
    console.log(`\n🎯 Examining .event elements (${eventElements.length} found):`);
    
    eventElements.slice(0, 5).each((index, element) => {
      const $event = $(element);
      console.log(`\nEvent ${index + 1}:`);
      console.log(`  Classes: ${$event.attr('class')}`);
      console.log(`  Text content: "${$event.text().trim().substring(0, 150)}..."`);
      
      // Look for title, date, time within this event
      const title = $event.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim();
      const date = $event.find('[class*="date"], time, .date').first().text().trim();
      const link = $event.find('a').first().attr('href');
      
      console.log(`  Title: "${title}"`);
      console.log(`  Date: "${date}"`);
      console.log(`  Link: "${link}"`);
      console.log(`  HTML preview: ${$event.html().substring(0, 200)}...`);
    });
    
    // Also examine the event links more closely
    console.log(`\n🔗 Examining event links in detail:`);
    eventLinks.slice(0, 10).each((index, element) => {
      const $link = $(element);
      const $parent = $link.closest('.event, [class*="event"], [class*="card"]');
      console.log(`\nLink ${index + 1}:`);
      console.log(`  Href: ${$link.attr('href')}`);
      console.log(`  Text: "${$link.text().trim()}"`);
      console.log(`  Parent classes: ${$parent.attr('class')}`);
      console.log(`  Parent text: "${$parent.text().trim().substring(0, 100)}..."`);
    });
    
    await scraper.closeBrowser();
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugChaseCenterHTML();