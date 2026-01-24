-- Migration: Remove Legacy Event Discovery Tables
-- Description: Drops tables used by the legacy scraper and ChatGPT discovery systems
-- Date: 2026-01-23

-- Drop ChatGPT discoveries table
DROP TABLE IF EXISTS chatgpt_event_discoveries CASCADE;

-- Drop scraper management tables
DROP TABLE IF EXISTS scraper_stats CASCADE;
DROP TABLE IF EXISTS scraper_requests CASCADE;
DROP TABLE IF EXISTS scrapers CASCADE;

-- Drop discovery tables
DROP TABLE IF EXISTS discovered_events CASCADE;
DROP TABLE IF EXISTS discovery_runs CASCADE;
DROP TABLE IF EXISTS event_scores CASCADE;
DROP TABLE IF EXISTS event_merges CASCADE;

-- Drop any related functions
DROP FUNCTION IF EXISTS update_scrapers_updated_at CASCADE;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Legacy event discovery tables removed successfully';
END $$;
