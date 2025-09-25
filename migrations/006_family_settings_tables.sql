-- Migration: Add family settings tables for dynamic configuration
-- This replaces hardcoded environment variables with database-driven settings

-- Family settings table for location, preferences, and general configuration
CREATE TABLE IF NOT EXISTS family_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK(setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Children profiles table
CREATE TABLE IF NOT EXISTS children (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    interests TEXT[], -- Array of interests
    special_needs TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Family contact information table
CREATE TABLE IF NOT EXISTS family_contacts (
    id SERIAL PRIMARY KEY,
    contact_type VARCHAR(50) NOT NULL, -- 'parent', 'emergency', 'backup'
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    is_primary BOOLEAN DEFAULT false,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Link to authenticated users
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_settings_key ON family_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_children_active ON children(active);
CREATE INDEX IF NOT EXISTS idx_family_contacts_type ON family_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_family_contacts_user_id ON family_contacts(user_id);

-- Insert initial family settings from environment variables
INSERT INTO family_settings (setting_key, setting_value, setting_type, description) VALUES
-- Location Settings
('home_address', 'San Francisco', 'string', 'Home city/address for distance calculations'),
('home_zip', '94158', 'string', 'Home ZIP code for weather and local events'),
('home_city', 'San Francisco', 'string', 'Home city name'),
('home_state', 'CA', 'string', 'Home state abbreviation'),
('home_country', 'US', 'string', 'Home country code'),
('max_distance_miles', '30', 'number', 'Maximum distance for event discovery'),

-- Schedule Settings  
('weekday_earliest_time', '16:30', 'string', 'Earliest time for weekday events'),
('weekend_earliest_time', '08:00', 'string', 'Earliest time for weekend events'),
('weekend_nap_start', '12:00', 'string', 'Weekend nap time start'),
('weekend_nap_end', '14:00', 'string', 'Weekend nap time end'),

-- Event Preferences
('min_child_age', '2', 'number', 'Minimum child age for events'),
('max_child_age', '4', 'number', 'Maximum child age for events'),
('max_cost_per_event', '200', 'number', 'Maximum cost per event in dollars'),
('min_advance_days', '2', 'number', 'Minimum days in advance for events'),
('max_advance_months', '6', 'number', 'Maximum months in advance for events'),

-- Discovery Settings
('events_per_week_min', '8', 'number', 'Minimum events to discover per week'),
('events_per_week_max', '20', 'number', 'Maximum events to discover per week'),
('events_per_day_max', '3', 'number', 'Maximum events per day'),
('scan_frequency_hours', '6', 'number', 'Normal scan frequency in hours'),
('urgent_scan_frequency_hours', '1', 'number', 'Urgent scan frequency in hours'),

-- Family Information
('family_name', 'Gray-Zhang Family', 'string', 'Family display name')

ON CONFLICT (setting_key) DO NOTHING;

-- Insert initial children profiles
INSERT INTO children (name, birth_date, interests, special_needs) VALUES
('Apollo Gray', '2020-09-25', ARRAY['Building', 'Science', 'Outdoor Play'], ''),
('Athena Gray', '2022-09-25', ARRAY['Art', 'Music', 'Animals'], '')
ON CONFLICT DO NOTHING;

-- Insert family contacts
INSERT INTO family_contacts (contact_type, name, email, phone, is_primary) VALUES
('parent', 'Joyce Zhang', 'joyce.yan.zhang@gmail.com', NULL, true),
('parent', 'Sheridan Gray', 'sheridan.gray@gmail.com', NULL, false),
('emergency', 'Emergency Contact', NULL, '+12063909727', false)
ON CONFLICT DO NOTHING;

-- Update family_contacts to link with users table if possible
UPDATE family_contacts 
SET user_id = (SELECT id FROM users WHERE email = family_contacts.email)
WHERE email IS NOT NULL AND user_id IS NULL;

-- Add updated_at trigger for family_settings
CREATE OR REPLACE FUNCTION update_family_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_family_settings_updated_at
    BEFORE UPDATE ON family_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_family_settings_updated_at();

-- Add updated_at trigger for children
CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_children_updated_at
    BEFORE UPDATE ON children
    FOR EACH ROW
    EXECUTE FUNCTION update_children_updated_at();

-- Add updated_at trigger for family_contacts
CREATE OR REPLACE FUNCTION update_family_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_family_contacts_updated_at
    BEFORE UPDATE ON family_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_family_contacts_updated_at();