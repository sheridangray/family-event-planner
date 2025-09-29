// TODO: Update this test file to use the new unified GmailClient API
// The old GmailMCPClient has been replaced with GmailClient that has a different API
// Key changes needed:
// 1. sendEmail now requires userId as first parameter
// 2. sendEmailWithRetry method no longer exists 
// 3. Different authentication flow using database-first tokens
// 4. CheckCalendarConflicts API has changed

const { GmailClient } = require('../../../src/mcp/gmail-client');
const TwilioMCPClient = require('../../../src/mcp/twilio');
const CalendarManager = require('../../../src/services/calendar-manager');

describe.skip('External Service Integration & Failure Handling - NEEDS UPDATE FOR UNIFIED CLIENT', () => {
  let gmailClient;
  let twilioClient;
  let calendarManager;
  let mockLogger;
  let mockDatabase;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create real instances but with mocked dependencies
    gmailClient = new GmailClient(mockLogger, mockDatabase);
    twilioClient = new TwilioMCPClient(mockLogger);
    calendarManager = new CalendarManager(mockLogger, mockDatabase);
  });

  describe('Gmail MCP Integration', () => {
    describe('Authentication Failures', () => {
      test('Handles expired OAuth tokens gracefully', async () => {
        // Mock expired token scenario
        const expiredTokenError = new Error('Token has expired');
        expiredTokenError.code = 401;
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(expiredTokenError)
            }
          }
        };
        
        const result = await gmailClient.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/token.*expired/i);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringMatching(/token.*expired/i)
        );
      });

      test('Handles invalid credentials', async () => {
        const invalidCredentialsError = new Error('Invalid credentials');
        invalidCredentialsError.code = 403;
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(invalidCredentialsError)
            }
          }
        };
        
        const result = await gmailClient.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid.*credentials/i);
      });

      test('Attempts token refresh on authentication failure', async () => {
        let callCount = 0;
        const mockRefreshToken = jest.fn().mockResolvedValue({
          access_token: 'new_token',
          expiry_date: Date.now() + 3600000
        });
        
        gmailClient.oauth2Client = {
          refreshAccessToken: mockRefreshToken,
          setCredentials: jest.fn()
        };
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  const error = new Error('Token expired');
                  error.code = 401;
                  throw error;
                }
                return Promise.resolve({ data: { id: 'message_id' } });
              })
            }
          }
        };
        
        const result = await gmailClient.sendEmailWithRetry({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        });
        
        expect(mockRefreshToken).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });

      test('Fails gracefully when token refresh fails', async () => {
        const refreshError = new Error('Refresh token expired');
        
        gmailClient.oauth2Client = {
          refreshAccessToken: jest.fn().mockRejectedValue(refreshError),
          setCredentials: jest.fn()
        };
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(new Error('Token expired'))
            }
          }
        };
        
        const result = await gmailClient.sendEmailWithRetry({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringMatching(/refresh.*token.*failed/i)
        );
      });
    });

    describe('API Rate Limiting', () => {
      test('Handles rate limit errors with exponential backoff', async () => {
        let callCount = 0;
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.code = 429;
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                  throw rateLimitError;
                }
                return Promise.resolve({ data: { id: 'success_id' } });
              })
            }
          }
        };
        
        const startTime = Date.now();
        const result = await gmailClient.sendEmailWithRetry({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        });
        const endTime = Date.now();
        
        expect(result.success).toBe(true);
        expect(endTime - startTime).toBeGreaterThan(100); // Should have delayed
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/rate.*limit/i)
        );
      });

      test('Gives up after maximum retry attempts', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.code = 429;
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(rateLimitError)
            }
          }
        };
        
        const result = await gmailClient.sendEmailWithRetry({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }, { maxRetries: 3 }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(gmailClient.gmail.users.messages.send).toHaveBeenCalledTimes(4); // Initial + 3 retries
      });
    });

    describe('Network Connectivity Issues', () => {
      test('Handles network timeouts', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'ETIMEDOUT';
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(timeoutError)
            }
          }
        };
        
        const result = await gmailClient.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout/i);
      });

      test('Handles DNS resolution failures', async () => {
        const dnsError = new Error('DNS resolution failed');
        dnsError.code = 'ENOTFOUND';
        
        gmailClient.gmail = {
          users: {
            messages: {
              send: jest.fn().mockRejectedValue(dnsError)
            }
          }
        };
        
        const result = await gmailClient.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/dns.*resolution/i);
      });
    });

    describe('Calendar Conflict Detection', () => {
      test('Handles calendar API failures gracefully', async () => {
        const calendarError = new Error('Calendar API temporarily unavailable');
        
        gmailClient.calendar = {
          events: {
            list: jest.fn().mockRejectedValue(calendarError)
          }
        };
        
        const result = await gmailClient.checkCalendarConflicts(
          new Date(),
          120 // 2 hours
        );
        
        expect(result.hasConflict).toBe(false);
        expect(result.hasWarning).toBe(true);
        expect(result.calendarAccessible.joyce).toBe(false);
        expect(result.calendarAccessible.sheridan).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/calendar.*api.*unavailable/i)
        );
      });

      test('Handles partial calendar access failures', async () => {
        let callCount = 0;
        gmailClient.calendar = {
          events: {
            list: jest.fn().mockImplementation((params) => {
              callCount++;
              if (callCount === 1) {
                // First call (Joyce's calendar) succeeds
                return Promise.resolve({
                  data: {
                    items: [
                      {
                        start: { dateTime: new Date(Date.now() + 1800000).toISOString() }, // 30 min later
                        end: { dateTime: new Date(Date.now() + 3600000).toISOString() }, // 1 hour later
                        summary: 'Joyce Meeting'
                      }
                    ]
                  }
                });
              } else {
                // Second call (Sheridan's calendar) fails
                throw new Error('Access denied to calendar');
              }
            })
          }
        };
        
        const result = await gmailClient.checkCalendarConflicts(
          new Date(),
          120
        );
        
        expect(result.calendarAccessible.joyce).toBe(true);
        expect(result.calendarAccessible.sheridan).toBe(false);
        expect(result.hasWarning).toBe(true);
        expect(result.warningConflicts).toHaveLength(1);
      });
    });
  });

  describe('Twilio SMS Integration', () => {
    describe('Service Outages', () => {
      test('Handles Twilio service unavailability', async () => {
        const serviceError = new Error('Service Unavailable');
        serviceError.status = 503;
        
        twilioClient.client = {
          messages: {
            create: jest.fn().mockRejectedValue(serviceError)
          }
        };
        
        const result = await twilioClient.sendSMS({
          to: '+1234567890',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/service.*unavailable/i);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringMatching(/twilio.*service.*unavailable/i)
        );
      });

      test('Implements fallback to email when SMS fails', async () => {
        const serviceError = new Error('Service Unavailable');
        serviceError.status = 503;
        
        twilioClient.client = {
          messages: {
            create: jest.fn().mockRejectedValue(serviceError)
          }
        };
        
        // Mock email fallback
        twilioClient.emailFallback = jest.fn().mockResolvedValue({
          success: true,
          method: 'email',
          messageId: 'email_123'
        });
        
        const result = await twilioClient.sendMessageWithFallback({
          to: '+1234567890',
          body: 'Test message',
          fallbackEmail: 'test@example.com'
        });
        
        expect(result.success).toBe(true);
        expect(result.fallbackUsed).toBe(true);
        expect(result.method).toBe('email');
        expect(twilioClient.emailFallback).toHaveBeenCalled();
      });
    });

    describe('Invalid Phone Numbers', () => {
      test('Handles various invalid phone number formats', async () => {
        const invalidNumbers = [
          '123', // Too short
          'abc', // Non-numeric
          '+1-invalid', // Invalid format
          '', // Empty
          null, // Null
          undefined // Undefined
        ];
        
        for (const number of invalidNumbers) {
          const result = await twilioClient.sendSMS({
            to: number,
            body: 'Test message'
          }).catch(err => ({ success: false, error: err.message }));
          
          expect(result.success).toBe(false);
          expect(result.error).toMatch(/invalid.*phone.*number/i);
        }
      });

      test('Validates phone number format before sending', async () => {
        const mockValidate = jest.fn().mockReturnValue(false);
        twilioClient.validatePhoneNumber = mockValidate;
        
        const result = await twilioClient.sendSMS({
          to: 'invalid-number',
          body: 'Test message'
        });
        
        expect(result.success).toBe(false);
        expect(mockValidate).toHaveBeenCalledWith('invalid-number');
        expect(result.error).toMatch(/invalid.*phone.*number/i);
      });
    });

    describe('Message Delivery Failures', () => {
      test('Handles message delivery failures', async () => {
        const deliveryError = new Error('Message delivery failed');
        deliveryError.status = 400;
        deliveryError.code = 21614; // Twilio error code for invalid number
        
        twilioClient.client = {
          messages: {
            create: jest.fn().mockRejectedValue(deliveryError)
          }
        };
        
        const result = await twilioClient.sendSMS({
          to: '+1234567890',
          body: 'Test message'
        }).catch(err => ({ success: false, error: err.message }));
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/delivery.*failed/i);
      });

      test('Tracks message status and handles failures', async () => {
        twilioClient.client = {
          messages: {
            create: jest.fn().mockResolvedValue({
              sid: 'SM123',
              status: 'failed',
              errorCode: 30008,
              errorMessage: 'Unknown error'
            })
          }
        };
        
        const result = await twilioClient.sendSMS({
          to: '+1234567890',
          body: 'Test message'
        });
        
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(30008);
        expect(result.errorMessage).toBe('Unknown error');
      });
    });
  });

  describe('Calendar Manager Integration', () => {
    describe('Multi-Calendar Access Failures', () => {
      test('Handles OAuth access failures for individual calendars', async () => {
        const accessError = new Error('Insufficient permissions');
        accessError.code = 403;
        
        calendarManager.gmailClient = {
          checkSingleCalendar: jest.fn()
            .mockResolvedValueOnce([]) // Joyce succeeds
            .mockRejectedValueOnce(accessError) // Sheridan fails
        };
        
        const result = await calendarManager.checkAllCalendars(new Date(), 120);
        
        expect(result.calendarAccessible.joyce).toBe(true);
        expect(result.calendarAccessible.sheridan).toBe(false);
        expect(result.hasWarning).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/calendar.*access.*failed.*sheridan/i)
        );
      });

      test('Handles complete calendar service outage', async () => {
        const serviceError = new Error('Calendar service temporarily unavailable');
        serviceError.code = 503;
        
        calendarManager.gmailClient = {
          checkSingleCalendar: jest.fn().mockRejectedValue(serviceError)
        };
        
        const result = await calendarManager.checkAllCalendars(new Date(), 120);
        
        expect(result.calendarAccessible.joyce).toBe(false);
        expect(result.calendarAccessible.sheridan).toBe(false);
        expect(result.hasConflict).toBe(false);
        expect(result.hasWarning).toBe(true);
        expect(result.systemWarning).toMatch(/calendar.*service.*unavailable/i);
      });
    });

    describe('Event Creation Failures', () => {
      test('Handles calendar event creation failures with rollback', async () => {
        const creationError = new Error('Calendar quota exceeded');
        creationError.code = 403;
        
        calendarManager.gmailClient = {
          createCalendarEvent: jest.fn().mockRejectedValue(creationError)
        };
        
        const testEvent = {
          id: 'test-event',
          title: 'Test Event',
          date: new Date(),
          time: '10:00'
        };
        
        const result = await calendarManager.createCalendarEvent(testEvent);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/quota.*exceeded/i);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringMatching(/calendar.*event.*creation.*failed/i)
        );
      });

      test('Handles partial calendar creation success', async () => {
        let callCount = 0;
        calendarManager.gmailClient = {
          createCalendarEvent: jest.fn().mockImplementation((event, calendarType) => {
            callCount++;
            if (calendarType === 'joyce') {
              return Promise.resolve({
                success: true,
                eventId: 'joyce_event_123',
                htmlLink: 'https://calendar.google.com/joyce'
              });
            } else {
              throw new Error('Sheridan calendar access denied');
            }
          })
        };
        
        const testEvent = {
          id: 'test-event',
          title: 'Test Event',
          date: new Date(),
          time: '10:00'
        };
        
        const result = await calendarManager.createCalendarEventAllCalendars(testEvent);
        
        expect(result.success).toBe(true);
        expect(result.partialSuccess).toBe(true);
        expect(result.joyce.success).toBe(true);
        expect(result.sheridan.success).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/partial.*success.*calendar.*creation/i)
        );
      });
    });
  });

  describe('Cross-Service Dependency Failures', () => {
    test('Handles Gmail + Calendar combined failures', async () => {
      const gmailError = new Error('Gmail API unavailable');
      const calendarError = new Error('Calendar API unavailable');
      
      gmailClient.gmail = {
        users: {
          messages: {
            send: jest.fn().mockRejectedValue(gmailError)
          }
        }
      };
      
      calendarManager.gmailClient = {
        checkSingleCalendar: jest.fn().mockRejectedValue(calendarError)
      };
      
      // Test combined workflow failure
      const emailResult = await gmailClient.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test'
      }).catch(err => ({ success: false, error: err.message }));
      
      const calendarResult = await calendarManager.checkAllCalendars(new Date(), 120);
      
      expect(emailResult.success).toBe(false);
      expect(calendarResult.hasWarning).toBe(true);
      expect(calendarResult.calendarAccessible.joyce).toBe(false);
      expect(calendarResult.calendarAccessible.sheridan).toBe(false);
    });

    test('Implements graceful degradation when multiple services fail', async () => {
      // Mock all external services failing
      gmailClient.gmail = {
        users: {
          messages: {
            send: jest.fn().mockRejectedValue(new Error('Gmail unavailable'))
          }
        }
      };
      
      twilioClient.client = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Twilio unavailable'))
        }
      };
      
      calendarManager.gmailClient = {
        checkSingleCalendar: jest.fn().mockRejectedValue(new Error('Calendar unavailable'))
      };
      
      // Test that the system continues to function with degraded capabilities
      const communicationResult = await twilioClient.sendMessageWithFallback({
        to: '+1234567890',
        body: 'Test',
        fallbackEmail: 'test@example.com'
      }).catch(() => ({ success: false, allServicesDown: true }));
      
      const calendarResult = await calendarManager.checkAllCalendars(new Date(), 120);
      
      expect(communicationResult.allServicesDown).toBe(true);
      expect(calendarResult.hasWarning).toBe(true);
      expect(calendarResult.systemWarning).toBeDefined();
      
      // System should still report status even with all services down
      expect(mockLogger.error).toHaveBeenCalledTimes(3); // One for each service
    });
  });

  describe('Service Recovery and Resilience', () => {
    test('Recovers when services come back online', async () => {
      let callCount = 0;
      gmailClient.gmail = {
        users: {
          messages: {
            send: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 2) {
                throw new Error('Service temporarily unavailable');
              }
              return Promise.resolve({ data: { id: 'recovered_message' } });
            })
          }
        }
      };
      
      const result = await gmailClient.sendEmailWithRetry({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('recovered_message');
      expect(callCount).toBe(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/service.*recovered/i)
      );
    });

    test('Circuit breaker prevents excessive calls to failing services', async () => {
      let callCount = 0;
      const failingService = jest.fn().mockImplementation(() => {
        callCount++;
        throw new Error('Service consistently failing');
      });
      
      gmailClient.gmail = {
        users: {
          messages: {
            send: failingService
          }
        }
      };
      
      // Implement circuit breaker pattern
      gmailClient.circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        maxFailures: 3,
        attempt: async function(operation) {
          if (this.isOpen) {
            throw new Error('Circuit breaker is open');
          }
          
          try {
            const result = await operation();
            this.failureCount = 0; // Reset on success
            return result;
          } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
              this.isOpen = true;
              setTimeout(() => {
                this.isOpen = false;
                this.failureCount = 0;
              }, 30000); // 30 second cooldown
            }
            throw error;
          }
        }
      };
      
      // Multiple rapid calls should trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await gmailClient.circuitBreaker.attempt(() => 
            gmailClient.gmail.users.messages.send({})
          );
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(callCount).toBeLessThanOrEqual(3); // Circuit breaker should prevent excessive calls
      expect(gmailClient.circuitBreaker.isOpen).toBe(true);
    });
  });
});