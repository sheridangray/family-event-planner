-- Health profiles for tracking sync status
CREATE TABLE IF NOT EXISTS health_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data_source VARCHAR(50) DEFAULT 'apple_health',
    last_sync_at TIMESTAMP,
    sync_frequency_hours INTEGER DEFAULT 24,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_health_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Physical health metrics - daily aggregated data
CREATE TABLE IF NOT EXISTS health_physical_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Activity metrics
    steps INTEGER DEFAULT 0,
    distance_miles DECIMAL(10,2) DEFAULT 0,
    flights_climbed INTEGER DEFAULT 0,
    active_calories INTEGER DEFAULT 0,
    resting_calories INTEGER DEFAULT 0,
    
    -- Exercise metrics
    exercise_minutes INTEGER DEFAULT 0,
    standing_hours INTEGER DEFAULT 0,
    
    -- Heart metrics
    resting_heart_rate INTEGER,
    heart_rate_variability DECIMAL(10,2),
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    
    -- Body metrics
    weight_lbs DECIMAL(10,2),
    body_fat_percentage DECIMAL(5,2),
    bmi DECIMAL(5,2),
    
    -- Sleep metrics
    sleep_hours DECIMAL(4,2),
    deep_sleep_hours DECIMAL(4,2),
    rem_sleep_hours DECIMAL(4,2),
    sleep_quality_score INTEGER, -- 0-100
    
    -- Nutrition (if tracked)
    calories_consumed INTEGER,
    water_oz DECIMAL(10,2),
    
    -- Raw data (for flexibility)
    raw_data JSONB, -- Store any additional metrics
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_health_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, metric_date)
);

-- Health goals and targets
CREATE TABLE IF NOT EXISTS health_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    goal_type VARCHAR(50) NOT NULL, -- 'steps', 'exercise_minutes', 'sleep_hours', 'weight', etc.
    target_value DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_health_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Health sync logs for debugging
CREATE TABLE IF NOT EXISTS health_sync_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    sync_date TIMESTAMP DEFAULT NOW(),
    metrics_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'partial', 'failed'
    error_message TEXT,
    source VARCHAR(50) DEFAULT 'ios_shortcut',
    CONSTRAINT fk_health_sync_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_physical_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON health_physical_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_goals_user_active ON health_goals(user_id, active);
CREATE INDEX IF NOT EXISTS idx_health_sync_logs_user ON health_sync_logs(user_id, sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_profiles_user ON health_profiles(user_id);

-- Insert default health profile for existing users
INSERT INTO health_profiles (user_id, data_source, active)
SELECT id, 'apple_health', true
FROM users
WHERE active = true
ON CONFLICT DO NOTHING;

-- Insert default health goals (10k steps, 30min exercise, 8h sleep)
INSERT INTO health_goals (user_id, goal_type, target_value, start_date, active)
SELECT id, 'steps', 10000, CURRENT_DATE, true
FROM users
WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO health_goals (user_id, goal_type, target_value, start_date, active)
SELECT id, 'exercise_minutes', 30, CURRENT_DATE, true
FROM users
WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO health_goals (user_id, goal_type, target_value, start_date, active)
SELECT id, 'sleep_hours', 8, CURRENT_DATE, true
FROM users
WHERE active = true
ON CONFLICT DO NOTHING;
