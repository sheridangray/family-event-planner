-- Migration: Create Kid Events Discovery Tables
-- Description: Creates tables for the new ground-truth-based event discovery system
-- Date: 2026-01-23

-- Kid Events table (unified storage for all sources)
CREATE TABLE IF NOT EXISTS kid_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source tracking
  source_type VARCHAR(50) NOT NULL, -- 'serp', 'eventbrite', 'facebook', 'newsletter'
  source_url TEXT NOT NULL,
  source_id VARCHAR(255), -- External ID from API sources
  url_verified_at TIMESTAMP,
  url_valid BOOLEAN DEFAULT true,
  
  -- Core event data
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  
  -- Location
  venue_name TEXT,
  address TEXT,
  city VARCHAR(100) DEFAULT 'San Francisco',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_miles DECIMAL(5, 2),
  
  -- Cost
  cost_adult DECIMAL(10, 2),
  cost_child DECIMAL(10, 2),
  is_free BOOLEAN DEFAULT false,
  
  -- Age appropriateness
  age_min INTEGER,
  age_max INTEGER,
  
  -- URLs
  event_url TEXT,
  registration_url TEXT,
  
  -- Extraction confidence
  extraction_confidence DECIMAL(3, 2), -- 0.00 to 1.00
  extraction_model VARCHAR(50), -- 'gpt-4o-mini'
  raw_content TEXT, -- Original HTML/text for debugging
  
  -- Filter scores (probabilistic)
  relevance_score DECIMAL(3, 2),
  filter_scores JSONB, -- {age: 0.95, schedule: 0.7, budget: 0.9, location: 0.85}
  
  -- User interaction
  status VARCHAR(50) DEFAULT 'discovered', -- discovered, interested, approved, rejected, attended
  user_rating INTEGER, -- 1-5 stars after attending
  notes TEXT,
  
  -- Timestamps
  discovered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(source_type, source_url)
);

-- Discovery preferences (learned from user feedback)
CREATE TABLE IF NOT EXISTS kid_event_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  
  -- Filter weights (learned)
  filter_weights JSONB DEFAULT '{"age": 0.3, "schedule": 0.25, "budget": 0.2, "location": 0.15, "interest": 0.1}',
  
  -- Venue preferences
  liked_venues JSONB DEFAULT '[]',
  disliked_venues JSONB DEFAULT '[]',
  
  -- Activity preferences
  liked_activities JSONB DEFAULT '[]',
  disliked_activities JSONB DEFAULT '[]',
  
  -- Time preferences
  preferred_days JSONB DEFAULT '["saturday", "sunday"]',
  preferred_times JSONB DEFAULT '{"weekday_after": "17:00", "weekend_start": "09:00"}',
  
  -- Budget
  max_cost_per_event DECIMAL(10, 2) DEFAULT 50.00,
  prefer_free BOOLEAN DEFAULT true,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Newsletter sources tracking
CREATE TABLE IF NOT EXISTS newsletter_sources (
  id SERIAL PRIMARY KEY,
  email_from TEXT NOT NULL,
  label_name VARCHAR(100) DEFAULT 'events/newsletters',
  is_active BOOLEAN DEFAULT true,
  last_processed_at TIMESTAMP,
  events_extracted_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Discovery runs for tracking
CREATE TABLE IF NOT EXISTS kid_event_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'on_demand'
  config JSONB, -- Discovery parameters used
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'running', -- running, completed, failed
  events_found INTEGER DEFAULT 0,
  events_saved INTEGER DEFAULT 0,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_kid_events_date ON kid_events(event_date);
CREATE INDEX idx_kid_events_status ON kid_events(status);
CREATE INDEX idx_kid_events_source ON kid_events(source_type);
CREATE INDEX idx_kid_events_relevance ON kid_events(relevance_score DESC);
CREATE INDEX idx_kid_events_discovered ON kid_events(discovered_at DESC);
CREATE INDEX idx_kid_event_prefs_user ON kid_event_preferences(user_id);
CREATE INDEX idx_newsletter_sources_active ON newsletter_sources(is_active);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_kid_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kid_events_updated_at_trigger
  BEFORE UPDATE ON kid_events
  FOR EACH ROW
  EXECUTE FUNCTION update_kid_events_updated_at();

DO $$
BEGIN
  RAISE NOTICE 'Kid events tables created successfully';
END $$;
