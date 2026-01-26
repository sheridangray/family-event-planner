-- Add title_hash column to kid_events for better uniqueness detection
-- This allows multiple events from the same URL to be stored separately

-- Add title_hash column
ALTER TABLE kid_events ADD COLUMN IF NOT EXISTS title_hash VARCHAR(64);

-- Drop the old unique constraint (source_type, source_url)
-- Note: The constraint name may vary, so we try to drop by finding it
DO $$
BEGIN
    -- Try to drop constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kid_events_source_type_source_url_key' 
        AND conrelid = 'kid_events'::regclass
    ) THEN
        ALTER TABLE kid_events DROP CONSTRAINT kid_events_source_type_source_url_key;
    END IF;
    
    -- Also try alternate naming convention
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kid_events_source_url_source_type_key' 
        AND conrelid = 'kid_events'::regclass
    ) THEN
        ALTER TABLE kid_events DROP CONSTRAINT kid_events_source_url_source_type_key;
    END IF;
END $$;

-- Create new unique constraint including title_hash
-- This allows multiple events from the same source URL (e.g., event roundup pages)
CREATE UNIQUE INDEX IF NOT EXISTS kid_events_source_title_unique 
ON kid_events(source_type, source_url, title_hash);

-- Index for faster lookups by title_hash
CREATE INDEX IF NOT EXISTS idx_kid_events_title_hash ON kid_events(title_hash);

COMMENT ON COLUMN kid_events.title_hash IS 'MD5 hash of normalized title for unique constraint';
