const request = require('supertest');
const express = require('express');
const eventsRouter = require('../../src/api/events');

describe('Events API Complete Coverage', () => {
  let app;
  let mockDatabase;
  let mockLogger;
  let mockRegistrationAutomator;
  let mockCalendarManager;
  let validToken;

  beforeEach(() => {
    // Set up test environment
    process.env.API_KEY = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    process.env.NODE_ENV = 'test';
    
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();
    mockRegistrationAutomator = {
      registerForEvent: jest.fn().mockResolvedValue({
        success: true,
        message: 'Registration successful'
      })
    };
    mockCalendarManager = {
      createCalendarEvent: jest.fn().mockResolvedValue({
        success: true,
        calendarId: 'test-calendar-id'
      })
    };
    
    // Create Express app with events router
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock app.locals for middleware
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      registrationAutomator: mockRegistrationAutomator,
      calendarManager: mockCalendarManager
    };
    
    // Ensure the middleware works by setting up the app correctly
    app.set('trust proxy', true);
    
    // Add events router
    app.use('/api/events', eventsRouter);
    
    // Mock valid API key for testing
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Setup default database query mock
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      if (query.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ total: 10 }] });
      }
      
      if (query.includes('SELECT') && query.includes('events e')) {
        return Promise.resolve({
          rows: [
            {
              id: 'test-event-1',
              title: 'Test Event',
              date: new Date(),
              time: '10:00',
              location_name: 'Test Venue',
              location_address: '123 Test St',
              location_distance: '2 miles',
              cost: 0,
              age_min: 3,
              age_max: 8,
              status: 'discovered',
              description: 'A test event',
              registration_url: 'https://example.com/register',
              social_proof_rating: 4.5,
              social_proof_review_count: 100,
              social_proof_tags: '["family-friendly", "educational"]',
              weather_context: 'sunny',
              preferences_context: 'liked',
              source: 'test-source',
              confirmation_number: null,
              score: 85,
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });
      }
      
      if (query.includes('UPDATE events')) {
        return Promise.resolve({
          rows: [
            { id: 'event-1', title: 'Event 1', cost: 0 },
            { id: 'event-2', title: 'Event 2', cost: 25 }
          ]
        });
      }
      
      return Promise.resolve({ rows: [] });
    });
  });

  describe('GET /api/events', () => {
    test('Returns events with proper pagination', async () => {
      const response = await request(app)
        .get('/api/events?page=1&limit=10')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('events');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('currentPage');
      expect(response.body.data.pagination).toHaveProperty('totalPages');
      expect(response.body.data.pagination).toHaveProperty('totalEvents');
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    test('Applies search filters correctly', async () => {
      const response = await request(app)
        .get('/api/events?search=test&status=discovered')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%'])
      );
    });

    test('Handles venue filtering', async () => {
      const response = await request(app)
        .get('/api/events?venue=library')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('location_name ILIKE'),
        expect.arrayContaining(['%library%'])
      );
    });

    test('Applies cost filters correctly', async () => {
      const response = await request(app)
        .get('/api/events?cost=free')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('cost = 0'),
        expect.any(Array)
      );
    });

    test('Handles age-appropriate filtering', async () => {
      const response = await request(app)
        .get('/api/events?age=perfect')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('age_min <= 4 AND age_max >= 2'),
        expect.any(Array)
      );
    });

    test('Handles sorting and pagination parameters', async () => {
      const response = await request(app)
        .get('/api/events?sortBy=date&sortOrder=ASC&page=2&limit=5')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY date ASC'),
        expect.arrayContaining([5, 5]) // limit and offset
      );
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .get('/api/events');
      
      expect(response.status).toBe(401);
    });

    test('Handles database errors gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));
      
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch events');
    });

    test('Formats event data correctly', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      const event = response.body.data.events[0];
      
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('location');
      expect(event.location).toHaveProperty('name');
      expect(event.location).toHaveProperty('address');
      expect(event).toHaveProperty('ageRange');
      expect(event.ageRange).toHaveProperty('min');
      expect(event.ageRange).toHaveProperty('max');
      expect(event).toHaveProperty('socialProof');
      expect(event.socialProof).toHaveProperty('rating');
      expect(event).toHaveProperty('context');
    });
  });

  describe('GET /api/events/:id', () => {
    test('Returns specific event details', async () => {
      const response = await request(app)
        .get('/api/events/test-event-1')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.id).toBe('test-event-1');
    });

    test('Returns 404 for non-existent event', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      const response = await request(app)
        .get('/api/events/non-existent')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event not found');
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .get('/api/events/test-event-1');
      
      expect(response.status).toBe(401);
    });

    test('Handles database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/events/test-event-1')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/events/:id/approve', () => {
    beforeEach(() => {
      mockDatabase.updateEventStatus = jest.fn().mockResolvedValue();
      mockDatabase.getEventsByStatus = jest.fn().mockResolvedValue([
        { id: 'test-event-1', title: 'Test Event', cost: 0 }
      ]);
    });

    test('Approves free event and marks ready for registration', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/approve')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requiresPayment).toBe(false);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith('test-event-1', 'approved');
    });

    test('Approves paid event but does not mark ready', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([
        { id: 'test-event-1', title: 'Paid Event', cost: 25 }
      ]);
      
      const response = await request(app)
        .post('/api/events/test-event-1/approve')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requiresPayment).toBe(true);
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/approve');
      
      expect(response.status).toBe(401);
    });

    test('Handles database errors', async () => {
      mockDatabase.updateEventStatus.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/events/test-event-1/approve')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/events/:id/reject', () => {
    beforeEach(() => {
      mockDatabase.updateEventStatus = jest.fn().mockResolvedValue();
    });

    test('Rejects event successfully', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/reject')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBe('test-event-1');
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith('test-event-1', 'rejected');
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/reject');
      
      expect(response.status).toBe(401);
    });

    test('Handles database errors', async () => {
      mockDatabase.updateEventStatus.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/events/test-event-1/reject')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/events/:id/register', () => {
    beforeEach(() => {
      mockDatabase.getEventsByStatus = jest.fn().mockResolvedValue([
        { id: 'test-event-1', title: 'Free Event', cost: 0 }
      ]);
    });

    test('Registers for free approved event', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/register')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockRegistrationAutomator.registerForEvent).toHaveBeenCalled();
    });

    test('Rejects registration for paid events', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([
        { id: 'test-event-1', title: 'Paid Event', cost: 25 }
      ]);
      
      const response = await request(app)
        .post('/api/events/test-event-1/register')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot auto-register for paid events');
    });

    test('Returns 404 for non-existent or non-approved event', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/events/test-event-1/register')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Event not found or not approved');
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/register');
      
      expect(response.status).toBe(401);
    });

    test('Handles registration failures', async () => {
      mockRegistrationAutomator.registerForEvent.mockRejectedValue(
        new Error('Registration failed')
      );
      
      const response = await request(app)
        .post('/api/events/test-event-1/register')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/events/:id/calendar', () => {
    beforeEach(() => {
      mockDatabase.getEventsByStatus = jest.fn().mockResolvedValue([
        { id: 'test-event-1', title: 'Booked Event', cost: 0 }
      ]);
      mockDatabase.updateEventStatus = jest.fn().mockResolvedValue();
    });

    test('Creates calendar event for booked event', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/calendar')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCalendarManager.createCalendarEvent).toHaveBeenCalled();
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith('test-event-1', 'attended');
    });

    test('Returns 404 for non-booked event', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/events/test-event-1/calendar')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Event not found or not booked');
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .post('/api/events/test-event-1/calendar');
      
      expect(response.status).toBe(401);
    });

    test('Handles calendar creation failures', async () => {
      mockCalendarManager.createCalendarEvent.mockRejectedValue(
        new Error('Calendar creation failed')
      );
      
      const response = await request(app)
        .post('/api/events/test-event-1/calendar')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/events/bulk-action', () => {
    beforeEach(() => {
      mockDatabase.query = jest.fn().mockImplementation((query, params) => {
        if (query.includes('UPDATE events')) {
          return Promise.resolve({
            rows: [
              { id: 'event-1', title: 'Event 1', cost: 0 },
              { id: 'event-2', title: 'Event 2', cost: 25 }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    test('Bulk approves multiple events', async () => {
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'approve',
          eventIds: ['event-1', 'event-2']
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('approve');
      expect(response.body.count).toBe(2);
      expect(response.body.updatedEvents).toHaveLength(2);
    });

    test('Bulk rejects multiple events', async () => {
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'reject',
          eventIds: ['event-1', 'event-2']
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('reject');
    });

    test('Validates required parameters', async () => {
      let response = await request(app)
        .post('/api/events/bulk-action')
        .send({ action: 'approve' }) // Missing eventIds
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing action or eventIds');
      
      response = await request(app)
        .post('/api/events/bulk-action')
        .send({ eventIds: ['event-1'] }) // Missing action
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing action or eventIds');
    });

    test('Validates action parameter', async () => {
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'invalid',
          eventIds: ['event-1']
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid action. Must be "approve" or "reject"');
    });

    test('Handles empty eventIds array', async () => {
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'approve',
          eventIds: []
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing action or eventIds');
    });

    test('Requires authentication', async () => {
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'approve',
          eventIds: ['event-1']
        });
      
      expect(response.status).toBe(401);
    });

    test('Handles database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'approve',
          eventIds: ['event-1']
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Validation and Security', () => {
    test('Sanitizes search inputs', async () => {
      const maliciousSearch = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .get(`/api/events?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      // Verify the search was processed but not executed as script
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('<script>')])
      );
    });

    test('Validates pagination parameters', async () => {
      const response = await request(app)
        .get('/api/events?page=invalid&limit=-1')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should still work with default values
      expect(response.status).toBe(200);
    });

    test('Handles SQL injection attempts safely', async () => {
      const sqlInjection = "'; DROP TABLE events; --";
      
      const response = await request(app)
        .get(`/api/events?search=${encodeURIComponent(sqlInjection)}`)
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should not crash and should handle safely
      expect(response.status).toBe(200);
    });
  });
});