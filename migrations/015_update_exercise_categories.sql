-- Migration: Update exercise schema for expanded categories
-- Supports 10 distinct exercise categories with specific metrics

-- 1. Update exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Migrate existing data (best effort mapping)
UPDATE exercises SET category = 'barbell_dumbbell' WHERE exercise_type = 'weight';
UPDATE exercises SET category = 'bodyweight' WHERE exercise_type = 'bodyweight';
UPDATE exercises SET category = 'cardio_distance' WHERE exercise_type = 'treadmill';

-- Set default for any new/unknown types
UPDATE exercises SET category = 'barbell_dumbbell' WHERE category IS NULL;

-- Create index for new category column
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);

-- 2. Update exercise_log_entries to support new metrics per set
-- All stored as JSONB arrays to match existing pattern (one entry per exercise, array of sets)

ALTER TABLE exercise_log_entries
ADD COLUMN IF NOT EXISTS distance_meters JSONB,      -- [1000, 1000, 1000] (meters)
ADD COLUMN IF NOT EXISTS band_level JSONB,           -- ["light", "medium", "heavy"]
ADD COLUMN IF NOT EXISTS resistance_level JSONB,     -- [5, 6, 6] (machine setting)
ADD COLUMN IF NOT EXISTS incline_percentage JSONB,   -- [1.0, 2.0, 2.0]
ADD COLUMN IF NOT EXISTS calories JSONB,             -- [100, 120, 110]
ADD COLUMN IF NOT EXISTS heart_rate JSONB,           -- [140, 155, 160]
ADD COLUMN IF NOT EXISTS speed_mph JSONB,            -- [6.0, 6.5, 7.0]
ADD COLUMN IF NOT EXISTS rpe JSONB;                  -- [7, 8, 9]

-- 3. Update routine_exercises to support preferred metrics defaults (optional but good for templates)
ALTER TABLE routine_exercises
ADD COLUMN IF NOT EXISTS target_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS target_incline_percentage DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS target_rpe INTEGER;

