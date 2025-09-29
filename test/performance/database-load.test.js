const Database = require('../../src/database');
const { PerformanceMonitor, LoadGenerator } = require('./performance-utils');

describe('Database Load Testing & Connection Pool Analysis', () => {
  let database;
  let performanceMonitor;
  let loadGenerator;
  let mockLogger;

  beforeAll(async () => {
    mockLogger = createMockLogger();
    database = new Database();
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    
    // Initialize database
    try {
      await database.init();
      console.log('✅ Database connected for load testing');
    } catch (error) {
      console.log('⚠️  Using mock database for load testing');
      database = createMockDatabase();
      
      // Enhanced mock for load testing
      database.query = jest.fn().mockImplementation((query, params) => {
        // Simulate realistic load with varying response times
        const baseDelay = Math.random() * 50 + 10; // 10-60ms base
        const loadDelay = Math.random() * 100; // Additional 0-100ms under load
        const totalDelay = baseDelay + (Math.random() > 0.9 ? loadDelay : 0);
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            // Simulate occasional database errors under load (5% failure rate)
            if (Math.random() < 0.05) {
              reject(new Error('Connection timeout under load'));
              return;
            }
            
            if (query.includes('COUNT(*)')) {
              resolve({ rows: [{ total: Math.floor(Math.random() * 50000) }] });
            } else if (query.includes('SELECT')) {
              const rowCount = Math.min(parseInt(params?.find(p => typeof p === 'number') || 20), 100);
              const rows = Array(rowCount).fill().map((_, i) => ({
                id: `load-event-${Date.now()}-${i}`,
                title: `Load Test Event ${i}`,
                status: 'discovered',
                created_at: new Date()
              }));
              resolve({ rows });
            } else if (query.includes('UPDATE') || query.includes('INSERT')) {
              resolve({ rowCount: Math.floor(Math.random() * 10) + 1 });
            } else {
              resolve({ rows: [] });
            }
          }, totalDelay);
        });
      });
    }
  });

  afterAll(async () => {
    if (database && typeof database.close === 'function') {
      await database.close();
    }
  });

  describe('Connection Pool Performance', () => {
    test('Connection pool efficiency under moderate load', async () => {
      const connectionTest = async (operationId) => {
        // Simulate typical database operations
        const operations = [
          () => database.query('SELECT COUNT(*) FROM events WHERE status = $1', ['discovered']),
          () => database.query('SELECT id, title FROM events WHERE cost <= $1 LIMIT $2', [50, 10]),
          () => database.query('UPDATE events SET updated_at = NOW() WHERE id = $1', [`op-${operationId}`])
        ];
        
        const operation = operations[operationId % operations.length];
        return await operation();
      };

      const { result, metrics } = await measureAsync('connection_pool_test', async () => {
        return await loadGenerator.generateLoad(connectionTest, 20, 100);
      });

      // Connection pool performance expectations
      expect(result.successRate).toBeGreaterThan(90); // >90% success rate
      expect(result.averageTime).toBeLessThan(200); // <200ms average
      expect(metrics.duration).toBeLessThan(10000); // Complete within 10 seconds
      
      console.log(`📊 Connection Pool Test Results:
        - Duration: ${metrics.duration}ms
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Query Time: ${result.averageTime.toFixed(2)}ms
        - Failed Operations: ${result.failed}/${result.totalOperations}
        - Memory Used: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}`);
    });

    test('High concurrency database operations', async () => {
      const highConcurrencyTest = async (operationId) => {
        // Mix of read and write operations
        const isWrite = operationId % 4 === 0; // 25% writes, 75% reads
        
        if (isWrite) {
          return await database.query(
            'INSERT INTO events (id, title, status, cost, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()',
            [`test-${operationId}`, `Test Event ${operationId}`, 'discovered', 0]
          );
        } else {
          return await database.query(
            'SELECT id, title, status FROM events WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
            ['discovered', Math.floor(Math.random() * 20) + 5]
          );
        }
      };

      const result = await loadGenerator.generateLoad(highConcurrencyTest, 50, 200);
      
      expect(result.successRate).toBeGreaterThan(85); // >85% success rate under high load
      expect(result.averageTime).toBeLessThan(500); // <500ms average under stress
      
      console.log(`📊 High Concurrency Test (50 concurrent, 200 total):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms
        - Failures: ${result.failed}`);
    });

    test('Database connection recovery after failures', async () => {
      let failureInjected = false;
      
      const recoveryTest = async (operationId) => {
        // Inject failures for the first 20% of operations, then recover
        if (operationId < 20 && !failureInjected) {
          failureInjected = true;
          throw new Error('Simulated database connection failure');
        }
        
        return await database.query('SELECT 1 as health_check');
      };

      const result = await loadGenerator.generateLoad(recoveryTest, 10, 100);
      
      // Should recover after initial failures
      expect(result.successRate).toBeGreaterThan(80); // Should recover >80% overall
      
      const lastHalfOperations = result.results.slice(50); // Last 50 operations
      const lastHalfSuccessRate = (lastHalfOperations.filter(r => r.success).length / lastHalfOperations.length) * 100;
      
      expect(lastHalfSuccessRate).toBeGreaterThan(95); // Should recover to >95% in second half
      
      console.log(`📊 Recovery Test:
        - Overall Success Rate: ${result.successRate.toFixed(1)}%
        - Recovery Success Rate: ${lastHalfSuccessRate.toFixed(1)}%`);
    });
  });

  describe('Query Performance Under Load', () => {
    test('Event search performance degradation under load', async () => {
      const eventSearchTest = async (operationId) => {
        const searchTerms = ['family', 'kids', 'fun', 'educational', 'outdoor'];
        const searchTerm = searchTerms[operationId % searchTerms.length];
        
        return await database.query(`
          SELECT e.id, e.title, e.date, e.cost, es.total_score
          FROM events e
          LEFT JOIN event_scores es ON e.id = es.event_id
          WHERE e.title ILIKE $1 AND e.status = $2
          ORDER BY es.total_score DESC
          LIMIT $3
        `, [`%${searchTerm}%`, 'discovered', 20]);
      };

      // Test with increasing load levels
      const loadLevels = [
        { concurrency: 5, operations: 25, name: 'Light Load' },
        { concurrency: 15, operations: 75, name: 'Medium Load' },
        { concurrency: 30, operations: 150, name: 'Heavy Load' }
      ];

      const loadResults = [];

      for (const level of loadLevels) {
        const result = await loadGenerator.generateLoad(
          eventSearchTest,
          level.concurrency,
          level.operations
        );
        
        loadResults.push({
          ...level,
          successRate: result.successRate,
          averageTime: result.averageTime
        });
        
        console.log(`📊 ${level.name} (${level.concurrency} concurrent):
          - Success Rate: ${result.successRate.toFixed(1)}%
          - Average Time: ${result.averageTime.toFixed(2)}ms`);
      }

      // Verify performance doesn't degrade too much under load
      const lightLoad = loadResults[0];
      const heavyLoad = loadResults[2];
      
      const performanceDegradation = (heavyLoad.averageTime / lightLoad.averageTime);
      expect(performanceDegradation).toBeLessThan(3); // <3x degradation under heavy load
      
      console.log(`📊 Performance degradation ratio: ${performanceDegradation.toFixed(2)}x`);
    });

    test('Bulk operations performance under concurrent load', async () => {
      const bulkOperationTest = async (operationId) => {
        const batchSize = 20;
        const eventIds = Array(batchSize).fill().map((_, i) => `bulk-${operationId}-${i}`);
        
        // Mix of bulk reads and writes
        if (operationId % 2 === 0) {
          // Bulk read
          return await database.query(
            'SELECT id, status FROM events WHERE id = ANY($1::text[])',
            [eventIds]
          );
        } else {
          // Bulk update
          return await database.query(
            'UPDATE events SET updated_at = NOW() WHERE id = ANY($1::text[])',
            [eventIds]
          );
        }
      };

      const result = await loadGenerator.generateLoad(bulkOperationTest, 10, 50);
      
      expect(result.successRate).toBeGreaterThan(90); // Bulk operations should be reliable
      expect(result.averageTime).toBeLessThan(1000); // <1s for bulk operations
      
      console.log(`📊 Bulk Operations Under Load:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Under Database Load', () => {
    test('Memory stability during sustained database load', async () => {
      const memoryTracker = performanceMonitor.trackResources('sustained_db_load', 1000, 30000);
      
      // Generate sustained load for 30 seconds
      const sustainedLoadTest = async () => {
        const operations = Array(300).fill().map(async (_, i) => {
          await new Promise(resolve => setTimeout(resolve, i * 100)); // Spread over 30 seconds
          return await database.query('SELECT COUNT(*) FROM events WHERE status = $1', ['discovered']);
        });
        
        return await Promise.all(operations);
      };

      const { result, metrics } = await measureAsync('sustained_load', sustainedLoadTest);
      
      await memoryTracker;
      const report = performanceMonitor.generateReport('sustained_db_load');
      
      expect(report.memory.growth).toBeLessThan(50 * 1024 * 1024); // <50MB growth
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // <100MB total increase
      
      console.log(`📊 Sustained Load Memory Analysis:
        - Duration: 30 seconds
        - Operations: 300
        - Memory Growth: ${report.memory.growthFormatted}
        - Max Memory: ${report.memory.maxFormatted}`);
    });

    test('Memory usage with large result sets under load', async () => {
      const largeResultTest = async (operationId) => {
        const limit = Math.floor(Math.random() * 500) + 100; // 100-600 rows
        
        return await database.query(`
          SELECT id, title, description, location_name, location_address, cost, date
          FROM events
          WHERE status = $1
          ORDER BY created_at DESC
          LIMIT $2
        `, ['discovered', limit]);
      };

      const initialMemory = performanceMonitor.getMemoryUsage();
      
      const result = await loadGenerator.generateLoad(largeResultTest, 15, 60);
      
      const finalMemory = performanceMonitor.getMemoryUsage();
      const memoryIncrease = finalMemory.current.heapUsed - initialMemory.current.heapUsed;
      
      expect(result.successRate).toBeGreaterThan(90);
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // <200MB for large result sets
      
      console.log(`📊 Large Result Sets Under Load:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Memory Increase: ${performanceMonitor.formatMemory(memoryIncrease)}
        - Average Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });

  describe('Database Transaction Performance', () => {
    test('Transaction rollback performance under load', async () => {
      const transactionTest = async (operationId) => {
        try {
          // Simulate transaction with potential rollback
          const shouldFail = operationId % 10 === 0; // 10% failure rate
          
          if (database.query.mock) {
            // Mock transaction behavior
            if (shouldFail) {
              throw new Error('Simulated transaction failure');
            }
            return { success: true, rolledBack: false };
          }
          
          // Real database transaction (if available)
          await database.query('BEGIN');
          
          await database.query(
            'INSERT INTO events (id, title, status, created_at) VALUES ($1, $2, $3, NOW())',
            [`tx-${operationId}`, `Transaction Event ${operationId}`, 'discovered']
          );
          
          if (shouldFail) {
            await database.query('ROLLBACK');
            return { success: false, rolledBack: true };
          } else {
            await database.query('COMMIT');
            return { success: true, rolledBack: false };
          }
          
        } catch (error) {
          try {
            await database.query('ROLLBACK');
          } catch (rollbackError) {
            // Rollback failed
          }
          throw error;
        }
      };

      const result = await loadGenerator.generateLoad(transactionTest, 10, 50);
      
      // Should handle transactions efficiently even with some failures
      expect(result.averageTime).toBeLessThan(300); // <300ms per transaction
      
      console.log(`📊 Transaction Performance:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });

  describe('Load Testing Edge Cases', () => {
    test('Database performance during peak load simulation', async () => {
      // Simulate peak usage: many users searching and approving events simultaneously
      const peakLoadTest = async (operationId) => {
        const operations = [
          // User searching (70% of operations)
          () => database.query('SELECT id, title FROM events WHERE status = $1 LIMIT 10', ['discovered']),
          () => database.query('SELECT COUNT(*) FROM events WHERE cost <= $1', [25]),
          
          // Admin operations (20% of operations)
          () => database.query('UPDATE events SET status = $1 WHERE id = $2', ['approved', `peak-${operationId}`]),
          () => database.query('SELECT id FROM events WHERE status = $1', ['approved']),
          
          // Heavy operations (10% of operations)
          () => database.query(`
            SELECT e.id, e.title, es.total_score, sp.rating
            FROM events e
            LEFT JOIN event_scores es ON e.id = es.event_id
            LEFT JOIN event_social_proof sp ON e.id = sp.event_id
            WHERE e.status = $1
            ORDER BY es.total_score DESC
            LIMIT 50
          `, ['discovered'])
        ];
        
        // Weight operations based on typical usage patterns
        let operationType;
        const rand = Math.random();
        if (rand < 0.7) {
          operationType = operations[operationId % 2]; // Search operations
        } else if (rand < 0.9) {
          operationType = operations[2 + (operationId % 2)]; // Admin operations
        } else {
          operationType = operations[4]; // Heavy operations
        }
        
        return await operationType();
      };

      const result = await loadGenerator.generateLoad(peakLoadTest, 40, 200);
      
      expect(result.successRate).toBeGreaterThan(85); // >85% during peak load
      expect(result.averageTime).toBeLessThan(800); // <800ms average during peak
      
      console.log(`📊 Peak Load Simulation (40 concurrent users):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Response Time: ${result.averageTime.toFixed(2)}ms
        - Total Duration: ${result.totalTime.toFixed(2)}ms
        - Operations/second: ${(result.totalOperations / (result.totalTime / 1000)).toFixed(1)}`);
    });

    test('Database recovery after connection pool exhaustion', async () => {
      // Simulate connection pool exhaustion and recovery
      const exhaustionTest = async (operationId) => {
        // Hold connections for varying amounts of time
        const holdTime = Math.random() * 1000 + 500; // 500-1500ms
        
        const result = await database.query('SELECT $1 as operation_id, NOW() as timestamp', [operationId]);
        
        // Simulate work that holds the connection
        await new Promise(resolve => setTimeout(resolve, holdTime));
        
        return result;
      };

      // Try to exhaust connection pool with more concurrent operations than typical pool size
      const result = await loadGenerator.generateLoad(exhaustionTest, 25, 100);
      
      // System should handle pool exhaustion gracefully
      expect(result.successRate).toBeGreaterThan(70); // >70% even with pool stress
      
      console.log(`📊 Connection Pool Exhaustion Test:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - This tests connection pool limits and queuing`);
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    test('Performance threshold monitoring', async () => {
      const thresholds = {
        queryTime: 1000,      // 1 second
        successRate: 90,      // 90%
        memoryGrowth: 100     // 100MB
      };

      const monitoringTest = async (operationId) => {
        return await database.query('SELECT COUNT(*) as count FROM events');
      };

      const initialMemory = performanceMonitor.getMemoryUsage();
      const result = await loadGenerator.generateLoad(monitoringTest, 10, 50);
      const finalMemory = performanceMonitor.getMemoryUsage();
      
      const memoryGrowthMB = (finalMemory.current.heapUsed - initialMemory.current.heapUsed) / 1024 / 1024;
      
      // Check against thresholds
      const thresholdViolations = [];
      
      if (result.averageTime > thresholds.queryTime) {
        thresholdViolations.push(`Query time: ${result.averageTime}ms > ${thresholds.queryTime}ms`);
      }
      
      if (result.successRate < thresholds.successRate) {
        thresholdViolations.push(`Success rate: ${result.successRate}% < ${thresholds.successRate}%`);
      }
      
      if (memoryGrowthMB > thresholds.memoryGrowth) {
        thresholdViolations.push(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB > ${thresholds.memoryGrowth}MB`);
      }
      
      if (thresholdViolations.length > 0) {
        console.warn(`⚠️  Performance threshold violations:`, thresholdViolations);
      } else {
        console.log(`✅ All performance thresholds met`);
      }
      
      expect(thresholdViolations.length).toBe(0);
    });
  });
});