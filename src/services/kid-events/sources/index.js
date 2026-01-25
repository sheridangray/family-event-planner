/**
 * Sources Index - Aggregates all event sources
 */

const BraveSearchSource = require('./brave-search-source');
const SerpSource = require('./serp-source'); // Deprecated - Google CSE closed to new customers
const EventbriteSource = require('./eventbrite-source');
const NewsletterSource = require('./newsletter-source');

module.exports = {
  BraveSearchSource,
  SerpSource,
  EventbriteSource,
  NewsletterSource
};
