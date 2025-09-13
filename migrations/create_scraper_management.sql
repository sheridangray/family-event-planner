-- Create scrapers management table
CREATE TABLE IF NOT EXISTS scrapers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    class_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    target_domain VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create scraper statistics tracking table
CREATE TABLE IF NOT EXISTS scraper_stats (
    id SERIAL PRIMARY KEY,
    scraper_id INTEGER REFERENCES scrapers(id) ON DELETE CASCADE,
    discovery_run_id INTEGER,
    events_found INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    execution_time_ms INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create scraper requests table for user requests
CREATE TABLE IF NOT EXISTS scraper_requests (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    description TEXT,
    requester_info JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Insert existing scrapers
INSERT INTO scrapers (name, class_name, display_name, description, target_domain, enabled) VALUES 
('sf-rec-parks', 'SFRecParksScraper', 'SF Recreation & Parks', 'Discovers family activities and sports programs from San Francisco Recreation and Parks Department', 'sfrecpark.org', true),
('sf-library', 'SFLibraryScraper', 'SF Public Library', 'Finds events, story times, and educational programs at SF Public Library branches', 'sfpl.org', true),
('cal-academy', 'CalAcademyScraper', 'California Academy of Sciences', 'Discovers exhibits, planetarium shows, and educational events at Cal Academy', 'calacademy.org', true),
('chase-center', 'ChaseCenterScraper', 'Chase Center', 'Finds concerts, sports events, and family shows at Chase Center', 'chasecenter.com', true),
('funcheapsf', 'FunCheapSFScraper', 'Fun Cheap SF', 'Discovers free and affordable family events around San Francisco', 'funcheap.com', true),
('bayareakidfun', 'BayAreaKidFunScraper', 'Bay Area Kid Fun', 'Finds kid-friendly activities and events throughout the Bay Area', 'bayareakidfun.com', true),
('sanfran-kidsoutandabout', 'SanFranKidsOutAndAboutScraper', 'SF Kids Out and About', 'Discovers family events, activities, and attractions in San Francisco', 'kidsoutandabout.com', true),
('ybgfestival', 'YBGFestivalScraper', 'Yerba Buena Gardens Festival', 'Finds outdoor festivals, concerts, and cultural events at Yerba Buena Gardens', 'ybgfestival.org', true),
('exploratorium', 'ExploratoriumScraper', 'Exploratorium', 'Discovers interactive science exhibits, workshops, and special events', 'exploratorium.edu', true)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scrapers_enabled ON scrapers (enabled);
CREATE INDEX IF NOT EXISTS idx_scraper_stats_scraper_id ON scraper_stats (scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_stats_discovery_run_id ON scraper_stats (discovery_run_id);
CREATE INDEX IF NOT EXISTS idx_scraper_requests_status ON scraper_requests (status);
CREATE INDEX IF NOT EXISTS idx_scraper_requests_created_at ON scraper_requests (created_at);

-- Update trigger for scrapers table
CREATE OR REPLACE FUNCTION update_scrapers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scrapers_updated_at 
    BEFORE UPDATE ON scrapers 
    FOR EACH ROW EXECUTE FUNCTION update_scrapers_updated_at();