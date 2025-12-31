-- Migration: Create Time Pillar Tables
-- Introduces Tasks, Projects, Routines, and Focus Blocks

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'inbox' CHECK (status IN ('inbox', 'todo', 'doing', 'done', 'cancelled')),
    priority INTEGER DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
    
    due_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Recurrence (simplified RRULE-like)
    recurrence_rule TEXT, -- e.g. "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, -- For instances of recurring tasks
    
    tags TEXT[],
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Routines Table
-- Templates for repeatable focus blocks or sessions
CREATE TABLE IF NOT EXISTS routines (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50), -- e.g. "morning", "shutdown", "workout"
    default_duration_minutes INTEGER NOT NULL DEFAULT 30,
    
    steps JSONB DEFAULT '[]'::jsonb, -- Ordered list of steps
    preferred_times JSONB DEFAULT '[]'::jsonb, -- Preferred windows
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Focus Blocks Table (Extension of Events)
-- We'll add a type column to the existing events table and a focus_block_metadata table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'event' CHECK (event_type IN ('event', 'focus_block'));

CREATE TABLE IF NOT EXISTS focus_block_details (
    event_id VARCHAR(255) PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    
    focus_type VARCHAR(50), -- e.g. "deep_work", "admin", "family"
    routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
    
    execution_status VARCHAR(50) DEFAULT 'planned' CHECK (execution_status IN ('planned', 'in_progress', 'done', 'skipped')),
    actual_start_at TIMESTAMP,
    actual_end_at TIMESTAMP,
    
    linked_task_ids INTEGER[], -- Array of task IDs
    reflection_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_projects_household ON projects(household_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_routines_updated_at ON routines;
CREATE TRIGGER trigger_routines_updated_at BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
