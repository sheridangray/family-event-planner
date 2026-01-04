-- Migration: Create exercise tracking tables
-- Supports workout routines, logging, AI suggestions, and conversational coaching with RAG

-- Enable pgvector extension for vector similarity search (RAG)
-- Note: Optional - tables work without it
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Exercise routines (templates for each day)
CREATE TABLE IF NOT EXISTS exercise_routines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    routine_name VARCHAR(100) NOT NULL, -- e.g., "Upper Push", "Lower Body + VMO"
    day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc. (NULL = custom/one-time)
    description TEXT, -- e.g., "Fat loss + strength + knee longevity"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_exercise_routine_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Exercises within a routine (supports equipment variations)
CREATE TABLE IF NOT EXISTS routine_exercises (
    id SERIAL PRIMARY KEY,
    routine_id INTEGER NOT NULL,
    exercise_name VARCHAR(100) NOT NULL, -- e.g., "Band Chest Press", "Push-ups"
    exercise_order INTEGER NOT NULL, -- Order within routine
    target_sets INTEGER NOT NULL,
    target_reps_min INTEGER, -- e.g., 12
    target_reps_max INTEGER, -- e.g., 15 (NULL if single rep target)
    target_duration_seconds INTEGER, -- For holds like "20-40 sec"
    notes TEXT, -- e.g., "Squeeze chest, slow return"
    cues TEXT, -- Form cues
    preferred_equipment VARCHAR(50), -- 'bands', 'machines', 'free_weights', 'bodyweight', 'mixed'
    equipment_notes TEXT, -- e.g., "Can use bands at home or machine at gym"
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_routine_exercise_routine FOREIGN KEY (routine_id) REFERENCES exercise_routines(id) ON DELETE CASCADE
);

-- Exercise log entries (actual workouts performed)
CREATE TABLE IF NOT EXISTS exercise_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    routine_id INTEGER, -- Optional: link to routine template
    exercise_date DATE NOT NULL,
    day_of_week INTEGER, -- For easy filtering
    total_duration_minutes INTEGER, -- Total workout time
    location VARCHAR(50), -- 'home', 'gym', 'outdoor', etc.
    notes TEXT, -- Overall workout notes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_exercise_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_log_routine FOREIGN KEY (routine_id) REFERENCES exercise_routines(id) ON DELETE SET NULL
);

-- Individual exercise performances within a log
CREATE TABLE IF NOT EXISTS exercise_log_entries (
    id SERIAL PRIMARY KEY,
    log_id INTEGER NOT NULL,
    exercise_name VARCHAR(100) NOT NULL, -- e.g., "Band Chest Press" or "Chest Press (Machine)"
    exercise_order INTEGER NOT NULL, -- Order in workout
    equipment_used VARCHAR(50), -- 'bands', 'machine', 'free_weights', 'bodyweight', 'cable', etc.
    sets_performed INTEGER NOT NULL,
    reps_performed JSONB, -- Array of reps per set: [12, 13, 12, 14]
    weight_used JSONB, -- Array of weights per set: [null, null, null, null] for bodyweight, or [50, 50, 55, 55] for weights
    duration_seconds JSONB, -- For time-based exercises: [25, 30, 28] seconds
    rest_seconds INTEGER, -- Rest between sets (optional)
    notes TEXT, -- Per-exercise notes
    difficulty_rating INTEGER, -- 1-10 scale (optional)
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_log_entry_log FOREIGN KEY (log_id) REFERENCES exercise_logs(id) ON DELETE CASCADE
);

-- AI-generated suggestions for exercises
CREATE TABLE IF NOT EXISTS exercise_suggestions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    log_entry_id INTEGER, -- Link to specific exercise performance
    log_id INTEGER, -- Link to full workout log
    exercise_name VARCHAR(100) NOT NULL,
    suggestion_type VARCHAR(50), -- 'progression', 'form', 'equipment', 'volume', 'rest'
    suggestion_text TEXT NOT NULL,
    reasoning TEXT, -- Why this suggestion
    priority VARCHAR(20), -- 'high', 'medium', 'low'
    applied BOOLEAN DEFAULT false, -- User marked as applied
    applied_at TIMESTAMP,
    generated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_exercise_suggestion_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_suggestion_log_entry FOREIGN KEY (log_entry_id) REFERENCES exercise_log_entries(id) ON DELETE SET NULL,
    CONSTRAINT fk_exercise_suggestion_log FOREIGN KEY (log_id) REFERENCES exercise_logs(id) ON DELETE SET NULL
);

-- Exercise history/patterns (for AI analysis and progression tracking)
CREATE TABLE IF NOT EXISTS exercise_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exercise_name VARCHAR(100) NOT NULL, -- Normalized name (e.g., "Chest Press" regardless of equipment)
    equipment_type VARCHAR(50), -- 'bands', 'machine', 'free_weights', 'bodyweight'
    last_performed DATE,
    frequency_weeks DECIMAL(5,2), -- How often per week
    average_sets DECIMAL(5,2),
    average_reps DECIMAL(5,2),
    average_weight DECIMAL(10,2), -- NULL for bodyweight
    average_duration_seconds DECIMAL(10,2), -- For time-based exercises
    progression_trend VARCHAR(20), -- 'improving', 'stable', 'declining', 'plateau'
    personal_record JSONB, -- Best performance: {"sets": 4, "reps": 15, "weight": 50, "date": "2024-01-15"}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_exercise_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, exercise_name, equipment_type) -- One record per exercise+equipment combo
);

-- Exercise chat conversations
CREATE TABLE IF NOT EXISTS exercise_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    conversation_title VARCHAR(200), -- Auto-generated or user-provided
    started_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    context_snapshot JSONB, -- Snapshot of user's workout state at conversation start
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_exercise_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual messages in conversations
CREATE TABLE IF NOT EXISTS exercise_conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    message_order INTEGER NOT NULL, -- Order within conversation
    metadata JSONB, -- Additional context: workout logs referenced, suggestions generated, etc.
    tokens_used INTEGER, -- For assistant messages
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_conversation_message FOREIGN KEY (conversation_id) REFERENCES exercise_conversations(id) ON DELETE CASCADE
);

-- Conversation embeddings for semantic search (RAG)
CREATE TABLE IF NOT EXISTS exercise_conversation_embeddings (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    message_id INTEGER, -- NULL if embedding is for entire conversation
    embedding TEXT, -- Store as JSON array string until vector type available
    text_chunk TEXT, -- The text that was embedded
    chunk_type VARCHAR(50), -- 'user_message', 'assistant_message', 'conversation_summary'
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_conversation_embedding FOREIGN KEY (conversation_id) REFERENCES exercise_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_embedding FOREIGN KEY (message_id) REFERENCES exercise_conversation_messages(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercise_routines_user_day ON exercise_routines(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_exercise_routines_user_active ON exercise_routines(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id, exercise_order);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_date ON exercise_logs(user_id, exercise_date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_routine ON exercise_logs(routine_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON exercise_logs(exercise_date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_log_entries_log ON exercise_log_entries(log_id, exercise_order);
CREATE INDEX IF NOT EXISTS idx_exercise_suggestions_user ON exercise_suggestions(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_suggestions_log_entry ON exercise_suggestions(log_entry_id);
CREATE INDEX IF NOT EXISTS idx_exercise_suggestions_log ON exercise_suggestions(log_id);
CREATE INDEX IF NOT EXISTS idx_exercise_history_user ON exercise_history(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_conversations_user ON exercise_conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_conversation_messages_conv ON exercise_conversation_messages(conversation_id, message_order);
CREATE INDEX IF NOT EXISTS idx_exercise_conversation_embeddings_conv ON exercise_conversation_embeddings(conversation_id);

-- Vector similarity search index (using pgvector extension)
-- Note: Commented out until pgvector extension is available
-- CREATE INDEX IF NOT EXISTS idx_exercise_conversation_embeddings_vector 
--     ON exercise_conversation_embeddings 
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exercise_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-update updated_at
CREATE TRIGGER trigger_exercise_routine_updated_at
    BEFORE UPDATE ON exercise_routines
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

CREATE TRIGGER trigger_routine_exercise_updated_at
    BEFORE UPDATE ON routine_exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

CREATE TRIGGER trigger_exercise_log_updated_at
    BEFORE UPDATE ON exercise_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

CREATE TRIGGER trigger_exercise_history_updated_at
    BEFORE UPDATE ON exercise_history
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

CREATE TRIGGER trigger_exercise_conversation_updated_at
    BEFORE UPDATE ON exercise_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_updated_at();

