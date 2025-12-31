-- Migration: Create Sleep Pillar Tables
-- Introduces Sleep Sessions, Stages, and Caffeine Tracking

-- 1. Sleep Sessions Table
CREATE TABLE IF NOT EXISTS sleep_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    timezone VARCHAR(100),
    
    session_type VARCHAR(20) DEFAULT 'overnight' CHECK (session_type IN ('overnight', 'nap')),
    source VARCHAR(50) DEFAULT 'manual', -- manual, apple_health
    
    duration_minutes INTEGER,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    
    -- Summary metrics
    efficiency_pct DECIMAL(5, 2),
    awake_minutes INTEGER,
    deep_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    
    notes TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Sleep Stages Table (Optional detailed data)
CREATE TABLE IF NOT EXISTS sleep_stages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sleep_sessions(id) ON DELETE CASCADE,
    
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    stage VARCHAR(20) NOT NULL, -- awake, light, deep, rem, unknown
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Caffeine Tracking
CREATE TABLE IF NOT EXISTS caffeine_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    consumed_at TIMESTAMP NOT NULL,
    amount_mg INTEGER NOT NULL,
    
    source_type VARCHAR(50), -- coffee, tea, soda, etc.
    label VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Sleep Goals
CREATE TABLE IF NOT EXISTS sleep_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    target_sleep_minutes INTEGER DEFAULT 480, -- 8 hours
    bedtime_window_start TIME, -- e.g. "22:00"
    bedtime_window_end TIME, -- e.g. "23:30"
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user ON sleep_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_start ON sleep_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_caffeine_user ON caffeine_entries(user_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_sleep_sessions_updated_at ON sleep_sessions;
CREATE TRIGGER trigger_sleep_sessions_updated_at BEFORE UPDATE ON sleep_sessions FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_sleep_goals_updated_at ON sleep_goals;
CREATE TRIGGER trigger_sleep_goals_updated_at BEFORE UPDATE ON sleep_goals FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
