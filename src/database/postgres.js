const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class PostgresDatabase {
  constructor() {
    this.pool = null;
  }

  async init() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }

    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('Connected to PostgreSQL database');
    await this.createTables();
  }

  async createTables() {
    const createTablesSQL = `
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
        status VARCHAR(50) DEFAULT 'discovered',
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
        phone_number VARCHAR(20) NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_family_members_role ON family_members(role);
      CREATE INDEX IF NOT EXISTS idx_family_members_active ON family_members(active);
      CREATE INDEX IF NOT EXISTS idx_event_scores_total ON event_scores(total_score);
      CREATE INDEX IF NOT EXISTS idx_event_merges_primary ON event_merges(primary_event_id);
      CREATE INDEX IF NOT EXISTS idx_event_merges_merged_at ON event_merges(merged_at);
    `;

    await this.pool.query(createTablesSQL);
    console.log('Database tables created successfully');
  }

  async saveEvent(event) {
    const sql = `
      INSERT INTO events (
        id, source, title, date, location_address, location_lat, location_lng,
        age_range_min, age_range_max, cost, registration_url, registration_opens,
        capacity_available, capacity_total, description, image_url, status,
        is_recurring, previously_attended, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        date = EXCLUDED.date,
        location_address = EXCLUDED.location_address,
        cost = EXCLUDED.cost,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const params = [
      event.id, event.source, event.title, event.date, event.location?.address,
      event.location?.lat, event.location?.lng, event.ageRange?.min, event.ageRange?.max,
      event.cost, event.registrationUrl, event.registrationOpens,
      event.currentCapacity?.available, event.currentCapacity?.total,
      event.description, event.imageUrl, event.status || 'discovered',
      event.isRecurring || false, event.previouslyAttended || false
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
      eventId, scores.noveltyScore, scores.urgencyScore, 
      scores.socialScore, scores.matchScore, scores.totalScore
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

  async saveRegistration(eventId, success, confirmationNumber, errorMessage, screenshotPath, paymentInfo) {
    const sql = `
      INSERT INTO registrations (
        event_id, success, confirmation_number, error_message, 
        screenshot_path, payment_required, payment_amount, payment_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const params = [
      eventId, success, confirmationNumber, errorMessage, screenshotPath,
      paymentInfo?.required || false, paymentInfo?.amount || 0, paymentInfo?.completed || false
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
      member.emergency_contact || false
    ];
    
    const result = await this.pool.query(sql, params);
    return result.rows[0].id;
  }

  async getRegistrationStats(timeframe = '24 hours') {
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
      successRate: parseFloat(stats.success_rate) || 100
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
      .join(', ');
    
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

  async recordEventMerge(primaryEventId, mergedEvent, similarityScore, mergeType) {
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
      mergeType
    ];

    const result = await this.pool.query(sql, params);
    return result.rows[0].id;
  }

  async getEventMergeHistory(eventId, limit = 10) {
    const sql = `
      SELECT * FROM event_merges 
      WHERE primary_event_id = $1 
      ORDER BY merged_at DESC 
      LIMIT $2
    `;

    const result = await this.pool.query(sql, [eventId, limit]);
    
    return result.rows.map(row => ({
      ...row,
      mergedEventData: JSON.parse(row.merged_event_data)
    }));
  }

  async getEventById(id) {
    const sql = 'SELECT * FROM events WHERE id = $1';
    const result = await this.pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  async getEventsInDateRange(startDate, endDate) {
    const sql = 'SELECT * FROM events WHERE date BETWEEN $1 AND $2 ORDER BY date';
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
    const sql = 'SELECT * FROM sms_approvals WHERE status = $1 ORDER BY created_at DESC';
    const result = await this.pool.query(sql, [status]);
    return result.rows;
  }

  async getRegistrationHistory(eventId) {
    const sql = 'SELECT * FROM registrations WHERE event_id = $1 ORDER BY created_at DESC';
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
    const sql = 'SELECT visited FROM venues WHERE name = $1';
    const result = await this.pool.query(sql, [venueName]);
    return result.rows[0]?.visited || false;
  }

  async getVenueVisitCount(venueName) {
    const sql = 'SELECT visit_count FROM venues WHERE name = $1';
    const result = await this.pool.query(sql, [venueName]);
    return result.rows[0]?.visit_count || 0;
  }

  async cleanupOldEvents(daysToKeep = 90) {
    const sql = 'DELETE FROM events WHERE created_at < NOW() - INTERVAL $1 day';
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
      member.name, member.email, member.phone, member.birthdate,
      member.role, member.emergencyContact || false, member.active !== false
    ]);
    return result.rows[0].id;
  }

  async getFamilyMemberById(id) {
    const sql = 'SELECT * FROM family_members WHERE id = $1';
    const result = await this.pool.query(sql, [id]);
    return result.rows[0] || null;
  }

  async query(sql, params = []) {
    return await this.pool.query(sql, params);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }
}

module.exports = PostgresDatabase;