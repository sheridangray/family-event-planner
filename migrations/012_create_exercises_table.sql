-- Migration: Create master exercises table
-- Shared exercise database with LLM-generated details

CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    exercise_name VARCHAR(255) NOT NULL UNIQUE,
    instructions TEXT,
    youtube_url VARCHAR(500),
    body_parts TEXT[], -- Array of targeted body parts
    exercise_type VARCHAR(50) NOT NULL, -- 'weight', 'bodyweight', 'treadmill'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable pg_trgm extension for fuzzy text search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Index for search/autocomplete
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercises_name_trgm ON exercises USING gin(exercise_name gin_trgm_ops);

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

