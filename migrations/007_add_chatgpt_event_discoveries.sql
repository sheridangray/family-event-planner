-- Migration: Add ChatGPT Event Discoveries table
-- This migration adds the table for storing AI-generated event suggestions

-- Create the chatgpt_event_discoveries table
CREATE TABLE IF NOT EXISTS chatgpt_event_discoveries (
    id SERIAL PRIMARY KEY,
    date_searched TIMESTAMP NOT NULL,
    target_date DATE NOT NULL,
    search_context JSONB NOT NULL,
    events JSONB NOT NULL,
    metadata JSONB,
    interested_event_ranks INTEGER[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatgpt_discoveries_date_searched ON chatgpt_event_discoveries(date_searched);
CREATE INDEX IF NOT EXISTS idx_chatgpt_discoveries_target_date ON chatgpt_event_discoveries(target_date);

-- Add comment for documentation
COMMENT ON TABLE chatgpt_event_discoveries IS 'Stores AI-generated event suggestions from ChatGPT scheduled actions';
COMMENT ON COLUMN chatgpt_event_discoveries.search_context IS 'JSON containing search parameters, filters, and family context';
COMMENT ON COLUMN chatgpt_event_discoveries.events IS 'JSON array of ranked event suggestions with full details';
COMMENT ON COLUMN chatgpt_event_discoveries.interested_event_ranks IS 'Array of event ranks that user has marked as interested';
