/**
 * Automation System Performance Tests
 * 
 * Tests end-to-end automation performance including scraping → scoring → registration workflows
 */

const { PerformanceMonitor, LoadGenerator } = require('./performance-utils');

describe('Automation System Performance', () => {
  let performanceMonitor;
  let loadGenerator;
  let mockDatabase;
  let mockLogger;
  let mockScraperManager;
  let mockEventScorer;
  let mockRegistrationAutomator;
  let mockCalendarManager;

  beforeAll(async () => {
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    
    // Mock comprehensive automation system
    mockScraperManager = {
      scrapeAll: jest.fn().mockImplementation(async () => {
        const delay = Math.random() * 2000 + 1000; // 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return Array(50).fill().map((_, i) => ({
          id: `scraped-event-${i}`,
          title: `Scraped Event ${i}`,
          date: new Date(),
          cost: Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0,
          description: `Auto-scraped event ${i}`,
          source: `source-${i % 5}`,
          location_name: `Venue ${i}`,
          age_min: 2,
          age_max: 8
        }));
      }),
      scrapeSource: jest.fn().mockImplementation(async (source) => {
        const delay = Math.random() * 1000 + 500; // 500ms-1.5s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return Array(10).fill().map((_, i) => ({
          id: `${source}-event-${i}`,
          title: `${source} Event ${i}`,
          source: source
        }));
      })
    };

    mockEventScorer = {
      scoreEvents: jest.fn().mockImplementation(async (events) => {
        const delay = Math.random() * 1000 + 200; // 200ms-1.2s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return events.map(event => ({
          ...event,
          score: Math.floor(Math.random() * 100),
          age_appropriateness_score: Math.floor(Math.random() * 25),
          cost_score: Math.floor(Math.random() * 25),
          location_score: Math.floor(Math.random() * 25),
          timing_score: Math.floor(Math.random() * 25),
          total_score: Math.floor(Math.random() * 100)
        }));
      }),
      scoreEvent: jest.fn().mockImplementation(async (event) => {
        const delay = Math.random() * 200 + 50; // 50-250ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          ...event,
          score: Math.floor(Math.random() * 100)
        };
      })
    };

    mockRegistrationAutomator = {
      processApprovedEvents: jest.fn().mockImplementation(async () => {
        const delay = Math.random() * 3000 + 1000; // 1-4 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          processed: 5,
          registered: 3,
          failed: 2,
          results: [
            { eventId: 'event-1', success: true, confirmationNumber: 'CONF123' },
            { eventId: 'event-2', success: true, confirmationNumber: 'CONF124' },
            { eventId: 'event-3', success: true, confirmationNumber: 'CONF125' },
            { eventId: 'event-4', success: false, error: 'Registration full' },
            { eventId: 'event-5', success: false, error: 'Payment required' }
          ]
        };
      }),
      registerForEvent: jest.fn().mockImplementation(async (eventId) => {
        const delay = Math.random() * 2000 + 500; // 500ms-2.5s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 80% success rate
        if (Math.random() > 0.2) {
          return {
            success: true,
            confirmationNumber: `CONF${Date.now()}`,
            message: 'Registration successful'
          };
        } else {
          throw new Error('Registration failed');
        }
      })
    };

    mockCalendarManager = {
      createCalendarEvent: jest.fn().mockImplementation(async (event) => {
        const delay = Math.random() * 1000 + 200; // 200ms-1.2s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          success: true,
          calendarId: `cal-${Date.now()}`,
          eventId: event.id
        };
      })
    };

    // Mock database operations for automation workflows
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 100 + 10; // 10-110ms
      
      return new Promise(resolve => {
        setTimeout(() => {
          if (query.includes('INSERT') && query.includes('events')) {
            resolve({ rowCount: 1 });
          } else if (query.includes('UPDATE') && query.includes('events')) {
            resolve({ rowCount: 1 });
          } else if (query.includes('SELECT') && query.includes('events')) {
            const events = Array(10).fill().map((_, i) => ({
              id: `db-event-${i}`,
              title: `DB Event ${i}`,
              status: 'discovered',
              cost: 0
            }));
            resolve({ rows: events });
          } else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
  });

  describe('End-to-End Automation Performance', () => {
    test('Complete automation pipeline performance', async () => {
      const fullPipelineTest = async () => {
        // Step 1: Scraping
        const scrapedEvents = await mockScraperManager.scrapeAll();
        
        // Step 2: Database storage
        for (const event of scrapedEvents) {
          await mockDatabase.query(
            'INSERT INTO events (id, title, status) VALUES ($1, $2, $3)',
            [event.id, event.title, 'discovered']
          );
        }
        
        // Step 3: Scoring
        const scoredEvents = await mockEventScorer.scoreEvents(scrapedEvents);
        
        // Step 4: Update scores in database
        for (const event of scoredEvents) {
          await mockDatabase.query(
            'UPDATE events SET score = $1 WHERE id = $2',
            [event.score, event.id]
          );
        }
        
        // Step 5: Auto-registration for high-scoring free events
        const approvedEvents = scoredEvents
          .filter(e => e.score > 75 && e.cost === 0)
          .slice(0, 3); // Limit to 3 for performance testing
        
        const registrationResults = [];
        for (const event of approvedEvents) {
          try {
            const result = await mockRegistrationAutomator.registerForEvent(event.id);
            registrationResults.push({ eventId: event.id, ...result });
          } catch (error) {
            registrationResults.push({ eventId: event.id, success: false, error: error.message });
          }
        }
        
        // Step 6: Calendar integration for successful registrations
        const calendarResults = [];
        for (const result of registrationResults) {
          if (result.success) {
            const calendarResult = await mockCalendarManager.createCalendarEvent({
              id: result.eventId,
              title: `Event ${result.eventId}`
            });
            calendarResults.push(calendarResult);
          }
        }
        
        return {
          scrapedCount: scrapedEvents.length,
          scoredCount: scoredEvents.length,
          approvedCount: approvedEvents.length,
          registeredCount: registrationResults.filter(r => r.success).length,
          calendarCount: calendarResults.length
        };
      };

      const { result, metrics } = await measureAsync('full_automation_pipeline', fullPipelineTest);
      
      expect(metrics.duration).toBeLessThan(15000); // Complete pipeline <15 seconds
      expect(result.scrapedCount).toBeGreaterThan(0);
      expect(result.scoredCount).toBe(result.scrapedCount);
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(200 * 1024 * 1024); // <200MB
      
      console.log(`📊 Full Automation Pipeline Performance:
        - Total Duration: ${metrics.duration}ms
        - Scraped Events: ${result.scrapedCount}
        - Scored Events: ${result.scoredCount}
        - Auto-Approved: ${result.approvedCount}
        - Successfully Registered: ${result.registeredCount}
        - Calendar Events: ${result.calendarCount}
        - Memory Used: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}`);
    });

    test('Concurrent automation workflows', async () => {
      const concurrentWorkflowTest = async (workflowId) => {
        // Each workflow handles a different source
        const sources = ['library', 'parks', 'museums', 'eventbrite', 'schools'];
        const source = sources[workflowId % sources.length];
        
        // Mini-pipeline for this source
        const events = await mockScraperManager.scrapeSource(source);
        const scoredEvents = await mockEventScorer.scoreEvents(events);
        
        // Process top events
        const topEvents = scoredEvents
          .filter(e => e.score > 70)
          .slice(0, 2);
        
        const results = [];
        for (const event of topEvents) {
          try {
            const regResult = await mockRegistrationAutomator.registerForEvent(event.id);
            results.push(regResult);
          } catch (error) {
            results.push({ success: false, error: error.message });
          }
        }
        
        return {
          source,
          eventsFound: events.length,
          topEvents: topEvents.length,
          successful: results.filter(r => r.success).length
        };
      };

      const result = await loadGenerator.generateLoad(concurrentWorkflowTest, 3, 9);
      
      expect(result.successRate).toBeGreaterThan(90); // >90% workflow success
      expect(result.averageTime).toBeLessThan(8000); // <8s per workflow
      
      const totalEventsProcessed = result.results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.result.eventsFound, 0);
      
      console.log(`📊 Concurrent Automation Workflows (3 concurrent, 9 total):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Total Events Processed: ${totalEventsProcessed}
        - Processing Rate: ${(totalEventsProcessed / (result.totalTime / 1000)).toFixed(1)} events/sec`);
    });

    test('Peak automation load handling', async () => {
      const peakLoadTest = async (loadId) => {
        // Simulate peak usage scenarios
        const scenarios = [
          // High-volume scraping
          async () => {
            const events = await mockScraperManager.scrapeAll();
            return { type: 'scraping', count: events.length };
          },
          // Batch scoring
          async () => {
            const events = Array(30).fill().map((_, i) => ({ id: `peak-event-${i}` }));
            const scored = await mockEventScorer.scoreEvents(events);
            return { type: 'scoring', count: scored.length };
          },
          // Bulk registration processing
          async () => {
            const results = await mockRegistrationAutomator.processApprovedEvents();
            return { type: 'registration', count: results.processed };
          }
        ];
        
        const scenario = scenarios[loadId % scenarios.length];
        return await scenario();
      };

      const result = await loadGenerator.generateLoad(peakLoadTest, 6, 18);
      
      expect(result.successRate).toBeGreaterThan(85); // >85% under peak load
      
      const operationCounts = result.results
        .filter(r => r.success)
        .reduce((acc, r) => {
          acc[r.result.type] = (acc[r.result.type] || 0) + r.result.count;
          return acc;
        }, {});
      
      console.log(`📊 Peak Automation Load (6 concurrent, 18 operations):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Operations Processed: ${JSON.stringify(operationCounts)}`);
    });
  });

  describe('Individual Component Performance', () => {
    test('Event scoring performance under load', async () => {
      const scoringTest = async (batchId) => {
        const batchSize = Math.floor(Math.random() * 20) + 10; // 10-30 events
        const events = Array(batchSize).fill().map((_, i) => ({
          id: `batch-${batchId}-event-${i}`,
          title: `Batch Event ${i}`,
          cost: Math.random() > 0.8 ? 25 : 0,
          location_name: `Venue ${i}`,
          date: new Date()
        }));
        
        const scoredEvents = await mockEventScorer.scoreEvents(events);
        return { batchSize, scoredCount: scoredEvents.length };
      };

      const result = await loadGenerator.generateLoad(scoringTest, 5, 20);
      
      expect(result.successRate).toBe(100); // Scoring should always succeed
      expect(result.averageTime).toBeLessThan(2000); // <2s per batch
      
      const totalEventsScored = result.results
        .reduce((sum, r) => sum + r.result.scoredCount, 0);
      
      console.log(`📊 Event Scoring Load Test:
        - Batches Processed: ${result.totalOperations}
        - Total Events Scored: ${totalEventsScored}
        - Average Batch Time: ${result.averageTime.toFixed(2)}ms
        - Scoring Rate: ${(totalEventsScored / (result.totalTime / 1000)).toFixed(1)} events/sec`);
    });

    test('Registration automation performance', async () => {
      const registrationTest = async (eventId) => {
        const result = await mockRegistrationAutomator.registerForEvent(`test-event-${eventId}`);
        return result;
      };

      const result = await loadGenerator.generateLoad(registrationTest, 3, 15);
      
      // Should handle failures gracefully (mock has 80% success rate)
      expect(result.successRate).toBeGreaterThan(75); // >75% considering mock failures
      expect(result.averageTime).toBeLessThan(3000); // <3s per registration
      
      console.log(`📊 Registration Automation Performance:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Registration Time: ${result.averageTime.toFixed(2)}ms
        - Failed Registrations: ${result.failed}`);
    });

    test('Calendar integration performance', async () => {
      const calendarTest = async (eventId) => {
        const event = {
          id: `cal-event-${eventId}`,
          title: `Calendar Event ${eventId}`,
          date: new Date(),
          location: 'Test Venue'
        };
        
        return await mockCalendarManager.createCalendarEvent(event);
      };

      const result = await loadGenerator.generateLoad(calendarTest, 4, 16);
      
      expect(result.successRate).toBe(100); // Calendar operations should be reliable
      expect(result.averageTime).toBeLessThan(1500); // <1.5s per calendar event
      
      console.log(`📊 Calendar Integration Performance:
        - Events Created: ${result.successful}
        - Average Creation Time: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms`);
    });
  });

  describe('Database Performance Under Automation Load', () => {
    test('Database operations during automation workflows', async () => {
      const dbWorkflowTest = async (workflowId) => {
        // Simulate database operations during automation
        const operations = [
          // Insert new events
          () => mockDatabase.query(
            'INSERT INTO events (id, title, status) VALUES ($1, $2, $3)',
            [`workflow-${workflowId}-event-1`, 'New Event', 'discovered']
          ),
          // Update event scores
          () => mockDatabase.query(
            'UPDATE events SET score = $1 WHERE id = $2',
            [85, `workflow-${workflowId}-event-1`]
          ),
          // Select events for processing
          () => mockDatabase.query(
            'SELECT id, title FROM events WHERE status = $1 ORDER BY score DESC LIMIT 10',
            ['discovered']
          ),
          // Update event status
          () => mockDatabase.query(
            'UPDATE events SET status = $1 WHERE id = $2',
            ['approved', `workflow-${workflowId}-event-1`]
          )
        ];
        
        const results = [];
        for (const operation of operations) {
          const result = await operation();
          results.push(result);
        }
        
        return results.length;
      };

      const result = await loadGenerator.generateLoad(dbWorkflowTest, 4, 20);
      
      expect(result.successRate).toBeGreaterThan(95); // >95% database success
      expect(result.averageTime).toBeLessThan(1000); // <1s for 4 operations
      
      console.log(`📊 Database Automation Workflow Performance:
        - Workflows Completed: ${result.successful}
        - Average Workflow Time: ${result.averageTime.toFixed(2)}ms
        - Database Operations/sec: ${((result.successful * 4) / (result.totalTime / 1000)).toFixed(1)}`);
    });

    test('Bulk database operations performance', async () => {
      const bulkOperationTest = async (batchId) => {
        const batchSize = 25;
        const eventIds = Array(batchSize).fill().map((_, i) => `bulk-${batchId}-${i}`);
        
        // Bulk insert simulation
        const insertPromises = eventIds.map(id =>
          mockDatabase.query(
            'INSERT INTO events (id, title, status) VALUES ($1, $2, $3)',
            [id, `Bulk Event ${id}`, 'discovered']
          )
        );
        
        await Promise.all(insertPromises);
        
        // Bulk update simulation
        const updatePromises = eventIds.map(id =>
          mockDatabase.query(
            'UPDATE events SET score = $1 WHERE id = $2',
            [Math.floor(Math.random() * 100), id]
          )
        );
        
        await Promise.all(updatePromises);
        
        return batchSize * 2; // Operations performed
      };

      const result = await loadGenerator.generateLoad(bulkOperationTest, 2, 8);
      
      expect(result.successRate).toBeGreaterThan(95); // High success for bulk ops
      expect(result.averageTime).toBeLessThan(3000); // <3s for 50 operations
      
      const totalOpsPerformed = result.results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.result, 0);
      
      console.log(`📊 Bulk Database Operations Performance:
        - Total Operations: ${totalOpsPerformed}
        - Average Batch Time: ${result.averageTime.toFixed(2)}ms
        - Operations/sec: ${(totalOpsPerformed / (result.totalTime / 1000)).toFixed(1)}`);
    });
  });

  describe('Memory Management During Automation', () => {
    test('Memory usage during sustained automation', async () => {
      const memoryTracker = performanceMonitor.trackResources('sustained_automation', 1000, 45000);
      
      const sustainedAutomationTest = async () => {
        // Run automation cycles for 45 seconds
        const cycles = Array(15).fill().map(async (_, i) => {
          await new Promise(resolve => setTimeout(resolve, i * 3000)); // Every 3 seconds
          
          // Mini automation cycle
          const events = await mockScraperManager.scrapeSource(`cycle-${i}`);
          const scored = await mockEventScorer.scoreEvents(events.slice(0, 5));
          
          // Try to register one event
          if (scored.length > 0 && scored[0].cost === 0) {
            try {
              await mockRegistrationAutomator.registerForEvent(scored[0].id);
            } catch (error) {
              // Expected some failures
            }
          }
          
          return scored.length;
        });
        
        return await Promise.all(cycles);
      };

      const { result, metrics } = await measureAsync('sustained_automation', sustainedAutomationTest);
      
      await memoryTracker;
      const report = performanceMonitor.generateReport('sustained_automation');
      
      expect(report.memory.growth).toBeLessThan(100 * 1024 * 1024); // <100MB growth
      expect(result).toHaveLength(15);
      
      console.log(`📊 Sustained Automation Memory Analysis:
        - Duration: 45 seconds
        - Automation Cycles: ${result.length}
        - Memory Growth: ${report.memory.growthFormatted}
        - Peak Memory: ${report.memory.maxFormatted}`);
    });

    test('Memory efficiency during data processing', async () => {
      const dataProcessingTest = async (datasetId) => {
        // Large dataset processing simulation
        const largeDataset = Array(100).fill().map((_, i) => ({
          id: `large-${datasetId}-${i}`,
          title: `Large Event ${i}`,
          description: 'A'.repeat(1000), // 1KB description
          metadata: JSON.stringify({ tags: Array(50).fill(`tag-${i}`) })
        }));
        
        // Process in chunks to test memory efficiency
        const chunkSize = 20;
        const processedChunks = [];
        
        for (let i = 0; i < largeDataset.length; i += chunkSize) {
          const chunk = largeDataset.slice(i, i + chunkSize);
          const scored = await mockEventScorer.scoreEvents(chunk);
          processedChunks.push(scored);
          
          // Force garbage collection if available
          if (global.gc && Math.random() > 0.7) {
            global.gc();
          }
        }
        
        return processedChunks.flat().length;
      };

      const initialMemory = performanceMonitor.getMemoryUsage();
      const result = await loadGenerator.generateLoad(dataProcessingTest, 2, 6);
      const finalMemory = performanceMonitor.getMemoryUsage();
      
      const memoryIncrease = finalMemory.current.heapUsed - initialMemory.current.heapUsed;
      
      expect(result.successRate).toBe(100);
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024); // <150MB for large datasets
      
      console.log(`📊 Large Dataset Processing Memory Efficiency:
        - Datasets Processed: ${result.totalOperations}
        - Memory Increase: ${performanceMonitor.formatMemory(memoryIncrease)}
        - Average Processing Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });

  describe('Automation System Resilience', () => {
    test('Recovery from component failures', async () => {
      let scraperFailures = 0;
      let scorerFailures = 0;
      
      const failureRecoveryTest = async (testId) => {
        try {
          // Inject failures for testing resilience
          if (testId < 3 && testId % 2 === 0) {
            scraperFailures++;
            throw new Error('Scraper temporarily unavailable');
          }
          
          const events = await mockScraperManager.scrapeSource('resilience-test');
          
          if (testId < 3 && testId % 2 === 1) {
            scorerFailures++;
            throw new Error('Scorer temporarily unavailable');
          }
          
          const scored = await mockEventScorer.scoreEvents(events);
          return { events: events.length, scored: scored.length };
          
        } catch (error) {
          // System should recover gracefully
          return { error: error.message, recovered: true };
        }
      };

      const result = await loadGenerator.generateLoad(failureRecoveryTest, 2, 10);
      
      // System should recover and continue processing
      expect(result.successRate).toBeGreaterThan(70); // >70% overall with recovery
      
      const lastHalf = result.results.slice(5);
      const lastHalfSuccessRate = (lastHalf.filter(r => r.success).length / lastHalf.length) * 100;
      expect(lastHalfSuccessRate).toBeGreaterThan(90); // >90% after recovery
      
      console.log(`📊 Component Failure Recovery Test:
        - Overall Success Rate: ${result.successRate.toFixed(1)}%
        - Recovery Success Rate: ${lastHalfSuccessRate.toFixed(1)}%
        - Scraper Failures: ${scraperFailures}
        - Scorer Failures: ${scorerFailures}`);
    });

    test('Automation system performance under partial failures', async () => {
      const partialFailureTest = async (systemId) => {
        const results = {
          scraping: { success: true, events: 0 },
          scoring: { success: true, events: 0 },
          registration: { success: true, events: 0 }
        };
        
        try {
          // Step 1: Scraping (95% success rate)
          if (Math.random() > 0.05) {
            const events = await mockScraperManager.scrapeSource('partial-test');
            results.scraping.events = events.length;
          } else {
            results.scraping.success = false;
            throw new Error('Scraping failed');
          }
          
          // Step 2: Scoring (97% success rate)
          if (Math.random() > 0.03) {
            const mockEvents = Array(results.scraping.events).fill().map((_, i) => ({ id: `event-${i}` }));
            const scored = await mockEventScorer.scoreEvents(mockEvents);
            results.scoring.events = scored.length;
          } else {
            results.scoring.success = false;
            throw new Error('Scoring failed');
          }
          
          // Step 3: Registration (80% success rate - more realistic)
          if (Math.random() > 0.20) {
            const registered = await mockRegistrationAutomator.processApprovedEvents();
            results.registration.events = registered.processed;
          } else {
            results.registration.success = false;
          }
          
        } catch (error) {
          // Continue with partial success
        }
        
        return results;
      };

      const result = await loadGenerator.generateLoad(partialFailureTest, 3, 15);
      
      // Should handle partial failures gracefully
      expect(result.successRate).toBeGreaterThan(85); // >85% with partial failures
      
      const componentStats = result.results
        .filter(r => r.success)
        .reduce((acc, r) => {
          acc.scraping += r.result.scraping.success ? 1 : 0;
          acc.scoring += r.result.scoring.success ? 1 : 0;
          acc.registration += r.result.registration.success ? 1 : 0;
          return acc;
        }, { scraping: 0, scoring: 0, registration: 0 });
      
      console.log(`📊 Partial Failure Handling (3 concurrent, 15 operations):
        - Overall Success Rate: ${result.successRate.toFixed(1)}%
        - Component Success Rates:
          - Scraping: ${(componentStats.scraping / result.successful * 100).toFixed(1)}%
          - Scoring: ${(componentStats.scoring / result.successful * 100).toFixed(1)}%
          - Registration: ${(componentStats.registration / result.successful * 100).toFixed(1)}%`);
    });
  });
});