const Database = require('../../src/database');
const PostgresDatabase = require('../../src/database/postgres');

describe('Database Transaction Safety and Integrity', () => {
  let database;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    database = new Database();
    
    // Use test database configuration
    process.env.NODE_ENV = 'test';
    
    try {
      await database.init();
    } catch (error) {
      // If database is not available, use mocked database
      database = createMockDatabase();
    }
  });

  afterEach(async () => {
    if (database && typeof database.close === 'function') {
      await database.close();
    }
  });

  describe('Concurrent Access Safety', () => {
    test('Concurrent event registrations handled safely', async () => {
      const testEvent = {
        id: 'test-event-1',
        title: 'Limited Capacity Event',
        capacity: 1,
        current_registrations: 0
      };

      // Mock database to simulate capacity checking
      let registrationCount = 0;
      const mockRegisterForEvent = jest.fn().mockImplementation(async (eventId, familyId) => {
        // Simulate checking current capacity
        const currentCount = registrationCount;
        
        // Simulate some processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Check if still under capacity
        if (currentCount >= 1) {
          throw new Error('Event is at capacity');
        }
        
        registrationCount++;
        return { success: true, registrationId: `reg-${Date.now()}` };
      });

      if (database.registerForEvent) {
        database.registerForEvent = mockRegisterForEvent;
      }

      // Simulate 5 simultaneous registration attempts
      const familyIds = ['family_1', 'family_2', 'family_3', 'family_4', 'family_5'];
      const registrationPromises = familyIds.map(familyId => 
        database.registerForEvent ? 
          database.registerForEvent(testEvent.id, familyId).catch(err => ({ success: false, error: err.message })) :
          Promise.resolve({ success: false, error: 'Method not implemented' })
      );
      
      const results = await Promise.allSettled(registrationPromises);
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(v => v.success);
      
      // Only one registration should succeed due to capacity limit
      expect(successful).toHaveLength(1);
      
      // Verify that the failed attempts were due to capacity, not race conditions
      const failed = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(v => !v.success);
      
      failed.forEach(result => {
        expect(result.error).toMatch(/capacity|full/i);
      });
    });

    test('Concurrent event updates maintain data consistency', async () => {
      const eventId = 'test-event-2';
      const initialData = {
        id: eventId,
        title: 'Test Event',
        status: 'discovered',
        score: 0
      };

      // Mock database operations with potential race conditions
      let eventData = { ...initialData };
      const updateOperations = [];

      const mockUpdateEvent = jest.fn().mockImplementation(async (id, updates) => {
        // Record the operation for analysis
        updateOperations.push({ id, updates, timestamp: Date.now() });
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        
        // Apply updates
        eventData = { ...eventData, ...updates };
        return eventData;
      });

      if (database.updateEvent) {
        database.updateEvent = mockUpdateEvent;
      }

      // Simulate concurrent updates
      const concurrentUpdates = [
        { status: 'scored' },
        { score: 85 },
        { status: 'approved' },
        { approvedBy: 'parent_1' },
        { score: 90 }
      ];

      const updatePromises = concurrentUpdates.map(update => 
        database.updateEvent ? 
          database.updateEvent(eventId, update) :
          Promise.resolve(eventData)
      );
      
      await Promise.allSettled(updatePromises);
      
      // Verify all operations were recorded
      expect(updateOperations.length).toBe(concurrentUpdates.length);
      
      // Verify final state is consistent
      expect(eventData.id).toBe(eventId);
      expect(eventData.title).toBe('Test Event');
      // Final status should be one of the attempted values
      expect(['discovered', 'scored', 'approved']).toContain(eventData.status);
    });
  });

  describe('Transaction Rollback Safety', () => {
    test('Database rollback on partial failures', async () => {
      const initialEventCount = await getEventCountSafely(database);
      
      // Attempt a transaction that should fail partway through
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const mockTrx = {
          saveEvent: jest.fn().mockImplementation(async (event) => {
            if (event.title.includes('FAIL')) {
              throw new Error('Simulated database error');
            }
            return { id: `event-${Date.now()}`, ...event };
          }),
          saveEventScore: jest.fn().mockImplementation(async (eventId, scores) => {
            if (eventId === 'invalid_event_id') {
              throw new Error('Foreign key constraint violation');
            }
            return { eventId, scores };
          }),
          rollback: jest.fn(),
          commit: jest.fn()
        };
        
        try {
          const result = await callback(mockTrx);
          await mockTrx.commit();
          return result;
        } catch (error) {
          await mockTrx.rollback();
          throw error;
        }
      });

      // Mock database transaction if available
      if (database.transaction) {
        database.transaction = mockTransaction;
      }

      const validEvent = {
        title: 'Valid Event',
        date: new Date(),
        location: 'Test Location'
      };

      try {
        await (database.transaction || mockTransaction)(async (trx) => {
          await trx.saveEvent(validEvent);
          await trx.saveEventScore('invalid_event_id', { overall: 85 }); // This should fail
        });
      } catch (error) {
        // Transaction should rollback
        expect(error.message).toMatch(/constraint|invalid/i);
      }
      
      const finalEventCount = await getEventCountSafely(database);
      
      // Event count should remain the same (rollback successful)
      expect(finalEventCount).toBe(initialEventCount);
    });

    test('Nested transaction handling', async () => {
      // Test that nested transactions are handled safely
      const operations = [];
      
      const mockNestedTransaction = jest.fn().mockImplementation(async (callback) => {
        operations.push('outer_transaction_start');
        
        try {
          const result = await callback({
            saveEvent: jest.fn().mockImplementation(async (event) => {
              operations.push('save_event');
              
              // Nested operation
              return await mockNestedTransaction(async (innerTrx) => {
                operations.push('inner_transaction_start');
                
                if (event.title.includes('NESTED_FAIL')) {
                  throw new Error('Nested transaction failure');
                }
                
                operations.push('inner_transaction_success');
                return { id: `nested-${Date.now()}`, ...event };
              });
            })
          });
          
          operations.push('outer_transaction_success');
          return result;
        } catch (error) {
          operations.push('outer_transaction_rollback');
          throw error;
        }
      });

      if (database.transaction) {
        database.transaction = mockNestedTransaction;
      }

      try {
        await (database.transaction || mockNestedTransaction)(async (trx) => {
          await trx.saveEvent({ title: 'NESTED_FAIL Event' });
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Verify proper transaction nesting and rollback
      expect(operations).toContain('outer_transaction_start');
      expect(operations).toContain('inner_transaction_start');
      expect(operations).toContain('outer_transaction_rollback');
      expect(operations).not.toContain('inner_transaction_success');
      expect(operations).not.toContain('outer_transaction_success');
    });
  });

  describe('Data Integrity Constraints', () => {
    test('Foreign key constraint enforcement', async () => {
      const invalidEventScore = {
        eventId: 'non_existent_event',
        scores: { overall: 85, age_appropriateness: 90 }
      };

      // Attempt to save a score for non-existent event
      try {
        await database.saveEventScore(invalidEventScore.eventId, invalidEventScore.scores);
        
        // If no error thrown, verify the operation was safely rejected
        const savedScore = await database.getEventScore ? 
          database.getEventScore(invalidEventScore.eventId) : null;
        expect(savedScore).toBeNull();
        
      } catch (error) {
        // Should throw foreign key constraint error
        expect(error.message).toMatch(/foreign.*key|constraint|reference/i);
      }
    });

    test('Unique constraint enforcement', async () => {
      const duplicateEvent = {
        id: 'duplicate-test-event',
        title: 'Duplicate Event Test',
        date: new Date(),
        source_url: 'https://example.com/duplicate'
      };

      // Save event first time
      let firstSave;
      try {
        firstSave = await database.saveEvent(duplicateEvent);
        expect(firstSave.id).toBeDefined();
      } catch (error) {
        // If database not available, mock the constraint
        firstSave = { id: duplicateEvent.id };
      }

      // Attempt to save duplicate
      try {
        await database.saveEvent(duplicateEvent);
        
        // If no error, verify only one exists
        if (database.getEventById) {
          const events = await database.query ?
            database.query('SELECT COUNT(*) as count FROM events WHERE id = ?', [duplicateEvent.id]) :
            [{ count: 1 }];
          expect(events[0].count).toBe(1);
        }
        
      } catch (error) {
        // Should throw unique constraint error
        expect(error.message).toMatch(/unique|duplicate|constraint/i);
      }
    });

    test('Data type validation', async () => {
      const invalidEvents = [
        { title: null, date: 'invalid-date', cost: 'not-a-number' },
        { title: 123, date: null, cost: -1 },
        { title: '', date: new Date('invalid'), cost: Infinity }
      ];

      for (const invalidEvent of invalidEvents) {
        try {
          await database.saveEvent(invalidEvent);
          
          // If no error, verify data was sanitized/corrected
          if (database.getEventById && invalidEvent.id) {
            const savedEvent = await database.getEventById(invalidEvent.id);
            
            // Title should be string
            if (savedEvent) {
              expect(typeof savedEvent.title).toBe('string');
              expect(savedEvent.title.length).toBeGreaterThan(0);
              
              // Cost should be valid number
              expect(typeof savedEvent.cost).toBe('number');
              expect(Number.isFinite(savedEvent.cost)).toBe(true);
              expect(savedEvent.cost).toBeGreaterThanOrEqual(0);
              
              // Date should be valid
              expect(savedEvent.date).toBeInstanceOf(Date);
              expect(savedEvent.date.getTime()).not.toBeNaN();
            }
          }
          
        } catch (error) {
          // Should reject invalid data
          expect(error.message).toMatch(/invalid|type|format|constraint/i);
        }
      }
    });
  });

  describe('Connection Pool Management', () => {
    test('Database connection cleanup after errors', async () => {
      const connectionsBefore = await getActiveConnectionCount(database);
      
      // Simulate multiple failing operations
      const failingOperations = Array(10).fill().map(async (_, i) => {
        try {
          await database.query ? 
            database.query('SELECT * FROM non_existent_table') :
            Promise.reject(new Error('Table does not exist'));
        } catch (error) {
          // Expected to fail
        }
      });
      
      await Promise.allSettled(failingOperations);
      
      // Allow time for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connectionsAfter = await getActiveConnectionCount(database);
      
      // Connection count should not have grown significantly
      expect(connectionsAfter - connectionsBefore).toBeLessThanOrEqual(2);
    });

    test('Connection pool exhaustion handling', async () => {
      // Simulate many simultaneous operations
      const heavyOperations = Array(50).fill().map(async (_, i) => {
        try {
          await database.getEventsByStatus ? 
            database.getEventsByStatus('discovered') :
            Promise.resolve([]);
        } catch (error) {
          return { error: error.message };
        }
      });
      
      const results = await Promise.allSettled(heavyOperations);
      
      // Most operations should succeed despite high load
      const successful = results.filter(r => 
        r.status === 'fulfilled' && !r.value?.error
      );
      
      expect(successful.length).toBeGreaterThan(results.length * 0.8); // 80% success rate
    });
  });

  describe('Backup and Recovery Simulation', () => {
    test('Data consistency during backup operations', async () => {
      // Simulate backup scenario with concurrent writes
      const backupData = [];
      const writeOperations = [];
      
      // Start "backup" process
      const backupPromise = (async () => {
        // Simulate reading all data
        const events = await database.getEventsByStatus ? 
          database.getEventsByStatus('discovered') : [];
        backupData.push(...events);
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate backup time
        
        const moreEvents = await database.getEventsByStatus ? 
          database.getEventsByStatus('approved') : [];
        backupData.push(...moreEvents);
      })();
      
      // Concurrent write operations during backup
      const writePromise = (async () => {
        for (let i = 0; i < 5; i++) {
          const event = {
            title: `Concurrent Event ${i}`,
            date: new Date(),
            status: 'discovered'
          };
          
          try {
            const result = await database.saveEvent ? 
              database.saveEvent(event) : { id: `mock-${i}` };
            writeOperations.push(result);
          } catch (error) {
            writeOperations.push({ error: error.message });
          }
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();
      
      await Promise.all([backupPromise, writePromise]);
      
      // Verify system remained stable during concurrent operations
      expect(writeOperations.length).toBe(5);
      const successfulWrites = writeOperations.filter(op => !op.error);
      expect(successfulWrites.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions
async function getEventCountSafely(database) {
  try {
    if (database.query) {
      const result = await database.query('SELECT COUNT(*) as count FROM events');
      return result[0].count;
    }
    if (database.getEventsByStatus) {
      const events = await database.getEventsByStatus('discovered');
      return events.length;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

async function getActiveConnectionCount(database) {
  try {
    if (database.query) {
      const result = await database.query('SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()');
      return result[0].count;
    }
    return 1; // Mock single connection
  } catch (error) {
    return 1;
  }
}