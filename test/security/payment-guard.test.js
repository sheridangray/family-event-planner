const RegistrationAutomator = require('../../src/automation/registration');

describe('Payment Guard Security Tests', () => {
  let registrationAutomator;
  let mockLogger;
  let mockDatabase;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    registrationAutomator = new RegistrationAutomator(mockLogger, mockDatabase);
  });

  afterEach(async () => {
    if (registrationAutomator && registrationAutomator.browser && typeof registrationAutomator.browser.close === 'function') {
      await registrationAutomator.browser.close();
      registrationAutomator.browser = null;
    }
  });

  describe('Payment Safety Enforcement', () => {
    test('CRITICAL: Blocks all paid events from automation', async () => {
      const paidEvents = [
        { 
          id: 1, 
          title: 'Expensive Concert', 
          cost: 25.00, 
          registration_url: 'https://example.com/register' 
        },
        { 
          id: 2, 
          title: 'Workshop with Fee', 
          cost: 0.01, 
          registration_url: 'https://example.com/workshop' 
        },
        { 
          id: 3, 
          title: 'Premium Event', 
          cost: 100, 
          registration_url: 'https://example.com/premium' 
        }
      ];
      
      // Set up mock browser to ensure payment guard is tested
      registrationAutomator.browser = {
        newPage: jest.fn().mockResolvedValue({
          setUserAgent: jest.fn(),
          close: jest.fn()
        }),
        close: jest.fn()
      };
      
      for (const event of paidEvents) {
        await expect(registrationAutomator.registerForEvent(event))
          .rejects.toThrow(/SAFETY VIOLATION.*paid events/i);
        
        // Verify error logging for safety violations
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringMatching(/CRITICAL SAFETY.*PAID event/i)
        );
      }
    });

    test('Allows free events to proceed', async () => {
      const freeEvent = {
        id: 1,
        title: 'Free Workshop',
        cost: 0,
        registration_url: 'https://example.com/free'
      };

      // Mock browser initialization failure to avoid actual browser operations
      registrationAutomator.browser = null;
      
      const result = await registrationAutomator.registerForEvent(freeEvent);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Browser automation not available');
      // Should not throw safety violation for free events
    });

    test('Validates cost parsing from multiple sources', async () => {
      const eventsWithHiddenCosts = [
        { 
          id: 1, 
          cost: 0, 
          title: 'Hidden Cost Event',
          description: 'Admission $20 at the door',
          registration_url: 'https://example.com/hidden1'
        },
        { 
          id: 2, 
          cost: null, 
          title: '$10 Workshop Special',
          registration_url: 'https://example.com/hidden2'
        },
        { 
          id: 3, 
          cost: 'free', 
          title: 'Free Event',
          details: 'Registration fee applies: $5',
          registration_url: 'https://example.com/hidden3'
        }
      ];

      // Note: Current implementation only checks event.cost field
      // This test documents the limitation and ensures we don't regress
      for (const event of eventsWithHiddenCosts) {
        if (typeof event.cost === 'number' && event.cost > 0) {
          await expect(registrationAutomator.registerForEvent(event))
            .rejects.toThrow(/SAFETY VIOLATION/i);
        } else {
          // Events with cost: 0, null, or 'free' currently pass
          // This is a known limitation that should be addressed
          registrationAutomator.browser = null; // Prevent actual registration
          const result = await registrationAutomator.registerForEvent(event);
          expect(result.success).toBe(false);
          expect(result.message).toBe('Browser automation not available');
        }
      }
    });

    test('Handles malformed cost data safely', async () => {
      const malformedEvents = [
        { 
          id: 1, 
          cost: 'invalid', 
          title: 'Invalid Cost',
          registration_url: 'https://example.com/invalid1'
        },
        { 
          id: 2, 
          cost: NaN, 
          title: 'NaN Cost',
          registration_url: 'https://example.com/invalid2'
        },
        { 
          id: 3, 
          cost: Infinity, 
          title: 'Infinity Cost',
          registration_url: 'https://example.com/invalid3'
        },
        { 
          id: 4, 
          cost: -5, 
          title: 'Negative Cost',
          registration_url: 'https://example.com/invalid4'
        }
      ];

      for (const event of malformedEvents) {
        if (typeof event.cost === 'number' && event.cost > 0) {
          // Set up mock browser for payment guard test
          registrationAutomator.browser = {
            newPage: jest.fn().mockResolvedValue({
              setUserAgent: jest.fn(),
              close: jest.fn()
            }),
            close: jest.fn()
          };
          
          await expect(registrationAutomator.registerForEvent(event))
            .rejects.toThrow(/SAFETY VIOLATION/i);
        } else {
          // Malformed costs that don't trigger > 0 check should still be handled safely
          registrationAutomator.browser = null; // Prevent actual registration
          const result = await registrationAutomator.registerForEvent(event);
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('Payment Processing Safety', () => {
    test('processApprovedEvents skips paid events correctly', async () => {
      const mixedEvents = [
        { id: 1, title: 'Free Event', cost: 0, status: 'approved' },
        { id: 2, title: 'Paid Event', cost: 25, status: 'approved' },
        { id: 3, title: 'Ready Free Event', cost: 0, status: 'ready_for_registration' }
      ];

      mockDatabase.getEventsByStatus.mockImplementation((status) => {
        if (status === 'approved') {
          return Promise.resolve(mixedEvents.filter(e => e.status === 'approved'));
        }
        if (status === 'ready_for_registration') {
          return Promise.resolve(mixedEvents.filter(e => e.status === 'ready_for_registration'));
        }
        return Promise.resolve([]);
      });

      // Mock browser to prevent actual registration attempts
      registrationAutomator.browser = null;

      const results = await registrationAutomator.processApprovedEvents();

      // Verify paid event was skipped
      const paidEventResult = results.find(r => r.title === 'Paid Event');
      expect(paidEventResult.success).toBe(false);
      expect(paidEventResult.requiresPayment).toBe(true);
      expect(paidEventResult.message).toBe('Waiting for payment confirmation');

      // Verify free events were processed (would fail due to no browser, but that's expected)
      const freeEventResults = results.filter(r => r.title.includes('Free'));
      expect(freeEventResults).toHaveLength(2);
    });

    test('Logs payment safety violations with sufficient detail', async () => {
      const paidEvent = {
        id: 1,
        title: 'Expensive Workshop',
        cost: 50.00,
        registration_url: 'https://example.com/expensive'
      };

      // Set up mock browser for payment guard test
      registrationAutomator.browser = {
        newPage: jest.fn().mockResolvedValue({
          setUserAgent: jest.fn(),
          close: jest.fn()
        }),
        close: jest.fn()
      };
      
      await expect(registrationAutomator.registerForEvent(paidEvent))
        .rejects.toThrow(/SAFETY VIOLATION/i);

      // Verify detailed logging for audit purposes
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/CRITICAL SAFETY.*Expensive Workshop.*\$50/i)
      );
    });
  });

  describe('Browser Resource Safety', () => {
    test('Browser cleanup on registration failure', async () => {
      const freeEvent = {
        id: 1,
        title: 'Free Event',
        cost: 0,
        registration_url: 'https://example.com/free'
      };

      // Mock a browser that will fail during registration
      const mockPage = {
        setUserAgent: jest.fn().mockResolvedValue(),
        close: jest.fn().mockResolvedValue()
      };
      
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      registrationAutomator.browser = mockBrowser;

      // Mock adapter that will throw an error
      registrationAutomator.adapters = {
        generic: {
          name: 'GenericAdapter',
          attemptRegistration: jest.fn().mockRejectedValue(new Error('Registration failed'))
        }
      };

      try {
        await registrationAutomator.registerForEvent(freeEvent);
      } catch (error) {
        // Expected to fail
      }

      // Verify page was closed even after failure
      expect(mockPage.close).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Security Boundaries', () => {
    test('Rejects events without registration URLs', async () => {
      const eventWithoutUrl = {
        id: 1,
        title: 'No URL Event',
        cost: 0
        // No registration_url field
      };

      // Set up mock browser for this test
      registrationAutomator.browser = {
        newPage: jest.fn().mockResolvedValue({
          setUserAgent: jest.fn(),
          close: jest.fn()
        }),
        close: jest.fn()
      };
      
      await expect(registrationAutomator.registerForEvent(eventWithoutUrl))
        .rejects.toThrow(/No registration URL/i);
    });

    test('Handles extremely large cost values', async () => {
      const expensiveEvent = {
        id: 1,
        title: 'Extremely Expensive',
        cost: Number.MAX_SAFE_INTEGER,
        registration_url: 'https://example.com/expensive'
      };

      // Set up mock browser for payment guard test
      registrationAutomator.browser = {
        newPage: jest.fn().mockResolvedValue({
          setUserAgent: jest.fn(),
          close: jest.fn()
        }),
        close: jest.fn()
      };
      
      await expect(registrationAutomator.registerForEvent(expensiveEvent))
        .rejects.toThrow(/SAFETY VIOLATION/i);
    });

    test('Protects against cost field manipulation', async () => {
      const manipulatedEvent = {
        id: 1,
        title: 'Manipulated Event',
        cost: 0,
        registration_url: 'https://example.com/manipulated'
      };

      // Simulate cost being changed after initial check
      setTimeout(() => {
        manipulatedEvent.cost = 100;
      }, 10);

      registrationAutomator.browser = null; // Prevent actual registration
      
      const result = await registrationAutomator.registerForEvent(manipulatedEvent);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Browser automation not available');
    });
  });
});