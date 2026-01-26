-- Migration: Add date range fields to kid_events
-- Description: Adds support for multi-day events, date ranges, and recurring events
-- Date: 2026-01-26

-- Add new date columns
-- Note: event_date remains as the "start" date for backwards compatibility
ALTER TABLE kid_events 
ADD COLUMN IF NOT EXISTS date_end DATE,
ADD COLUMN IF NOT EXISTS date_type VARCHAR(20) DEFAULT 'single',
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT;

-- Add constraint for date_type
ALTER TABLE kid_events 
DROP CONSTRAINT IF EXISTS kid_events_date_type_check;

ALTER TABLE kid_events 
ADD CONSTRAINT kid_events_date_type_check 
CHECK (date_type IN ('single', 'range', 'recurring'));

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_kid_events_date_end ON kid_events(date_end);
CREATE INDEX IF NOT EXISTS idx_kid_events_date_type ON kid_events(date_type);

-- Update comment on event_date column (informational)
COMMENT ON COLUMN kid_events.event_date IS 'Start date of the event (for single-day events, this is the only date)';
COMMENT ON COLUMN kid_events.date_end IS 'End date for range/recurring events (null for single-day events)';
COMMENT ON COLUMN kid_events.date_type IS 'Type of date: single (one day), range (multi-day), recurring (repeating pattern)';
COMMENT ON COLUMN kid_events.recurrence_pattern IS 'Human-readable recurrence pattern, e.g., "Every Tuesday", "First Saturday of month"';

DO $$
BEGIN
  RAISE NOTICE 'Date range fields added to kid_events successfully';
END $$;
