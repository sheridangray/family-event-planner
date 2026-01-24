/**
 * Sources Index - Aggregates all event sources
 */

const SerpSource = require('./serp-source');
const EventbriteSource = require('./eventbrite-source');
const NewsletterSource = require('./newsletter-source');

module.exports = {
  SerpSource,
  EventbriteSource,
  NewsletterSource
};
