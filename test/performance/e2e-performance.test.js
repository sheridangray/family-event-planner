/**
 * End-to-End Performance Tests
 * 
 * Complete system performance testing from user interactions through automation
 */

const request = require('supertest');
const express = require('express');
const { PerformanceMonitor, LoadGenerator } = require('./performance-utils');

describe('End-to-End System Performance', () => {
  let app;
  let performanceMonitor;
  let loadGenerator;
  let mockDatabase;
  let mockLogger;
  let validToken;

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create comprehensive Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock all system components
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      scraperManager: {
        scrapeAll: jest.fn().mockResolvedValue(generateMockEvents(100)),
        scrapeSource: jest.fn().mockResolvedValue(generateMockEvents(20))
      },
      eventScorer: {
        scoreEvents: jest.fn().mockImplementation(async (events) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return events.map(e => ({ ...e, score: Math.floor(Math.random() * 100) }));
        })
      },
      registrationAutomator: {
        processApprovedEvents: jest.fn().mockResolvedValue({
          processed: 5,
          registered: 3,
          failed: 2
        }),
        registerForEvent: jest.fn().mockResolvedValue({
          success: true,
          confirmationNumber: 'CONF123'
        })
      },
      calendarManager: {
        createCalendarEvent: jest.fn().mockResolvedValue({
          success: true,
          calendarId: 'cal-123'
        })
      }
    };
    
    // Add comprehensive API routes
    const apiRouter = require('../../src/api')(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Enhanced database mock for realistic performance
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 50 + 10; // 10-60ms realistic DB latency
      
      return new Promise(resolve => {
        setTimeout(() => {
          if (query.includes('COUNT(*)')) {
            resolve({ rows: [{ total: 1000 }] });
          } else if (query.includes('SELECT') && query.includes('events')) {
            const events = generateMockEvents(50);
            resolve({ rows: events });
          } else if (query.includes('UPDATE') || query.includes('INSERT')) {
            resolve({ rowCount: 1 });
          } else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
  });

  describe('User Journey Performance', () => {
    test('Complete user session performance', async () => {
      const userSessionTest = async (userId) => {
        const sessionResults = [];
        
        // 1. User loads dashboard
        const dashboardStart = Date.now();
        const dashboardResponse = await request(app)
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${validToken}`);
        sessionResults.push({
          action: 'dashboard',
          duration: Date.now() - dashboardStart,
          success: dashboardResponse.status === 200
        });
        
        // 2. User searches for events
        const searchStart = Date.now();
        const searchResponse = await request(app)
          .get('/api/events?search=family&cost=free&page=1&limit=20')
          .set('Authorization', `Bearer ${validToken}`);
        sessionResults.push({
          action: 'search',
          duration: Date.now() - searchStart,
          success: searchResponse.status === 200
        });
        
        // 3. User views event details
        const detailStart = Date.now();
        const detailResponse = await request(app)
          .get('/api/events/test-event-1')
          .set('Authorization', `Bearer ${validToken}`);
        sessionResults.push({
          action: 'details',
          duration: Date.now() - detailStart,
          success: detailResponse.status === 200
        });
        
        // 4. User approves events (bulk action)
        const approveStart = Date.now();
        const approveResponse = await request(app)
          .post('/api/events/bulk-action')
          .send({
            action: 'approve',
            eventIds: ['event-1', 'event-2', 'event-3']
          })
          .set('Authorization', `Bearer ${validToken}`);
        sessionResults.push({
          action: 'approve',
          duration: Date.now() - approveStart,
          success: approveResponse.status === 200
        });
        
        // 5. User registers for event
        const registerStart = Date.now();
        const registerResponse = await request(app)
          .post('/api/events/test-event-1/register')
          .set('Authorization', `Bearer ${validToken}`);
        sessionResults.push({
          action: 'register',
          duration: Date.now() - registerStart,
          success: registerResponse.status === 200
        });
        
        return sessionResults;
      };

      const result = await loadGenerator.generateLoad(userSessionTest, 3, 12);
      
      expect(result.successRate).toBeGreaterThan(90); // >90% user session success
      expect(result.averageTime).toBeLessThan(5000); // <5s per complete user session
      
      // Analyze individual action performance
      const actionPerformance = result.results
        .filter(r => r.success)
        .reduce((acc, r) => {
          r.result.forEach(action => {
            if (!acc[action.action]) {
              acc[action.action] = { total: 0, count: 0, failures: 0 };
            }
            acc[action.action].total += action.duration;
            acc[action.action].count++;
            if (!action.success) acc[action.action].failures++;
          });
          return acc;
        }, {});
      
      Object.entries(actionPerformance).forEach(([action, stats]) => {
        const avgTime = stats.total / stats.count;
        const successRate = ((stats.count - stats.failures) / stats.count) * 100;
        console.log(`📊 ${action}: ${avgTime.toFixed(2)}ms avg, ${successRate.toFixed(1)}% success`);
      });
      
      console.log(`📊 Complete User Session Performance:
        - Total Sessions: ${result.totalOperations}
        - Session Success Rate: ${result.successRate.toFixed(1)}%
        - Average Session Time: ${result.averageTime.toFixed(2)}ms`);
    });

    test('Mobile vs desktop performance comparison', async () => {
      const mobileUserTest = async (sessionId) => {
        // Simulate mobile user with smaller payloads
        const response = await request(app)
          .get('/api/events?limit=10&mobile=true') // Smaller mobile payload
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');
        
        return {
          type: 'mobile',
          duration: Date.now() - Date.now(),
          success: response.status === 200,
          dataSize: JSON.stringify(response.body).length
        };
      };
      
      const desktopUserTest = async (sessionId) => {
        // Simulate desktop user with larger payloads
        const response = await request(app)
          .get('/api/events?limit=50&desktop=true') // Larger desktop payload
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
        
        return {
          type: 'desktop',
          duration: Date.now() - Date.now(),
          success: response.status === 200,
          dataSize: JSON.stringify(response.body).length
        };
      };
      
      // Test both user types concurrently
      const mobileResults = await loadGenerator.generateLoad(mobileUserTest, 3, 9);
      const desktopResults = await loadGenerator.generateLoad(desktopUserTest, 2, 6);
      
      console.log(`📊 Mobile vs Desktop Performance:
        - Mobile: ${mobileResults.averageTime.toFixed(2)}ms avg, ${mobileResults.successRate.toFixed(1)}% success
        - Desktop: ${desktopResults.averageTime.toFixed(2)}ms avg, ${desktopResults.successRate.toFixed(1)}% success`);
    });
  });

  describe('System Load Performance', () => {
    test('High concurrent user load', async () => {
      const concurrentUserTest = async (userId) => {
        // Each user performs multiple actions
        const userActions = [
          () => request(app).get('/api/dashboard').set('Authorization', `Bearer ${validToken}`),
          () => request(app).get('/api/events?page=1').set('Authorization', `Bearer ${validToken}`),
          () => request(app).get('/api/events/test-event-1').set('Authorization', `Bearer ${validToken}`),
          () => request(app).post('/api/events/test-event-1/approve').set('Authorization', `Bearer ${validToken}`)
        ];
        
        const actionResults = [];
        for (const action of userActions) {
          const startTime = Date.now();
          try {
            const response = await action();
            actionResults.push({
              duration: Date.now() - startTime,
              success: response.status < 400
            });
          } catch (error) {
            actionResults.push({
              duration: Date.now() - startTime,
              success: false
            });
          }
        }
        
        return actionResults;
      };

      const result = await loadGenerator.generateLoad(concurrentUserTest, 10, 50); // 10 concurrent users
      
      expect(result.successRate).toBeGreaterThan(85); // >85% under high load
      expect(result.averageTime).toBeLessThan(8000); // <8s for 4 actions per user
      
      console.log(`📊 High Concurrent Load (10 users, 50 sessions):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average User Session: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms
        - Requests/second: ${((result.successful * 4) / (result.totalTime / 1000)).toFixed(1)}`);
    });

    test('Sustained load over time', async () => {
      const memoryTracker = performanceMonitor.trackResources('sustained_load', 2000, 60000); // 1 minute
      
      const sustainedLoadTest = async () => {
        // Generate requests over 60 seconds
        const requests = Array(60).fill().map(async (_, i) => {
          await new Promise(resolve => setTimeout(resolve, i * 1000)); // Every second
          
          try {
            const response = await request(app)
              .get(`/api/events?page=${(i % 5) + 1}&t=${i}`)
              .set('Authorization', `Bearer ${validToken}`);
            
            return {
              timestamp: i,
              success: response.status === 200,
              duration: response.duration || 0
            };
          } catch (error) {
            return {
              timestamp: i,
              success: false,
              error: error.message
            };
          }
        });
        
        return await Promise.all(requests);
      };

      const { result, metrics } = await measureAsync('sustained_load_test', sustainedLoadTest);
      
      await memoryTracker;
      const report = performanceMonitor.generateReport('sustained_load');
      
      const successfulRequests = result.filter(r => r.success).length;
      const successRate = (successfulRequests / result.length) * 100;
      
      expect(successRate).toBeGreaterThan(90); // >90% over sustained period
      expect(report.memory.growth).toBeLessThan(100 * 1024 * 1024); // <100MB growth
      
      console.log(`📊 Sustained Load Test (60 seconds):
        - Total Requests: ${result.length}
        - Success Rate: ${successRate.toFixed(1)}%
        - Memory Growth: ${report.memory.growthFormatted}
        - Peak Memory: ${report.memory.maxFormatted}`);
    });

    test('Peak traffic simulation', async () => {
      const peakTrafficTest = async (requestId) => {
        // Simulate peak traffic patterns (varied endpoints)
        const endpoints = [
          { method: 'GET', path: '/api/events', weight: 40 },
          { method: 'GET', path: '/api/dashboard', weight: 25 },
          { method: 'GET', path: '/api/events/test-event-1', weight: 15 },
          { method: 'POST', path: '/api/events/test-event-1/approve', weight: 10 },
          { method: 'POST', path: '/api/events/bulk-action', weight: 10 }
        ];
        
        // Weighted random selection
        const rand = Math.random() * 100;
        let cumulative = 0;
        let selectedEndpoint = endpoints[0];
        
        for (const endpoint of endpoints) {
          cumulative += endpoint.weight;
          if (rand <= cumulative) {
            selectedEndpoint = endpoint;
            break;
          }
        }
        
        const startTime = Date.now();
        
        try {
          let response;
          if (selectedEndpoint.method === 'GET') {
            response = await request(app)
              .get(selectedEndpoint.path)
              .set('Authorization', `Bearer ${validToken}`);
          } else {
            const body = selectedEndpoint.path.includes('bulk-action') 
              ? { action: 'approve', eventIds: ['event-1', 'event-2'] }
              : {};
            
            response = await request(app)
              .post(selectedEndpoint.path)
              .send(body)
              .set('Authorization', `Bearer ${validToken}`);
          }
          
          return {
            endpoint: selectedEndpoint.path,
            duration: Date.now() - startTime,
            success: response.status < 400,
            status: response.status
          };
        } catch (error) {
          return {
            endpoint: selectedEndpoint.path,
            duration: Date.now() - startTime,
            success: false,
            error: error.message
          };
        }
      };

      const result = await loadGenerator.generateLoad(peakTrafficTest, 15, 150); // High concurrency
      
      expect(result.successRate).toBeGreaterThan(80); // >80% under peak load
      
      // Analyze endpoint performance
      const endpointStats = result.results
        .filter(r => r.success)
        .reduce((acc, r) => {
          const endpoint = r.result.endpoint;
          if (!acc[endpoint]) {
            acc[endpoint] = { count: 0, totalTime: 0, failures: 0 };
          }
          acc[endpoint].count++;
          acc[endpoint].totalTime += r.result.duration;
          if (!r.result.success) acc[endpoint].failures++;
          return acc;
        }, {});
      
      console.log(`📊 Peak Traffic Analysis (15 concurrent, 150 requests):`);
      Object.entries(endpointStats).forEach(([endpoint, stats]) => {
        const avgTime = stats.totalTime / stats.count;
        const successRate = ((stats.count - stats.failures) / stats.count) * 100;
        console.log(`  - ${endpoint}: ${avgTime.toFixed(2)}ms avg, ${stats.count} requests, ${successRate.toFixed(1)}% success`);
      });
    });
  });

  describe('Real-World Scenario Performance', () => {
    test('Family event discovery workflow', async () => {
      const familyWorkflowTest = async (familyId) => {
        const workflow = [];
        
        // 1. Parent opens app and checks dashboard
        let step = Date.now();
        const dashboard = await request(app)
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${validToken}`);
        workflow.push({ step: 'dashboard', duration: Date.now() - step, success: dashboard.status === 200 });
        
        // 2. Parent searches for weekend activities
        step = Date.now();
        const search = await request(app)
          .get('/api/events?search=kids&age=perfect&cost=free')
          .set('Authorization', `Bearer ${validToken}`);
        workflow.push({ step: 'search', duration: Date.now() - step, success: search.status === 200 });
        
        // 3. Parent reviews several event details
        for (let i = 1; i <= 3; i++) {
          step = Date.now();
          const details = await request(app)
            .get(`/api/events/test-event-${i}`)
            .set('Authorization', `Bearer ${validToken}`);
          workflow.push({ step: `details-${i}`, duration: Date.now() - step, success: details.status === 200 });
        }
        
        // 4. Parent approves favorite events
        step = Date.now();
        const approve = await request(app)
          .post('/api/events/bulk-action')
          .send({
            action: 'approve',
            eventIds: ['test-event-1', 'test-event-2']
          })
          .set('Authorization', `Bearer ${validToken}`);
        workflow.push({ step: 'approve', duration: Date.now() - step, success: approve.status === 200 });
        
        // 5. System auto-registers for free events
        step = Date.now();
        const register = await request(app)
          .post('/api/events/test-event-1/register')
          .set('Authorization', `Bearer ${validToken}`);
        workflow.push({ step: 'register', duration: Date.now() - step, success: register.status === 200 });
        
        return workflow;
      };

      const result = await loadGenerator.generateLoad(familyWorkflowTest, 4, 16);
      
      expect(result.successRate).toBeGreaterThan(90); // >90% family workflow success
      expect(result.averageTime).toBeLessThan(6000); // <6s total workflow
      
      // Calculate step-by-step performance
      const stepPerformance = result.results
        .filter(r => r.success)
        .reduce((acc, r) => {
          r.result.forEach(step => {
            if (!acc[step.step]) {
              acc[step.step] = { total: 0, count: 0, failures: 0 };
            }
            acc[step.step].total += step.duration;
            acc[step.step].count++;
            if (!step.success) acc[step.step].failures++;
          });
          return acc;
        }, {});
      
      console.log(`📊 Family Event Discovery Workflow:`);
      Object.entries(stepPerformance).forEach(([step, stats]) => {
        const avgTime = stats.total / stats.count;
        const successRate = ((stats.count - stats.failures) / stats.count) * 100;
        console.log(`  - ${step}: ${avgTime.toFixed(2)}ms avg, ${successRate.toFixed(1)}% success`);
      });
    });

    test('Weekly automation cycle performance', async () => {
      const weeklyAutomationTest = async () => {
        const automationSteps = [];
        
        // Simulate weekly automation cycle
        let step = Date.now();
        
        // 1. Scrape new events
        const scrapeResults = await app.locals.scraperManager.scrapeAll();
        automationSteps.push({
          step: 'scraping',
          duration: Date.now() - step,
          eventsFound: scrapeResults.length
        });
        
        // 2. Score events
        step = Date.now();
        const scoredEvents = await app.locals.eventScorer.scoreEvents(scrapeResults);
        automationSteps.push({
          step: 'scoring',
          duration: Date.now() - step,
          eventsScored: scoredEvents.length
        });
        
        // 3. Process approved events
        step = Date.now();
        const processed = await app.locals.registrationAutomator.processApprovedEvents();
        automationSteps.push({
          step: 'registration',
          duration: Date.now() - step,
          eventsProcessed: processed.processed
        });
        
        return automationSteps;
      };

      const { result, metrics } = await measureAsync('weekly_automation', weeklyAutomationTest);
      
      expect(metrics.duration).toBeLessThan(10000); // <10s for full automation cycle
      expect(result).toHaveLength(3);
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(150 * 1024 * 1024); // <150MB
      
      console.log(`📊 Weekly Automation Cycle Performance:
        - Total Duration: ${metrics.duration}ms
        - Memory Used: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}`);
      
      result.forEach(step => {
        console.log(`  - ${step.step}: ${step.duration}ms, ${step.eventsFound || step.eventsScored || step.eventsProcessed || 0} events`);
      });
    });
  });

  describe('Performance Regression Detection', () => {
    test('API response time baselines', async () => {
      const baselines = {
        'GET /api/dashboard': 500,        // 500ms
        'GET /api/events': 800,           // 800ms
        'GET /api/events/:id': 300,       // 300ms
        'POST /api/events/bulk-action': 1000  // 1000ms
      };
      
      const regressionResults = {};
      
      for (const [endpoint, baseline] of Object.entries(baselines)) {
        const [method, path] = endpoint.split(' ');
        const testFunction = async () => {
          if (method === 'GET') {
            const testPath = path.includes(':id') ? path.replace(':id', 'test-event-1') : path;
            return await request(app).get(testPath).set('Authorization', `Bearer ${validToken}`);
          } else {
            return await request(app)
              .post(path)
              .send({ action: 'approve', eventIds: ['event-1'] })
              .set('Authorization', `Bearer ${validToken}`);
          }
        };
        
        const { metrics } = await measureAsync(`baseline_${endpoint}`, testFunction);
        regressionResults[endpoint] = {
          actual: metrics.duration,
          baseline: baseline,
          regression: metrics.duration > baseline
        };
      }
      
      console.log(`📊 Performance Baseline Validation:`);
      Object.entries(regressionResults).forEach(([endpoint, result]) => {
        const status = result.regression ? '❌ REGRESSION' : '✅ PASSED';
        console.log(`  - ${endpoint}: ${result.actual.toFixed(2)}ms (baseline: ${result.baseline}ms) ${status}`);
      });
      
      const regressions = Object.values(regressionResults).filter(r => r.regression);
      expect(regressions.length).toBe(0); // No performance regressions
    });
  });
});

// Helper function to generate mock events
function generateMockEvents(count) {
  return Array(count).fill().map((_, i) => ({
    id: `mock-event-${i}`,
    title: `Mock Event ${i}`,
    date: new Date(),
    time: '10:00',
    location_name: `Venue ${i}`,
    location_address: `${i} Test St`,
    location_distance: `${i % 10} miles`,
    cost: i % 4 === 0 ? 0 : Math.floor(Math.random() * 50),
    age_min: 2,
    age_max: 8,
    status: 'discovered',
    description: `Description for mock event ${i}`,
    registration_url: `https://example.com/event-${i}`,
    social_proof_rating: 4.0 + (Math.random() * 1),
    social_proof_review_count: Math.floor(Math.random() * 200) + 50,
    social_proof_tags: JSON.stringify(['family-friendly', 'educational']),
    weather_context: 'sunny',
    preferences_context: 'liked',
    source: `source-${i % 5}`,
    score: Math.floor(Math.random() * 100),
    created_at: new Date(),
    updated_at: new Date()
  }));
}