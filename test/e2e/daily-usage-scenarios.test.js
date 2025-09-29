/**
 * Daily Usage Scenario End-to-End Tests
 * 
 * Real-world family usage patterns and workflows
 */

const request = require('supertest');
const express = require('express');
const { PerformanceMonitor, LoadGenerator } = require('../performance/performance-utils');

describe('Daily Family Usage Scenarios', () => {
  let app;
  let performanceMonitor;
  let loadGenerator;
  let mockDatabase;
  let mockLogger;
  let validToken;
  let familyProfiles;

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create comprehensive Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock comprehensive system components
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      scraperManager: {
        scrapeAll: jest.fn().mockResolvedValue(generateDailyEvents(30)),
        scrapeSource: jest.fn().mockResolvedValue(generateDailyEvents(8))
      },
      eventScorer: {
        scoreEvents: jest.fn().mockImplementation(async (events) => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return events.map(e => ({ ...e, score: Math.floor(Math.random() * 100) }));
        })
      },
      registrationAutomator: {
        processApprovedEvents: jest.fn().mockResolvedValue({
          processed: 4, registered: 3, failed: 1
        }),
        registerForEvent: jest.fn().mockResolvedValue({
          success: true, confirmationNumber: `DAILY-${Date.now()}`
        })
      },
      calendarManager: {
        createCalendarEvent: jest.fn().mockResolvedValue({
          success: true, calendarId: `cal-${Date.now()}`
        })
      },
      notificationManager: {
        sendDailyDigest: jest.fn().mockResolvedValue({ sent: true }),
        sendEventReminder: jest.fn().mockResolvedValue({ sent: true })
      }
    };
    
    // Add API routes
    const apiRouter = require('../../src/api')(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Create diverse family profiles for testing
    familyProfiles = {
      busyParents: {
        id: 'busy-family-001',
        name: 'The Busy Parents',
        children: [
          { name: 'Alex', age: 7, interests: ['sports', 'science'] },
          { name: 'Maya', age: 4, interests: ['art', 'music'] }
        ],
        preferences: {
          maxCost: 15,
          maxDistance: '5 miles',
          preferredTimes: ['morning'],
          categories: ['educational', 'quick-activities']
        },
        schedule: {
          availableTime: 'limited',
          weekendOnly: true,
          autoApproval: true
        }
      },
      adventurousFamily: {
        id: 'adventure-family-002',
        name: 'The Adventure Seekers',
        children: [
          { name: 'Sam', age: 9, interests: ['outdoor', 'adventure', 'nature'] },
          { name: 'Riley', age: 6, interests: ['animals', 'hiking', 'camping'] }
        ],
        preferences: {
          maxCost: 50,
          maxDistance: '25 miles',
          categories: ['outdoor', 'adventure', 'nature', 'sports'],
          avoidCategories: ['indoor-only']
        },
        schedule: {
          availableTime: 'flexible',
          weekends: true,
          weekdays: true,
          autoApproval: false
        }
      },
      educationalFamily: {
        id: 'educational-family-003',
        name: 'The Learners',
        children: [
          { name: 'Emma', age: 8, interests: ['science', 'math', 'reading'] },
          { name: 'Noah', age: 5, interests: ['dinosaurs', 'space', 'robots'] }
        ],
        preferences: {
          maxCost: 30,
          maxDistance: '15 miles',
          categories: ['educational', 'museums', 'science', 'STEM'],
          requirements: ['age-appropriate', 'interactive']
        },
        schedule: {
          availableTime: 'moderate',
          preferredDays: ['Saturday', 'Sunday'],
          autoApproval: false
        }
      }
    };
    
    // Enhanced database mock for daily scenarios
    let familyData = {};
    let eventData = [];
    let userSessions = {};
    
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 40 + 5;
      
      return new Promise(resolve => {
        setTimeout(() => {
          // Family data operations
          if (query.includes('SELECT') && query.includes('families')) {
            const familyId = params?.[0];
            if (familyId && familyData[familyId]) {
              resolve({ rows: [familyData[familyId]] });
            } else {
              resolve({ rows: Object.values(familyData) });
            }
          }
          // Event operations
          else if (query.includes('SELECT') && query.includes('events')) {
            if (query.includes('COUNT(*)')) {
              resolve({ rows: [{ total: eventData.length }] });
            } else {
              const status = params?.find(p => ['discovered', 'approved', 'registered'].includes(p));
              const filteredEvents = status ? 
                eventData.filter(e => e.status === status) : 
                eventData;
              resolve({ rows: filteredEvents.slice(0, 50) });
            }
          }
          // Dashboard operations
          else if (query.includes('dashboard') || query.includes('summary')) {
            const familyId = params?.[0];
            const familyEvents = eventData.filter(e => e.family_id === familyId);
            resolve({
              rows: [{
                upcoming_events: familyEvents.filter(e => e.status === 'registered').length,
                pending_events: familyEvents.filter(e => e.status === 'discovered').length,
                this_week_events: familyEvents.filter(e => e.date > new Date()).length,
                total_saved: familyEvents.reduce((sum, e) => sum + (e.cost || 0), 0)
              }]
            });
          }
          // Update operations
          else if (query.includes('UPDATE') || query.includes('INSERT')) {
            resolve({ rowCount: 1 });
          }
          // Default
          else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
    
    // Initialize family data
    Object.values(familyProfiles).forEach(family => {
      familyData[family.id] = family;
      // Add some initial events for each family
      for (let i = 0; i < 10; i++) {
        eventData.push({
          id: `${family.id}-event-${i}`,
          family_id: family.id,
          title: `${family.name} Event ${i}`,
          date: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)),
          status: ['discovered', 'approved', 'registered'][i % 3],
          cost: i % 3 === 0 ? 0 : Math.floor(Math.random() * 25) + 5,
          score: Math.floor(Math.random() * 100)
        });
      }
    });
  });

  describe('Morning Routine Scenarios', () => {
    test('Busy parent morning dashboard check', async () => {
      const morningRoutineTest = async () => {
        const family = familyProfiles.busyParents;
        const routineSteps = [];
        
        // Step 1: Quick morning dashboard check (7:30 AM scenario)
        let stepStart = Date.now();
        const dashboardResponse = await request(app)
          .get(`/api/family/${family.id}/dashboard`)
          .query({ timeContext: 'morning', quickView: true })
          .set('Authorization', `Bearer ${validToken}`);
        
        routineSteps.push({
          step: 'morning_dashboard',
          duration: Date.now() - stepStart,
          success: dashboardResponse.status === 200,
          upcomingEvents: dashboardResponse.body?.upcomingEvents || 0
        });
        
        // Step 2: Check today's events
        stepStart = Date.now();
        const todaysEventsResponse = await request(app)
          .get('/api/events')
          .query({
            familyId: family.id,
            date: new Date().toISOString().split('T')[0],
            status: 'registered'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        routineSteps.push({
          step: 'todays_events',
          duration: Date.now() - stepStart,
          success: todaysEventsResponse.status === 200,
          todaysEvents: todaysEventsResponse.body?.data?.events?.length || 0
        });
        
        // Step 3: Quick notification check
        stepStart = Date.now();
        const notificationsResponse = await request(app)
          .get(`/api/family/${family.id}/notifications`)
          .query({ unreadOnly: true, limit: 5 })
          .set('Authorization', `Bearer ${validToken}`);
        
        routineSteps.push({
          step: 'notifications_check',
          duration: Date.now() - stepStart,
          success: notificationsResponse.status === 200,
          unreadNotifications: notificationsResponse.body?.unread || 0
        });
        
        // Step 4: Quick approve high-scoring events (if any)
        stepStart = Date.now();
        const highScoreEventsResponse = await request(app)
          .get('/api/events')
          .query({
            familyId: family.id,
            status: 'discovered',
            minScore: 85,
            limit: 3
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        const highScoreEvents = highScoreEventsResponse.body?.data?.events || [];
        if (highScoreEvents.length > 0) {
          const quickApprovalResponse = await request(app)
            .post('/api/events/bulk-action')
            .send({
              action: 'approve',
              eventIds: highScoreEvents.map(e => e.id),
              familyId: family.id,
              autoRegister: true // Busy parents want automation
            })
            .set('Authorization', `Bearer ${validToken}`);
          
          routineSteps.push({
            step: 'quick_approval',
            duration: Date.now() - stepStart,
            success: quickApprovalResponse.status === 200,
            approvedEvents: highScoreEvents.length
          });
        }
        
        return routineSteps;
      };

      const { result: routineSteps, metrics } = await performanceMonitor.measure(
        'busy_parent_morning_routine',
        morningRoutineTest
      );
      
      // Validate morning routine efficiency
      expect(routineSteps.length).toBeGreaterThan(2);
      expect(routineSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(5000); // Morning check should be <5 seconds
      
      // Validate speed for busy parents
      const dashboardStep = routineSteps.find(s => s.step === 'morning_dashboard');
      expect(dashboardStep.duration).toBeLessThan(1000); // Dashboard <1 second
      
      console.log(`📊 Busy Parent Morning Routine:
        - Total Duration: ${metrics.duration}ms
        - Dashboard Load: ${dashboardStep.duration}ms
        - Steps Completed: ${routineSteps.length}`);
      
      routineSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });

    test('Weekend family planning session', async () => {
      const weekendPlanningTest = async () => {
        const family = familyProfiles.adventurousFamily;
        const planningSteps = [];
        
        // Step 1: Weekend event discovery
        let stepStart = Date.now();
        const weekendEventsResponse = await request(app)
          .get('/api/events')
          .query({
            familyId: family.id,
            dateRange: 'thisWeekend',
            status: 'discovered',
            categories: family.preferences.categories.join(','),
            maxDistance: family.preferences.maxDistance,
            sortBy: 'score',
            limit: 20
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        planningSteps.push({
          step: 'weekend_discovery',
          duration: Date.now() - stepStart,
          success: weekendEventsResponse.status === 200,
          eventsFound: weekendEventsResponse.body?.data?.events?.length || 0
        });
        
        // Step 2: Family discussion simulation (review event details)
        stepStart = Date.now();
        const events = weekendEventsResponse.body?.data?.events || [];
        const topEvents = events.slice(0, 5);
        
        const detailPromises = topEvents.map(event =>
          request(app)
            .get(`/api/events/${event.id}`)
            .set('Authorization', `Bearer ${validToken}`)
        );
        
        const eventDetails = await Promise.all(detailPromises);
        
        planningSteps.push({
          step: 'event_review',
          duration: Date.now() - stepStart,
          success: eventDetails.every(r => r.status === 200),
          eventsReviewed: eventDetails.length
        });
        
        // Step 3: Collaborative event selection
        stepStart = Date.now();
        const selectedEvents = topEvents.filter((_, i) => i % 2 === 0); // Simulate family choosing every other event
        
        if (selectedEvents.length > 0) {
          const selectionResponse = await request(app)
            .post('/api/events/bulk-action')
            .send({
              action: 'approve',
              eventIds: selectedEvents.map(e => e.id),
              familyId: family.id,
              notes: 'Family weekend activities selected together'
            })
            .set('Authorization', `Bearer ${validToken}`);
          
          planningSteps.push({
            step: 'collaborative_selection',
            duration: Date.now() - stepStart,
            success: selectionResponse.status === 200,
            selectedEvents: selectedEvents.length
          });
        }
        
        // Step 4: Calendar coordination
        stepStart = Date.now();
        const approvedEvents = selectedEvents.filter(e => e.cost === 0); // Auto-register free events
        
        if (approvedEvents.length > 0) {
          const calendarPromises = approvedEvents.map(event =>
            request(app)
              .post(`/api/events/${event.id}/calendar`)
              .send({
                familyId: family.id,
                calendarType: 'family',
                reminderSettings: {
                  emailReminder: true,
                  pushNotification: true,
                  advanceNotice: '1 day'
                }
              })
              .set('Authorization', `Bearer ${validToken}`)
          );
          
          const calendarResults = await Promise.all(calendarPromises);
          
          planningSteps.push({
            step: 'calendar_coordination',
            duration: Date.now() - stepStart,
            success: calendarResults.every(r => r.status === 200),
            calendarEvents: calendarResults.length
          });
        }
        
        return planningSteps;
      };

      const { result: planningSteps, metrics } = await performanceMonitor.measure(
        'weekend_family_planning',
        weekendPlanningTest
      );
      
      // Validate family planning session
      expect(planningSteps.length).toBeGreaterThan(2);
      expect(planningSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(15000); // Planning session <15 seconds
      
      const discoveryStep = planningSteps.find(s => s.step === 'weekend_discovery');
      expect(discoveryStep.eventsFound).toBeGreaterThan(0);
      
      console.log(`📊 Weekend Family Planning Session:
        - Total Duration: ${metrics.duration}ms
        - Events Discovered: ${discoveryStep.eventsFound}
        - Planning Steps: ${planningSteps.length}`);
      
      planningSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });
  });

  describe('Evening Usage Scenarios', () => {
    test('Educational family learning time', async () => {
      const learningTimeTest = async () => {
        const family = familyProfiles.educationalFamily;
        const learningSteps = [];
        
        // Step 1: Search for educational activities
        let stepStart = Date.now();
        const educationalSearchResponse = await request(app)
          .get('/api/events')
          .query({
            familyId: family.id,
            search: 'science museum STEM workshop',
            categories: family.preferences.categories.join(','),
            ageRange: '5-8',
            educational: true,
            sortBy: 'educational_value',
            limit: 15
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        learningSteps.push({
          step: 'educational_search',
          duration: Date.now() - stepStart,
          success: educationalSearchResponse.status === 200,
          educationalEvents: educationalSearchResponse.body?.data?.events?.length || 0
        });
        
        // Step 2: Deep dive into event educational content
        stepStart = Date.now();
        const events = educationalSearchResponse.body?.data?.events || [];
        const topEducationalEvents = events.slice(0, 3);
        
        const educationalDetailPromises = topEducationalEvents.map(event =>
          request(app)
            .get(`/api/events/${event.id}/educational-details`)
            .set('Authorization', `Bearer ${validToken}`)
        );
        
        const educationalDetails = await Promise.allSettled(educationalDetailPromises);
        
        learningSteps.push({
          step: 'educational_analysis',
          duration: Date.now() - stepStart,
          success: educationalDetails.length > 0,
          eventsAnalyzed: educationalDetails.length
        });
        
        // Step 3: Parent-child activity planning
        stepStart = Date.now();
        const activityPlanningResponse = await request(app)
          .post('/api/family/activity-planning')
          .send({
            familyId: family.id,
            selectedEvents: topEducationalEvents.map(e => e.id),
            learningObjectives: [
              'hands-on science exploration',
              'critical thinking development',
              'collaborative learning'
            ],
            preparationNeeded: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        learningSteps.push({
          step: 'activity_planning',
          duration: Date.now() - stepStart,
          success: activityPlanningResponse.status === 200,
          activitiesPlanned: topEducationalEvents.length
        });
        
        // Step 4: Learning progress tracking setup
        stepStart = Date.now();
        const progressTrackingResponse = await request(app)
          .post('/api/family/learning-tracking')
          .send({
            familyId: family.id,
            children: family.children.map(child => ({
              name: child.name,
              age: child.age,
              interests: child.interests,
              learningGoals: ['STEM engagement', 'curiosity building']
            })),
            trackingPreferences: {
              photoJournal: true,
              reflectionNotes: true,
              skillProgress: true
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        learningSteps.push({
          step: 'learning_tracking',
          duration: Date.now() - stepStart,
          success: progressTrackingResponse.status === 200,
          childrenTracked: family.children.length
        });
        
        return learningSteps;
      };

      const { result: learningSteps, metrics } = await performanceMonitor.measure(
        'educational_family_learning_time',
        learningTimeTest
      );
      
      // Validate educational workflow
      expect(learningSteps.length).toBe(4);
      expect(learningSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(12000); // Learning session <12 seconds
      
      const searchStep = learningSteps.find(s => s.step === 'educational_search');
      expect(searchStep.educationalEvents).toBeGreaterThan(0);
      
      console.log(`📊 Educational Family Learning Time:
        - Total Duration: ${metrics.duration}ms
        - Educational Events Found: ${searchStep.educationalEvents}
        - Learning Steps: ${learningSteps.length}`);
      
      learningSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });

    test('Multi-device family coordination', async () => {
      const multiDeviceTest = async () => {
        const family = familyProfiles.busyParents;
        const deviceSteps = [];
        
        // Step 1: Parent 1 on mobile - quick event approval
        let stepStart = Date.now();
        const mobileApprovalResponse = await request(app)
          .post('/api/events/bulk-action')
          .send({
            action: 'approve',
            eventIds: ['mobile-event-1', 'mobile-event-2'],
            familyId: family.id,
            device: 'mobile'
          })
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'Mobile App/1.0');
        
        deviceSteps.push({
          step: 'mobile_approval',
          duration: Date.now() - stepStart,
          success: mobileApprovalResponse.status === 200,
          device: 'mobile'
        });
        
        // Step 2: Parent 2 on desktop - detailed planning
        stepStart = Date.now();
        const desktopPlanningResponse = await request(app)
          .get('/api/family/planning-dashboard')
          .query({
            familyId: family.id,
            view: 'detailed',
            timeRange: 'next2weeks'
          })
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'Desktop Browser/1.0');
        
        deviceSteps.push({
          step: 'desktop_planning',
          duration: Date.now() - stepStart,
          success: desktopPlanningResponse.status === 200,
          device: 'desktop'
        });
        
        // Step 3: Real-time sync verification
        stepStart = Date.now();
        const syncCheckResponse = await request(app)
          .get(`/api/family/${family.id}/sync-status`)
          .set('Authorization', `Bearer ${validToken}`);
        
        deviceSteps.push({
          step: 'device_sync',
          duration: Date.now() - stepStart,
          success: syncCheckResponse.status === 200,
          syncStatus: syncCheckResponse.body?.inSync || false
        });
        
        // Step 4: Notification coordination
        stepStart = Date.now();
        const notificationResponse = await request(app)
          .post('/api/family/notifications/coordinate')
          .send({
            familyId: family.id,
            notificationType: 'event_approved',
            recipients: ['parent1_mobile', 'parent2_desktop'],
            preferences: {
              mobile: ['push', 'sms'],
              desktop: ['email', 'browser']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        deviceSteps.push({
          step: 'notification_coordination',
          duration: Date.now() - stepStart,
          success: notificationResponse.status === 200,
          notificationsSent: notificationResponse.body?.sent || 0
        });
        
        return deviceSteps;
      };

      const { result: deviceSteps, metrics } = await performanceMonitor.measure(
        'multi_device_coordination',
        multiDeviceTest
      );
      
      // Validate multi-device coordination
      expect(deviceSteps.length).toBe(4);
      expect(deviceSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(8000); // Device coordination <8 seconds
      
      const syncStep = deviceSteps.find(s => s.step === 'device_sync');
      expect(syncStep.syncStatus).toBe(true);
      
      console.log(`📊 Multi-Device Family Coordination:
        - Total Duration: ${metrics.duration}ms
        - Device Sync: ${syncStep.syncStatus ? 'Success' : 'Failed'}
        - Coordination Steps: ${deviceSteps.length}`);
      
      deviceSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms (${step.device || 'system'})`);
      });
    });
  });

  describe('Weekly Usage Patterns', () => {
    test('Complete weekly family automation cycle', async () => {
      const weeklyAutomationTest = async () => {
        const family = familyProfiles.adventurousFamily;
        const weeklySteps = [];
        
        // Step 1: Weekly discovery automation
        let stepStart = Date.now();
        const weeklyDiscoveryResponse = await request(app)
          .post('/api/automation/weekly-discovery')
          .send({
            familyId: family.id,
            preferences: family.preferences,
            automation: {
              enabled: true,
              schedule: 'sunday_evening',
              sources: ['all_sources'],
              filters: family.preferences.categories
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weeklySteps.push({
          step: 'weekly_discovery',
          duration: Date.now() - stepStart,
          success: weeklyDiscoveryResponse.status === 200,
          eventsDiscovered: weeklyDiscoveryResponse.body?.eventsDiscovered || 0
        });
        
        // Step 2: Automated scoring and filtering
        stepStart = Date.now();
        const scoringResponse = await request(app)
          .post('/api/automation/weekly-scoring')
          .send({
            familyId: family.id,
            scoringCriteria: {
              ageWeight: 0.3,
              costWeight: 0.2,
              locationWeight: 0.2,
              interestWeight: 0.3
            },
            autoFilter: {
              minScore: 60,
              maxResults: 15
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weeklySteps.push({
          step: 'automated_scoring',
          duration: Date.now() - stepStart,
          success: scoringResponse.status === 200,
          eventsScored: scoringResponse.body?.eventsScored || 0
        });
        
        // Step 3: Weekly digest preparation
        stepStart = Date.now();
        const digestResponse = await request(app)
          .post('/api/family/weekly-digest')
          .send({
            familyId: family.id,
            digestType: 'comprehensive',
            includeAnalytics: true,
            personalizedRecommendations: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weeklySteps.push({
          step: 'weekly_digest',
          duration: Date.now() - stepStart,
          success: digestResponse.status === 200,
          digestGenerated: digestResponse.body?.digestId || false
        });
        
        // Step 4: Family engagement analytics
        stepStart = Date.now();
        const analyticsResponse = await request(app)
          .get('/api/family/analytics/weekly')
          .query({
            familyId: family.id,
            metrics: ['event_participation', 'interest_trends', 'satisfaction_scores']
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weeklySteps.push({
          step: 'engagement_analytics',
          duration: Date.now() - stepStart,
          success: analyticsResponse.status === 200,
          analyticsGenerated: analyticsResponse.body?.analytics || false
        });
        
        return weeklySteps;
      };

      const { result: weeklySteps, metrics } = await performanceMonitor.measure(
        'weekly_automation_cycle',
        weeklyAutomationTest
      );
      
      // Validate weekly automation
      expect(weeklySteps.length).toBe(4);
      expect(weeklySteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(20000); // Weekly cycle <20 seconds
      
      const discoveryStep = weeklySteps.find(s => s.step === 'weekly_discovery');
      const scoringStep = weeklySteps.find(s => s.step === 'automated_scoring');
      
      expect(discoveryStep.eventsDiscovered).toBeGreaterThan(0);
      expect(scoringStep.eventsScored).toBeGreaterThan(0);
      
      console.log(`📊 Weekly Family Automation Cycle:
        - Total Duration: ${metrics.duration}ms
        - Events Discovered: ${discoveryStep.eventsDiscovered}
        - Events Scored: ${scoringStep.eventsScored}
        - Automation Steps: ${weeklySteps.length}`);
      
      weeklySteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });

    test('Concurrent multi-family usage simulation', async () => {
      const multiFamilyTest = async (familyIndex) => {
        const families = Object.values(familyProfiles);
        const family = families[familyIndex % families.length];
        const familySteps = [];
        
        // Each family performs typical daily actions
        const actions = [
          // Morning dashboard check
          () => request(app)
            .get(`/api/family/${family.id}/dashboard`)
            .set('Authorization', `Bearer ${validToken}`),
          
          // Event search
          () => request(app)
            .get('/api/events')
            .query({ familyId: family.id, limit: 10 })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Event approval
          () => request(app)
            .post('/api/events/bulk-action')
            .send({
              action: 'approve',
              eventIds: [`${family.id}-concurrent-event-${familyIndex}`],
              familyId: family.id
            })
            .set('Authorization', `Bearer ${validToken}`),
          
          // Notifications check
          () => request(app)
            .get(`/api/family/${family.id}/notifications`)
            .set('Authorization', `Bearer ${validToken}`)
        ];
        
        // Execute all actions for this family
        for (const action of actions) {
          const stepStart = Date.now();
          try {
            const response = await action();
            familySteps.push({
              familyId: family.id,
              duration: Date.now() - stepStart,
              success: response.status < 400
            });
          } catch (error) {
            familySteps.push({
              familyId: family.id,
              duration: Date.now() - stepStart,
              success: false,
              error: error.message
            });
          }
        }
        
        return familySteps;
      };

      const result = await loadGenerator.generateLoad(multiFamilyTest, 6, 18); // 6 concurrent families
      
      expect(result.successRate).toBeGreaterThan(90); // >90% success under concurrent load
      expect(result.averageTime).toBeLessThan(5000); // <5s per family workflow
      
      console.log(`📊 Concurrent Multi-Family Usage:
        - Families Simulated: 6 concurrent
        - Total Operations: ${result.totalOperations}
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Family Workflow: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms`);
    });
  });
});

// Helper function to generate daily events
function generateDailyEvents(count) {
  const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const locations = ['Library', 'Park', 'Museum', 'Community Center', 'School', 'Zoo'];
  const activities = ['Story Time', 'Art Workshop', 'Science Demo', 'Nature Walk', 'Music Class', 'Sports'];
  
  return Array(count).fill().map((_, i) => ({
    id: `daily-event-${Date.now()}-${i}`,
    title: `${activities[i % activities.length]} at ${locations[i % locations.length]}`,
    date: new Date(Date.now() + (Math.floor(i / 3) * 24 * 60 * 60 * 1000)),
    time: times[i % times.length],
    location_name: locations[i % locations.length],
    cost: i % 4 === 0 ? 0 : Math.floor(Math.random() * 20) + 5,
    age_min: 2 + (i % 3),
    age_max: 8 + (i % 4),
    status: 'discovered',
    score: Math.floor(Math.random() * 40) + 60, // Higher scores for realistic daily events
    created_at: new Date()
  }));
}