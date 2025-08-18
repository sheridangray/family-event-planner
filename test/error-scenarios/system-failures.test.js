const { SMSApprovalManager } = require('../../src/mcp/twilio');
const { CalendarConflictChecker } = require('../../src/mcp/gmail');
const RegistrationAutomator = require('../../src/automation/registration');
const ReportingService = require('../../src/services/reporting');
const { FailingMockDatabase } = require('../mocks/database');
const { createMockGoogleServices } = require('../mocks/external-services');

describe('System Failure Scenarios', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    jest.clearAllMocks();
  });

  describe('Database Failures', () => {
    test('should handle database connection failures gracefully', async () => {
      const failingDb = new FailingMockDatabase('always');
      const smsManager = new SMSApprovalManager(mockLogger, failingDb);
      
      const testEvent = {
        id: 1,
        title: 'Test Event',
        cost: 0,
        date: new Date().toISOString()
      };

      await expect(smsManager.sendEventForApproval(testEvent)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending event for approval'),
        expect.any(String)
      );
    });

    test('should handle partial database failures', async () => {
      const failingDb = new FailingMockDatabase('random');
      failingDb.failureRate = 0.5; // 50% failure rate
      
      const smsManager = new SMSApprovalManager(mockLogger, failingDb);
      const results = [];
      
      // Try multiple operations to test randomness
      for (let i = 0; i < 10; i++) {
        try {
          const event = { id: i, title: `Event ${i}`, cost: 0, date: new Date().toISOString() };
          const result = await smsManager.sendEventForApproval(event);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      expect(failures).toBeGreaterThan(0); // Should have some failures
      expect(successes).toBeGreaterThan(0); // Should have some successes
    });

    test('should handle database query timeouts', async () => {
      const failingDb = new FailingMockDatabase('getEventsByStatus');
      const registrationAutomator = new RegistrationAutomator(mockLogger, failingDb);
      
      const results = await registrationAutomator.processApprovedEvents();
      
      expect(results).toEqual([]); // Should return empty array on failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing approved events'),
        expect.any(String)
      );
    });
  });

  describe('External Service Cascading Failures', () => {
    test('should handle complete Gmail API failure', async () => {
      const mockServices = createMockGoogleServices();
      mockServices._mockCalendar.setFailureMode('network');
      mockServices._mockGmail.setFailureMode('auth');
      
      jest.doMock('googleapis', () => mockServices);
      
      const calendarChecker = new CalendarConflictChecker(mockLogger);
      const reportingService = new ReportingService(mockLogger);
      
      // Calendar should fail gracefully
      const conflicts = await calendarChecker.getConflictDetails('2024-01-15T14:00:00Z');
      expect(conflicts.hasConflict).toBe(false);
      expect(conflicts.warnings).toContain(expect.stringContaining('completely unavailable'));
      
      // Email reports should fall back gracefully
      const emailResult = await reportingService.emailReport('Test report');
      expect(emailResult.success).toBe(false);
      expect(emailResult.fallback).toBe('file_saved');
    });

    test('should handle Twilio service degradation', async () => {
      const mockDb = global.createMockDatabase();
      const smsManager = new SMSApprovalManager(mockLogger, mockDb);
      
      // Mock Twilio failure
      smsManager.twilioClient.sendSMS = jest.fn().mockRejectedValue(new Error('Twilio service unavailable'));
      
      const testEvent = {
        id: 1,
        title: 'Test Event',
        cost: 0,
        date: new Date().toISOString()
      };

      await expect(smsManager.sendEventForApproval(testEvent)).rejects.toThrow('Twilio service unavailable');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle Puppeteer browser crashes', async () => {
      const mockDb = global.createMockDatabase();
      const registrationAutomator = new RegistrationAutomator(mockLogger, mockDb);
      
      // Mock browser failure
      registrationAutomator.browser = {
        newPage: jest.fn().mockRejectedValue(new Error('Browser crashed'))
      };

      const testEvent = {
        id: 1,
        title: 'Test Event',
        cost: 0,
        registrationUrl: 'https://example.com/register'
      };

      const result = await registrationAutomator.registerForEvent(testEvent);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to load registration page');
      expect(result.requiresManualAction).toBe(true);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory pressure gracefully', async () => {
      const mockDb = global.createMockDatabase();
      
      // Create a large number of events to simulate memory pressure
      const largeEventSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Event ${i}`,
        cost: Math.random() * 100,
        date: new Date(Date.now() + i * 86400000).toISOString(),
        ageRange: { min: 2, max: 10 },
        location: { address: 'San Francisco, CA' }
      }));

      // Process large batch
      mockDb.getEventsByStatus = jest.fn().mockResolvedValue(largeEventSet);
      
      const registrationAutomator = new RegistrationAutomator(mockLogger, mockDb);
      const results = await registrationAutomator.processApprovedEvents();
      
      // Should complete without crashing
      expect(Array.isArray(results)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processed')
      );
    });

    test('should handle rate limiting from external APIs', async () => {
      const mockServices = createMockGoogleServices();
      mockServices._mockCalendar.setFailureMode('quota');
      
      jest.doMock('googleapis', () => mockServices);
      
      const calendarChecker = new CalendarConflictChecker(mockLogger);
      
      const conflicts = await calendarChecker.getConflictDetails('2024-01-15T14:00:00Z');
      
      expect(conflicts.hasConflict).toBe(false); // Safe default
      expect(conflicts.warnings).toContain(expect.stringContaining('unavailable'));
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Data Corruption and Invalid States', () => {
    test('should handle corrupted event data', async () => {
      const mockDb = global.createMockDatabase();
      const registrationAutomator = new RegistrationAutomator(mockLogger, mockDb);
      
      // Simulate corrupted event data
      const corruptedEvent = {
        id: 'not-a-number',
        title: null,
        cost: 'invalid',
        date: 'not-a-date',
        registrationUrl: 'not-a-url'
      };

      const result = await registrationAutomator.registerForEvent(corruptedEvent);
      
      expect(result.success).toBe(false);
      expect(result.requiresManualAction).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle orphaned SMS approvals', async () => {
      const mockDb = global.createMockDatabase();
      const smsManager = new SMSApprovalManager(mockLogger, mockDb);
      
      // Mock approval without corresponding event
      smsManager.twilioClient.getPendingApprovals = jest.fn().mockResolvedValue([
        {
          id: 999,
          event_id: 99999, // Non-existent event
          event_title: 'Orphaned Event',
          phone_number: '+1234567890'
        }
      ]);

      const result = await smsManager.handleIncomingResponse('+1234567890', 'YES', 'msg-id');
      
      // Should handle gracefully without crashing
      expect(result).toBeTruthy();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle malformed SMS responses', async () => {
      const mockDb = global.createMockDatabase();
      const smsManager = new SMSApprovalManager(mockLogger, mockDb);
      
      // Mock empty approvals
      smsManager.twilioClient.getPendingApprovals = jest.fn().mockResolvedValue([]);
      
      // Test various malformed inputs
      const malformedInputs = [
        null,
        undefined,
        '',
        '   ',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit'.repeat(10), // Very long text
        '🤖🎉🔥💯' // Only emojis
      ];

      for (const input of malformedInputs) {
        const result = await smsManager.handleIncomingResponse('+1234567890', input, 'msg-id');
        expect(result).toBeNull(); // Should handle gracefully
      }
    });
  });

  describe('Race Conditions and Concurrency Issues', () => {
    test('should handle concurrent SMS responses for same event', async () => {
      const mockDb = global.createMockDatabase();
      const smsManager = new SMSApprovalManager(mockLogger, mockDb);
      
      // Mock same pending approval for both requests
      const pendingApproval = {
        id: 123,
        event_id: 1,
        event_title: 'Concurrent Event',
        event_cost: 0,
        phone_number: '+1234567890'
      };
      
      smsManager.twilioClient.getPendingApprovals = jest.fn().mockResolvedValue([pendingApproval]);
      
      // Simulate concurrent responses
      const responses = await Promise.allSettled([
        smsManager.handleIncomingResponse('+1234567890', 'YES', 'msg-1'),
        smsManager.handleIncomingResponse('+1234567890', 'NO', 'msg-2')
      ]);

      // Both should complete without error
      expect(responses[0].status).toBe('fulfilled');
      expect(responses[1].status).toBe('fulfilled');
      
      // Event status should be updated (last one wins)
      expect(mockDb.updateEventStatus).toHaveBeenCalled();
    });

    test('should handle concurrent event processing', async () => {
      const mockDb = global.createMockDatabase();
      
      // Mock same event being processed concurrently
      const testEvent = {
        id: 1,
        title: 'Concurrent Processing Event',
        cost: 0,
        status: 'approved',
        registrationUrl: 'https://example.com'
      };
      
      mockDb.getEventsByStatus = jest.fn().mockResolvedValue([testEvent]);
      
      const automator1 = new RegistrationAutomator(mockLogger, mockDb);
      const automator2 = new RegistrationAutomator(mockLogger, mockDb);
      
      // Process simultaneously
      const results = await Promise.allSettled([
        automator1.processApprovedEvents(),
        automator2.processApprovedEvents()
      ]);

      // Both should complete
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
    });
  });

  describe('Network and Connectivity Issues', () => {
    test('should handle intermittent network failures', async () => {
      const mockServices = createMockGoogleServices();
      let callCount = 0;
      
      // Simulate intermittent failures
      mockServices._mockCalendar.events.list = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          throw new Error('Network timeout');
        }
        return Promise.resolve({ data: { items: [] } });
      });
      
      jest.doMock('googleapis', () => mockServices);
      
      const calendarChecker = new CalendarConflictChecker(mockLogger);
      
      // Multiple calls should eventually succeed
      const results = await Promise.allSettled([
        calendarChecker.hasConflict('2024-01-15T14:00:00Z'),
        calendarChecker.hasConflict('2024-01-15T15:00:00Z'),
        calendarChecker.hasConflict('2024-01-15T16:00:00Z'),
        calendarChecker.hasConflict('2024-01-15T17:00:00Z')
      ]);

      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0); // Some should succeed
    });

    test('should handle DNS resolution failures', async () => {
      const mockDb = global.createMockDatabase();
      const registrationAutomator = new RegistrationAutomator(mockLogger, mockDb);
      
      const eventWithBadUrl = {
        id: 1,
        title: 'Bad URL Event',
        cost: 0,
        registrationUrl: 'https://this-domain-does-not-exist-12345.com'
      };

      const result = await registrationAutomator.registerForEvent(eventWithBadUrl);
      
      expect(result.success).toBe(false);
      expect(result.requiresManualAction).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});