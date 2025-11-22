const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

class PostgresDatabase {
  constructor() {
    this.pool = null;
  }

  async init() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required for PostgreSQL"
      );
    }

    this.pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });

    console.log("Connected to PostgreSQL database");
    await this.createTables();
  }

  async createTables() {
    const createTablesSQL = `
      -- Users table for multi-user authentication
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        image_url VARCHAR(500),
        role VARCHAR(50) DEFAULT 'user' CHECK(role IN ('admin', 'user')),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- OAuth tokens table for multi-user token storage
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL DEFAULT 'google',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expiry TIMESTAMP,
        scope TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, provider)
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(user_id, provider);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(255) PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        location_address TEXT,
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        age_range_min INTEGER DEFAULT 0,
        age_range_max INTEGER DEFAULT 18,
        cost DECIMAL(10, 2) DEFAULT 0,
        registration_url TEXT,
        registration_opens TIMESTAMP,
        capacity_available INTEGER,
        capacity_total INTEGER,
        description TEXT,
        image_url TEXT,
        status VARCHAR(50) DEFAULT 'discovered' CHECK (status IN ('discovered', 'proposed', 'approved', 'registering', 'registered', 'manual_registration_sent', 'registration_failed', 'rejected', 'cancelled')),
        is_recurring BOOLEAN DEFAULT FALSE,
        previously_attended BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_scores (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) REFERENCES events(id) ON DELETE CASCADE,
        novelty_score DECIMAL(5, 2) DEFAULT 0,
        urgency_score DECIMAL(5, 2) DEFAULT 0,
        social_score DECIMAL(5, 2) DEFAULT 0,
        match_score DECIMAL(5, 2) DEFAULT 0,
        total_score DECIMAL(5, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id)
      );

      CREATE TABLE IF NOT EXISTS sms_approvals (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) REFERENCES events(id) ON DELETE CASCADE,
        phone_number VARCHAR(100) NOT NULL,
        message_sent TEXT NOT NULL,
        response_received TEXT,
        response_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) REFERENCES events(id) ON DELETE CASCADE,
        success BOOLEAN DEFAULT FALSE,
        confirmation_number VARCHAR(255),
        error_message TEXT,
        screenshot_path TEXT,
        payment_required BOOLEAN DEFAULT FALSE,
        payment_amount DECIMAL(10, 2),
        payment_completed BOOLEAN DEFAULT FALSE,
        adapter_used VARCHAR(50) DEFAULT 'manual',
        triggered_by VARCHAR(50) DEFAULT 'manual',
        approval_id INTEGER REFERENCES sms_approvals(id),
        requires_manual_completion BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS venues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        address TEXT,
        visited BOOLEAN DEFAULT FALSE,
        first_visit_date TIMESTAMP,
        visit_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS family_members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        birthdate DATE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('parent', 'child', 'guardian')),
        emergency_contact BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_merges (
        id SERIAL PRIMARY KEY,
        primary_event_id VARCHAR(255) NOT NULL,
        merged_event_id VARCHAR(255) NOT NULL,
        merged_event_data JSONB NOT NULL,
        similarity_score DECIMAL(5, 2),
        merge_type VARCHAR(20) NOT NULL CHECK(merge_type IN ('exact', 'fuzzy')),
        merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (primary_event_id) REFERENCES events(id)
      );

      CREATE TABLE IF NOT EXISTS weather_cache (
        id SERIAL PRIMARY KEY,
        location TEXT NOT NULL,
        date TEXT NOT NULL,
        temperature DECIMAL(5, 2),
        condition TEXT,
        precipitation DECIMAL(5, 2),
        wind_speed DECIMAL(5, 2),
        is_outdoor_friendly BOOLEAN,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(location, date)
      );

      CREATE TABLE IF NOT EXISTS event_interactions (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        event_data JSONB NOT NULL,
        interaction_type VARCHAR(50) NOT NULL CHECK(interaction_type IN ('discovered', 'proposed', 'approved', 'rejected', 'registered', 'attended', 'cancelled')),
        interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        user_feedback TEXT,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS discovery_runs (
        id SERIAL PRIMARY KEY,
        trigger_type VARCHAR(20) NOT NULL CHECK(trigger_type IN ('manual', 'scheduled')),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        scrapers_count INTEGER DEFAULT 0,
        events_found INTEGER DEFAULT 0,
        events_saved INTEGER DEFAULT 0,
        events_duplicated INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS discovered_events (
        id SERIAL PRIMARY KEY,
        discovery_run_id INTEGER NOT NULL,
        scraper_name VARCHAR(100) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        event_title TEXT NOT NULL,
        event_date TIMESTAMP,
        event_cost DECIMAL(10, 2) DEFAULT 0,
        venue_name TEXT,
        event_data JSONB NOT NULL,
        is_duplicate BOOLEAN DEFAULT FALSE,
        duplicate_of VARCHAR(255),
        filter_results JSONB,
        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discovery_run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chatgpt_event_discoveries (
        id SERIAL PRIMARY KEY,
        date_searched TIMESTAMP NOT NULL,
        target_date DATE NOT NULL,
        search_context JSONB NOT NULL,
        events JSONB NOT NULL,
        metadata JSONB,
        interested_event_ranks INTEGER[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_family_members_role ON family_members(role);
      CREATE INDEX IF NOT EXISTS idx_family_members_active ON family_members(active);
      CREATE INDEX IF NOT EXISTS idx_event_scores_total ON event_scores(total_score);
      CREATE INDEX IF NOT EXISTS idx_event_merges_primary ON event_merges(primary_event_id);
      CREATE INDEX IF NOT EXISTS idx_event_merges_merged_at ON event_merges(merged_at);
      CREATE INDEX IF NOT EXISTS idx_event_interactions_event_id ON event_interactions(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_interactions_type ON event_interactions(interaction_type);
      CREATE INDEX IF NOT EXISTS idx_event_interactions_date ON event_interactions(interaction_date);
      CREATE INDEX IF NOT EXISTS idx_chatgpt_discoveries_date_searched ON chatgpt_event_discoveries(date_searched);
      CREATE INDEX IF NOT EXISTS idx_chatgpt_discoveries_target_date ON chatgpt_event_discoveries(target_date);

      -- Health tracking tables
      CREATE TABLE IF NOT EXISTS health_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        data_source VARCHAR(50) DEFAULT 'apple_health',
        last_sync_at TIMESTAMP,
        sync_frequency_hours INTEGER DEFAULT 24,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS health_physical_metrics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        metric_date DATE NOT NULL,
        steps INTEGER DEFAULT 0,
        distance_miles DECIMAL(10,2) DEFAULT 0,
        flights_climbed INTEGER DEFAULT 0,
        active_calories INTEGER DEFAULT 0,
        resting_calories INTEGER DEFAULT 0,
        exercise_minutes INTEGER DEFAULT 0,
        standing_hours INTEGER DEFAULT 0,
        resting_heart_rate INTEGER,
        heart_rate_variability DECIMAL(10,2),
        avg_heart_rate INTEGER,
        max_heart_rate INTEGER,
        weight_lbs DECIMAL(10,2),
        body_fat_percentage DECIMAL(5,2),
        bmi DECIMAL(5,2),
        sleep_hours DECIMAL(4,2),
        deep_sleep_hours DECIMAL(4,2),
        rem_sleep_hours DECIMAL(4,2),
        sleep_quality_score INTEGER,
        calories_consumed INTEGER,
        water_oz DECIMAL(10,2),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, metric_date)
      );

      CREATE TABLE IF NOT EXISTS health_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        goal_type VARCHAR(50) NOT NULL,
        target_value DECIMAL(10,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS health_sync_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sync_date TIMESTAMP DEFAULT NOW(),
        metrics_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        source VARCHAR(50) DEFAULT 'ios_shortcut'
      );

      CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_physical_metrics(user_id, metric_date DESC);
      CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON health_physical_metrics(metric_date DESC);
      CREATE INDEX IF NOT EXISTS idx_health_goals_user_active ON health_goals(user_id, active);
      CREATE INDEX IF NOT EXISTS idx_health_sync_logs_user ON health_sync_logs(user_id, sync_date DESC);
      CREATE INDEX IF NOT EXISTS idx_health_profiles_user ON health_profiles(user_id);
    `;

    await this.pool.query(createTablesSQL);
    console.log("Database tables created successfully");

    // Run migrations for existing databases to add missing columns
    await this.runMigrations();
  }

  async runMigrations() {
    try {
      // Add missing columns to events table if they don't exist
      const addColumnsSQL = `
        -- Add sources field to track multiple sources for merged events
        ALTER TABLE events ADD COLUMN IF NOT EXISTS sources TEXT;
        
        -- Add alternate URLs for events that were merged
        ALTER TABLE events ADD COLUMN IF NOT EXISTS alternate_urls TEXT;
        
        -- Add merge tracking fields
        ALTER TABLE events ADD COLUMN IF NOT EXISTS merge_count INTEGER DEFAULT 1;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS last_merged TIMESTAMP;
        
        -- Add fingerprint field for exact duplicate detection
        ALTER TABLE events ADD COLUMN IF NOT EXISTS fingerprint TEXT;
        
        -- Add discovery run tracking field
        ALTER TABLE events ADD COLUMN IF NOT EXISTS discovery_run_id INTEGER;
      `;

      await this.pool.query(addColumnsSQL);

      // Add indexes after columns are created
      const addIndexesSQL = `
        -- Create indexes for new columns
        CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON events(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_events_sources ON events(sources);
        CREATE INDEX IF NOT EXISTS idx_events_merge_count ON events(merge_count);
        CREATE INDEX IF NOT EXISTS idx_events_discovery_run_id ON events(discovery_run_id);
      `;

      await this.pool.query(addIndexesSQL);

      // Update existing events to have default values for new columns
      const updateDefaultsSQL = `
        UPDATE events SET 
          sources = jsonb_build_array(source),
          merge_count = 1,
          fingerprint = id
        WHERE sources IS NULL;
      `;

      await this.pool.query(updateDefaultsSQL);

      // Add extended health metrics columns (Migration 009)
      const addHealthMetricsSQL = `
        -- Vitals & Fitness
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS height_inches DECIMAL(5,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS vo2_max DECIMAL(5,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS blood_oxygen DECIMAL(5,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS respiratory_rate DECIMAL(5,2);
        
        -- Activity & Mobility
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS walking_speed DECIMAL(5,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS stand_hours INTEGER DEFAULT 0;
        
        -- Body Composition
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS lean_body_mass DECIMAL(10,2);
        
        -- Nutrition
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS protein_grams DECIMAL(10,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS carbs_grams DECIMAL(10,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS fat_grams DECIMAL(10,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS sugar_grams DECIMAL(10,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS fiber_grams DECIMAL(10,2);
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS caffeine_mg DECIMAL(10,2);
        
        -- Mindfulness
        ALTER TABLE health_physical_metrics ADD COLUMN IF NOT EXISTS mindful_minutes INTEGER DEFAULT 0;
      `;

      await this.pool.query(addHealthMetricsSQL);

      // Add indexes for new health metrics
      const addHealthMetricsIndexesSQL = `
        CREATE INDEX IF NOT EXISTS idx_health_metrics_vo2_max ON health_physical_metrics(vo2_max);
        CREATE INDEX IF NOT EXISTS idx_health_metrics_blood_oxygen ON health_physical_metrics(blood_oxygen);
        CREATE INDEX IF NOT EXISTS idx_health_metrics_calories_consumed ON health_physical_metrics(calories_consumed);
      `;

      await this.pool.query(addHealthMetricsIndexesSQL);

      // Initialize health profiles and goals for existing users
      await this.initializeHealthData();

      console.log("Database migrations completed successfully");
    } catch (error) {
      console.warn(
        "Migration warning (may be expected if columns already exist):",
        error.message
      );
    }
  }

  async initializeHealthData() {
    try {
      // Create default health profiles for active users without profiles
      const createProfilesSQL = `
        INSERT INTO health_profiles (user_id, data_source, active)
        SELECT id, 'apple_health', true
        FROM users
        WHERE active = true
        AND NOT EXISTS (
          SELECT 1 FROM health_profiles WHERE health_profiles.user_id = users.id
        );
      `;
      await this.pool.query(createProfilesSQL);

      // Create default health goals (10k steps, 30min exercise, 8h sleep)
      const createGoalsSQL = `
        INSERT INTO health_goals (user_id, goal_type, target_value, start_date, active)
        SELECT id, goal_data.type, goal_data.target, CURRENT_DATE, true
        FROM users
        CROSS JOIN (
          VALUES 
            ('steps', 10000),
            ('exercise_minutes', 30),
            ('sleep_hours', 8)
        ) AS goal_data(type, target)
        WHERE users.active = true
        AND NOT EXISTS (
          SELECT 1 FROM health_goals 
          WHERE health_goals.user_id = users.id 
          AND health_goals.goal_type = goal_data.type
        );
      `;
      await this.pool.query(createGoalsSQL);

      console.log("✅ Health data initialized for existing users");
    } catch (error) {
      console.warn("Health data initialization warning:", error.message);
    }
  }

  /**
   * Validate and sanitize event data before database insertion
   * @param {Object} event - The event to validate
   * @returns {Object} Validated and sanitized event
   */
  validateEventData(event) {
    const validated = { ...event };

    // Required fields validation
    if (!validated.id || typeof validated.id !== "string") {
      throw new Error("Event ID is required and must be a string");
    }
    if (!validated.source || typeof validated.source !== "string") {
      throw new Error("Event source is required and must be a string");
    }
    if (!validated.title || typeof validated.title !== "string") {
      throw new Error("Event title is required and must be a string");
    }
    if (!validated.date) {
      throw new Error("Event date is required");
    }

    // String field length limits based on database schema
    validated.id = String(validated.id).substring(0, 255);
    validated.source = String(validated.source).substring(0, 100);
    validated.title = String(validated.title).substring(0, 2000); // TEXT field, reasonable limit

    // Optional string fields with truncation
    if (validated.location?.address) {
      validated.location.address = String(validated.location.address).substring(
        0,
        2000
      );
    }
    if (validated.registrationUrl || validated.registration_url) {
      const url = validated.registrationUrl || validated.registration_url;
      validated.registrationUrl = String(url).substring(0, 2000);
    }
    if (validated.description) {
      validated.description = String(validated.description).substring(0, 5000); // Reasonable limit for TEXT
    }
    if (validated.imageUrl) {
      validated.imageUrl = String(validated.imageUrl).substring(0, 2000);
    }

    // Numeric field validation
    if (
      validated.location?.lat !== null &&
      validated.location?.lat !== undefined
    ) {
      const lat = parseFloat(validated.location.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        validated.location.lat = null; // Invalid latitude
      } else {
        validated.location.lat = lat;
      }
    }

    if (
      validated.location?.lng !== null &&
      validated.location?.lng !== undefined
    ) {
      const lng = parseFloat(validated.location.lng);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        validated.location.lng = null; // Invalid longitude
      } else {
        validated.location.lng = lng;
      }
    }

    // Age range validation
    if (
      validated.ageRange?.min !== null &&
      validated.ageRange?.min !== undefined
    ) {
      const ageMin = parseInt(validated.ageRange.min);
      validated.ageRange.min =
        isNaN(ageMin) || ageMin < 0 ? 0 : Math.min(ageMin, 100);
    }

    if (
      validated.ageRange?.max !== null &&
      validated.ageRange?.max !== undefined
    ) {
      const ageMax = parseInt(validated.ageRange.max);
      validated.ageRange.max =
        isNaN(ageMax) || ageMax < 0 ? 18 : Math.min(ageMax, 100);
    }

    // Cost validation
    if (validated.cost !== null && validated.cost !== undefined) {
      const cost = parseFloat(validated.cost);
      validated.cost =
        isNaN(cost) || cost < 0 ? 0 : Math.min(cost, 99999999.99); // DECIMAL(10,2) limit
    }

    // Capacity validation
    if (
      validated.currentCapacity?.available !== null &&
      validated.currentCapacity?.available !== undefined
    ) {
      const available = parseInt(validated.currentCapacity.available);
      validated.currentCapacity.available =
        isNaN(available) || available < 0
          ? null
          : Math.min(available, 2147483647); // INTEGER limit
    }

    if (
      validated.currentCapacity?.total !== null &&
      validated.currentCapacity?.total !== undefined
    ) {
      const total = parseInt(validated.currentCapacity.total);
      validated.currentCapacity.total =
        isNaN(total) || total < 0 ? null : Math.min(total, 2147483647); // INTEGER limit
    }

    // Date validation
    try {
      validated.date = new Date(validated.date);
      if (isNaN(validated.date.getTime())) {
        throw new Error("Invalid event date");
      }
    } catch (error) {
      throw new Error(`Invalid event date: ${error.message}`);
    }

    // Registration opens date validation
    if (validated.registrationOpens) {
      try {
        validated.registrationOpens = new Date(validated.registrationOpens);
        if (isNaN(validated.registrationOpens.getTime())) {
          validated.registrationOpens = null; // Optional field, set to null if invalid
        }
      } catch (error) {
        validated.registrationOpens = null;
      }
    }

    // Status validation
    const validStatuses = [
      "discovered",
      "proposed",
      "approved",
      "registering",
      "registered",
      "manual_registration_sent",
      "registration_failed",
      "rejected",
      "cancelled",
    ];
    if (validated.status && !validStatuses.includes(validated.status)) {
      validated.status = "discovered"; // Default to discovered if invalid
    }

    return validated;
  }

  async saveEvent(event) {
    // Validate and sanitize event data
    const validatedEvent = this.validateEventData(event);

    const sql = `
      INSERT INTO events (
        id, source, title, date, location_address, location_lat, location_lng,
        age_range_min, age_range_max, cost, registration_url, registration_opens,
        capacity_available, capacity_total, description, image_url, status,
        is_recurring, previously_attended, discovery_run_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        date = EXCLUDED.date,
        location_address = EXCLUDED.location_address,
        cost = EXCLUDED.cost,
        registration_url = EXCLUDED.registration_url,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const params = [
      validatedEvent.id,
      validatedEvent.source,
      validatedEvent.title,
      validatedEvent.date,
      validatedEvent.location?.address,
      validatedEvent.location?.lat,
      validatedEvent.location?.lng,
      validatedEvent.ageRange?.min,
      validatedEvent.ageRange?.max,
      validatedEvent.cost,
      validatedEvent.registrationUrl || validatedEvent.registration_url,
      validatedEvent.registrationOpens,
      validatedEvent.currentCapacity?.available,
      validatedEvent.currentCapacity?.total,
      validatedEvent.description,
      validatedEvent.imageUrl,
      validatedEvent.status || "discovered",
      validatedEvent.isRecurring || false,
      validatedEvent.previouslyAttended || false,
      validatedEvent.discovery_run_id || null,
    ];

    const result = await this.pool.query(sql, params);
    return result.rows[0]?.id;
  }

  async saveEventScore(eventId, scores) {
    const sql = `
      INSERT INTO event_scores (
        event_id, novelty_score, urgency_score, social_score, match_score, total_score
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_id) DO UPDATE SET
        novelty_score = EXCLUDED.novelty_score,
        urgency_score = EXCLUDED.urgency_score,
        social_score = EXCLUDED.social_score,
        match_score = EXCLUDED.match_score,
        total_score = EXCLUDED.total_score
      RETURNING id
    `;

    const params = [
      eventId,
      scores.noveltyScore,
      scores.urgencyScore,
      scores.socialScore,
      scores.matchScore,
      scores.totalScore,
    ];

    const result = await this.pool.query(sql, params);
    return result.rows[0]?.id;
  }

  async getEventsByStatus(status) {
    const sql = `
      SELECT e.*, es.total_score
      FROM events e
      LEFT JOIN event_scores es ON e.id = es.event_id
      WHERE e.status = $1
      ORDER BY es.total_score DESC NULLS LAST, e.date ASC
    `;

    const result = await this.pool.query(sql, [status]);
    return result.rows;
  }

  async updateEventStatus(eventId, status) {
    const sql = `UPDATE events SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`;
    const result = await this.pool.query(sql, [status, eventId]);
    return result.rowCount;
  }

  async saveSMSApproval(eventId, phoneNumber, message) {
    const sql = `
      INSERT INTO sms_approvals (event_id, phone_number, message_sent)
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    const result = await this.pool.query(sql, [eventId, phoneNumber, message]);
    return result.rows[0]?.id;
  }

  async updateSMSApproval(approvalId, response, status) {
    const sql = `
      UPDATE sms_approvals 
      SET response_received = $1, response_at = CURRENT_TIMESTAMP, status = $2
      WHERE id = $3
    `;

    const result = await this.pool.query(sql, [response, status, approvalId]);
    return result.rowCount;
  }

  // NEW UNIFIED NOTIFICATIONS METHODS

  /**
   * Save a notification (email or SMS) to the unified notifications table
   */
  async saveNotification(
    eventId,
    notificationType,
    recipient,
    subject,
    messageContent,
    messageId = null
  ) {
    const sql = `
      INSERT INTO notifications (
        event_id, notification_type, recipient, subject, 
        message_content, message_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'sent')
      RETURNING id
    `;

    const params = [
      eventId,
      notificationType,
      recipient,
      subject,
      messageContent,
      messageId,
    ];
    const result = await this.pool.query(sql, params);
    return result.rows[0]?.id;
  }

  /**
   * Update notification response
   */
  async updateNotificationResponse(notificationId, response, responseStatus) {
    const sql = `
      UPDATE notifications 
      SET response_received = $1, response_at = CURRENT_TIMESTAMP, 
          response_status = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;

    const result = await this.pool.query(sql, [
      response,
      responseStatus,
      responseStatus,
      notificationId,
    ]);
    return result.rowCount;
  }

  /**
   * Get pending notifications for a recipient
   */
  async getPendingNotifications(recipient, notificationType = null) {
    let sql = `
      SELECT n.*, e.title as event_title, e.date as event_date, e.cost as event_cost
      FROM notifications n
      LEFT JOIN events e ON n.event_id = e.id  
      WHERE n.recipient = $1 
      AND n.status IN ('sent', 'pending')
      AND n.created_at + INTERVAL '24 hours' > NOW()
    `;

    const params = [recipient];

    if (notificationType) {
      sql += ` AND n.notification_type = $2`;
      params.push(notificationType);
    }

    sql += ` ORDER BY n.created_at DESC`;

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * Get notifications by event ID
   */
  async getNotificationsByEventId(eventId) {
    const sql = `
      SELECT * FROM notifications 
      WHERE event_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(sql, [eventId]);
    return result.rows;
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(notificationId, status) {
    const sql = `
      UPDATE notifications 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await this.pool.query(sql, [status, notificationId]);
    return result.rowCount;
  }

  async saveRegistration(
    eventId,
    success,
    confirmationNumber,
    errorMessage,
    screenshotPath,
    paymentInfo
  ) {
    const sql = `
      INSERT INTO registrations (
        event_id, success, confirmation_number, error_message, 
        screenshot_path, payment_required, payment_amount, payment_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const params = [
      eventId,
      success,
      confirmationNumber,
      errorMessage,
      screenshotPath,
      paymentInfo?.required || false,
      paymentInfo?.amount || 0,
      paymentInfo?.completed || false,
    ];

    const result = await this.pool.query(sql, params);
    return result.rows[0]?.id;
  }

  async markVenueVisited(venueName, address) {
    const sql = `
      INSERT INTO venues (name, address, visited, first_visit_date, visit_count)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (name) DO UPDATE SET
        visited = true,
        visit_count = venues.visit_count + 1,
        first_visit_date = COALESCE(venues.first_visit_date, CURRENT_TIMESTAMP)
    `;

    const result = await this.pool.query(sql, [venueName, address]);
    return result.rowCount;
  }

  async isVenueVisited(venueName) {
    const sql = `SELECT visited FROM venues WHERE name = $1 AND visited = true`;
    const result = await this.pool.query(sql, [venueName]);
    return result.rows.length > 0;
  }

  async addFamilyMember(member) {
    const sql = `
      INSERT INTO family_members (name, email, phone, birthdate, role, emergency_contact)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const params = [
      member.name,
      member.email || null,
      member.phone || null,
      member.birthdate,
      member.role,
      member.emergency_contact || false,
    ];

    const result = await this.pool.query(sql, params);
    return result.rows[0].id;
  }

  async getRegistrationStats(timeframe = "24 hours") {
    const sql = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful,
        COUNT(CASE WHEN success = false THEN 1 END) as failed,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*)), 2)
          ELSE 100
        END as success_rate
      FROM registrations 
      WHERE created_at >= NOW() - INTERVAL '${timeframe}'
    `;

    const result = await this.pool.query(sql);
    const stats = result.rows[0] || {};

    return {
      totalAttempts: parseInt(stats.total_attempts) || 0,
      successful: parseInt(stats.successful) || 0,
      failed: parseInt(stats.failed) || 0,
      successRate: parseFloat(stats.success_rate) || 100,
    };
  }

  async getFamilyMembers(activeOnly = true) {
    const sql = activeOnly
      ? `SELECT * FROM family_members WHERE active = true ORDER BY role, birthdate`
      : `SELECT * FROM family_members ORDER BY role, birthdate`;
    const result = await this.pool.query(sql);
    return result.rows;
  }

  async getFamilyMembersByRole(role, activeOnly = true) {
    const sql = activeOnly
      ? `SELECT * FROM family_members WHERE role = $1 AND active = true ORDER BY birthdate`
      : `SELECT * FROM family_members WHERE role = $1 ORDER BY birthdate`;
    const result = await this.pool.query(sql, [role]);
    return result.rows;
  }

  async updateFamilyMember(id, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    const sql = `
      UPDATE family_members 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING id
    `;

    const params = [id, ...Object.values(updates)];
    const result = await this.pool.query(sql, params);
    return result.rowCount;
  }

  async recordEventMerge(
    primaryEventId,
    mergedEvent,
    similarityScore,
    mergeType
  ) {
    // First check if the primary event exists to avoid foreign key constraint violations
    const checkEventSql = `SELECT id FROM events WHERE id = $1`;
    const eventExists = await this.pool.query(checkEventSql, [primaryEventId]);

    if (eventExists.rows.length === 0) {
      this.logger.warn(
        `Cannot record merge: primary event ${primaryEventId} does not exist in database`
      );
      return null; // Return null instead of failing
    }

    const sql = `
      INSERT INTO event_merges (
        primary_event_id, merged_event_id, merged_event_data, 
        similarity_score, merge_type
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const params = [
      primaryEventId,
      mergedEvent.id,
      JSON.stringify(mergedEvent),
      similarityScore,
      mergeType,
    ];

    try {
      const result = await this.pool.query(sql, params);
      return result.rows[0].id;
    } catch (error) {
      this.logger.warn(`Failed to record event merge: ${error.message}`, {
        primaryEventId,
        mergedEventId: mergedEvent.id,
        mergeType,
      });
      return null; // Return null instead of throwing
    }
  }

  async getEventMergeHistory(eventId, limit = 10) {
    const sql = `
      SELECT * FROM event_merges 
      WHERE primary_event_id = $1 
      ORDER BY merged_at DESC 
      LIMIT $2
    `;

    const result = await this.pool.query(sql, [eventId, limit]);

    return result.rows.map((row) => ({
      ...row,
      mergedEventData: JSON.parse(row.merged_event_data),
    }));
  }

  async getEventById(id) {
    const sql = "SELECT * FROM events WHERE id = $1";
    const result = await this.pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  async getEventsInDateRange(startDate, endDate) {
    const sql =
      "SELECT * FROM events WHERE date BETWEEN $1 AND $2 ORDER BY date";
    const result = await this.pool.query(sql, [startDate, endDate]);
    return result.rows;
  }

  async getTopScoredEvents(limit = 10) {
    const sql = `
      SELECT e.*, es.total_score 
      FROM events e 
      LEFT JOIN event_scores es ON e.id = es.event_id 
      ORDER BY es.total_score DESC 
      LIMIT $1
    `;
    const result = await this.pool.query(sql, [limit]);
    return result.rows;
  }

  async getApprovalsByStatus(status) {
    const sql =
      "SELECT * FROM sms_approvals WHERE status = $1 ORDER BY created_at DESC";
    const result = await this.pool.query(sql, [status]);
    return result.rows;
  }

  async getRegistrationHistory(eventId) {
    const sql =
      "SELECT * FROM registrations WHERE event_id = $1 ORDER BY created_at DESC";
    const result = await this.pool.query(sql, [eventId]);
    return result.rows;
  }

  async trackVenueVisit(venueName, address) {
    const sql = `
      INSERT INTO venues (name, address, visited, first_visit_date, visit_count) 
      VALUES ($1, $2, true, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (name) DO UPDATE SET 
        visit_count = venues.visit_count + 1,
        visited = true
      RETURNING id
    `;
    const result = await this.pool.query(sql, [venueName, address]);
    return result.rows[0].id;
  }

  async hasVisitedVenue(venueName) {
    const sql = "SELECT visited FROM venues WHERE name = $1";
    const result = await this.pool.query(sql, [venueName]);
    return result.rows[0]?.visited || false;
  }

  async getVenueVisitCount(venueName) {
    const sql = "SELECT visit_count FROM venues WHERE name = $1";
    const result = await this.pool.query(sql, [venueName]);
    return result.rows[0]?.visit_count || 0;
  }

  async cleanupOldEvents(daysToKeep = 90) {
    const sql = "DELETE FROM events WHERE created_at < NOW() - INTERVAL $1 day";
    const result = await this.pool.query(sql, [daysToKeep]);
    return result.rowCount;
  }

  async getEventStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'discovered' THEN 1 END) as discovered,
        COUNT(CASE WHEN status = 'proposed' THEN 1 END) as proposed,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'booked' THEN 1 END) as booked,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        AVG(cost) as avg_cost,
        COUNT(CASE WHEN cost = 0 THEN 1 END) as free_events,
        COUNT(CASE WHEN cost > 0 THEN 1 END) as paid_events
      FROM events
    `;
    const result = await this.pool.query(sql);
    return result.rows[0];
  }

  async saveFamilyMember(member) {
    const sql = `
      INSERT INTO family_members (name, email, phone, birthdate, role, emergency_contact, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        birthdate = EXCLUDED.birthdate,
        role = EXCLUDED.role,
        emergency_contact = EXCLUDED.emergency_contact,
        active = EXCLUDED.active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    const result = await this.pool.query(sql, [
      member.name,
      member.email,
      member.phone,
      member.birthdate,
      member.role,
      member.emergencyContact || false,
      member.active !== false,
    ]);
    return result.rows[0].id;
  }

  async getFamilyMemberById(id) {
    const sql = "SELECT * FROM family_members WHERE id = $1";
    const result = await this.pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  async getEventInteractions(limit = 1000) {
    const sql = `
      SELECT * FROM event_interactions 
      ORDER BY interaction_date DESC 
      LIMIT $1
    `;
    const result = await this.pool.query(sql, [limit]);
    return result.rows.map((row) => ({
      ...row,
      event: JSON.parse(row.event_data),
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  async cacheWeatherData(location, date, weatherData) {
    const sql = `
      INSERT INTO weather_cache (
        location, date, temperature, condition, precipitation, 
        wind_speed, is_outdoor_friendly
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (location, date) DO UPDATE SET
        temperature = EXCLUDED.temperature,
        condition = EXCLUDED.condition,
        precipitation = EXCLUDED.precipitation,
        wind_speed = EXCLUDED.wind_speed,
        is_outdoor_friendly = EXCLUDED.is_outdoor_friendly,
        fetched_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    const result = await this.pool.query(sql, [
      location,
      date,
      weatherData.temperature,
      weatherData.condition,
      weatherData.precipitation,
      weatherData.windSpeed,
      weatherData.isOutdoorFriendly,
    ]);
    return result.rows[0].id;
  }

  async getCachedWeatherData(location, date) {
    const sql = `
      SELECT * FROM weather_cache 
      WHERE location = $1 AND date = $2 
      AND fetched_at > NOW() - INTERVAL '6 hours'
    `;
    const result = await this.pool.query(sql, [location, date]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      temperature: parseFloat(row.temperature),
      condition: row.condition,
      precipitation: parseFloat(row.precipitation),
      windSpeed: parseFloat(row.wind_speed),
      isOutdoorFriendly: row.is_outdoor_friendly,
    };
  }

  async query(sql, params = []) {
    return await this.pool.query(sql, params);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("Database connection closed");
    }
  }

  // Discovery Runs methods
  async createDiscoveryRun(triggerType = "manual") {
    const sql = `
      INSERT INTO discovery_runs (trigger_type, started_at, status)
      VALUES ($1, CURRENT_TIMESTAMP, 'running')
      RETURNING id
    `;
    const result = await this.pool.query(sql, [triggerType]);
    return result.rows[0].id;
  }

  async updateDiscoveryRun(runId, updates) {
    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    Object.entries(updates).forEach(([key, value]) => {
      updateFields.push(`${key} = $${paramCounter}`);
      values.push(value);
      paramCounter++;
    });

    if (updateFields.length === 0) return;

    const sql = `
      UPDATE discovery_runs 
      SET ${updateFields.join(", ")}, completed_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCounter}
    `;
    values.push(runId);

    await this.pool.query(sql, values);
  }

  async getDiscoveryRuns(limit = 10) {
    const sql = `
      SELECT * FROM discovery_runs 
      ORDER BY started_at DESC 
      LIMIT $1
    `;
    const result = await this.pool.query(sql, [limit]);
    return result.rows;
  }

  async getLatestDiscoveryRunId() {
    const sql = `
      SELECT id FROM discovery_runs 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(sql);
    return result.rows[0]?.id || 0;
  }

  // Discovered Events methods
  async saveDiscoveredEvent(
    discoveryRunId,
    scraperName,
    event,
    isDuplicate = false,
    duplicateOf = null,
    filterResults = null
  ) {
    const sql = `
      INSERT INTO discovered_events (
        discovery_run_id, scraper_name, event_id, event_title, event_date, 
        event_cost, venue_name, event_data, is_duplicate, duplicate_of, filter_results
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;
    const result = await this.pool.query(sql, [
      discoveryRunId,
      scraperName,
      event.id,
      event.title,
      event.date,
      event.cost || 0,
      event.venue_name || event.location?.name,
      JSON.stringify(event),
      isDuplicate,
      duplicateOf,
      filterResults ? JSON.stringify(filterResults) : null,
    ]);
    return result.rows[0].id;
  }

  async getDiscoveredEventsByRun(discoveryRunId) {
    const sql = `
      SELECT * FROM discovered_events 
      WHERE discovery_run_id = $1 
      ORDER BY discovered_at DESC
    `;
    const result = await this.pool.query(sql, [discoveryRunId]);
    return result.rows;
  }

  async getDiscoveredEventsByRunAndScraper(discoveryRunId, scraperName) {
    const sql = `
      SELECT * FROM discovered_events 
      WHERE discovery_run_id = $1 AND scraper_name = $2
      ORDER BY discovered_at DESC
    `;
    const result = await this.pool.query(sql, [discoveryRunId, scraperName]);
    return result.rows;
  }

  // ===== OAuth Token Management Methods =====

  async getOAuthTokens(userId, provider = "google") {
    const sql = `
      SELECT * FROM oauth_tokens 
      WHERE user_id = $1 AND provider = $2
    `;
    const result = await this.pool.query(sql, [userId, provider]);

    if (result.rows.length === 0) {
      throw new Error(
        `No OAuth tokens found for user ${userId} with provider ${provider}`
      );
    }

    const row = result.rows[0];
    return {
      ...row,
      expiry_date: parseInt(row.expiry_date), // Ensure it's a number for JavaScript Date
    };
  }

  async saveOAuthTokens(userId, provider, tokens) {
    const sql = `
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_type, scope, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await this.pool.query(sql, [
      userId,
      provider,
      tokens.access_token,
      tokens.refresh_token,
      tokens.token_type || "Bearer",
      tokens.scope,
      tokens.expiry_date,
    ]);

    return result.rows[0].id;
  }

  async updateOAuthTokens(userId, provider, tokens) {
    const sql = `
      UPDATE oauth_tokens 
      SET access_token = $3, refresh_token = $4, token_type = $5, scope = $6, expiry_date = $7, updated_at = NOW()
      WHERE user_id = $1 AND provider = $2
      RETURNING id
    `;

    const result = await this.pool.query(sql, [
      userId,
      provider,
      tokens.access_token,
      tokens.refresh_token,
      tokens.token_type || "Bearer",
      tokens.scope,
      tokens.expiry_date,
    ]);

    if (result.rows.length === 0) {
      throw new Error(
        `No OAuth tokens found to update for user ${userId} with provider ${provider}`
      );
    }

    return result.rows[0].id;
  }

  async deleteOAuthTokens(userId, provider = "google") {
    const sql = `DELETE FROM oauth_tokens WHERE user_id = $1 AND provider = $2`;
    const result = await this.pool.query(sql, [userId, provider]);
    return result.rowCount > 0;
  }

  async isUserAuthenticated(userId, provider = "google") {
    try {
      const sql = `
        SELECT access_token, refresh_token, expiry_date 
        FROM oauth_tokens 
        WHERE user_id = $1 AND provider = $2
      `;
      const result = await this.pool.query(sql, [userId, provider]);

      if (result.rows.length === 0) {
        return false;
      }

      const token = result.rows[0];

      // Check if token is not expired (with 5 minute buffer)
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5 minutes
      const isValid = now < token.expiry_date - buffer;

      // If expired but we have a refresh token, trigger auto-refresh via GmailClient
      if (!isValid && token.refresh_token) {
        try {
          const { GmailClient } = require("../mcp/gmail-client");
          const Database = require("../database");

          // Get logger from global or use console
          const logger = global.appLogger || console;

          const database = new Database();
          await database.init();
          const gmailClient = new GmailClient(logger, database);

          // This will auto-refresh and save to database
          const refreshed = await gmailClient.isUserAuthenticated(userId);
          return refreshed;
        } catch (refreshError) {
          console.error(
            `Failed to auto-refresh token for user ${userId}:`,
            refreshError.message
          );
          return false;
        }
      }

      return isValid;
    } catch (error) {
      return false;
    }
  }

  async getAllUserAuthStatus() {
    const sql = `
      SELECT u.id, u.email, u.name, u.role,
             ot.expiry_date, ot.updated_at, ot.refresh_token
      FROM users u
      LEFT JOIN oauth_tokens ot ON u.id = ot.user_id AND ot.provider = 'google'
      WHERE u.active = true
      ORDER BY u.id
    `;

    const result = await this.pool.query(sql);

    // Use the auto-refresh version of isUserAuthenticated for each user
    const statusPromises = result.rows.map(async (row) => {
      const isAuthenticated = row.expiry_date
        ? await this.isUserAuthenticated(row.id, "google")
        : false;

      return {
        userId: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isAuthenticated: isAuthenticated,
        tokenExpiryDate: row.expiry_date
          ? new Date(parseInt(row.expiry_date))
          : null,
        lastUpdated: row.updated_at,
      };
    });

    return await Promise.all(statusPromises);
  }

  async getUserIdByEmail(email) {
    const sql = `SELECT id FROM users WHERE email = $1 AND active = true`;
    const result = await this.pool.query(sql, [email]);
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  async logOAuthActivity(
    userId,
    action,
    provider,
    success,
    errorMessage = null
  ) {
    const sql = `
      INSERT INTO oauth_audit_log (user_id, action, provider, success, error_message)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(sql, [
      userId,
      action,
      provider,
      success,
      errorMessage,
    ]);
  }

  // ===== User Management Methods =====

  async createUser(email, name, role = "user") {
    const sql = `
      INSERT INTO users (email, name, role)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, role, created_at
    `;
    const result = await this.pool.query(sql, [email, name, role]);
    return result.rows[0];
  }

  async getUserById(userId) {
    const sql = `SELECT * FROM users WHERE id = $1 AND active = true`;
    const result = await this.pool.query(sql, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getUserByEmail(email) {
    const sql = `SELECT * FROM users WHERE email = $1 AND active = true`;
    const result = await this.pool.query(sql, [email]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getAllUsers(activeOnly = true) {
    const sql = activeOnly
      ? `SELECT * FROM users WHERE active = true ORDER BY id`
      : `SELECT * FROM users ORDER BY id`;
    const result = await this.pool.query(sql);
    return result.rows;
  }
}

module.exports = PostgresDatabase;
