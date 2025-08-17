-- Events table to track discovered, proposed, and booked events
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    date DATETIME NOT NULL,
    location_address TEXT,
    location_lat REAL,
    location_lng REAL,
    age_range_min INTEGER,
    age_range_max INTEGER,
    cost REAL DEFAULT 0,
    registration_url TEXT,
    registration_opens DATETIME,
    capacity_available INTEGER,
    capacity_total INTEGER,
    description TEXT,
    image_url TEXT,
    status TEXT CHECK(status IN ('discovered', 'monitoring', 'proposed', 'approved', 'rejected', 'ready_for_registration', 'booked', 'attended')) DEFAULT 'discovered',
    is_recurring BOOLEAN DEFAULT 0,
    previously_attended BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Social proof tracking
CREATE TABLE IF NOT EXISTS event_social_proof (
    event_id TEXT,
    instagram_posts TEXT, -- JSON array of post URLs
    yelp_rating REAL,
    google_rating REAL,
    influencer_mentions TEXT, -- JSON array of mentions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
);

-- Event scoring factors
CREATE TABLE IF NOT EXISTS event_scores (
    event_id TEXT,
    novelty_score REAL DEFAULT 0,
    urgency_score REAL DEFAULT 0,
    social_score REAL DEFAULT 0,
    match_score REAL DEFAULT 0,
    total_score REAL DEFAULT 0,
    scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
);

-- SMS approval tracking
CREATE TABLE IF NOT EXISTS sms_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    phone_number TEXT,
    message_sent TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    response_received TEXT,
    response_at DATETIME,
    status TEXT CHECK(status IN ('sent', 'approved', 'rejected', 'timeout')) DEFAULT 'sent',
    FOREIGN KEY (event_id) REFERENCES events (id)
);

-- Registration attempts and results
CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT 0,
    confirmation_number TEXT,
    error_message TEXT,
    screenshot_path TEXT,
    payment_required BOOLEAN DEFAULT 0,
    payment_amount REAL,
    payment_completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events (id)
);

-- Calendar event tracking
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    parent1_calendar_id TEXT,
    parent2_calendar_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
);

-- Event sources and scraping status
CREATE TABLE IF NOT EXISTS event_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    active BOOLEAN DEFAULT 1,
    last_scraped DATETIME,
    last_error TEXT,
    scrape_frequency_hours INTEGER DEFAULT 6,
    events_found_last_scan INTEGER DEFAULT 0
);

-- Venue tracking for novelty scoring
CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    visited BOOLEAN DEFAULT 0,
    first_visit_date DATETIME,
    visit_count INTEGER DEFAULT 0
);

-- Insert initial event sources
INSERT OR IGNORE INTO event_sources (name, url, scrape_frequency_hours) VALUES
('SF Recreation & Parks', 'https://www.sfrecpark.org/events/', 6),
('EventBrite Bay Area', 'https://www.eventbrite.com/d/ca--san-francisco/family-friendly/', 6),
('SF FunCheap', 'https://sf.funcheap.com/', 6),
('Children''s Creativity Museum', 'https://creativity.org/events/', 12),
('California Academy of Sciences', 'https://www.calacademy.org/events', 12),
('Exploratorium', 'https://www.exploratorium.edu/visit/calendar', 12),
('SF Zoo', 'https://www.sfzoo.org/events/', 12);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_cost ON events(cost);
CREATE INDEX IF NOT EXISTS idx_event_scores_total ON event_scores(total_score);
CREATE INDEX IF NOT EXISTS idx_sms_approvals_status ON sms_approvals(status);
CREATE INDEX IF NOT EXISTS idx_registrations_success ON registrations(success);