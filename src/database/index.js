const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    // Use /tmp directory in production (Render), local data directory in development
    const isProduction = process.env.NODE_ENV === 'production';
    this.dbPath = isProduction 
      ? '/tmp/events.db' 
      : path.join(__dirname, '../../data/events.db');
    this.db = null;
  }

  async init() {
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
        resolve();
      });
    });
  }

  async saveEvent(event) {
    const sql = `
      INSERT OR REPLACE INTO events (
        id, source, title, date, location_address, location_lat, location_lng,
        age_range_min, age_range_max, cost, registration_url, registration_opens,
        capacity_available, capacity_total, description, image_url, status,
        is_recurring, previously_attended, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      event.id, event.source, event.title, event.date, event.location?.address,
      event.location?.lat, event.location?.lng, event.ageRange?.min, event.ageRange?.max,
      event.cost, event.registrationUrl, event.registrationOpens,
      event.currentCapacity?.available, event.currentCapacity?.total,
      event.description, event.imageUrl, event.status || 'discovered',
      event.isRecurring || false, event.previouslyAttended || false
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

  async close() {
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