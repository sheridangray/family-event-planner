-- Add missing columns for automation API
-- These columns are referenced in the automation endpoints but don't exist in the current schema

-- Add adapter_type to registrations table
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS adapter_type VARCHAR(50);

-- Add venue_name to events table  
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name VARCHAR(255);

-- Update existing records with default values
UPDATE registrations SET adapter_type = 'manual' WHERE adapter_type IS NULL;
UPDATE events SET venue_name = location_name WHERE venue_name IS NULL AND location_name IS NOT NULL;
UPDATE events SET venue_name = 'TBD' WHERE venue_name IS NULL;