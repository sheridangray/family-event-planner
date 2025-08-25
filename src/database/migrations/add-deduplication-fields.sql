-- Migration to add deduplication support fields
-- Add new columns to events table for deduplication tracking

-- Add sources field to track multiple sources for merged events
ALTER TABLE events ADD COLUMN sources TEXT; -- JSON array of source names

-- Add alternate URLs for events that were merged
ALTER TABLE events ADD COLUMN alternate_urls TEXT; -- JSON array of additional registration URLs

-- Add merge tracking fields
ALTER TABLE events ADD COLUMN merge_count INTEGER DEFAULT 1; -- Number of events merged into this one
ALTER TABLE events ADD COLUMN last_merged DATETIME; -- Timestamp of last merge operation

-- Add fingerprint field for exact duplicate detection
ALTER TABLE events ADD COLUMN fingerprint TEXT; -- Normalized fingerprint for deduplication

-- Create new table for tracking event merges
CREATE TABLE IF NOT EXISTS event_merges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_event_id TEXT NOT NULL, -- The event that was kept
    merged_event_id TEXT NOT NULL,  -- The event that was merged (original ID before merging)
    merged_event_data TEXT NOT NULL, -- JSON of the merged event data
    similarity_score REAL,          -- Similarity score that triggered the merge
    merge_type TEXT NOT NULL CHECK(merge_type IN ('exact', 'fuzzy')),
    merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_event_id) REFERENCES events (id)
);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_events_sources ON events(sources);
CREATE INDEX IF NOT EXISTS idx_events_merge_count ON events(merge_count);
CREATE INDEX IF NOT EXISTS idx_event_merges_primary ON event_merges(primary_event_id);
CREATE INDEX IF NOT EXISTS idx_event_merges_merged_at ON event_merges(merged_at);

-- Update existing events to have default values
UPDATE events SET 
    sources = JSON_ARRAY(source),
    merge_count = 1,
    fingerprint = id
WHERE sources IS NULL;