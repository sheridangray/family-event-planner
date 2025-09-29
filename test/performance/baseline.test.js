const request = require('supertest');
const express = require('express');
const createApiRouter = require('../../src/api');

describe('Performance Baseline Tests', () => {
  let app;
  let mockDatabase;
  let mockLogger;
  let validToken;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();
    
    // Create Express app with API router
    app = express();
    app.use(express.json());
    
    // Mock app.locals
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      scraperManager: {
        scrapeSource: jest.fn().mockResolvedValue([]),
        scrapeAll: jest.fn().mockResolvedValue([])
      },
      eventScorer: {
        scoreEvents: jest.fn().mockResolvedValue([])
      },
      registrationAutomator: {
        processApprovedEvents: jest.fn().mockResolvedValue([])
      }
    };
    
    // Add API router
    const apiRouter = createApiRouter(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Mock database with performance-focused responses
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      // Simulate realistic database response times
      return new Promise(resolve => {
        setTimeout(() => {
          if (query.includes('COUNT(*)')) {
            resolve({ rows: [{ total: 1000 }] });
          } else if (query.includes('SELECT') && query.includes('events')) {
            // Generate mock events for performance testing
            const events = Array(50).fill().map((_, i) => ({
              id: `event-${i}`,
              title: `Event ${i}`,
              date: new Date(),
              time: '10:00',
              location_name: `Venue ${i}`,
              location_address: `${i} Test St`,
              location_distance: `${i} miles`,
              cost: i % 3 === 0 ? 0 : 25,
              age_min: 2,
              age_max: 8,
              status: 'discovered',
              description: `Description for event ${i}`,
              registration_url: `https://example.com/event-${i}`,
              social_proof_rating: 4.5,
              social_proof_review_count: 100,
              social_proof_tags: JSON.stringify(['family-friendly']),
              weather_context: 'sunny',
              preferences_context: 'liked',
              source: 'test-source',
              score: 85,
              created_at: new Date(),
              updated_at: new Date()
            }));
            resolve({ rows: events });
          } else {
            resolve({ rows: [] });
          }
        }, Math.random() * 50 + 10); // 10-60ms response time
      });
    });
  });

  describe('API Response Time Performance', () => {
    test('GET /api/events responds within performance threshold', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/events?page=1&limit=20')
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms
      expect(response.body.data.events).toHaveLength(50);
      
      console.log(`✅ Events API response time: ${responseTime}ms`);
    });

    test('API handles concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map(() =>
        request(app)
          .get('/api/events?page=1&limit=10')
          .set('Authorization', `Bearer ${validToken}`)
      );
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentRequests;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Average response time should be reasonable under load
      expect(averageTime).toBeLessThan(1000); // Average under 1 second
      expect(totalTime).toBeLessThan(3000); // Total under 3 seconds
      
      console.log(`✅ Concurrent requests (${concurrentRequests}): ${totalTime}ms total, ${averageTime.toFixed(2)}ms average`);
    });

    test('Complex search queries perform within limits', async () => {
      const complexQuery = {
        search: 'family fun activity',
        venue: 'library',
        cost: 'free',
        age: 'perfect',
        status: 'discovered',
        sortBy: 'score',
        sortOrder: 'DESC'
      };
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/events')
        .query(complexQuery)
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(800); // Complex queries within 800ms
      
      console.log(`✅ Complex search query response time: ${responseTime}ms`);
    });

    test('Bulk operations scale efficiently', async () => {
      const eventIds = Array(50).fill().map((_, i) => `event-${i}`);
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send({
          action: 'approve',
          eventIds: eventIds
        })
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Bulk operations within 1 second
      
      console.log(`✅ Bulk operation (${eventIds.length} events): ${responseTime}ms`);
    });
  });

  describe('Memory Usage Performance', () => {
    test('Memory usage remains stable under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate sustained load
      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/events?page=1&limit=50')
          .set('Authorization', `Bearer ${validToken}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      // Memory increase should be minimal (less than 50MB for 20 requests)
      expect(memoryIncrease).toBeLessThan(50);
      
      console.log(`✅ Memory increase after ${iterations} requests: ${memoryIncrease.toFixed(2)}MB`);
    });

    test('Large response payloads handled efficiently', async () => {
      // Mock large dataset
      mockDatabase.query = jest.fn().mockImplementation((query) => {
        if (query.includes('SELECT') && query.includes('events')) {
          const largeEventSet = Array(1000).fill().map((_, i) => ({
            id: `large-event-${i}`,
            title: `Large Event ${i}`,
            date: new Date(),
            location_name: `Large Venue ${i}`,
            description: 'A'.repeat(500), // Large description
            cost: 0,
            age_min: 2,
            age_max: 8,
            status: 'discovered',
            social_proof_tags: JSON.stringify(['tag1', 'tag2', 'tag3']),
            score: 85,
            created_at: new Date(),
            updated_at: new Date()
          }));
          return Promise.resolve({ rows: largeEventSet });
        }
        return Promise.resolve({ rows: [{ total: 1000 }] });
      });
      
      const startTime = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;
      
      const response = await request(app)
        .get('/api/events?limit=1000')
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1000);
      expect(responseTime).toBeLessThan(2000); // Large datasets within 2 seconds
      expect(memoryUsed).toBeLessThan(100); // Memory usage reasonable
      
      console.log(`✅ Large dataset (1000 events): ${responseTime}ms, ${memoryUsed.toFixed(2)}MB memory`);
    });
  });

  describe('Database Performance Simulation', () => {
    test('Handles database latency gracefully', async () => {
      // Simulate slow database
      mockDatabase.query = jest.fn().mockImplementation((query) => {
        return new Promise(resolve => {
          setTimeout(() => {
            if (query.includes('COUNT(*)')) {
              resolve({ rows: [{ total: 100 }] });
            } else {
              resolve({ rows: [
                {
                  id: 'slow-event',
                  title: 'Slow Event',
                  date: new Date(),
                  cost: 0,
                  status: 'discovered',
                  created_at: new Date(),
                  updated_at: new Date()
                }
              ]});
            }
          }, 200); // 200ms database latency
        });
      });
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeGreaterThan(200); // Should include database latency
      expect(responseTime).toBeLessThan(1000); // But still reasonable total time
      
      console.log(`✅ Slow database simulation: ${responseTime}ms (includes 200ms DB latency)`);
    });

    test('Concurrent database operations dont cause bottlenecks', async () => {
      let queryCount = 0;
      mockDatabase.query = jest.fn().mockImplementation((query) => {
        queryCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ rows: [{ total: 10 }] });
          }, 50); // 50ms per query
        });
      });
      
      const startTime = Date.now();
      
      // 5 concurrent requests
      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/api/events')
          .set('Authorization', `Bearer ${validToken}`)
      );
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should execute concurrently, not sequentially
      expect(totalTime).toBeLessThan(300); // Much less than 5 * 50ms * 2 queries = 500ms
      expect(queryCount).toBe(10); // 2 queries per request (count + data)
      
      console.log(`✅ Concurrent DB operations: ${totalTime}ms for ${queryCount} queries`);
    });
  });

  describe('Error Handling Performance', () => {
    test('Error responses are fast', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/events')
        // No authorization header
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(401);
      expect(responseTime).toBeLessThan(50); // Error responses should be very fast
      
      console.log(`✅ Error response time: ${responseTime}ms`);
    });

    test('Database error recovery is efficient', async () => {
      mockDatabase.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(500);
      expect(responseTime).toBeLessThan(200); // Should fail fast
      
      console.log(`✅ Database error response time: ${responseTime}ms`);
    });
  });

  describe('Payload Size Performance', () => {
    test('Large request payloads handled efficiently', async () => {
      const largePayload = {
        action: 'approve',
        eventIds: Array(1000).fill().map((_, i) => `event-${i}`)
      };
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/events/bulk-action')
        .send(largePayload)
        .set('Authorization', `Bearer ${validToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1500); // Large payloads within 1.5 seconds
      
      console.log(`✅ Large payload (${largePayload.eventIds.length} IDs): ${responseTime}ms`);
    });

    test('Response streaming efficiency', async () => {
      const startTime = Date.now();
      let firstByteTime = null;
      
      const response = await request(app)
        .get('/api/events?limit=100')
        .set('Authorization', `Bearer ${validToken}`)
        .on('response', () => {
          firstByteTime = Date.now() - startTime;
        });
      
      const totalTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(firstByteTime).toBeLessThan(200); // Time to first byte
      expect(totalTime).toBeLessThan(800); // Total response time
      
      console.log(`✅ Response streaming: ${firstByteTime}ms first byte, ${totalTime}ms total`);
    });
  });

  describe('Resource Cleanup Performance', () => {
    test('Connections are properly cleaned up', async () => {
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .get('/api/events')
          .set('Authorization', `Bearer ${validToken}`);
        
        expect(response.status).toBe(200);
      }
      
      // Verify no resource leaks by checking if subsequent requests still work
      const finalResponse = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(finalResponse.status).toBe(200);
      
      console.log(`✅ Resource cleanup: ${iterations} requests completed without leaks`);
    });
  });
});

// Performance test utilities
global.measurePerformance = async (operation, description) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  const result = await operation();
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  const duration = endTime - startTime;
  const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB
  
  console.log(`📊 ${description}: ${duration}ms, ${memoryUsed.toFixed(2)}MB`);
  
  return { result, duration, memoryUsed };
};