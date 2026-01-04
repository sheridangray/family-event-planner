-- Migration: Align exercise and health tables with PRD
-- Phase 1 of aligning with the "Integrated Life — Health Pillar" PRD

-- 1. Update exercises table (ExerciseDefinition)
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE,
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_muscles TEXT[],
ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[],
ADD COLUMN IF NOT EXISTS equipment TEXT[],
ADD COLUMN IF NOT EXISTS input_schema JSONB,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 2. Update exercise_logs table (WorkoutSession)
-- We will keep the name exercise_logs for now to avoid breaking too much code,
-- but treat it as the session container.
ALTER TABLE exercise_logs
ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'COMPLETED' CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'DISCARDED')),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 3. Update exercise_log_entries table (ExerciseLog)
ALTER TABLE exercise_log_entries
ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE,
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS performed_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS sets JSONB, -- The new unified sets array as per PRD
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS sync_state VARCHAR(20) DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Update existing log entries with user_id from parent log
UPDATE exercise_log_entries e
SET user_id = l.user_id
FROM exercise_logs l
WHERE e.log_id = l.id AND e.user_id IS NULL;

-- Make log_id nullable to allow ExerciseLogs to exist without a WorkoutSession
ALTER TABLE exercise_log_entries ALTER COLUMN log_id DROP NOT NULL;

-- 4. Add uuid to health_physical_metrics for client-side syncing
ALTER TABLE health_physical_metrics
ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE;

-- 5. Add soft delete and sync indexes
CREATE INDEX IF NOT EXISTS idx_exercises_archived ON exercises(is_archived);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_deleted_at ON exercise_logs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_deleted_at ON exercise_log_entries(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_user_id ON exercise_log_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_performed_at ON exercise_log_entries(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_uuid ON exercise_log_entries(uuid);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_uuid ON exercise_logs(uuid);
CREATE INDEX IF NOT EXISTS idx_health_metrics_uuid ON health_physical_metrics(uuid);
