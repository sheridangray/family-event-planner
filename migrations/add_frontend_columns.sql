-- Migration to add missing columns for frontend alignment
-- Run this once to add the columns needed by the frontend

-- Add missing columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS time VARCHAR(10),
ADD COLUMN IF NOT EXISTS location_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS location_distance VARCHAR(50);

-- Update existing events to extract time from date field
-- This will populate the time field for existing records
UPDATE events 
SET time = TO_CHAR(date, 'HH24:MI')
WHERE time IS NULL;

-- Add index on new fields for better performance
CREATE INDEX IF NOT EXISTS idx_events_time ON events(time);
CREATE INDEX IF NOT EXISTS idx_events_location_name ON events(location_name);

-- Add columns for social proof data (already exists in schema.sql but not in postgres.js)
CREATE TABLE IF NOT EXISTS event_social_proof (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  rating DECIMAL(3, 2),
  review_count INTEGER DEFAULT 0,
  tags JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(event_id)
);

-- Add columns to family_members for frontend requirements
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS interests JSONB,
ADD COLUMN IF NOT EXISTS special_needs TEXT,
ADD COLUMN IF NOT EXISTS preferences JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_proof_event_id ON event_social_proof(event_id);
CREATE INDEX IF NOT EXISTS idx_family_members_interests ON family_members USING GIN(interests);

COMMIT;