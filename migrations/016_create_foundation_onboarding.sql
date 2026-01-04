-- Migration: Create Foundation & Onboarding Tables
-- Introduces Households, Profiles (replacing/unifying disjoint family tables), Onboarding State, and App Config

-- 1. Households Table
-- Represents a group of people living together (e.g. "The Gray Family")
CREATE TABLE IF NOT EXISTS households (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Profiles Table
-- Unifies 'users', 'children', and 'family_contacts' into a single concept.
-- A profile belongs to a household. A profile MAY be linked to a login 'user'.
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Nullable: kids don't have login users yet
    
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'adult', 'child', 'viewer')),
    relationship_type VARCHAR(50) CHECK (relationship_type IN ('self', 'spouse', 'child', 'parent', 'other')),
    
    birth_date DATE,
    avatar_url VARCHAR(500),
    
    -- Permissions & Visibility
    is_active BOOLEAN DEFAULT true,
    enabled_pillars TEXT[] DEFAULT '{time,food,health,relationships,sleep,money}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Onboarding State Table
-- Stores the progress and temporary data during the onboarding wizard.
CREATE TABLE IF NOT EXISTS onboarding_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    current_step_id VARCHAR(50) NOT NULL DEFAULT 'welcome',
    steps_status JSONB DEFAULT '{}'::jsonb, -- e.g. {"goals": "complete", "pillars": "in_progress"}
    
    payload JSONB DEFAULT '{}'::jsonb, -- Stores the draft data (goals, diet, etc.) before final commit
    
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. App Config Table (Remote Config)
-- Stores version gating, maintenance mode, and feature flags.
CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(100) PRIMARY KEY, -- e.g. "ios_min_version", "maintenance_mode"
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_foundation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_households_updated_at ON households;
CREATE TRIGGER trigger_households_updated_at BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_onboarding_state_updated_at ON onboarding_state;
CREATE TRIGGER trigger_onboarding_state_updated_at BEFORE UPDATE ON onboarding_state FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_app_config_updated_at ON app_config;
CREATE TRIGGER trigger_app_config_updated_at BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

-- Seed Initial App Config
INSERT INTO app_config (key, value, description) VALUES
('min_supported_version', '1.0.0', 'Minimum supported iOS app version'),
('maintenance_mode', 'false', 'Global maintenance mode switch'),
('feature_flags', '{"new_onboarding": true}', 'JSON blob of feature flags')
ON CONFLICT (key) DO NOTHING;
