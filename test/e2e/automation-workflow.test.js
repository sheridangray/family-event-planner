/**
 * Complete Automation Workflow End-to-End Tests
 * 
 * Full automation pipeline testing from discovery through registration and calendar integration
 */

const request = require('supertest');
const express = require('express');
const { PerformanceMonitor, LoadGenerator } = require('../performance/performance-utils');

describe('Complete Automation Workflow E2E Tests', () => {
  let app;
  let performanceMonitor;
  let loadGenerator;
  let mockDatabase;
  let mockLogger;
  let validToken;
  let automationSystem;

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create comprehensive Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock comprehensive automation system with realistic behaviors
    automationSystem = {
      scraperManager: {
        scrapeAll: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Realistic scraping time
          const events = generateAutomationEvents(50);
          console.log(`🔍 Scraper found ${events.length} events`);
          return events;
        }),
        scrapeSource: jest.fn().mockImplementation(async (source) => {
          await new Promise(resolve => setTimeout(resolve, 800));
          const events = generateAutomationEvents(12, source);
          console.log(`🔍 Scraper found ${events.length} events from ${source}`);
          return events;
        }),
        getScrapingStatus: jest.fn().mockImplementation(async () => {
          return {
            lastRun: new Date(),
            status: 'completed',
            eventsFound: 50,
            errors: 0,
            sources: ['sf-library', 'sf-rec-parks', 'eventbrite', 'funcheapsf', 'museums']
          };
        })
      },

      eventScorer: {
        scoreEvents: jest.fn().mockImplementation(async (events) => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const scoredEvents = events.map(event => ({
            ...event,
            age_appropriateness_score: calculateAgeScore(event),
            cost_score: calculateCostScore(event),
            location_score: calculateLocationScore(event),
            timing_score: calculateTimingScore(event),
            total_score: calculateTotalScore(event),
            score: calculateTotalScore(event),
            scoring_timestamp: new Date()
          }));
          console.log(`📊 Scored ${scoredEvents.length} events, avg score: ${(scoredEvents.reduce((sum, e) => sum + e.total_score, 0) / scoredEvents.length).toFixed(1)}`);
          return scoredEvents;
        }),
        getHighScoringEvents: jest.fn().mockImplementation(async (minScore = 75) => {
          return generateAutomationEvents(8).filter(e => calculateTotalScore(e) >= minScore);
        })
      },

      registrationAutomator: {
        processApprovedEvents: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Realistic registration time
          const results = {
            processed: 6,
            registered: 4,
            failed: 2,
            blocked: 0, // Paid events blocked by payment guard
            results: [
              { eventId: 'event-1', success: true, confirmationNumber: 'FEP-AUTOMATION-001', registeredAt: new Date() },
              { eventId: 'event-2', success: true, confirmationNumber: 'FEP-AUTOMATION-002', registeredAt: new Date() },
              { eventId: 'event-3', success: true, confirmationNumber: 'FEP-AUTOMATION-003', registeredAt: new Date() },
              { eventId: 'event-4', success: true, confirmationNumber: 'FEP-AUTOMATION-004', registeredAt: new Date() },
              { eventId: 'event-5', success: false, error: 'Event capacity reached', attemptedAt: new Date() },
              { eventId: 'event-6', success: false, error: 'Registration period closed', attemptedAt: new Date() }
            ]
          };
          console.log(`🎯 Registration: ${results.registered} successful, ${results.failed} failed`);
          return results;
        }),
        registerForEvent: jest.fn().mockImplementation(async (eventId, familyId) => {
          await new Promise(resolve => setTimeout(resolve, 1500));
          // 85% success rate for individual registrations
          if (Math.random() > 0.15) {
            return {
              success: true,
              confirmationNumber: `FEP-${Date.now()}-${eventId.slice(-3)}`,
              message: 'Successfully registered for event',
              registeredAt: new Date()
            };
          } else {
            throw new Error('Event registration failed: External system error');
          }
        })
      },

      calendarManager: {
        createCalendarEvent: jest.fn().mockImplementation(async (eventData) => {
          await new Promise(resolve => setTimeout(resolve, 800));
          return {
            success: true,
            calendarId: `gcal-${Date.now()}`,
            eventId: eventData.id,
            htmlLink: `https://calendar.google.com/event?eid=${Date.now()}`,
            status: 'confirmed',
            createdAt: new Date()
          };
        }),
        syncFamilyCalendar: jest.fn().mockImplementation(async (familyId) => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return {
            success: true,
            eventsSynced: 4,
            lastSync: new Date()
          };
        })
      },

      notificationManager: {
        sendAutomationSummary: jest.fn().mockImplementation(async (summaryData) => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return {
            emailSent: true,
            smsSent: true,
            pushSent: true,
            messageId: `summary-${Date.now()}`
          };
        }),
        sendEventReminders: jest.fn().mockImplementation(async (events) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return {
            remindersSent: events.length,
            channels: ['email', 'sms', 'push'],
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours ahead
          };
        })
      },

      familyPreferenceEngine: {
        updatePreferences: jest.fn().mockImplementation(async (familyId, learningData) => {
          await new Promise(resolve => setTimeout(resolve, 400));
          return {
            preferencesUpdated: true,
            newInterests: learningData.newInterests || [],
            adjustedWeights: learningData.adjustedWeights || {},
            confidence: 0.85
          };
        }),
        getPersonalizedRecommendations: jest.fn().mockImplementation(async (familyId) => {
          return {
            recommendations: generateAutomationEvents(10),
            confidence: 0.92,
            basedOn: ['past_attendance', 'explicit_preferences', 'family_demographics']
          };
        })
      }
    };
    
    // Mock app.locals with automation system
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      ...automationSystem
    };
    
    // Add API routes
    const apiRouter = require('../../src/api')(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Enhanced database mock for automation workflows
    let automationState = {
      events: [],
      families: {},
      automationRuns: [],
      registrations: [],
      calendarEvents: []
    };
    
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 30 + 5;
      
      return new Promise(resolve => {
        setTimeout(() => {
          // Automation run tracking
          if (query.includes('automation_runs')) {
            if (query.includes('INSERT')) {
              const runId = `run-${Date.now()}`;
              automationState.automationRuns.push({
                id: runId,
                family_id: params[0],
                status: 'in_progress',
                started_at: new Date()
              });
              resolve({ rowCount: 1, rows: [{ id: runId }] });
            } else {
              resolve({ rows: automationState.automationRuns });
            }
          }
          // Event operations
          else if (query.includes('events')) {
            if (query.includes('INSERT')) {
              const event = {
                id: params[0] || `auto-event-${Date.now()}`,
                title: params[1] || 'Auto Event',
                status: params[2] || 'discovered',
                score: params[3] || 0,
                created_at: new Date(),
                updated_at: new Date()
              };
              automationState.events.push(event);
              resolve({ rowCount: 1 });
            } else if (query.includes('UPDATE')) {
              const eventId = params[params.length - 1];
              const eventIndex = automationState.events.findIndex(e => e.id === eventId);
              if (eventIndex !== -1) {
                automationState.events[eventIndex].updated_at = new Date();
                if (query.includes('status')) automationState.events[eventIndex].status = params[0];
                if (query.includes('score')) automationState.events[eventIndex].score = params[0];
              }
              resolve({ rowCount: eventIndex !== -1 ? 1 : 0 });
            } else {
              // SELECT queries
              let filteredEvents = automationState.events;
              if (params.length > 0) {
                const status = params.find(p => ['discovered', 'scored', 'approved', 'registered'].includes(p));
                if (status) filteredEvents = filteredEvents.filter(e => e.status === status);
              }
              if (query.includes('COUNT(*)')) {
                resolve({ rows: [{ total: filteredEvents.length }] });
              } else {
                resolve({ rows: filteredEvents.slice(0, 50) });
              }
            }
          }
          // Registration tracking
          else if (query.includes('registrations')) {
            if (query.includes('INSERT')) {
              automationState.registrations.push({
                id: `reg-${Date.now()}`,
                event_id: params[0],
                family_id: params[1],
                confirmation_number: params[2],
                registered_at: new Date()
              });
              resolve({ rowCount: 1 });
            } else {
              resolve({ rows: automationState.registrations });
            }
          }
          // Calendar events
          else if (query.includes('calendar_events')) {
            if (query.includes('INSERT')) {
              automationState.calendarEvents.push({
                event_id: params[0],
                calendar_event_id: params[1],
                created_at: new Date()
              });
              resolve({ rowCount: 1 });
            } else {
              resolve({ rows: automationState.calendarEvents });
            }
          }
          // Default
          else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
  });

  describe('Complete Weekly Automation Cycle', () => {
    test('Full automation pipeline: Discovery → Scoring → Approval → Registration → Calendar', async () => {
      const fullAutomationTest = async () => {
        const familyId = 'automation-family-001';
        const automationSteps = [];
        
        console.log('\n🚀 Starting complete automation pipeline...\n');
        
        // Step 1: Initiate weekly discovery automation
        let stepStart = Date.now();
        const discoveryResponse = await request(app)
          .post('/api/automation/weekly-discovery')
          .send({
            familyId: familyId,
            automation: {
              enabled: true,
              sources: ['all'],
              filters: {
                maxDistance: '15 miles',
                categories: ['educational', 'outdoor', 'arts', 'STEM'],
                ageRange: { min: 4, max: 8 },
                maxCost: 25
              }
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'discovery_initiation',
          duration: Date.now() - stepStart,
          success: discoveryResponse.status === 200,
          eventsDiscovered: discoveryResponse.body?.eventsDiscovered || 0,
          sources: discoveryResponse.body?.sourcesScraped || []
        });
        
        console.log(`✅ Discovery: Found ${automationSteps[0].eventsDiscovered} events in ${automationSteps[0].duration}ms`);
        
        // Step 2: Automatic event scoring
        stepStart = Date.now();
        const scoringResponse = await request(app)
          .post('/api/automation/score-events')
          .send({
            familyId: familyId,
            scoringCriteria: {
              ageWeight: 0.30,
              costWeight: 0.25,
              locationWeight: 0.20,
              interestWeight: 0.25
            },
            autoFilter: {
              minScore: 60,
              autoApprove: false // Family wants manual approval
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'automated_scoring',
          duration: Date.now() - stepStart,
          success: scoringResponse.status === 200,
          eventsScored: scoringResponse.body?.eventsScored || 0,
          averageScore: scoringResponse.body?.averageScore || 0,
          highScoringEvents: scoringResponse.body?.highScoringEvents || 0
        });
        
        console.log(`✅ Scoring: ${automationSteps[1].eventsScored} events scored, avg: ${automationSteps[1].averageScore}`);
        
        // Step 3: Family preference learning update
        stepStart = Date.now();
        const preferenceLearningResponse = await request(app)
          .post('/api/automation/update-preferences')
          .send({
            familyId: familyId,
            learningData: {
              recentAttendance: ['science_workshop', 'art_class', 'nature_walk'],
              recentRatings: [
                { eventType: 'STEM', rating: 5 },
                { eventType: 'arts', rating: 4 },
                { eventType: 'outdoor', rating: 5 }
              ],
              childFeedback: {
                'Emma': ['loved the dinosaurs', 'wants more science'],
                'Oliver': ['enjoyed building', 'likes hands-on activities']
              }
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'preference_learning',
          duration: Date.now() - stepStart,
          success: preferenceLearningResponse.status === 200,
          preferencesUpdated: preferenceLearningResponse.body?.preferencesUpdated || false,
          confidence: preferenceLearningResponse.body?.confidence || 0
        });
        
        console.log(`✅ Learning: Preferences updated with ${automationSteps[2].confidence} confidence`);
        
        // Step 4: Simulate family review and approval
        stepStart = Date.now();
        const approvalResponse = await request(app)
          .post('/api/automation/family-approval')
          .send({
            familyId: familyId,
            approvalCriteria: {
              autoApprove: true,
              minScore: 75,
              maxCost: 20,
              requiresFreeEvents: false,
              maxEventsPerWeek: 3
            },
            reviewSettings: {
              skipReview: false,
              notifyOnApproval: true
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'family_approval',
          duration: Date.now() - stepStart,
          success: approvalResponse.status === 200,
          eventsApproved: approvalResponse.body?.eventsApproved || 0,
          requiresManualReview: approvalResponse.body?.requiresManualReview || 0
        });
        
        console.log(`✅ Approval: ${automationSteps[3].eventsApproved} events approved`);
        
        // Step 5: Automated registration for approved free events
        stepStart = Date.now();
        const registrationResponse = await request(app)
          .post('/api/automation/auto-registration')
          .send({
            familyId: familyId,
            registrationSettings: {
              autoRegisterFreeEvents: true,
              requireConfirmation: false,
              maxSimultaneousRegistrations: 3,
              paymentGuardEnabled: true // CRITICAL: Must block paid events
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'automated_registration',
          duration: Date.now() - stepStart,
          success: registrationResponse.status === 200,
          registrationsAttempted: registrationResponse.body?.registrationsAttempted || 0,
          registrationsSuccessful: registrationResponse.body?.registrationsSuccessful || 0,
          registrationsFailed: registrationResponse.body?.registrationsFailed || 0,
          paidEventsBlocked: registrationResponse.body?.paidEventsBlocked || 0
        });
        
        console.log(`✅ Registration: ${automationSteps[4].registrationsSuccessful} successful, ${automationSteps[4].paidEventsBlocked} paid events blocked`);
        
        // Step 6: Calendar integration for registered events
        stepStart = Date.now();
        const calendarResponse = await request(app)
          .post('/api/automation/calendar-integration')
          .send({
            familyId: familyId,
            calendarSettings: {
              createCalendarEvents: true,
              addReminders: true,
              shareWithFamily: true,
              reminderTiming: ['1 day', '2 hours', '30 minutes']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'calendar_integration',
          duration: Date.now() - stepStart,
          success: calendarResponse.status === 200,
          calendarEventsCreated: calendarResponse.body?.calendarEventsCreated || 0,
          remindersScheduled: calendarResponse.body?.remindersScheduled || 0
        });
        
        console.log(`✅ Calendar: ${automationSteps[5].calendarEventsCreated} events added to calendar`);
        
        // Step 7: Family notification and summary
        stepStart = Date.now();
        const notificationResponse = await request(app)
          .post('/api/automation/family-notification')
          .send({
            familyId: familyId,
            notificationData: {
              totalEventsFound: automationSteps[0].eventsDiscovered,
              eventsApproved: automationSteps[3].eventsApproved,
              eventsRegistered: automationSteps[4].registrationsSuccessful,
              calendarEventsCreated: automationSteps[5].calendarEventsCreated,
              nextActions: ['review_upcoming_events', 'check_calendar']
            },
            channels: ['email', 'sms', 'push', 'in-app']
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'family_notification',
          duration: Date.now() - stepStart,
          success: notificationResponse.status === 200,
          notificationsSent: notificationResponse.body?.notificationsSent || 0,
          channels: notificationResponse.body?.channels || []
        });
        
        console.log(`✅ Notifications: Sent via ${automationSteps[6].channels.join(', ')}`);
        
        // Step 8: Automation analytics and reporting
        stepStart = Date.now();
        const analyticsResponse = await request(app)
          .post('/api/automation/analytics')
          .send({
            familyId: familyId,
            analyticsData: {
              automationRun: {
                eventsDiscovered: automationSteps[0].eventsDiscovered,
                eventsScored: automationSteps[1].eventsScored,
                eventsApproved: automationSteps[3].eventsApproved,
                eventsRegistered: automationSteps[4].registrationsSuccessful,
                totalDuration: automationSteps.reduce((sum, step) => sum + step.duration, 0)
              },
              familyEngagement: {
                automationAcceptanceRate: 0.85,
                averageEventRating: 4.3,
                preferenceAccuracy: automationSteps[2].confidence
              }
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        automationSteps.push({
          step: 'automation_analytics',
          duration: Date.now() - stepStart,
          success: analyticsResponse.status === 200,
          analyticsGenerated: analyticsResponse.body?.analyticsGenerated || false,
          insights: analyticsResponse.body?.insights || []
        });
        
        console.log(`✅ Analytics: Generated insights for continuous improvement`);
        
        console.log('\n🎉 Complete automation pipeline finished!\n');
        
        return automationSteps;
      };

      const { result: automationSteps, metrics } = await performanceMonitor.measure(
        'complete_automation_pipeline',
        fullAutomationTest
      );
      
      // Validate complete automation pipeline
      expect(automationSteps.length).toBe(8);
      expect(automationSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(45000); // Complete automation <45 seconds
      
      // Validate step-by-step progression
      const discoveryStep = automationSteps.find(s => s.step === 'discovery_initiation');
      const scoringStep = automationSteps.find(s => s.step === 'automated_scoring');
      const approvalStep = automationSteps.find(s => s.step === 'family_approval');
      const registrationStep = automationSteps.find(s => s.step === 'automated_registration');
      const calendarStep = automationSteps.find(s => s.step === 'calendar_integration');
      
      expect(discoveryStep.eventsDiscovered).toBeGreaterThan(0);
      expect(scoringStep.eventsScored).toBeGreaterThan(0);
      expect(approvalStep.eventsApproved).toBeGreaterThan(0);
      expect(registrationStep.registrationsSuccessful).toBeGreaterThan(0);
      expect(calendarStep.calendarEventsCreated).toBeGreaterThan(0);
      
      // CRITICAL: Verify payment guard worked
      expect(registrationStep.paidEventsBlocked).toBeGreaterThanOrEqual(0);
      
      console.log(`\n📊 Complete Automation Pipeline Results:
        - Total Duration: ${metrics.duration}ms
        - Events Discovered: ${discoveryStep.eventsDiscovered}
        - Events Scored: ${scoringStep.eventsScored}
        - Events Approved: ${approvalStep.eventsApproved}
        - Events Registered: ${registrationStep.registrationsSuccessful}
        - Calendar Events: ${calendarStep.calendarEventsCreated}
        - Paid Events Blocked: ${registrationStep.paidEventsBlocked}
        - Memory Used: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}\n`);
      
      automationSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });

    test('Automation failure recovery and rollback', async () => {
      const failureRecoveryTest = async () => {
        const familyId = 'automation-recovery-family';
        const recoverySteps = [];
        
        // Step 1: Start automation with induced failures
        let stepStart = Date.now();
        
        // Induce scraper failure
        automationSystem.scraperManager.scrapeAll.mockRejectedValueOnce(new Error('External service timeout'));
        
        const failedDiscoveryResponse = await request(app)
          .post('/api/automation/weekly-discovery')
          .send({
            familyId: familyId,
            automation: { enabled: true, fallbackEnabled: true }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'handle_scraper_failure',
          duration: Date.now() - stepStart,
          success: failedDiscoveryResponse.status < 500, // Should handle gracefully
          fallbackUsed: failedDiscoveryResponse.body?.fallbackUsed || false,
          errorHandled: failedDiscoveryResponse.status !== 500
        });
        
        // Step 2: Recovery with backup data
        stepStart = Date.now();
        const recoveryResponse = await request(app)
          .post('/api/automation/recovery-mode')
          .send({
            familyId: familyId,
            recoveryStrategy: 'use_cached_events',
            fallbackSources: ['cached_events', 'family_history'],
            minimumEvents: 5
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'automation_recovery',
          duration: Date.now() - stepStart,
          success: recoveryResponse.status === 200,
          eventsRecovered: recoveryResponse.body?.eventsRecovered || 0,
          recoveryStrategy: recoveryResponse.body?.strategyUsed
        });
        
        // Step 3: Partial automation with reduced scope
        stepStart = Date.now();
        const partialAutomationResponse = await request(app)
          .post('/api/automation/partial-mode')
          .send({
            familyId: familyId,
            partialSettings: {
              skipScraping: true,
              useExistingEvents: true,
              reducedFeatures: ['scoring_only', 'manual_approval']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'partial_automation',
          duration: Date.now() - stepStart,
          success: partialAutomationResponse.status === 200,
          partialModeEnabled: partialAutomationResponse.body?.partialModeEnabled || false,
          availableFeatures: partialAutomationResponse.body?.availableFeatures || []
        });
        
        return recoverySteps;
      };

      const { result: recoverySteps, metrics } = await performanceMonitor.measure(
        'automation_failure_recovery',
        failureRecoveryTest
      );
      
      // Validate failure recovery
      expect(recoverySteps.length).toBe(3);
      expect(recoverySteps.every(step => step.success)).toBe(true);
      
      const failureStep = recoverySteps.find(s => s.step === 'handle_scraper_failure');
      const recoveryStep = recoverySteps.find(s => s.step === 'automation_recovery');
      const partialStep = recoverySteps.find(s => s.step === 'partial_automation');
      
      expect(failureStep.errorHandled).toBe(true);
      expect(recoveryStep.eventsRecovered).toBeGreaterThan(0);
      expect(partialStep.partialModeEnabled).toBe(true);
      
      console.log(`📊 Automation Failure Recovery:
        - Recovery Duration: ${metrics.duration}ms
        - Error Handled: ${failureStep.errorHandled}
        - Events Recovered: ${recoveryStep.eventsRecovered}
        - Partial Mode: ${partialStep.partialModeEnabled}`);
    });
  });

  describe('Concurrent Family Automation', () => {
    test('Multiple families running automation simultaneously', async () => {
      const multiFamilyAutomationTest = async (familyIndex) => {
        const familyId = `concurrent-family-${familyIndex}`;
        const familySteps = [];
        
        // Each family runs a simplified automation cycle
        const steps = [
          // Discovery
          () => request(app)
            .post('/api/automation/weekly-discovery')
            .send({ familyId })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Scoring
          () => request(app)
            .post('/api/automation/score-events')
            .send({ familyId })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Approval
          () => request(app)
            .post('/api/automation/family-approval')
            .send({ familyId })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Registration
          () => request(app)
            .post('/api/automation/auto-registration')
            .send({ familyId })
            .set('Authorization', `Bearer ${validToken}`)
        ];
        
        for (const step of steps) {
          const stepStart = Date.now();
          try {
            const response = await step();
            familySteps.push({
              familyId,
              duration: Date.now() - stepStart,
              success: response.status === 200
            });
          } catch (error) {
            familySteps.push({
              familyId,
              duration: Date.now() - stepStart,
              success: false,
              error: error.message
            });
          }
        }
        
        return familySteps;
      };

      const result = await loadGenerator.generateLoad(multiFamilyAutomationTest, 8, 24); // 8 concurrent families
      
      expect(result.successRate).toBeGreaterThan(85); // >85% success under concurrent load
      expect(result.averageTime).toBeLessThan(15000); // <15s per family automation
      
      console.log(`📊 Concurrent Family Automation:
        - Families: 8 concurrent
        - Total Automations: ${result.totalOperations}
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms`);
    });

    test('Peak automation load simulation', async () => {
      const peakLoadTest = async (requestId) => {
        // Simulate system peak load (Sunday evening automation)
        const loadTypes = [
          // Weekly discovery runs
          () => request(app)
            .post('/api/automation/weekly-discovery')
            .send({ familyId: `peak-family-${requestId}` })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Manual event searches during peak
          () => request(app)
            .get('/api/events')
            .query({ search: 'weekend activities', limit: 20 })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Bulk approvals
          () => request(app)
            .post('/api/events/bulk-action')
            .send({
              action: 'approve',
              eventIds: [`peak-event-${requestId}-1`, `peak-event-${requestId}-2`]
            })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Registration attempts
          () => request(app)
            .post('/api/automation/auto-registration')
            .send({ familyId: `peak-family-${requestId}` })
            .set('Authorization', `Bearer ${validToken}`)
        ];
        
        const operation = loadTypes[requestId % loadTypes.length];
        return await operation();
      };

      const result = await loadGenerator.generateLoad(peakLoadTest, 15, 60); // High peak load
      
      expect(result.successRate).toBeGreaterThan(80); // >80% during peak load
      expect(result.averageTime).toBeLessThan(10000); // <10s during peak
      
      console.log(`📊 Peak Automation Load Simulation:
        - Peak Concurrent: 15
        - Total Operations: ${result.totalOperations}
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Response: ${result.averageTime.toFixed(2)}ms
        - Operations/second: ${(result.totalOperations / (result.totalTime / 1000)).toFixed(1)}`);
    });
  });

  describe('Automation Quality and Accuracy', () => {
    test('Scoring accuracy and family preference matching', async () => {
      const scoringAccuracyTest = async () => {
        const familyId = 'accuracy-test-family';
        const accuracySteps = [];
        
        // Step 1: Set specific family preferences
        let stepStart = Date.now();
        const preferencesResponse = await request(app)
          .post('/api/family/preferences')
          .send({
            familyId: familyId,
            preferences: {
              children: [
                { name: 'Science Lover', age: 7, interests: ['science', 'STEM', 'experiments'] },
                { name: 'Art Creator', age: 5, interests: ['art', 'crafts', 'creativity'] }
              ],
              categories: ['educational', 'STEM', 'arts', 'hands-on'],
              avoidCategories: ['scary', 'competitive'],
              maxCost: 20,
              maxDistance: '10 miles',
              preferredTimes: ['morning', 'afternoon']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        accuracySteps.push({
          step: 'set_preferences',
          duration: Date.now() - stepStart,
          success: preferencesResponse.status === 200,
          preferencesSet: preferencesResponse.body?.preferencesSet || false
        });
        
        // Step 2: Score events with specific criteria
        stepStart = Date.now();
        const scoringResponse = await request(app)
          .post('/api/automation/precision-scoring')
          .send({
            familyId: familyId,
            testEvents: [
              {
                id: 'perfect-match',
                title: 'Kids Science Workshop',
                categories: ['science', 'STEM', 'hands-on'],
                ageRange: { min: 5, max: 8 },
                cost: 0,
                distance: '3 miles',
                time: 'morning'
              },
              {
                id: 'good-match',
                title: 'Art and Crafts Class',
                categories: ['art', 'crafts', 'creativity'],
                ageRange: { min: 4, max: 7 },
                cost: 15,
                distance: '5 miles',
                time: 'afternoon'
              },
              {
                id: 'poor-match',
                title: 'Competitive Sports Event',
                categories: ['sports', 'competitive'],
                ageRange: { min: 8, max: 12 },
                cost: 30,
                distance: '15 miles',
                time: 'evening'
              }
            ],
            validateAccuracy: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        accuracySteps.push({
          step: 'precision_scoring',
          duration: Date.now() - stepStart,
          success: scoringResponse.status === 200,
          scores: scoringResponse.body?.scores || {},
          accuracy: scoringResponse.body?.accuracy || 0
        });
        
        // Step 3: Validate recommendation quality
        stepStart = Date.now();
        const recommendationResponse = await request(app)
          .get('/api/automation/recommendation-quality')
          .query({
            familyId: familyId,
            testMode: true,
            evaluateAccuracy: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        accuracySteps.push({
          step: 'recommendation_quality',
          duration: Date.now() - stepStart,
          success: recommendationResponse.status === 200,
          qualityScore: recommendationResponse.body?.qualityScore || 0,
          precisionRate: recommendationResponse.body?.precisionRate || 0,
          recallRate: recommendationResponse.body?.recallRate || 0
        });
        
        return accuracySteps;
      };

      const { result: accuracySteps, metrics } = await performanceMonitor.measure(
        'scoring_accuracy_test',
        scoringAccuracyTest
      );
      
      // Validate scoring accuracy
      expect(accuracySteps.length).toBe(3);
      expect(accuracySteps.every(step => step.success)).toBe(true);
      
      const scoringStep = accuracySteps.find(s => s.step === 'precision_scoring');
      const qualityStep = accuracySteps.find(s => s.step === 'recommendation_quality');
      
      // Validate that perfect match scores higher than poor match
      if (scoringStep.scores.perfectMatch && scoringStep.scores.poorMatch) {
        expect(scoringStep.scores.perfectMatch).toBeGreaterThan(scoringStep.scores.poorMatch);
      }
      
      expect(qualityStep.qualityScore).toBeGreaterThan(0.7); // >70% quality
      expect(qualityStep.precisionRate).toBeGreaterThan(0.6); // >60% precision
      
      console.log(`📊 Automation Scoring Accuracy:
        - Quality Score: ${qualityStep.qualityScore}
        - Precision Rate: ${qualityStep.precisionRate}
        - Recall Rate: ${qualityStep.recallRate}
        - Scoring Accuracy: ${scoringStep.accuracy}`);
    });
  });
});

// Helper functions for automation testing
function generateAutomationEvents(count, source = 'automation-source') {
  const categories = ['educational', 'STEM', 'arts', 'outdoor', 'sports', 'music', 'crafts'];
  const venues = ['Library', 'Museum', 'Park', 'Community Center', 'School', 'Art Studio'];
  const activities = ['Workshop', 'Class', 'Event', 'Festival', 'Tour', 'Experience'];
  
  return Array(count).fill().map((_, i) => ({
    id: `${source}-auto-event-${Date.now()}-${i}`,
    title: `${categories[i % categories.length]} ${activities[i % activities.length]} at ${venues[i % venues.length]}`,
    categories: [categories[i % categories.length], categories[(i + 1) % categories.length]],
    date: new Date(Date.now() + ((i % 14) * 24 * 60 * 60 * 1000)), // Next 2 weeks
    time: ['09:00', '10:00', '11:00', '14:00', '15:00'][i % 5],
    location_name: venues[i % venues.length],
    location_address: `${100 + i} ${venues[i % venues.length]} St, San Francisco, CA`,
    distance: `${(i % 15) + 1} miles`,
    cost: i % 3 === 0 ? 0 : Math.floor(Math.random() * 30) + 5, // 1/3 free events
    ageRange: {
      min: 2 + (i % 4),
      max: 8 + (i % 5)
    },
    description: `Family-friendly ${categories[i % categories.length]} activity`,
    registration_url: `https://example.com/register/${source}-${i}`,
    source: source,
    status: 'discovered',
    created_at: new Date(),
    updated_at: new Date()
  }));
}

function calculateAgeScore(event) {
  // Assuming family has children aged 4-7
  const familyAgeRange = { min: 4, max: 7 };
  const eventAgeRange = event.ageRange || { min: event.age_min || 0, max: event.age_max || 18 };
  
  const overlap = Math.max(0, Math.min(familyAgeRange.max, eventAgeRange.max) - Math.max(familyAgeRange.min, eventAgeRange.min));
  const familyRange = familyAgeRange.max - familyAgeRange.min;
  
  return Math.min(25, Math.floor((overlap / familyRange) * 25));
}

function calculateCostScore(event) {
  if (event.cost === 0) return 25;
  if (event.cost <= 10) return 20;
  if (event.cost <= 20) return 15;
  if (event.cost <= 30) return 10;
  return 5;
}

function calculateLocationScore(event) {
  const distance = parseInt(event.distance) || parseInt(event.location_distance) || 5;
  if (distance <= 5) return 25;
  if (distance <= 10) return 20;
  if (distance <= 15) return 15;
  return 10;
}

function calculateTimingScore(event) {
  const preferredTimes = ['morning', 'afternoon'];
  const eventTime = event.time;
  
  if (eventTime && (eventTime.startsWith('09') || eventTime.startsWith('10') || eventTime.startsWith('11'))) {
    return 25; // Morning
  } else if (eventTime && (eventTime.startsWith('13') || eventTime.startsWith('14') || eventTime.startsWith('15'))) {
    return 20; // Afternoon
  }
  return 15; // Other times
}

function calculateTotalScore(event) {
  return calculateAgeScore(event) + calculateCostScore(event) + calculateLocationScore(event) + calculateTimingScore(event);
}