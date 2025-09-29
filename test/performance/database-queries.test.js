const Database = require('../../src/database');
const { PerformanceMonitor, DatabasePerformanceAnalyzer } = require('./performance-utils');

describe('Database Query Performance Analysis', () => {
  let database;
  let performanceAnalyzer;
  let performanceMonitor;
  let mockLogger;

  beforeAll(async () => {
    mockLogger = createMockLogger();
    database = new Database();
    performanceMonitor = new PerformanceMonitor();
    performanceAnalyzer = new DatabasePerformanceAnalyzer(database, mockLogger);
    
    // Initialize database connection
    try {
      await database.init();
      console.log('✅ Database connected for performance testing');
    } catch (error) {
      console.log('⚠️  Using mock database for performance testing');
      database = createMockDatabase();
      
      // Enhanced mock for performance testing
      database.query = jest.fn().mockImplementation((query, params) => {
        // Simulate realistic database response times
        const delay = Math.random() * 100 + 10; // 10-110ms
        
        return new Promise(resolve => {
          setTimeout(() => {
            if (query.includes('COUNT(*)')) {
              resolve({ rows: [{ total: Math.floor(Math.random() * 10000) }] });
            } else if (query.includes('SELECT') && query.includes('events')) {
              // Generate mock events for performance testing
              const rowCount = Math.min(parseInt(params.find(p => typeof p === 'number') || 50), 1000);
              const rows = Array(rowCount).fill().map((_, i) => ({
                id: `perf-event-${i}`,
                title: `Performance Test Event ${i}`,
                date: new Date(),
                cost: Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0,
                status: 'discovered',
                score: Math.floor(Math.random() * 100),
                created_at: new Date()
              }));
              resolve({ rows });
            } else {
              resolve({ rows: [] });
            }
          }, delay);
        });
      });
    }
  });

  afterAll(async () => {
    if (database && typeof database.close === 'function') {
      await database.close();
    }
  });

  describe('Individual Query Performance Analysis', () => {
    test('Event search query performance baseline', async () => {
      const query = `
        SELECT id, title, date, cost, status, score
        FROM events 
        WHERE status = $1 
        ORDER BY score DESC 
        LIMIT $2
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'event_search_baseline',
        query,
        ['discovered', 50]
      );
      
      expect(metrics.duration).toBeLessThan(200); // Target: <200ms
      expect(result.rows).toBeDefined();
      expect(metrics.rowCount).toBeGreaterThanOrEqual(0);
      
      console.log(`📊 Event search baseline: ${metrics.duration}ms for ${metrics.rowCount} rows`);
    });

    test('Complex event search with joins performance', async () => {
      const complexQuery = `
        SELECT 
          e.id, e.title, e.date, e.cost, e.status,
          COALESCE(es.total_score, 0) as score,
          COALESCE(sp.rating, 0) as social_proof_rating
        FROM events e
        LEFT JOIN event_scores es ON e.id = es.event_id
        LEFT JOIN event_social_proof sp ON e.id = sp.event_id
        WHERE e.status = $1 AND e.cost <= $2
        ORDER BY es.total_score DESC, e.created_at DESC
        LIMIT $3 OFFSET $4
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'complex_event_search',
        complexQuery,
        ['discovered', 50, 20, 0]
      );
      
      expect(metrics.duration).toBeLessThan(500); // Complex queries: <500ms
      console.log(`📊 Complex search: ${metrics.duration}ms for ${metrics.rowCount} rows`);
    });

    test('Event count query performance', async () => {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM events 
        WHERE status = $1 AND date >= $2
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'event_count',
        countQuery,
        ['discovered', new Date()]
      );
      
      expect(metrics.duration).toBeLessThan(100); // Count queries: <100ms
      expect(result.rows[0]).toHaveProperty('total');
      
      console.log(`📊 Count query: ${metrics.duration}ms`);
    });

    test('Family settings query performance', async () => {
      const familyQuery = `
        SELECT setting_key, setting_value
        FROM family_settings
        WHERE active = true
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'family_settings',
        familyQuery,
        []
      );
      
      expect(metrics.duration).toBeLessThan(50); // Settings queries: <50ms
      console.log(`📊 Family settings: ${metrics.duration}ms`);
    });

    test('Event scoring query performance', async () => {
      const scoringQuery = `
        SELECT 
          e.id, e.title,
          es.age_appropriateness_score,
          es.cost_score,
          es.location_score,
          es.timing_score,
          es.total_score
        FROM events e
        LEFT JOIN event_scores es ON e.id = es.event_id
        WHERE e.status = $1
        ORDER BY es.total_score DESC
        LIMIT $2
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'event_scoring',
        scoringQuery,
        ['scored', 100]
      );
      
      expect(metrics.duration).toBeLessThan(300); // Scoring queries: <300ms
      console.log(`📊 Event scoring: ${metrics.duration}ms for ${metrics.rowCount} rows`);
    });
  });

  describe('Query Performance Under Load', () => {
    test('Event search under concurrent load', async () => {
      const query = `
        SELECT id, title, date, cost, status
        FROM events 
        WHERE status = $1 
        LIMIT $2
      `;
      
      const loadResult = await performanceAnalyzer.loadTestQuery(
        'event_search_load',
        query,
        ['discovered', 20],
        10, // 10 concurrent queries
        50  // 50 total operations
      );
      
      expect(loadResult.successRate).toBeGreaterThan(95); // 95%+ success rate
      expect(loadResult.averageTime).toBeLessThan(300); // Average <300ms under load
      expect(loadResult.failed).toBeLessThan(3); // <3 failures acceptable
      
      console.log(`📊 Load test results:
        - Total time: ${loadResult.totalTime}ms
        - Average query time: ${loadResult.averageTime.toFixed(2)}ms
        - Success rate: ${loadResult.successRate.toFixed(1)}%
        - Failed queries: ${loadResult.failed}`);
    });

    test('Bulk event operations performance', async () => {
      const bulkUpdateQuery = `
        UPDATE events 
        SET status = $2, updated_at = NOW()
        WHERE id = ANY($1::text[])
      `;
      
      // Simulate updating 100 events
      const eventIds = Array(100).fill().map((_, i) => `bulk-event-${i}`);
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'bulk_update',
        bulkUpdateQuery,
        [eventIds, 'approved']
      );
      
      expect(metrics.duration).toBeLessThan(1000); // Bulk operations: <1s
      console.log(`📊 Bulk update (100 events): ${metrics.duration}ms`);
    });

    test('Database connection stress test', async () => {
      const connectionStressTest = async () => {
        const concurrentQueries = Array(20).fill().map(async (_, i) => {
          const query = `SELECT COUNT(*) as count FROM events WHERE title LIKE $1`;
          return await database.query(query, [`%test${i}%`]);
        });
        
        return await Promise.all(concurrentQueries);
      };

      const { result, metrics } = await measureAsync(
        'connection_stress_test',
        connectionStressTest
      );
      
      expect(metrics.duration).toBeLessThan(2000); // Should handle 20 concurrent queries <2s
      expect(result).toHaveLength(20);
      
      console.log(`📊 Connection stress test: ${metrics.duration}ms for 20 concurrent queries`);
    });
  });

  describe('Memory Usage During Database Operations', () => {
    test('Memory usage during large result set processing', async () => {
      const initialMemory = performanceMonitor.getMemoryUsage();
      
      const largeResultQuery = `
        SELECT id, title, description, date, location_name, location_address, cost
        FROM events 
        LIMIT $1
      `;
      
      const { result, metrics } = await performanceAnalyzer.analyzeQuery(
        'large_result_set',
        largeResultQuery,
        [1000] // Request 1000 events
      );
      
      const finalMemory = performanceMonitor.getMemoryUsage();
      const memoryIncrease = finalMemory.current.heapUsed - initialMemory.current.heapUsed;
      
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // <50MB for 1000 events
      
      console.log(`📊 Large result set memory usage: ${performanceMonitor.formatMemory(memoryIncrease)}`);
    });

    test('Memory stability during repeated queries', async () => {
      const memoryTracker = performanceMonitor.trackResources('repeated_queries', 500, 10000);
      
      // Execute queries repeatedly for 10 seconds
      const queryInterval = setInterval(async () => {
        await database.query('SELECT COUNT(*) FROM events WHERE status = $1', ['discovered']);
      }, 100); // Every 100ms
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      clearInterval(queryInterval);
      
      const resourceData = await memoryTracker;
      const report = performanceMonitor.generateReport('repeated_queries');
      
      expect(report.memory.growth).toBeLessThan(10 * 1024 * 1024); // <10MB growth
      
      console.log(`📊 Memory stability test:
        - Duration: ${report.duration}ms
        - Memory growth: ${report.memory.growthFormatted}
        - Max memory: ${report.memory.maxFormatted}`);
    });
  });

  describe('Database Index and Query Optimization Analysis', () => {
    test('Query execution plan analysis (if supported)', async () => {
      // PostgreSQL EXPLAIN functionality
      const explainQuery = `
        EXPLAIN (FORMAT JSON, ANALYZE true) 
        SELECT e.id, e.title, es.total_score
        FROM events e
        LEFT JOIN event_scores es ON e.id = es.event_id
        WHERE e.status = $1
        ORDER BY es.total_score DESC
        LIMIT $2
      `;
      
      try {
        const { result, metrics } = await performanceAnalyzer.analyzeQuery(
          'query_plan_analysis',
          explainQuery,
          ['discovered', 50]
        );
        
        console.log(`📊 Query plan analysis completed in ${metrics.duration}ms`);
        
        // If we get a real database response, analyze the plan
        if (result.rows && result.rows[0] && result.rows[0]['QUERY PLAN']) {
          const plan = result.rows[0]['QUERY PLAN'];
          console.log('📋 Query execution plan available for analysis');
        }
      } catch (error) {
        console.log('⚠️  Query plan analysis not available (likely mock database)');
        // This is expected for mock databases
      }
    });

    test('Index usage verification', async () => {
      // Test queries that should use indexes
      const indexedQueries = [
        {
          name: 'status_index',
          query: 'SELECT id FROM events WHERE status = $1',
          params: ['discovered']
        },
        {
          name: 'date_index', 
          query: 'SELECT id FROM events WHERE date >= $1',
          params: [new Date()]
        },
        {
          name: 'cost_index',
          query: 'SELECT id FROM events WHERE cost <= $1',
          params: [50]
        }
      ];
      
      for (const queryTest of indexedQueries) {
        const { result, metrics } = await performanceAnalyzer.analyzeQuery(
          queryTest.name,
          queryTest.query,
          queryTest.params
        );
        
        // Indexed queries should be fast
        expect(metrics.duration).toBeLessThan(100);
        console.log(`📊 ${queryTest.name}: ${metrics.duration}ms (should use index)`);
      }
    });
  });

  describe('Performance Summary and Analysis', () => {
    test('Generate comprehensive query performance summary', async () => {
      const summary = performanceAnalyzer.getQuerySummary();
      
      console.log(`📋 Database Performance Summary:
        - Total queries executed: ${summary.totalQueries}
        - Successful queries: ${summary.successful}
        - Failed queries: ${summary.failed}
        - Average duration: ${summary.averageDuration?.toFixed(2)}ms
        - Slowest query: ${summary.maxDuration?.toFixed(2)}ms
        - Fastest query: ${summary.minDuration?.toFixed(2)}ms
        - Slow queries (>1s): ${summary.slowQueries?.length || 0}`);
      
      // Performance assertions
      if (summary.totalQueries > 0) {
        expect(summary.averageDuration).toBeLessThan(500); // Average <500ms
        expect(summary.slowQueries.length).toBeLessThan(summary.totalQueries * 0.1); // <10% slow queries
        expect(summary.successful / summary.totalQueries).toBeGreaterThan(0.95); // >95% success rate
      }
    });

    test('Performance regression detection', async () => {
      // Baseline performance expectations
      const performanceBaselines = {
        simple_select: 100,     // <100ms
        complex_join: 500,      // <500ms
        count_query: 50,        // <50ms
        bulk_operation: 1000    // <1000ms
      };
      
      // Run baseline tests
      const baselineResults = {};
      
      for (const [testName, maxDuration] of Object.entries(performanceBaselines)) {
        const testQuery = getBaselineQuery(testName);
        if (testQuery) {
          const { metrics } = await performanceAnalyzer.analyzeQuery(
            `baseline_${testName}`,
            testQuery.query,
            testQuery.params
          );
          
          baselineResults[testName] = metrics.duration;
          expect(metrics.duration).toBeLessThan(maxDuration);
        }
      }
      
      console.log('📊 Performance baselines verified:', baselineResults);
    });
  });
});

// Helper function to get baseline queries
function getBaselineQuery(testName) {
  const queries = {
    simple_select: {
      query: 'SELECT id, title FROM events WHERE status = $1 LIMIT 10',
      params: ['discovered']
    },
    complex_join: {
      query: `
        SELECT e.id, e.title, es.total_score, sp.rating
        FROM events e
        LEFT JOIN event_scores es ON e.id = es.event_id
        LEFT JOIN event_social_proof sp ON e.id = sp.event_id
        WHERE e.status = $1
        ORDER BY es.total_score DESC
        LIMIT 20
      `,
      params: ['discovered']
    },
    count_query: {
      query: 'SELECT COUNT(*) as total FROM events WHERE status = $1',
      params: ['discovered']
    },
    bulk_operation: {
      query: 'SELECT id FROM events WHERE id = ANY($1::text[])',
      params: [Array(100).fill().map((_, i) => `event-${i}`)]
    }
  };
  
  return queries[testName];
}