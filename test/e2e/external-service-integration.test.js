/**
 * External Service Integration End-to-End Tests
 * 
 * Complete integration testing with Gmail, Twilio, Calendar, Weather, and Payment services
 */

const request = require('supertest');
const express = require('express');
const { PerformanceMonitor, LoadGenerator } = require('../performance/performance-utils');

describe('External Service Integration E2E Tests', () => {
  let app;
  let performanceMonitor;
  let loadGenerator;
  let mockDatabase;
  let mockLogger;
  let validToken;
  let externalServices;

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    mockLogger = createMockLogger();
    mockDatabase = createMockDatabase();
    
    // Create comprehensive Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock external services with realistic behaviors and failure scenarios
    externalServices = {
      gmail: {
        authenticate: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return {
            success: true,
            accessToken: 'mock-gmail-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 3600000
          };
        }),
        sendEmail: jest.fn().mockImplementation(async (emailData) => {
          await new Promise(resolve => setTimeout(resolve, 150));
          // Simulate occasional failures
          if (Math.random() < 0.05) {
            throw new Error('Gmail service temporarily unavailable');
          }
          return {
            messageId: `gmail-${Date.now()}`,
            status: 'sent',
            recipient: emailData.to
          };
        }),
        createCalendarEvent: jest.fn().mockImplementation(async (eventData) => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return {
            calendarEventId: `gcal-${Date.now()}`,
            htmlLink: `https://calendar.google.com/event?eid=${Date.now()}`,
            status: 'confirmed'
          };
        })
      },
      
      twilio: {
        sendSMS: jest.fn().mockImplementation(async (smsData) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          // Simulate network issues
          if (Math.random() < 0.03) {
            throw new Error('Twilio service timeout');
          }
          return {
            messageSid: `twilio-${Date.now()}`,
            status: 'sent',
            to: smsData.to,
            body: smsData.body
          };
        }),
        getDeliveryStatus: jest.fn().mockImplementation(async (messageSid) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            messageSid,
            status: 'delivered',
            dateDelivered: new Date()
          };
        })
      },
      
      weather: {
        getForecast: jest.fn().mockImplementation(async (location) => {
          await new Promise(resolve => setTimeout(resolve, 80));
          return {
            location: location,
            current: {
              temperature: 72,
              condition: 'sunny',
              humidity: 65,
              windSpeed: 8
            },
            forecast: Array(7).fill().map((_, i) => ({
              date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
              high: 75 + Math.floor(Math.random() * 10),
              low: 60 + Math.floor(Math.random() * 10),
              condition: ['sunny', 'cloudy', 'rain'][Math.floor(Math.random() * 3)],
              precipitation: Math.floor(Math.random() * 30)
            }))
          };
        })
      },
      
      payment: {
        validateCard: jest.fn().mockImplementation(async (cardData) => {
          await new Promise(resolve => setTimeout(resolve, 120));
          return {
            valid: true,
            last4: cardData.number.slice(-4),
            brand: 'visa',
            country: 'US'
          };
        }),
        processPayment: jest.fn().mockImplementation(async (paymentData) => {
          await new Promise(resolve => setTimeout(resolve, 250));
          // Our payment guard should prevent this from being called
          throw new Error('CRITICAL: Automated payment blocked by security system');
        })
      },
      
      maps: {
        geocode: jest.fn().mockImplementation(async (address) => {
          await new Promise(resolve => setTimeout(resolve, 90));
          return {
            lat: 37.7749 + (Math.random() - 0.5) * 0.1,
            lng: -122.4194 + (Math.random() - 0.5) * 0.1,
            formattedAddress: `${address}, San Francisco, CA`,
            placeId: `place-${Date.now()}`
          };
        }),
        calculateDistance: jest.fn().mockImplementation(async (origin, destination) => {
          await new Promise(resolve => setTimeout(resolve, 60));
          return {
            distance: `${Math.floor(Math.random() * 20) + 1} miles`,
            duration: `${Math.floor(Math.random() * 30) + 5} minutes`,
            route: 'optimal'
          };
        })
      }
    };
    
    // Mock app.locals with external services
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      externalServices: externalServices,
      scraperManager: {
        scrapeAll: jest.fn().mockResolvedValue([]),
        scrapeSource: jest.fn().mockResolvedValue([])
      },
      eventScorer: {
        scoreEvents: jest.fn().mockResolvedValue([])
      },
      registrationAutomator: {
        registerForEvent: jest.fn().mockResolvedValue({ success: true })
      }
    };
    
    // Add API routes
    const apiRouter = require('../../src/api')(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
    
    // Enhanced database mock for external service integration
    mockDatabase.query = jest.fn().mockImplementation((query, params) => {
      const delay = Math.random() * 20 + 5;
      
      return new Promise(resolve => {
        setTimeout(() => {
          // OAuth tokens storage
          if (query.includes('oauth_tokens')) {
            if (query.includes('INSERT') || query.includes('UPDATE')) {
              resolve({ rowCount: 1 });
            } else {
              resolve({
                rows: [{
                  service: 'gmail',
                  access_token: 'mock-access-token',
                  refresh_token: 'mock-refresh-token',
                  expires_at: new Date(Date.now() + 3600000)
                }]
              });
            }
          }
          // Notification logs
          else if (query.includes('notification_logs')) {
            resolve({
              rows: [{
                id: 'notif-001',
                type: 'email',
                status: 'sent',
                created_at: new Date()
              }]
            });
          }
          // Calendar events
          else if (query.includes('calendar_events')) {
            resolve({
              rows: [{
                event_id: 'event-001',
                calendar_event_id: 'gcal-123',
                status: 'created'
              }]
            });
          }
          // Default
          else {
            resolve({ rows: [] });
          }
        }, delay);
      });
    });
  });

  describe('Gmail Integration E2E', () => {
    test('Complete Gmail OAuth flow and email sending', async () => {
      const gmailIntegrationTest = async () => {
        const gmailSteps = [];
        
        // Step 1: OAuth authentication
        let stepStart = Date.now();
        const authResponse = await request(app)
          .post('/api/integrations/gmail/authenticate')
          .send({
            familyId: 'test-family-gmail',
            authCode: 'mock-auth-code',
            redirectUri: 'https://app.familyeventplanner.com/auth/callback'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        gmailSteps.push({
          step: 'gmail_oauth',
          duration: Date.now() - stepStart,
          success: authResponse.status === 200,
          tokenReceived: authResponse.body?.accessToken ? true : false
        });
        
        // Step 2: Send welcome email
        stepStart = Date.now();
        const welcomeEmailResponse = await request(app)
          .post('/api/integrations/gmail/send-email')
          .send({
            familyId: 'test-family-gmail',
            emailType: 'welcome',
            to: 'family@example.com',
            templateData: {
              familyName: 'Test Family',
              childrenNames: ['Emma', 'Oliver']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        gmailSteps.push({
          step: 'welcome_email',
          duration: Date.now() - stepStart,
          success: welcomeEmailResponse.status === 200,
          messageId: welcomeEmailResponse.body?.messageId
        });
        
        // Step 3: Send event digest email
        stepStart = Date.now();
        const digestEmailResponse = await request(app)
          .post('/api/integrations/gmail/send-email')
          .send({
            familyId: 'test-family-gmail',
            emailType: 'weekly_digest',
            to: 'family@example.com',
            templateData: {
              weeklyEvents: [
                { title: 'Science Workshop', date: '2024-03-15', location: 'Library' },
                { title: 'Art Class', date: '2024-03-16', location: 'Community Center' }
              ],
              upcomingCount: 5,
              newEventsCount: 12
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        gmailSteps.push({
          step: 'digest_email',
          duration: Date.now() - stepStart,
          success: digestEmailResponse.status === 200,
          digestSent: digestEmailResponse.body?.messageId ? true : false
        });
        
        // Step 4: Calendar event creation
        stepStart = Date.now();
        const calendarEventResponse = await request(app)
          .post('/api/integrations/gmail/create-calendar-event')
          .send({
            familyId: 'test-family-gmail',
            eventData: {
              title: 'Family Science Workshop',
              description: 'Interactive STEM learning for the whole family',
              startTime: '2024-03-15T10:00:00-08:00',
              endTime: '2024-03-15T12:00:00-08:00',
              location: 'San Francisco Public Library',
              attendees: ['parent1@example.com', 'parent2@example.com']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        gmailSteps.push({
          step: 'calendar_creation',
          duration: Date.now() - stepStart,
          success: calendarEventResponse.status === 200,
          calendarEventId: calendarEventResponse.body?.calendarEventId
        });
        
        return gmailSteps;
      };

      const { result: gmailSteps, metrics } = await performanceMonitor.measure(
        'gmail_integration_e2e',
        gmailIntegrationTest
      );
      
      // Validate Gmail integration
      expect(gmailSteps.length).toBe(4);
      expect(gmailSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(10000); // Gmail flow <10 seconds
      
      const authStep = gmailSteps.find(s => s.step === 'gmail_oauth');
      const emailStep = gmailSteps.find(s => s.step === 'welcome_email');
      const calendarStep = gmailSteps.find(s => s.step === 'calendar_creation');
      
      expect(authStep.tokenReceived).toBe(true);
      expect(emailStep.messageId).toBeTruthy();
      expect(calendarStep.calendarEventId).toBeTruthy();
      
      console.log(`📊 Gmail Integration E2E:
        - Total Duration: ${metrics.duration}ms
        - OAuth Success: ${authStep.tokenReceived}
        - Email Sent: ${emailStep.messageId ? 'Yes' : 'No'}
        - Calendar Event: ${calendarStep.calendarEventId ? 'Created' : 'Failed'}`);
      
      gmailSteps.forEach(step => {
        console.log(`  ✅ ${step.step}: ${step.duration}ms`);
      });
    });

    test('Gmail service failure recovery', async () => {
      const failureRecoveryTest = async () => {
        const recoverySteps = [];
        
        // Step 1: Simulate Gmail service failure
        externalServices.gmail.sendEmail.mockRejectedValueOnce(new Error('Gmail API quota exceeded'));
        
        let stepStart = Date.now();
        const failureResponse = await request(app)
          .post('/api/integrations/gmail/send-email')
          .send({
            familyId: 'test-family-recovery',
            emailType: 'event_reminder',
            to: 'family@example.com',
            fallbackEnabled: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'service_failure',
          duration: Date.now() - stepStart,
          success: failureResponse.status < 500, // Should handle gracefully
          usedFallback: failureResponse.body?.fallbackUsed || false
        });
        
        // Step 2: Retry with exponential backoff
        stepStart = Date.now();
        const retryResponse = await request(app)
          .post('/api/integrations/gmail/send-email')
          .send({
            familyId: 'test-family-recovery',
            emailType: 'event_reminder',
            to: 'family@example.com',
            retryAttempt: 1
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        recoverySteps.push({
          step: 'service_recovery',
          duration: Date.now() - stepStart,
          success: retryResponse.status === 200,
          retrySuccessful: retryResponse.body?.messageId ? true : false
        });
        
        return recoverySteps;
      };

      const { result: recoverySteps, metrics } = await performanceMonitor.measure(
        'gmail_failure_recovery',
        failureRecoveryTest
      );
      
      // Validate failure recovery
      expect(recoverySteps.length).toBe(2);
      expect(recoverySteps[0].success).toBe(true); // Graceful failure handling
      expect(recoverySteps[1].retrySuccessful).toBe(true); // Successful recovery
      
      console.log(`📊 Gmail Failure Recovery:
        - Recovery Duration: ${metrics.duration}ms
        - Graceful Failure: ${recoverySteps[0].success}
        - Retry Success: ${recoverySteps[1].retrySuccessful}`);
    });
  });

  describe('Twilio SMS Integration E2E', () => {
    test('Complete SMS notification workflow', async () => {
      const smsWorkflowTest = async () => {
        const smsSteps = [];
        
        // Step 1: Send event reminder SMS
        let stepStart = Date.now();
        const reminderSMSResponse = await request(app)
          .post('/api/integrations/twilio/send-sms')
          .send({
            familyId: 'test-family-sms',
            to: '+1234567890',
            messageType: 'event_reminder',
            templateData: {
              eventTitle: 'Science Workshop',
              eventTime: '10:00 AM',
              eventLocation: 'Library',
              timeUntilEvent: '1 hour'
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        smsSteps.push({
          step: 'reminder_sms',
          duration: Date.now() - stepStart,
          success: reminderSMSResponse.status === 200,
          messageSid: reminderSMSResponse.body?.messageSid
        });
        
        // Step 2: Check delivery status
        stepStart = Date.now();
        const deliveryStatusResponse = await request(app)
          .get(`/api/integrations/twilio/delivery-status/${reminderSMSResponse.body?.messageSid}`)
          .set('Authorization', `Bearer ${validToken}`);
        
        smsSteps.push({
          step: 'delivery_status',
          duration: Date.now() - stepStart,
          success: deliveryStatusResponse.status === 200,
          deliveryStatus: deliveryStatusResponse.body?.status
        });
        
        // Step 3: Send bulk family notifications
        stepStart = Date.now();
        const bulkSMSResponse = await request(app)
          .post('/api/integrations/twilio/send-bulk-sms')
          .send({
            familyId: 'test-family-sms',
            recipients: ['+1234567890', '+1234567891'],
            messageType: 'weekly_digest',
            templateData: {
              newEvents: 8,
              upcomingEvents: 3,
              familyName: 'Smith Family'
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        smsSteps.push({
          step: 'bulk_sms',
          duration: Date.now() - stepStart,
          success: bulkSMSResponse.status === 200,
          messagesSent: bulkSMSResponse.body?.messagesSent || 0
        });
        
        // Step 4: Emergency notification test
        stepStart = Date.now();
        const emergencyResponse = await request(app)
          .post('/api/integrations/twilio/send-sms')
          .send({
            familyId: 'test-family-sms',
            to: '+1234567890',
            messageType: 'emergency',
            priority: 'high',
            templateData: {
              message: 'Event cancelled due to weather. Check app for alternatives.'
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        smsSteps.push({
          step: 'emergency_sms',
          duration: Date.now() - stepStart,
          success: emergencyResponse.status === 200,
          emergencySent: emergencyResponse.body?.messageSid ? true : false
        });
        
        return smsSteps;
      };

      const { result: smsSteps, metrics } = await performanceMonitor.measure(
        'twilio_sms_workflow',
        smsWorkflowTest
      );
      
      // Validate SMS workflow
      expect(smsSteps.length).toBe(4);
      expect(smsSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(8000); // SMS workflow <8 seconds
      
      const reminderStep = smsSteps.find(s => s.step === 'reminder_sms');
      const bulkStep = smsSteps.find(s => s.step === 'bulk_sms');
      const emergencyStep = smsSteps.find(s => s.step === 'emergency_sms');
      
      expect(reminderStep.messageSid).toBeTruthy();
      expect(bulkStep.messagesSent).toBeGreaterThan(0);
      expect(emergencyStep.emergencySent).toBe(true);
      
      console.log(`📊 Twilio SMS Workflow:
        - Total Duration: ${metrics.duration}ms
        - Reminder Sent: ${reminderStep.messageSid ? 'Yes' : 'No'}
        - Bulk Messages: ${bulkStep.messagesSent}
        - Emergency Alert: ${emergencyStep.emergencySent}`);
    });
  });

  describe('Weather Service Integration E2E', () => {
    test('Weather-based event recommendations', async () => {
      const weatherIntegrationTest = async () => {
        const weatherSteps = [];
        
        // Step 1: Get current weather for event planning
        let stepStart = Date.now();
        const currentWeatherResponse = await request(app)
          .get('/api/integrations/weather/current')
          .query({
            familyId: 'test-family-weather',
            location: 'San Francisco, CA'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weatherSteps.push({
          step: 'current_weather',
          duration: Date.now() - stepStart,
          success: currentWeatherResponse.status === 200,
          temperature: currentWeatherResponse.body?.current?.temperature
        });
        
        // Step 2: Get 7-day forecast for event filtering
        stepStart = Date.now();
        const forecastResponse = await request(app)
          .get('/api/integrations/weather/forecast')
          .query({
            familyId: 'test-family-weather',
            location: 'San Francisco, CA',
            days: 7
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weatherSteps.push({
          step: 'weather_forecast',
          duration: Date.now() - stepStart,
          success: forecastResponse.status === 200,
          forecastDays: forecastResponse.body?.forecast?.length || 0
        });
        
        // Step 3: Weather-based event filtering
        stepStart = Date.now();
        const weatherFilterResponse = await request(app)
          .post('/api/events/weather-filter')
          .send({
            familyId: 'test-family-weather',
            events: [
              { id: 'outdoor-1', title: 'Park Picnic', type: 'outdoor' },
              { id: 'indoor-1', title: 'Museum Visit', type: 'indoor' },
              { id: 'outdoor-2', title: 'Beach Day', type: 'outdoor' }
            ],
            weatherCriteria: {
              minTemperature: 65,
              maxPrecipitation: 20,
              avoidConditions: ['rain', 'storm']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weatherSteps.push({
          step: 'weather_filtering',
          duration: Date.now() - stepStart,
          success: weatherFilterResponse.status === 200,
          filteredEvents: weatherFilterResponse.body?.recommendedEvents?.length || 0
        });
        
        // Step 4: Weather alert setup
        stepStart = Date.now();
        const weatherAlertResponse = await request(app)
          .post('/api/integrations/weather/alerts')
          .send({
            familyId: 'test-family-weather',
            alertTypes: ['severe_weather', 'precipitation', 'temperature_extreme'],
            thresholds: {
              temperature: { min: 50, max: 90 },
              precipitation: { max: 30 },
              windSpeed: { max: 25 }
            },
            notificationMethods: ['email', 'sms', 'push']
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        weatherSteps.push({
          step: 'weather_alerts',
          duration: Date.now() - stepStart,
          success: weatherAlertResponse.status === 200,
          alertsConfigured: weatherAlertResponse.body?.alertsConfigured || 0
        });
        
        return weatherSteps;
      };

      const { result: weatherSteps, metrics } = await performanceMonitor.measure(
        'weather_integration_e2e',
        weatherIntegrationTest
      );
      
      // Validate weather integration
      expect(weatherSteps.length).toBe(4);
      expect(weatherSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(6000); // Weather integration <6 seconds
      
      const currentStep = weatherSteps.find(s => s.step === 'current_weather');
      const forecastStep = weatherSteps.find(s => s.step === 'weather_forecast');
      const filterStep = weatherSteps.find(s => s.step === 'weather_filtering');
      
      expect(currentStep.temperature).toBeTruthy();
      expect(forecastStep.forecastDays).toBe(7);
      expect(filterStep.filteredEvents).toBeGreaterThanOrEqual(0);
      
      console.log(`📊 Weather Service Integration:
        - Total Duration: ${metrics.duration}ms
        - Current Temp: ${currentStep.temperature}°F
        - Forecast Days: ${forecastStep.forecastDays}
        - Filtered Events: ${filterStep.filteredEvents}`);
    });
  });

  describe('Payment Security Integration E2E', () => {
    test('Payment guard and security validation', async () => {
      const paymentSecurityTest = async () => {
        const securitySteps = [];
        
        // Step 1: Payment validation (should succeed)
        let stepStart = Date.now();
        const cardValidationResponse = await request(app)
          .post('/api/integrations/payment/validate-card')
          .send({
            familyId: 'test-family-payment',
            cardData: {
              number: '4111111111111111',
              expiry: '12/25',
              cvv: '123'
            },
            validateOnly: true // Important: only validation, no processing
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        securitySteps.push({
          step: 'card_validation',
          duration: Date.now() - stepStart,
          success: cardValidationResponse.status === 200,
          cardValid: cardValidationResponse.body?.valid || false
        });
        
        // Step 2: Attempt automated payment (should be BLOCKED)
        stepStart = Date.now();
        const blockedPaymentResponse = await request(app)
          .post('/api/integrations/payment/process-payment')
          .send({
            familyId: 'test-family-payment',
            eventId: 'paid-event-001',
            amount: 25.00,
            automated: true, // This should trigger the payment guard
            paymentMethod: 'card'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        securitySteps.push({
          step: 'payment_guard',
          duration: Date.now() - stepStart,
          success: blockedPaymentResponse.status >= 400, // Should be blocked
          paymentBlocked: blockedPaymentResponse.status >= 400,
          blockReason: blockedPaymentResponse.body?.error
        });
        
        // Step 3: Security audit log verification
        stepStart = Date.now();
        const auditLogResponse = await request(app)
          .get('/api/security/audit-log')
          .query({
            familyId: 'test-family-payment',
            eventType: 'payment_attempt',
            last24Hours: true
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        securitySteps.push({
          step: 'audit_verification',
          duration: Date.now() - stepStart,
          success: auditLogResponse.status === 200,
          auditEntriesFound: auditLogResponse.body?.auditEntries?.length || 0
        });
        
        // Step 4: Payment fraud detection
        stepStart = Date.now();
        const fraudDetectionResponse = await request(app)
          .post('/api/integrations/payment/fraud-check')
          .send({
            familyId: 'test-family-payment',
            paymentData: {
              amount: 25.00,
              cardLast4: '1111',
              ipAddress: '192.168.1.100',
              userAgent: 'FamilyEventPlanner/1.0'
            },
            riskFactors: ['automation_attempt', 'large_amount', 'new_card']
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        securitySteps.push({
          step: 'fraud_detection',
          duration: Date.now() - stepStart,
          success: fraudDetectionResponse.status === 200,
          riskLevel: fraudDetectionResponse.body?.riskLevel,
          recommendedAction: fraudDetectionResponse.body?.recommendedAction
        });
        
        return securitySteps;
      };

      const { result: securitySteps, metrics } = await performanceMonitor.measure(
        'payment_security_e2e',
        paymentSecurityTest
      );
      
      // Validate payment security
      expect(securitySteps.length).toBe(4);
      expect(securitySteps.every(step => step.success)).toBe(true);
      
      const validationStep = securitySteps.find(s => s.step === 'card_validation');
      const guardStep = securitySteps.find(s => s.step === 'payment_guard');
      const auditStep = securitySteps.find(s => s.step === 'audit_verification');
      const fraudStep = securitySteps.find(s => s.step === 'fraud_detection');
      
      expect(validationStep.cardValid).toBe(true);
      expect(guardStep.paymentBlocked).toBe(true); // CRITICAL: Payment must be blocked
      expect(auditStep.auditEntriesFound).toBeGreaterThan(0);
      expect(fraudStep.riskLevel).toBeTruthy();
      
      console.log(`📊 Payment Security Integration:
        - Total Duration: ${metrics.duration}ms
        - Card Validation: ${validationStep.cardValid ? 'Valid' : 'Invalid'}
        - Payment Blocked: ${guardStep.paymentBlocked ? '✅ SECURED' : '❌ CRITICAL FAILURE'}
        - Audit Entries: ${auditStep.auditEntriesFound}
        - Risk Level: ${fraudStep.riskLevel}`);
      
      // CRITICAL ASSERTION: Payment guard must work
      expect(guardStep.paymentBlocked).toBe(true);
    });
  });

  describe('Maps and Location Integration E2E', () => {
    test('Complete location services workflow', async () => {
      const locationServicesTest = async () => {
        const locationSteps = [];
        
        // Step 1: Geocode family address
        let stepStart = Date.now();
        const geocodeResponse = await request(app)
          .post('/api/integrations/maps/geocode')
          .send({
            familyId: 'test-family-location',
            address: '123 Family Street, San Francisco, CA 94102'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        locationSteps.push({
          step: 'address_geocoding',
          duration: Date.now() - stepStart,
          success: geocodeResponse.status === 200,
          coordinates: geocodeResponse.body?.coordinates
        });
        
        // Step 2: Calculate distances to events
        stepStart = Date.now();
        const distanceResponse = await request(app)
          .post('/api/integrations/maps/calculate-distances')
          .send({
            familyId: 'test-family-location',
            origin: geocodeResponse.body?.coordinates,
            destinations: [
              { name: 'SF Library', address: 'Library St, San Francisco, CA' },
              { name: 'Golden Gate Park', address: 'Golden Gate Park, San Francisco, CA' },
              { name: 'Exploratorium', address: 'Pier 15, San Francisco, CA' }
            ]
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        locationSteps.push({
          step: 'distance_calculation',
          duration: Date.now() - stepStart,
          success: distanceResponse.status === 200,
          distancesCalculated: distanceResponse.body?.distances?.length || 0
        });
        
        // Step 3: Location-based event filtering
        stepStart = Date.now();
        const locationFilterResponse = await request(app)
          .post('/api/events/location-filter')
          .send({
            familyId: 'test-family-location',
            maxDistance: '10 miles',
            preferredLocations: ['libraries', 'parks', 'museums'],
            avoidAreas: ['downtown', 'high-traffic'],
            accessibilityRequirements: ['parking', 'stroller-friendly']
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        locationSteps.push({
          step: 'location_filtering',
          duration: Date.now() - stepStart,
          success: locationFilterResponse.status === 200,
          filteredEvents: locationFilterResponse.body?.nearbyEvents?.length || 0
        });
        
        return locationSteps;
      };

      const { result: locationSteps, metrics } = await performanceMonitor.measure(
        'location_services_e2e',
        locationServicesTest
      );
      
      // Validate location services
      expect(locationSteps.length).toBe(3);
      expect(locationSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(5000); // Location services <5 seconds
      
      const geocodeStep = locationSteps.find(s => s.step === 'address_geocoding');
      const distanceStep = locationSteps.find(s => s.step === 'distance_calculation');
      const filterStep = locationSteps.find(s => s.step === 'location_filtering');
      
      expect(geocodeStep.coordinates).toBeTruthy();
      expect(distanceStep.distancesCalculated).toBeGreaterThan(0);
      expect(filterStep.filteredEvents).toBeGreaterThanOrEqual(0);
      
      console.log(`📊 Location Services Integration:
        - Total Duration: ${metrics.duration}ms
        - Geocoding: ${geocodeStep.coordinates ? 'Success' : 'Failed'}
        - Distances Calculated: ${distanceStep.distancesCalculated}
        - Events Filtered: ${filterStep.filteredEvents}`);
    });
  });

  describe('Cross-Service Integration Scenarios', () => {
    test('Multi-service event notification workflow', async () => {
      const multiServiceTest = async () => {
        const multiSteps = [];
        
        // Step 1: Weather check + Email + SMS + Calendar (coordinated)
        let stepStart = Date.now();
        const coordinatedResponse = await request(app)
          .post('/api/integrations/coordinated-notification')
          .send({
            familyId: 'test-family-multi',
            eventData: {
              title: 'Outdoor Science Festival',
              date: '2024-03-16',
              location: 'Golden Gate Park',
              type: 'outdoor'
            },
            notificationTypes: ['email', 'sms', 'calendar'],
            includeWeatherContext: true,
            recipients: {
              email: ['parent1@example.com', 'parent2@example.com'],
              sms: ['+1234567890', '+1234567891']
            }
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        multiSteps.push({
          step: 'coordinated_notification',
          duration: Date.now() - stepStart,
          success: coordinatedResponse.status === 200,
          servicesUsed: coordinatedResponse.body?.servicesUsed?.length || 0,
          notificationsSent: coordinatedResponse.body?.notificationsSent || 0
        });
        
        // Step 2: Service failure cascade handling
        stepStart = Date.now();
        
        // Simulate Gmail failure
        externalServices.gmail.sendEmail.mockRejectedValueOnce(new Error('Gmail service down'));
        
        const cascadeResponse = await request(app)
          .post('/api/integrations/cascade-notification')
          .send({
            familyId: 'test-family-multi',
            message: 'Event reminder: Science Workshop in 1 hour',
            fallbackChain: ['email', 'sms', 'push', 'in-app'],
            priority: 'high'
          })
          .set('Authorization', `Bearer ${validToken}`);
        
        multiSteps.push({
          step: 'cascade_handling',
          duration: Date.now() - stepStart,
          success: cascadeResponse.status === 200,
          fallbacksUsed: cascadeResponse.body?.fallbacksUsed || 0,
          finalDeliveryMethod: cascadeResponse.body?.finalDeliveryMethod
        });
        
        return multiSteps;
      };

      const { result: multiSteps, metrics } = await performanceMonitor.measure(
        'multi_service_integration',
        multiServiceTest
      );
      
      // Validate multi-service integration
      expect(multiSteps.length).toBe(2);
      expect(multiSteps.every(step => step.success)).toBe(true);
      expect(metrics.duration).toBeLessThan(8000); // Multi-service <8 seconds
      
      const coordinatedStep = multiSteps.find(s => s.step === 'coordinated_notification');
      const cascadeStep = multiSteps.find(s => s.step === 'cascade_handling');
      
      expect(coordinatedStep.servicesUsed).toBeGreaterThan(0);
      expect(cascadeStep.fallbacksUsed).toBeGreaterThan(0);
      expect(cascadeStep.finalDeliveryMethod).toBeTruthy();
      
      console.log(`📊 Multi-Service Integration:
        - Total Duration: ${metrics.duration}ms
        - Services Coordinated: ${coordinatedStep.servicesUsed}
        - Notifications Sent: ${coordinatedStep.notificationsSent}
        - Fallbacks Used: ${cascadeStep.fallbacksUsed}
        - Final Delivery: ${cascadeStep.finalDeliveryMethod}`);
    });

    test('High-load external service stress test', async () => {
      const externalServiceStressTest = async (requestId) => {
        // Simulate concurrent family using multiple external services
        const serviceRequests = [
          // Gmail request
          () => externalServices.gmail.sendEmail({
            to: 'test@example.com',
            subject: `Test ${requestId}`,
            body: 'Test email'
          }),
          
          // Twilio request
          () => externalServices.twilio.sendSMS({
            to: '+1234567890',
            body: `Test SMS ${requestId}`
          }),
          
          // Weather request
          () => externalServices.weather.getForecast('San Francisco, CA'),
          
          // Maps request
          () => externalServices.maps.geocode(`Address ${requestId}`)
        ];
        
        const results = [];
        for (const request of serviceRequests) {
          const startTime = Date.now();
          try {
            await request();
            results.push({
              duration: Date.now() - startTime,
              success: true
            });
          } catch (error) {
            results.push({
              duration: Date.now() - startTime,
              success: false,
              error: error.message
            });
          }
        }
        
        return results;
      };

      const result = await loadGenerator.generateLoad(externalServiceStressTest, 8, 32);
      
      expect(result.successRate).toBeGreaterThan(85); // >85% success under load
      expect(result.averageTime).toBeLessThan(3000); // <3s average per service batch
      
      console.log(`📊 External Service Stress Test:
        - Concurrent Requests: 8
        - Total Service Calls: ${result.totalOperations * 4}
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Batch Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });
});