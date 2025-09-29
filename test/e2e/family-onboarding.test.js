/**
 * Family Onboarding End-to-End Tests
 * 
 * Complete user journey from first-time family setup through first automation cycle
 */

const request = require('supertest');
const express = require('express');
const { PerformanceMonitor } = require('../performance/performance-utils');

describe('Family Onboarding End-to-End Journey', () => {
  let app;
  let performanceMonitor;
  let mockDatabase;
  let mockLogger;
  let mockScraperManager;
  let mockEventScorer;
  let mockRegistrationAutomator;
  let mockCalendarManager;
  let validToken;
  let familyId;

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create comprehensive Express app for E2E testing
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Mock all system components with realistic behaviors
    mockScraperManager = {
      scrapeAll: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Realistic scraping time
        return generateRealisticEvents(25);
      }),
      scrapeSource: jest.fn().mockImplementation(async (source) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return generateRealisticEvents(8, source);
      })
    };

    mockEventScorer = {
      scoreEvents: jest.fn().mockImplementation(async (events) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return events.map(event => ({
          ...event,
          score: calculateRealisticScore(event),
          age_appropriateness_score: Math.floor(Math.random() * 25) + 15,
          cost_score: event.cost === 0 ? 25 : Math.floor(Math.random() * 15) + 5,
          location_score: Math.floor(Math.random() * 25) + 10,
          timing_score: Math.floor(Math.random() * 25) + 10,
          total_score: calculateRealisticScore(event)
        }));
      })
    };

    mockRegistrationAutomator = {
      processApprovedEvents: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
          processed: 3,
          registered: 2,
          failed: 1,
          results: [
            { eventId: 'event-1', success: true, confirmationNumber: 'FEP-CONF-001' },
            { eventId: 'event-2', success: true, confirmationNumber: 'FEP-CONF-002' },
            { eventId: 'event-3', success: false, error: 'Event capacity reached' }
          ]
        };
      }),
      registerForEvent: jest.fn().mockImplementation(async (eventId) => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return {
          success: true,
          confirmationNumber: `FEP-${Date.now()}`,
          message: 'Successfully registered for event'
        };
      })
    };

    mockCalendarManager = {
      createCalendarEvent: jest.fn().mockImplementation(async (event) => {
        await new Promise(resolve => setTimeout(resolve, 600));
        return {
          success: true,
          calendarId: `cal-${Date.now()}`,
          eventId: event.id,
          calendarEventId: `gcal-${Date.now()}`
        };
      })
    };

    // Mock app.locals for comprehensive system
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      scraperManager: mockScraperManager,
      eventScorer: mockEventScorer,
      registrationAutomator: mockRegistrationAutomator,
      calendarManager: mockCalendarManager
    };
    
    // Add comprehensive API routes
    const apiRouter = require('../../src/api')(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    familyId = `family-${Date.now()}`;
    
    // Enhanced database mock for onboarding flow
    let familySettings = {};
    let familyEvents = [];
    
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 30 + 5; // 5-35ms realistic DB latency
      
      return new Promise(resolve => {
        setTimeout(() => {
          // Family settings operations
          if (query.includes('INSERT INTO family_settings')) {
            const [, settingKey, settingValue] = params;
            familySettings[settingKey] = settingValue;
            resolve({ rowCount: 1 });
          } else if (query.includes('SELECT') && query.includes('family_settings')) {
            const settings = Object.entries(familySettings).map(([key, value]) => ({
              setting_key: key,
              setting_value: value,
              active: true,
              created_at: new Date(),
              updated_at: new Date()
            }));
            resolve({ rows: settings });
          }
          // Event operations
          else if (query.includes('INSERT INTO events')) {
            const eventData = extractEventDataFromQuery(query, params);
            familyEvents.push(eventData);
            resolve({ rowCount: 1 });
          } else if (query.includes('SELECT') && query.includes('events')) {
            if (query.includes('COUNT(*)')) {
              resolve({ rows: [{ total: familyEvents.length }] });
            } else {
              const events = familyEvents.slice(0, Math.min(50, familyEvents.length));
              resolve({ rows: events });
            }
          } else if (query.includes('UPDATE events')) {
            const eventId = params[params.length - 1]; // Usually last parameter
            const eventIndex = familyEvents.findIndex(e => e.id === eventId);
            if (eventIndex !== -1) {
              familyEvents[eventIndex].updated_at = new Date();
              if (query.includes('status')) {
                familyEvents[eventIndex].status = params[0];
              }
              if (query.includes('score')) {
                familyEvents[eventIndex].score = params[0];
              }
            }
            resolve({ rowCount: eventIndex !== -1 ? 1 : 0 });
          }
          // Default responses
          else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
  });

  describe('Complete Family Onboarding Journey', () => {
    test('New family registration through first automation cycle', async () => {
      const onboardingJourney = async () => {
        const journeySteps = [];
        
        // Step 1: Family Registration & Basic Setup
        console.log('🚀 Starting family onboarding journey...');
        
        let stepStart = Date.now();
        const familySetupResponse = await request(app)
          .post('/api/family/setup')
          .send({
            familyId: familyId,
            familyName: 'The Smith Family',
            location: {
              address: '123 Family Lane, San Francisco, CA',
              coordinates: { lat: 37.7749, lng: -122.4194 }
            },
            children: [
              { name: 'Emma', age: 6, interests: ['art', 'music', 'animals'] },
              { name: 'Oliver', age: 4, interests: ['dinosaurs', 'sports', 'building'] }
            ]
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'family_setup',
          duration: Date.now() - stepStart,
          success: familySetupResponse.status === 200,
          data: familySetupResponse.body
        });
        
        // Step 2: Preference Configuration
        stepStart = Date.now();
        const preferencesResponse = await request(app)
          .post('/api/family/preferences')
          .send({
            familyId: familyId,
            preferences: {
              maxCost: 25,
              maxDistance: '10 miles',
              preferredDays: ['Saturday', 'Sunday'],
              preferredTimes: ['morning', 'afternoon'],
              categories: ['educational', 'outdoor', 'arts', 'sports'],
              avoidCategories: ['scary', 'violent'],
              accessibility: ['stroller-friendly', 'parking-available']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'preferences_setup',
          duration: Date.now() - stepStart,
          success: preferencesResponse.status === 200,
          data: preferencesResponse.body
        });
        
        // Step 3: Schedule Configuration
        stepStart = Date.now();
        const scheduleResponse = await request(app)
          .post('/api/family/schedule')
          .send({
            familyId: familyId,
            schedule: {
              weekdayAvailability: {
                monday: { available: false },
                tuesday: { available: false },
                wednesday: { available: false },
                thursday: { available: false },
                friday: { available: false },
                saturday: { available: true, timeSlots: ['9:00-12:00', '14:00-17:00'] },
                sunday: { available: true, timeSlots: ['10:00-15:00'] }
              },
              automationSettings: {
                autoScraping: true,
                autoScoring: true,
                autoApproval: false, // Family wants to review events
                autoRegistration: true, // But auto-register approved free events
                notificationPreferences: ['email', 'calendar']
              }
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'schedule_setup',
          duration: Date.now() - stepStart,
          success: scheduleResponse.status === 200,
          data: scheduleResponse.body
        });
        
        // Step 4: First Event Discovery (Trigger Initial Scraping)
        stepStart = Date.now();
        const discoveryResponse = await request(app)
          .post('/api/automation/discover')
          .send({
            familyId: familyId,
            sources: ['sf-library', 'sf-rec-parks', 'sf-museums', 'funcheapsf'],
            immediate: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'initial_discovery',
          duration: Date.now() - stepStart,
          success: discoveryResponse.status === 200,
          eventsFound: discoveryResponse.body?.eventsFound || 0
        });
        
        // Step 5: Wait for Scoring Completion (Simulate async processing)
        stepStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Allow scoring to complete
        
        const scoringCheckResponse = await request(app)
          .get(`/api/family/${familyId}/events?status=scored`)
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'scoring_completion',
          duration: Date.now() - stepStart,
          success: scoringCheckResponse.status === 200,
          scoredEvents: scoringCheckResponse.body?.data?.events?.length || 0
        });
        
        // Step 6: Family Reviews and Approves High-Scoring Events
        stepStart = Date.now();
        const highScoreEvents = scoringCheckResponse.body?.data?.events
          ?.filter(event => event.score > 75)
          ?.slice(0, 3) || [];
        
        if (highScoreEvents.length > 0) {
          const approvalResponse = await request(app)
            .post('/api/events/bulk-action')
            .send({
              action: 'approve',
              eventIds: highScoreEvents.map(e => e.id),
              familyId: familyId
            })
            .set('Authorization', `Bearer ${validToken}`);
          
          journeySteps.push({
            step: 'event_approval',
            duration: Date.now() - stepStart,
            success: approvalResponse.status === 200,
            approvedEvents: highScoreEvents.length
          });
        }
        
        // Step 7: Auto-Registration for Free Approved Events
        stepStart = Date.now();
        const freeApprovedEvents = highScoreEvents.filter(event => event.cost === 0);
        
        if (freeApprovedEvents.length > 0) {
          const registrationPromises = freeApprovedEvents.map(event =>
            request(app)
              .post(`/api/events/${event.id}/register`)
              .send({ familyId: familyId })
              .set('Authorization', `Bearer ${validToken}`)
          );
          
          const registrationResults = await Promise.all(registrationPromises);
          const successfulRegistrations = registrationResults.filter(r => r.status === 200);
          
          journeySteps.push({
            step: 'auto_registration',
            duration: Date.now() - stepStart,
            success: successfulRegistrations.length > 0,
            registeredEvents: successfulRegistrations.length,
            totalAttempted: freeApprovedEvents.length
          });
        }
        
        // Step 8: Calendar Integration
        stepStart = Date.now();
        const registeredEvents = freeApprovedEvents.slice(0, 2); // Simulate successful registrations
        
        if (registeredEvents.length > 0) {
          const calendarPromises = registeredEvents.map(event =>
            request(app)
              .post(`/api/events/${event.id}/calendar`)
              .send({ familyId: familyId })
              .set('Authorization', `Bearer ${validToken}`)
          );
          
          const calendarResults = await Promise.all(calendarPromises);
          const successfulCalendarEvents = calendarResults.filter(r => r.status === 200);
          
          journeySteps.push({
            step: 'calendar_integration',
            duration: Date.now() - stepStart,
            success: successfulCalendarEvents.length > 0,
            calendarEvents: successfulCalendarEvents.length
          });
        }
        
        // Step 9: Family Dashboard Review
        stepStart = Date.now();
        const dashboardResponse = await request(app)
          .get(`/api/family/${familyId}/dashboard`)
          .set('Authorization', `Bearer ${validToken}`);
        
        journeySteps.push({
          step: 'dashboard_review',
          duration: Date.now() - stepStart,
          success: dashboardResponse.status === 200,
          upcomingEvents: dashboardResponse.body?.upcomingEvents?.length || 0,
          pendingEvents: dashboardResponse.body?.pendingEvents?.length || 0
        });
        
        return journeySteps;
      };

      const { result: journeySteps, metrics } = await performanceMonitor.measure(
        'complete_family_onboarding',
        onboardingJourney
      );
      
      // Validate complete journey success
      expect(journeySteps).toHaveLength(8); // All steps completed
      expect(journeySteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(30000); // Complete onboarding <30 seconds
      
      // Validate journey progression
      const discoveryStep = journeySteps.find(s => s.step === 'initial_discovery');
      const scoringStep = journeySteps.find(s => s.step === 'scoring_completion');
      const approvalStep = journeySteps.find(s => s.step === 'event_approval');
      
      expect(discoveryStep.eventsFound).toBeGreaterThan(0);
      expect(scoringStep.scoredEvents).toBeGreaterThan(0);
      expect(approvalStep?.approvedEvents).toBeGreaterThan(0);
      
      // Validate time-to-value
      const timeToFirstEvents = journeySteps
        .slice(0, journeySteps.findIndex(s => s.step === 'initial_discovery') + 1)
        .reduce((sum, step) => sum + step.duration, 0);
      
      expect(timeToFirstEvents).toBeLessThan(15000); // Time to first events <15 seconds
      
      console.log(`📊 Complete Family Onboarding Journey Results:
        - Total Duration: ${metrics.duration}ms
        - Time to First Events: ${timeToFirstEvents}ms
        - Steps Completed: ${journeySteps.length}
        - Memory Used: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}`);
      
      journeySteps.forEach(step => {
        const status = step.success ? '✅' : '❌';
        const extra = step.eventsFound ? `, ${step.eventsFound} events found` :
                     step.scoredEvents ? `, ${step.scoredEvents} events scored` :
                     step.approvedEvents ? `, ${step.approvedEvents} events approved` :
                     step.registeredEvents ? `, ${step.registeredEvents} events registered` :
                     step.calendarEvents ? `, ${step.calendarEvents} calendar events` :
                     step.upcomingEvents ? `, ${step.upcomingEvents} upcoming events` : '';
        
        console.log(`  ${status} ${step.step}: ${step.duration}ms${extra}`);
      });
    });

    test('Multi-step onboarding with error recovery', async () => {
      const errorRecoveryTest = async () => {
        const recoverySteps = [];
        
        // Step 1: Initial setup (should succeed)
        let stepStart = Date.now();
        const initialSetup = await request(app)
          .post('/api/family/setup')
          .send({
            familyId: `recovery-${Date.now()}`,
            familyName: 'Recovery Test Family',
            location: { address: '456 Recovery St, San Francisco, CA' },
            children: [{ name: 'Test Child', age: 5, interests: ['testing'] }]
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'initial_setup',
          duration: Date.now() - stepStart,
          success: initialSetup.status === 200
        });
        
        // Step 2: Simulate preferences failure and recovery
        stepStart = Date.now();
        
        // First attempt with invalid data (should fail gracefully)
        const invalidPreferences = await request(app)
          .post('/api/family/preferences')
          .send({
            familyId: 'invalid-family-id',
            preferences: { invalidField: 'invalid-data' }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        // Recovery attempt with valid data
        const validPreferences = await request(app)
          .post('/api/family/preferences')
          .send({
            familyId: `recovery-${Date.now()}`,
            preferences: {
              maxCost: 30,
              maxDistance: '15 miles',
              categories: ['educational', 'fun']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'preferences_recovery',
          duration: Date.now() - stepStart,
          success: validPreferences.status === 200,
          initialFailed: invalidPreferences.status >= 400,
          recoverySucceeded: validPreferences.status === 200
        });
        
        // Step 3: Simulate discovery service failure and fallback
        stepStart = Date.now();
        
        // Mock scraper failure
        mockScraperManager.scrapeAll.mockRejectedValueOnce(new Error('External service unavailable'));
        
        const discoveryAttempt = await request(app)
          .post('/api/automation/discover')
          .send({
            familyId: `recovery-${Date.now()}`,
            sources: ['failing-source'],
            fallbackToCache: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'discovery_fallback',
          duration: Date.now() - stepStart,
          success: discoveryAttempt.status < 500, // Should handle failure gracefully
          usedFallback: discoveryAttempt.body?.usedFallback || false
        });
        
        return recoverySteps;
      };

      const { result: recoverySteps, metrics } = await performanceMonitor.measure(
        'error_recovery_onboarding',
        errorRecoveryTest
      );
      
      // Validate error recovery
      expect(recoverySteps).toHaveLength(3);
      expect(recoverySteps[0].success).toBe(true); // Initial setup works
      expect(recoverySteps[1].recoverySucceeded).toBe(true); // Recovery from invalid data
      expect(recoverySteps[2].success).toBe(true); // Graceful service failure handling
      
      console.log(`📊 Error Recovery Test Results:
        - Total Duration: ${metrics.duration}ms
        - Recovery Steps: ${recoverySteps.length}`);
      
      recoverySteps.forEach(step => {
        const status = step.success ? '✅' : '❌';
        console.log(`  ${status} ${step.step}: ${step.duration}ms`);
      });
    });

    test('Family onboarding data validation and security', async () => {
      const securityValidationTest = async () => {
        const validationTests = [];
        
        // Test 1: SQL Injection Prevention
        const sqlInjectionAttempt = await request(app)
          .post('/api/family/setup')
          .send({
            familyId: "'; DROP TABLE families; --",
            familyName: '<script>alert("xss")</script>',
            location: { address: "'; SELECT * FROM family_settings; --" }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        validationTests.push({
          test: 'sql_injection_prevention',
          success: sqlInjectionAttempt.status >= 400,
          blocked: sqlInjectionAttempt.status >= 400
        });
        
        // Test 2: XSS Prevention
        const xssAttempt = await request(app)
          .post('/api/family/preferences')
          .send({
            familyId: 'test-family',
            preferences: {
              categories: ['<script>alert("xss")</script>', 'javascript:alert("xss")'],
              location: '<img src="x" onerror="alert(\'xss\')">'
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        validationTests.push({
          test: 'xss_prevention',
          success: xssAttempt.status < 500, // Should handle without crashing
          sanitized: !JSON.stringify(xssAttempt.body).includes('<script>')
        });
        
        // Test 3: Data Size Limits
        const largeFamilyData = {
          familyId: 'large-data-test',
          familyName: 'A'.repeat(10000), // Very long name
          children: Array(100).fill().map((_, i) => ({
            name: `Child ${i}`,
            age: 5,
            interests: Array(50).fill(`interest-${i}`)
          }))
        };
        
        const dataSizeTest = await request(app)
          .post('/api/family/setup')
          .send(largeFamilyData)
          .set('Authorization', `Bearer ${validToken}`);
        
        validationTests.push({
          test: 'data_size_limits',
          success: dataSizeTest.status >= 400 || 
                   (dataSizeTest.status === 200 && 
                    dataSizeTest.body.familyName?.length < 1000),
          handled: dataSizeTest.status !== 500
        });
        
        // Test 4: Authentication Bypass Attempts
        const noAuthAttempt = await request(app)
          .post('/api/family/setup')
          .send({
            familyId: 'no-auth-test',
            familyName: 'Unauthorized Family'
          });
        
        const invalidAuthAttempt = await request(app)
          .post('/api/family/setup')
          .send({
            familyId: 'invalid-auth-test',
            familyName: 'Invalid Auth Family'
          })
          .set('Authorization', 'Bearer invalid-token');
        
        validationTests.push({
          test: 'authentication_enforcement',
          success: noAuthAttempt.status === 401 && invalidAuthAttempt.status === 401,
          noAuthBlocked: noAuthAttempt.status === 401,
          invalidAuthBlocked: invalidAuthAttempt.status === 401
        });
        
        return validationTests;
      };

      const { result: validationTests, metrics } = await performanceMonitor.measure(
        'security_validation_test',
        securityValidationTest
      );
      
      // Validate all security tests passed
      expect(validationTests.every(test => test.success)).toBe(true);
      
      const sqlTest = validationTests.find(t => t.test === 'sql_injection_prevention');
      const xssTest = validationTests.find(t => t.test === 'xss_prevention');
      const sizeTest = validationTests.find(t => t.test === 'data_size_limits');
      const authTest = validationTests.find(t => t.test === 'authentication_enforcement');
      
      expect(sqlTest.blocked).toBe(true);
      expect(xssTest.sanitized).toBe(true);
      expect(sizeTest.handled).toBe(true);
      expect(authTest.noAuthBlocked && authTest.invalidAuthBlocked).toBe(true);
      
      console.log(`📊 Security Validation Results:
        - Tests Passed: ${validationTests.filter(t => t.success).length}/${validationTests.length}
        - Duration: ${metrics.duration}ms`);
      
      validationTests.forEach(test => {
        const status = test.success ? '✅' : '❌';
        console.log(`  ${status} ${test.test}`);
      });
    });
  });
});

// Helper functions
function generateRealisticEvents(count, source = 'test-source') {
  const venues = ['SF Library', 'Golden Gate Park', 'Exploratorium', 'Aquarium', 'Zoo', 'Museum'];
  const activities = ['Story Time', 'Science Workshop', 'Art Class', 'Nature Walk', 'Concert', 'Festival'];
  const ageRanges = [[2, 5], [3, 8], [5, 12], [0, 3], [6, 10], [4, 8]];
  
  return Array(count).fill().map((_, i) => ({
    id: `${source}-event-${Date.now()}-${i}`,
    title: `${activities[i % activities.length]} at ${venues[i % venues.length]}`,
    date: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)), // Future dates
    time: ['09:00', '10:00', '11:00', '14:00', '15:00'][i % 5],
    location_name: venues[i % venues.length],
    location_address: `${100 + i} ${venues[i % venues.length]} St, San Francisco, CA`,
    location_distance: `${(i % 10) + 1} miles`,
    cost: i % 4 === 0 ? 0 : Math.floor(Math.random() * 30) + 5,
    age_min: ageRanges[i % ageRanges.length][0],
    age_max: ageRanges[i % ageRanges.length][1],
    status: 'discovered',
    description: `Family-friendly ${activities[i % activities.length].toLowerCase()} perfect for children`,
    registration_url: `https://example.com/register/${source}-${i}`,
    social_proof_rating: 3.5 + (Math.random() * 1.5),
    social_proof_review_count: Math.floor(Math.random() * 200) + 20,
    social_proof_tags: JSON.stringify(['family-friendly', 'educational', 'fun']),
    weather_context: ['indoor', 'outdoor', 'covered'][i % 3],
    preferences_context: ['liked', 'neutral', 'interested'][i % 3],
    source: source,
    created_at: new Date(),
    updated_at: new Date()
  }));
}

function calculateRealisticScore(event) {
  let score = 50; // Base score
  
  // Cost scoring
  if (event.cost === 0) score += 20;
  else if (event.cost < 15) score += 10;
  else if (event.cost > 25) score -= 10;
  
  // Age appropriateness (assuming family has children aged 4-6)
  if (event.age_min <= 4 && event.age_max >= 6) score += 15;
  else if (event.age_min <= 6 && event.age_max >= 4) score += 10;
  else score -= 5;
  
  // Distance scoring
  const distance = parseInt(event.location_distance);
  if (distance <= 5) score += 10;
  else if (distance <= 10) score += 5;
  else score -= 5;
  
  // Random variation
  score += Math.floor(Math.random() * 20) - 10;
  
  return Math.max(0, Math.min(100, score));
}

function extractEventDataFromQuery(query, params) {
  // Simple mock extraction - in real implementation would parse SQL
  return {
    id: `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: 'Mock Event',
    status: 'discovered',
    score: 0,
    created_at: new Date(),
    updated_at: new Date()
  };
}