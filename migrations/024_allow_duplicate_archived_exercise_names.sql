-- Migration: Allow duplicate exercise names for archived exercises
-- This enables creating a new exercise with the same name as an archived one
-- while maintaining uniqueness for active exercises

-- Drop the old UNIQUE constraint on exercise_name
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_exercise_name_key;

-- Create a partial unique index that only applies to non-archived exercises
-- This allows multiple archived exercises with the same name
-- but ensures only one active exercise can have a given name
CREATE UNIQUE INDEX IF NOT EXISTS exercises_exercise_name_active_unique 
ON exercises (LOWER(exercise_name))
WHERE (is_archived = false OR is_archived IS NULL);

-- Add comment for documentation
COMMENT ON INDEX exercises_exercise_name_active_unique IS 
'Ensures exercise names are unique only for active (non-archived) exercises. Allows reusing names for new exercises after archiving old ones.';

