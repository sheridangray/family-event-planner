/**
 * Debug SF Library HTML Structure
 * 
 * Examines the actual HTML structure to understand why events aren't being parsed.
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const SFLibraryScraper = require('../src/scrapers/sf-library');
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

async function debugSFLibraryHTML() {
  console.log('🔍 Debugging SF Library HTML structure...\n');
  
  try {
    const scraper = new SFLibraryScraper(logger);
    
    // Fetch the HTML
    const html = await scraper.fetchWithPuppeteer('https://sfpl.org/events');
    const $ = cheerio.load(html);
    
    console.log('📄 HTML Analysis:');
    console.log(`Total HTML length: ${html.length} characters`);
    
    // Check for views-row elements
    const viewsRows = $('.views-row');
    console.log(`Found ${viewsRows.length} .views-row elements`);
    
    if (viewsRows.length > 0) {
      console.log('\n📋 First few .views-row elements:');
      viewsRows.slice(0, 3).each((index, element) => {
        const $event = $(element);
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  HTML: ${$event.html().substring(0, 200)}...`);
        
        // Check for title
        const titleElement = $event.find('.views-field-title a');
        console.log(`  Title element found: ${titleElement.length > 0}`);
        if (titleElement.length > 0) {
          console.log(`  Title text: "${titleElement.text().trim()}"`);
          console.log(`  Title href: "${titleElement.attr('href')}"`);
        }
        
        // Check for date
        const dateElement = $event.find('.views-field-field-event-date-and-time');
        console.log(`  Date element found: ${dateElement.length > 0}`);
        if (dateElement.length > 0) {
          console.log(`  Date text: "${dateElement.text().trim()}"`);
        }
        
        // Check for location
        const locationElement = $event.find('.views-field-field-event-location a');
        console.log(`  Location element found: ${locationElement.length > 0}`);
        if (locationElement.length > 0) {
          console.log(`  Location text: "${locationElement.text().trim()}"`);
        }
        
        // Check for audience
        const audienceElement = $event.find('.views-field-field-event-audience');
        console.log(`  Audience element found: ${audienceElement.length > 0}`);
        if (audienceElement.length > 0) {
          console.log(`  Audience text: "${audienceElement.text().trim()}"`);
        }
      });
    }
    
    // Look for alternative selectors
    console.log('\n🔍 Alternative selectors:');
    console.log(`  .view-content: ${$('.view-content').length}`);
    console.log(`  .views-field: ${$('.views-field').length}`);
    console.log(`  .field-content: ${$('.field-content').length}`);
    console.log(`  [class*="event"]: ${$('[class*="event"]').length}`);
    console.log(`  .node: ${$('.node').length}`);
    
    // Look for any links to event pages
    const eventLinks = $('a[href*="/events/"]');
    console.log(`\n🔗 Event links found: ${eventLinks.length}`);
    
    if (eventLinks.length > 0) {
      console.log('Sample event links and their parent containers:');
      eventLinks.slice(0, 5).each((index, element) => {
        const $link = $(element);
        const $parent = $link.closest('.views-row, .node, .event-item, .view-content > div');
        console.log(`  ${index + 1}. "${$link.text().trim()}" -> ${$link.attr('href')}`);
        console.log(`    Parent element: ${$parent.prop('tagName')} with classes: ${$parent.attr('class')}`);
        console.log(`    Parent HTML preview: ${$parent.html().substring(0, 300)}...`);
        console.log('');
      });
    }
    
    // Look for the main content area that contains events
    const mainContent = $('.view-events .view-content');
    console.log(`\n📄 Main events content area:`);
    console.log(`  .view-events .view-content found: ${mainContent.length}`);
    
    if (mainContent.length > 0) {
      const children = mainContent.children();
      console.log(`  Direct children: ${children.length}`);
      children.slice(0, 3).each((index, element) => {
        const $child = $(element);
        console.log(`    Child ${index + 1}: ${$child.prop('tagName')} with classes: ${$child.attr('class')}`);
        console.log(`    Contains event link: ${$child.find('a[href*="/events/"]').length > 0}`);
      });
    }
    
    await scraper.closeBrowser();
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugSFLibraryHTML();