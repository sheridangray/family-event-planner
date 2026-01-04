-- Migration: Create health coach recommendations table
-- Stores LLM-generated health recommendations for users

CREATE TABLE IF NOT EXISTS health_coach_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  focus_areas JSONB,
  recommendations JSONB,
  context_snapshot JSONB,
  model_used VARCHAR(50),
  tokens_used INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  user_feedback INTEGER, -- 1-5 rating (future)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_health_coach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_coach_user_date ON health_coach_recommendations(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_coach_notification_sent ON health_coach_recommendations(notification_sent);
-- Partial index for recent recommendations
CREATE INDEX IF NOT EXISTS idx_health_coach_user_recent ON health_coach_recommendations(user_id, generated_at DESC)
    WHERE generated_at >= NOW() - INTERVAL '30 days';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_health_coach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_health_coach_updated_at
    BEFORE UPDATE ON health_coach_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_health_coach_updated_at();

