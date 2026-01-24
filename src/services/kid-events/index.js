/**
 * Kid Events Service - Main Export
 * 
 * Unified event discovery for children's activities using:
 * - Google Custom Search (SERP)
 * - Eventbrite API
 * - Gmail Newsletters
 */

const DiscoveryOrchestrator = require('./discovery-orchestrator');
const { SerpSource, EventbriteSource, NewsletterSource } = require('./sources');
const { LLMExtractor, ProbabilisticFilter } = require('./processing');

module.exports = {
  DiscoveryOrchestrator,
  SerpSource,
  EventbriteSource,
  NewsletterSource,
  LLMExtractor,
  ProbabilisticFilter
};
