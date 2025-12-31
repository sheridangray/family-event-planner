-- Migration: Create Relationships Pillar Tables
-- Introduces Rituals, Memories, and expanded People context

-- 1. People (Relationship Profiles) Table
-- This expands on the basic profiles to add relationship-specific metadata
CREATE TABLE IF NOT EXISTS relationship_people (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    
    importance VARCHAR(50) DEFAULT 'close' CHECK (importance IN ('core', 'close', 'extended')),
    
    -- Preferences (JSON blob for love languages, likes, dislikes)
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Important Dates (JSON array or separate table? choosing array for simplicity in MVP)
    important_dates JSONB DEFAULT '[]'::jsonb, 
    
    notes TEXT,
    last_interaction_at TIMESTAMP,
    next_moment_at TIMESTAMP,
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Rituals Table
-- Template workflows for relationships (e.g. "Monthly Letter", "Date Night")
CREATE TABLE IF NOT EXISTS rituals (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ritual_type VARCHAR(50) NOT NULL, -- e.g. "monthly_letter", "date_night", "check_in"
    
    completion_definition JSONB DEFAULT '{}'::jsonb, -- e.g. { "requires_photo": true }
    default_cadence JSONB DEFAULT '{}'::jsonb, -- e.g. { "frequency": "monthly" }
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Ritual Schedules Table
-- Instances of rituals scheduled for specific people
CREATE TABLE IF NOT EXISTS ritual_schedules (
    id SERIAL PRIMARY KEY,
    ritual_id INTEGER REFERENCES rituals(id) ON DELETE CASCADE,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    target_profile_ids INTEGER[], -- Who this ritual is for
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    
    cadence JSONB NOT NULL, -- RRULE-like or structured
    notification_settings JSONB DEFAULT '{}'::jsonb,
    
    next_due_at TIMESTAMP NOT NULL,
    last_completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Ritual Completions Table
CREATE TABLE IF NOT EXISTS ritual_completions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES ritual_schedules(id) ON DELETE CASCADE,
    ritual_id INTEGER REFERENCES rituals(id) ON DELETE CASCADE,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    target_profile_ids INTEGER[],
    completed_at TIMESTAMP DEFAULT NOW(),
    
    artifact JSONB, -- e.g. { "text": "...", "photo_url": "..." }
    
    is_skipped BOOLEAN DEFAULT false,
    skip_reason TEXT
);

-- 5. Memories Table
-- Lightweight journaling / highlights
CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    title VARCHAR(255),
    note TEXT,
    photo_urls TEXT[],
    
    target_profile_ids INTEGER[],
    occurred_at TIMESTAMP NOT NULL,
    
    tags TEXT[],
    sentiment VARCHAR(20), -- positive, neutral, negative
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ritual_schedules_due ON ritual_schedules(next_due_at);
CREATE INDEX IF NOT EXISTS idx_memories_occurred ON memories(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ritual_completions_ritual ON ritual_completions(ritual_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_relationship_people_updated_at ON relationship_people;
CREATE TRIGGER trigger_relationship_people_updated_at BEFORE UPDATE ON relationship_people FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_rituals_updated_at ON rituals;
CREATE TRIGGER trigger_rituals_updated_at BEFORE UPDATE ON rituals FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_ritual_schedules_updated_at ON ritual_schedules;
CREATE TRIGGER trigger_ritual_schedules_updated_at BEFORE UPDATE ON ritual_schedules FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_memories_updated_at ON memories;
CREATE TRIGGER trigger_memories_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
