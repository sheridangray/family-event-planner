-- Migration: Create Food Pillar Tables
-- Introduces Recipes, Meal Plans, Grocery Lists, and Pantry

-- 1. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    source_url TEXT,
    image_url TEXT,
    
    servings_default INTEGER DEFAULT 2,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    
    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of structured ingredients
    steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings
    
    tags TEXT[],
    cuisine VARCHAR(100),
    meal_types TEXT[], -- e.g. ['breakfast', 'dinner']
    
    is_favorite BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Meal Plans Table
CREATE TABLE IF NOT EXISTS meal_plans (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    
    week_start_date DATE NOT NULL, -- The Sunday of the week
    
    -- Store plan items as a JSONB array for flexibility or separate table
    -- Choosing separate table for easier querying of specific days/meals
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(household_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS planned_meals (
    id SERIAL PRIMARY KEY,
    meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
    
    planned_date DATE NOT NULL,
    meal_type VARCHAR(50) NOT NULL, -- breakfast, lunch, dinner, snack
    
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    custom_meal_note TEXT, -- e.g. "Eat out", "Leftovers"
    
    servings_planned INTEGER,
    is_locked BOOLEAN DEFAULT false, -- Prevents regeneration
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Pantry Table
CREATE TABLE IF NOT EXISTS pantry_items (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2),
    unit VARCHAR(50),
    
    category VARCHAR(100), -- e.g. "produce", "meat", "spices"
    min_threshold DECIMAL(10, 2), -- For auto-adding to grocery list
    
    expires_at DATE,
    last_updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Grocery Lists Table
CREATE TABLE IF NOT EXISTS grocery_lists (
    id SERIAL PRIMARY KEY,
    household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
    meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL,
    
    name VARCHAR(255) DEFAULT 'Weekly Groceries',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grocery_items (
    id SERIAL PRIMARY KEY,
    grocery_list_id INTEGER REFERENCES grocery_lists(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2),
    unit VARCHAR(50),
    category VARCHAR(100),
    
    is_checked BOOLEAN DEFAULT false,
    source_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_household ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_household ON meal_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_pantry_household ON pantry_items(household_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_household ON grocery_lists(household_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_recipes_updated_at ON recipes;
CREATE TRIGGER trigger_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_meal_plans_updated_at ON meal_plans;
CREATE TRIGGER trigger_meal_plans_updated_at BEFORE UPDATE ON meal_plans FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();

DROP TRIGGER IF EXISTS trigger_grocery_lists_updated_at ON grocery_lists;
CREATE TRIGGER trigger_grocery_lists_updated_at BEFORE UPDATE ON grocery_lists FOR EACH ROW EXECUTE FUNCTION update_foundation_updated_at();
