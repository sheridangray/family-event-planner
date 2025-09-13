-- Add discovery_run_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS discovery_run_id INTEGER;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_discovery_run_id ON events (discovery_run_id);

-- Create a sequence for discovery run IDs
CREATE SEQUENCE IF NOT EXISTS discovery_run_seq START 1;

-- Update existing events to have discovery run IDs based on creation date groups
-- This will group events by day and assign sequential run IDs
WITH date_groups AS (
  SELECT DISTINCT DATE(created_at) as discovery_date
  FROM events 
  WHERE discovery_run_id IS NULL
  ORDER BY DATE(created_at)
),
numbered_dates AS (
  SELECT discovery_date, ROW_NUMBER() OVER (ORDER BY discovery_date) as run_id
  FROM date_groups
)
UPDATE events 
SET discovery_run_id = nd.run_id
FROM numbered_dates nd
WHERE DATE(events.created_at) = nd.discovery_date 
  AND events.discovery_run_id IS NULL;

-- Set the sequence to continue from the highest existing run ID
SELECT setval('discovery_run_seq', COALESCE((SELECT MAX(discovery_run_id) FROM events), 0) + 1);