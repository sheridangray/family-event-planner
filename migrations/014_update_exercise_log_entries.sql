-- Migration: Update exercise_log_entries to reference master exercises table

-- Add exercise_id column
ALTER TABLE exercise_log_entries
ADD COLUMN IF NOT EXISTS exercise_id INTEGER;

-- Add foreign key constraint
ALTER TABLE exercise_log_entries
ADD CONSTRAINT fk_log_entry_exercise
FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;

-- Create index for exercise_id
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_exercise_id ON exercise_log_entries(exercise_id);

-- Rename log_id to workout_id for clarity (optional, keeping both for now)
-- ALTER TABLE exercise_log_entries RENAME COLUMN log_id TO workout_id;

-- Note: exercise_name is kept for backward compatibility
-- Migration script will link existing log_entries to exercises where possible

