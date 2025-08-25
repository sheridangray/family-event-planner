const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const PostgresDatabase = require('./postgres');

class Database {
  constructor() {
    // Use PostgreSQL in production if DATABASE_URL is available, otherwise fallback to SQLite
    if (process.env.DATABASE_URL) {
      this.usePostgres = true;
      this.postgres = new PostgresDatabase();
      this.db = null;
    } else {
      this.usePostgres = false;
      // Use /tmp directory in production (Render), local data directory in development
      const isProduction = process.env.NODE_ENV === 'production';
      this.dbPath = isProduction 
        ? '/tmp/events.db' 
        : path.join(__dirname, '../../data/events.db');
      this.db = null;
    }
  }

  async init() {
    if (this.usePostgres) {
      return await this.postgres.init();
    }

    // SQLite fallback
    // Ensure directory exists in development mode
    if (process.env.NODE_ENV !== 'production') {
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Database tables created successfully');
        
        // Apply deduplication migration
        this.applyDeduplicationMigration().then(resolve).catch(reject);
      });
    });
  }

  async applyDeduplicationMigration() {
    const migrationPath = path.join(__dirname, 'migrations/add-deduplication-fields.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log('Deduplication migration file not found, skipping');
      return;
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      this.db.exec(migration, (err) => {
        if (err) {
          // Migration might fail if columns already exist, which is OK
          console.log('Deduplication migration completed (some operations may have been skipped)');
          resolve();
        } else {
          console.log('Deduplication migration applied successfully');
          resolve();
        }
      });
    });
  }

  async saveEvent(event) {
    if (this.usePostgres) {
      return await this.postgres.saveEvent(event);
    }

    const sql = `
      INSERT OR REPLACE INTO events (
        id, source, title, date, location_address, location_lat, location_lng,
        age_range_min, age_range_max, cost, registration_url, registration_opens,
        capacity_available, capacity_total, description, image_url, status,
        is_recurring, previously_attended, sources, alternate_urls, merge_count,
        last_merged, fingerprint, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      event.id, event.source, event.title, event.date, event.location?.address,
      event.location?.lat, event.location?.lng, event.ageRange?.min, event.ageRange?.max,
      event.cost, event.registrationUrl, event.registrationOpens,
      event.currentCapacity?.available, event.currentCapacity?.total,
      event.description, event.imageUrl, event.status || 'discovered',
      event.isRecurring || false, event.previouslyAttended || false,
      JSON.stringify(event.sources || [event.source]),
      JSON.stringify(event.alternateUrls || []),
      event.mergeCount || 1,
      event.lastMerged || null,
      event.fingerprint || event.id
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async saveEventScore(eventId, scores) {
    if (this.usePostgres) {
      return await this.postgres.saveEventScore(eventId, scores);
    }

    const sql = `
      INSERT OR REPLACE INTO event_scores (
        event_id, novelty_score, urgency_score, social_score, match_score, total_score
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      eventId, scores.noveltyScore, scores.urgencyScore, 
      scores.socialScore, scores.matchScore, scores.totalScore
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getEventsByStatus(status) {
    if (this.usePostgres) {
      return await this.postgres.getEventsByStatus(status);
    }

    const sql = `
      SELECT e.*, es.total_score
      FROM events e
      LEFT JOIN event_scores es ON e.id = es.event_id
      WHERE e.status = ?
      ORDER BY es.total_score DESC, e.date ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [status], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async updateEventStatus(eventId, status) {
    if (this.usePostgres) {
      return await this.postgres.updateEventStatus(eventId, status);
    }

    const sql = `UPDATE events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [status, eventId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async saveSMSApproval(eventId, phoneNumber, message) {
    const sql = `
      INSERT INTO sms_approvals (event_id, phone_number, message_sent)
      VALUES (?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [eventId, phoneNumber, message], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async updateSMSResponse(approvalId, response, status) {
    const sql = `
      UPDATE sms_approvals 
      SET response_received = ?, response_at = CURRENT_TIMESTAMP, status = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [response, status, approvalId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async saveRegistration(registration) {
    const sql = `
      INSERT INTO registrations (
        event_id, success, confirmation_number, error_message, 
        screenshot_path, payment_required, payment_amount, payment_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      registration.eventId, registration.success, registration.confirmationNumber,
      registration.errorMessage, registration.screenshotPath, registration.paymentRequired,
      registration.paymentAmount, registration.paymentCompleted || false
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async markVenueVisited(venueName, address) {
    const sql = `
      INSERT OR REPLACE INTO venues (name, address, visited, first_visit_date, visit_count)
      VALUES (?, ?, 1, COALESCE((SELECT first_visit_date FROM venues WHERE name = ?), CURRENT_TIMESTAMP),
              COALESCE((SELECT visit_count FROM venues WHERE name = ?), 0) + 1)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [venueName, address, venueName, venueName], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async isVenueVisited(venueName) {
    const sql = `SELECT visited FROM venues WHERE name = ? AND visited = 1`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [venueName], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(!!row);
      });
    });
  }

  async recordEventInteraction(eventId, interactionType, metadata = {}) {
    if (this.usePostgres) {
      return await this.postgres.recordEventInteraction(eventId, interactionType, metadata);
    }

    // Get event data for context
    const eventSql = `SELECT * FROM events WHERE id = ?`;
    const event = await new Promise((resolve, reject) => {
      this.db.get(eventSql, [eventId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const sql = `
      INSERT INTO event_interactions (event_id, event_data, interaction_type, metadata)
      VALUES (?, ?, ?, ?)
    `;
    
    const params = [
      eventId,
      JSON.stringify(event),
      interactionType,
      JSON.stringify(metadata)
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getEventInteractions(limit = 1000) {
    if (this.usePostgres) {
      return await this.postgres.getEventInteractions(limit);
    }

    const sql = `
      SELECT event_id, event_data, interaction_type, interaction_date, metadata, user_feedback
      FROM event_interactions
      ORDER BY interaction_date DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Parse JSON data
        const interactions = rows.map(row => ({
          ...row,
          event: JSON.parse(row.event_data),
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }));
        
        resolve(interactions);
      });
    });
  }

  async cacheWeatherData(location, date, weatherData) {
    if (this.usePostgres) {
      return await this.postgres.cacheWeatherData(location, date, weatherData);
    }

    const sql = `
      INSERT OR REPLACE INTO weather_cache 
      (location, date, temperature, condition, precipitation, wind_speed, is_outdoor_friendly, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      location,
      date,
      weatherData.temperature,
      weatherData.condition,
      weatherData.precipitation,
      weatherData.windSpeed,
      weatherData.isOutdoorFriendly
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getCachedWeatherData(location, date) {
    if (this.usePostgres) {
      return await this.postgres.getCachedWeatherData(location, date);
    }

    const sql = `
      SELECT temperature, condition, precipitation, wind_speed, is_outdoor_friendly, fetched_at
      FROM weather_cache
      WHERE location = ? AND date = ?
      AND datetime(fetched_at, '+6 hours') > datetime('now')
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [location, date], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row) {
          resolve({
            temperature: row.temperature,
            condition: row.condition,
            precipitation: row.precipitation,
            windSpeed: row.wind_speed,
            isOutdoorFriendly: !!row.is_outdoor_friendly
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async addFamilyMember(member) {
    if (this.usePostgres) {
      return await this.postgres.addFamilyMember(member);
    }

    const sql = `
      INSERT INTO family_members (name, email, phone, birthdate, role, emergency_contact)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      member.name,
      member.email || null,
      member.phone || null,
      member.birthdate,
      member.role,
      member.emergencyContact || false
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getFamilyMembers(activeOnly = true) {
    if (this.usePostgres) {
      return await this.postgres.getFamilyMembers(activeOnly);
    }

    const sql = activeOnly 
      ? `SELECT * FROM family_members WHERE active = 1 ORDER BY role, birthdate`
      : `SELECT * FROM family_members ORDER BY role, birthdate`;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getFamilyMembersByRole(role, activeOnly = true) {
    if (this.usePostgres) {
      return await this.postgres.getFamilyMembersByRole(role, activeOnly);
    }

    const sql = activeOnly
      ? `SELECT * FROM family_members WHERE role = ? AND active = 1 ORDER BY birthdate`
      : `SELECT * FROM family_members WHERE role = ? ORDER BY birthdate`;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [role], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async updateFamilyMember(id, updates) {
    if (this.usePostgres) {
      return await this.postgres.updateFamilyMember(id, updates);
    }

    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const sql = `
      UPDATE family_members 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    const params = [...Object.values(updates), id];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async deactivateFamilyMember(id) {
    return this.updateFamilyMember(id, { active: false });
  }

  async getRegistrationStats(timeframe = '24 hours') {
    if (this.usePostgres) {
      return await this.postgres.getRegistrationStats(timeframe);
    }

    const timeframeSql = this.getTimeframeSql(timeframe);
    
    const sql = `
      SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        COUNT(DISTINCT event_id) as unique_events
      FROM registrations
      WHERE attempt_at >= ${timeframeSql}
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          totalAttempts: row.total_attempts || 0,
          successful: row.successful || 0,
          failed: row.failed || 0,
          uniqueEvents: row.unique_events || 0,
          successRate: row.total_attempts > 0 ? (row.successful / row.total_attempts * 100).toFixed(1) : 0
        });
      });
    });
  }

  async getFailedRegistrations(limit = 10) {
    if (this.usePostgres) {
      return await this.postgres.getFailedRegistrations(limit);
    }

    const sql = `
      SELECT r.*, e.title, e.date, e.registration_url
      FROM registrations r
      LEFT JOIN events e ON r.event_id = e.id
      WHERE r.success = 0
      ORDER BY r.attempt_at DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  getTimeframeSql(timeframe) {
    switch (timeframe) {
      case '1 hour':
        return "datetime('now', '-1 hour')";
      case '24 hours':
        return "datetime('now', '-1 day')";
      case '7 days':
        return "datetime('now', '-7 days')";
      case '30 days':
        return "datetime('now', '-30 days')";
      default:
        return "datetime('now', '-1 day')";
    }
  }

  async recordEventMerge(primaryEventId, mergedEvent, similarityScore, mergeType) {
    if (this.usePostgres) {
      // TODO: Implement for PostgreSQL
      return;
    }

    const sql = `
      INSERT INTO event_merges (
        primary_event_id, merged_event_id, merged_event_data, 
        similarity_score, merge_type
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      primaryEventId,
      mergedEvent.id,
      JSON.stringify(mergedEvent),
      similarityScore,
      mergeType
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getEventMergeHistory(eventId, limit = 10) {
    if (this.usePostgres) {
      // TODO: Implement for PostgreSQL
      return [];
    }

    const sql = `
      SELECT * FROM event_merges 
      WHERE primary_event_id = ? 
      ORDER BY merged_at DESC 
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [eventId, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const mergeHistory = rows.map(row => ({
          ...row,
          mergedEventData: JSON.parse(row.merged_event_data)
        }));
        
        resolve(mergeHistory);
      });
    });
  }

  async close() {
    if (this.usePostgres) {
      return await this.postgres.close();
    }

    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;