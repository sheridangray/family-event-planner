-- Migration: Add updated_at to exercise_log_entries
ALTER TABLE exercise_log_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update trigger to maintain updated_at
CREATE TRIGGER trigger_exercise_log_entries_updated_at
    BEFORE UPDATE ON exercise_log_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

