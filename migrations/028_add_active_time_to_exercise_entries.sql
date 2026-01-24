-- Migration: Add started_at and ended_at to exercise_log_entries for active time tracking
ALTER TABLE exercise_log_entries
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_started_at ON exercise_log_entries(started_at);
