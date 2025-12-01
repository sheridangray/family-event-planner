-- Migration: Update routine_exercises to reference master exercises table

-- Add exercise_id column
ALTER TABLE routine_exercises
ADD COLUMN IF NOT EXISTS exercise_id INTEGER;

-- Add foreign key constraint
ALTER TABLE routine_exercises
ADD CONSTRAINT fk_routine_exercise_exercise
FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;

-- Create index for exercise_id
CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise_id ON routine_exercises(exercise_id);

-- Note: exercise_name is kept for backward compatibility
-- Migration script will link existing routine_exercises to exercises where possible

