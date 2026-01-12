-- Migration: Create workout_analysis table
-- Stores AI-generated analysis, stats, and suggested routine tweaks

CREATE TABLE IF NOT EXISTS workout_analysis (
    id SERIAL PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_text TEXT NOT NULL,
    stats JSONB, -- { "calories": 250, "volume_lbs": 5000, "duration_mins": 45, "intensity_score": 8 }
    routine_tweaks JSONB, -- [ { "exercise": "Bench Press", "current": { "sets": 3, "reps": 10 }, "suggested": { "sets": 4, "reps": 8 }, "reason": "Consistent high volume" } ]
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup by workout
CREATE INDEX IF NOT EXISTS idx_workout_analysis_workout ON workout_analysis(workout_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trigger_workout_analysis_updated_at ON workout_analysis;
CREATE TRIGGER trigger_workout_analysis_updated_at
    BEFORE UPDATE ON workout_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

