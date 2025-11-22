-- Add extended health metrics to health_physical_metrics table

-- Vitals & Fitness
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS height_inches DECIMAL(5,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS vo2_max DECIMAL(5,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS heart_rate_variability DECIMAL(6,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS blood_oxygen DECIMAL(5,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS respiratory_rate DECIMAL(5,2);

-- Activity & Mobility
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS walking_speed DECIMAL(5,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS stand_hours INTEGER DEFAULT 0;

-- Body Composition
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS lean_body_mass DECIMAL(10,2);

-- Nutrition
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS calories_consumed DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS protein_grams DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS carbs_grams DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS fat_grams DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS sugar_grams DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS fiber_grams DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS water_oz DECIMAL(10,2);
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS caffeine_mg DECIMAL(10,2);

-- Mindfulness
ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS mindful_minutes INTEGER DEFAULT 0;

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_health_metrics_vo2_max ON health_physical_metrics(vo2_max);
CREATE INDEX IF NOT EXISTS idx_health_metrics_blood_oxygen ON health_physical_metrics(blood_oxygen);
CREATE INDEX IF NOT EXISTS idx_health_metrics_calories_consumed ON health_physical_metrics(calories_consumed);

