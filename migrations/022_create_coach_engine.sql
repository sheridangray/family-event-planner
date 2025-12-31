-- Migration: Create Coach Engine Tables
-- Introduces Coach Calibration, Style, and generated Advice

-- 1. Coach Calibration Table
CREATE TABLE IF NOT EXISTS coach_calibration (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Intent (JSON blob for goals, pillars focus, pain points)
    intent JSONB DEFAULT '{}'::jsonb,
    
    -- Availability (JSON for work hours, preferred windows)
    availability JSONB DEFAULT '{}'::jsonb,
    
    -- Tone & Style
    tone_preference VARCHAR(50) DEFAULT 'direct', -- direct, gentle
    verbosity VARCHAR(50) DEFAULT 'short', -- short, detailed
    accountability_level VARCHAR(50) DEFAULT 'medium', -- low, medium, high
    humor_enabled BOOLEAN DEFAULT false,
    
    -- Check-in settings
    checkin_cadence VARCHAR(50) DEFAULT 'daily',
    checkin_times JSONB DEFAULT '[]'::jsonb,
    preferred_channel VARCHAR(50) DEFAULT 'push',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Coach Suggestions (History of advice given)
CREATE TABLE IF NOT EXISTS coach_suggestions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    pillar VARCHAR(50), -- time, food, relationships, etc.
    title TEXT NOT NULL,
    suggestion_text TEXT NOT NULL,
    reasoning TEXT,
    
    -- Context used for this suggestion
    context_snapshot JSONB,
    
    -- Status & Feedback
    status VARCHAR(50) DEFAULT 'presented' CHECK (status IN ('presented', 'accepted', 'snoozed', 'dismissed', 'completed')),
    user_feedback_score INTEGER, -- 1-5
    
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Weekly Plans
CREATE TABLE IF NOT EXISTS coach_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    goals_focus TEXT[],
    top_priorities JSONB DEFAULT '[]'::jsonb,
    
    status VARCHAR(50) DEFAULT 'active',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coach_suggestions_user ON coach_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_suggestions_pillar ON coach_suggestions(pillar);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_coach_calibration_updated_at ON coach_calibration;
CREATE TRIGGER trigger_coach_calibration_updated_at BEFORE UPDATE ON coach_calibration FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_coach_suggestions_updated_at ON coach_suggestions;
CREATE TRIGGER trigger_coach_suggestions_updated_at BEFORE UPDATE ON coach_suggestions FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
