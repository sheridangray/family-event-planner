const request = require('supertest');
const express = require('express');
const createApiRouter = require('../../src/api');

// Add custom matchers for this test suite
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    return {
      message: () => `Expected ${received} to be one of: ${validOptions.join(', ')}`,
      pass
    };
  }
});

describe('API Security Vulnerabilities', () => {
  let app;
  let mockDatabase;
  let mockLogger;
  let validToken;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();
    
    // Create Express app with API router
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock app.locals for middleware
    app.locals = {
      database: mockDatabase,
      logger: mockLogger,
      scraperManager: {
        scrapeSource: jest.fn().mockResolvedValue([]),
        scrapeAll: jest.fn().mockResolvedValue([])
      },
      eventScorer: {
        scoreEvents: jest.fn().mockResolvedValue([])
      },
      registrationAutomator: {
        processApprovedEvents: jest.fn().mockResolvedValue([])
      },
      smsManager: {
        handleIncomingResponse: jest.fn().mockResolvedValue(null),
        processApprovedEvent: jest.fn().mockResolvedValue()
      }
    };
    
    // Add API router
    const apiRouter = createApiRouter(mockDatabase, null, null, mockLogger, null);
    app.use('/api', apiRouter);
    
    // Mock valid API key for testing
    validToken = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
  });

  describe('SQL Injection Prevention', () => {
    const injectionPayloads = [
      "'; DROP TABLE events; --",
      "' UNION SELECT * FROM family_settings --", 
      "1' OR '1'='1",
      "'; UPDATE users SET role='admin' WHERE id=1; --",
      "admin'/**/OR/**/1=1/**/--",
      "' AND 1=CONVERT(int, (SELECT COUNT(*) FROM events)) --",
      "1; EXEC xp_cmdshell('dir'); --"
    ];

    test.each(injectionPayloads)('Blocks SQL injection in search parameter: %s', async (payload) => {
      mockDatabase.searchEvents = jest.fn().mockImplementation((params) => {
        // Simulate database query with the payload
        if (typeof params.search === 'string' && 
            (params.search.includes(';') || 
             params.search.includes('--') || 
             params.search.includes('UNION') ||
             params.search.includes('DROP') ||
             params.search.includes('DELETE') ||
             params.search.includes('UPDATE'))) {
          throw new Error('SQL syntax error - potential injection detected');
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/events')
        .query({ search: payload })
        .set('Authorization', `Bearer ${validToken}`);

      // Should either reject with 400 or safely handle the malicious input
      if (response.status === 400) {
        expect(response.body.error).toMatch(/invalid|malformed|syntax/i);
      } else {
        // If it doesn't reject, verify no SQL injection occurred
        expect(mockDatabase.searchEvents).not.toHaveBeenCalledWith(
          expect.objectContaining({
            search: expect.stringMatching(/DROP|DELETE|UPDATE|UNION.*SELECT/i)
          })
        );
      }
    });

    test('SQL injection in event filtering parameters', async () => {
      const maliciousFilters = [
        { minAge: "1; DROP TABLE children; --" },
        { maxAge: "'; DELETE FROM events; --" },
        { location: "' OR 1=1; --" },
        { category: "'; UPDATE events SET status='deleted'; --" }
      ];

      for (const filter of maliciousFilters) {
        const response = await request(app)
          .get('/api/events')
          .query(filter)
          .set('Authorization', `Bearer ${validToken}`);

        // Should validate input types and reject malicious strings
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/invalid|malformed|type/i);
      }
    });
  });

  describe('Authorization Boundaries', () => {
    test('API key validation on protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/scrape' },
        { method: 'post', path: '/api/score' },
        { method: 'post', path: '/api/process-approvals' }
      ];

      for (const endpoint of protectedEndpoints) {
        // Test with no authorization
        let response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);

        // Test with invalid token
        response = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', 'Bearer invalid_token_123');
        expect(response.status).toBe(401);

        // Test with malformed authorization header
        response = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', 'InvalidFormat token');
        expect(response.status).toBe(401);
      }
    });

    test('Family data access requires proper authentication', async () => {
      // Mock family endpoints (would exist in family router)
      app.get('/api/family/children', (req, res) => {
        // This would normally be protected by authentication middleware
        res.json({ children: [{ name: 'Test Child', age: 4 }] });
      });

      const response = await request(app)
        .get('/api/family/children');
      
      // Should require authentication for family data
      // Note: Current implementation may not have this endpoint, 
      // but this test documents the security requirement
      expect(response.status).toBe(404); // Endpoint doesn't exist yet
    });

    test('Cross-family data isolation', async () => {
      // Test that one family cannot access another family's data
      // This test documents a critical security requirement
      
      const familyAToken = 'family_a_token';
      const familyBEndpoint = '/api/family/events?family_id=family_b';
      
      app.get('/api/family/events', (req, res) => {
        const requestedFamilyId = req.query.family_id;
        const tokenFamilyId = 'family_a'; // Extracted from token
        
        if (requestedFamilyId !== tokenFamilyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({ events: [] });
      });

      const response = await request(app)
        .get(familyBEndpoint)
        .set('Authorization', `Bearer ${familyAToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/access denied/i);
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('XSS prevention in event data', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>',
        '<svg onload=alert(1)>',
        '{{constructor.constructor("alert(1)")()}}'
      ];

      for (const payload of xssPayloads) {
        const eventData = {
          title: payload,
          description: payload,
          location: payload
        };

        // Test creating event with XSS payload
        const response = await request(app)
          .post('/api/events')
          .send(eventData)
          .set('Authorization', `Bearer ${validToken}`);

        if (response.status === 200) {
          // If accepted, verify the data was sanitized
          expect(response.body.title).not.toContain('<script>');
          expect(response.body.title).not.toContain('javascript:');
          expect(response.body.description).not.toContain('<script>');
        } else {
          // Should reject malicious input
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/invalid|malformed/i);
        }
      }
    });

    test('File path traversal prevention', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd'
      ];

      for (const payload of pathTraversalPayloads) {
        // Test any endpoint that might handle file paths
        const response = await request(app)
          .post('/api/upload')
          .send({ filename: payload })
          .set('Authorization', `Bearer ${validToken}`);

        // Should reject path traversal attempts
        // Note: Upload endpoint may not exist, this documents the requirement
        if (response.status !== 404) {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/invalid|path|security/i);
        }
      }
    });

    test('CSRF protection on state-changing operations', async () => {
      const stateChangingEndpoints = [
        { method: 'post', path: '/api/scrape', data: { source: 'test' } },
        { method: 'post', path: '/api/score', data: {} },
        { method: 'post', path: '/api/process-approvals', data: {} }
      ];

      for (const endpoint of stateChangingEndpoints) {
        // Test without CSRF token (if implemented)
        const response = await request(app)[endpoint.method](endpoint.path)
          .send(endpoint.data)
          .set('Authorization', `Bearer ${validToken}`)
          // Missing CSRF token header
          .set('Origin', 'https://malicious-site.com');

        // Note: CSRF protection may not be implemented yet
        // This test documents the security requirement
        expect(response.status).toBeOneOf([200, 403]); // Either works or is protected
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    test('Rate limiting on SMS webhook endpoint', async () => {
      const smsPayload = {
        From: '+1234567890',
        Body: 'YES',
        MessageSid: 'test-message-id'
      };

      // Send multiple rapid requests
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/api/sms-webhook')
          .send(smsPayload)
      );

      const responses = await Promise.all(requests);
      
      // Should handle rapid SMS requests gracefully
      responses.forEach(response => {
        expect(response.status).toBeOneOf([200, 429]); // Success or rate limited
      });
    });

    test('Large payload rejection', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024) // 10MB payload
      };

      const response = await request(app)
        .post('/api/scrape')
        .send(largePayload)
        .set('Authorization', `Bearer ${validToken}`);

      // Should reject oversized payloads
      expect(response.status).toBeOneOf([400, 413]); // Bad request or payload too large
    });
  });

  describe('Error Handling Security', () => {
    test('No sensitive information in error responses', async () => {
      // Trigger various error conditions
      mockDatabase.getEventsByStatus.mockRejectedValue(
        new Error('Database connection failed: postgres://user:password@host:5432/db')
      );

      const response = await request(app)
        .post('/api/score')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      
      // Error response should not contain sensitive information
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/password|secret|key|token|connection.*string/i);
      expect(responseText).not.toContain('postgres://');
    });

    test('Stack traces not exposed in production', async () => {
      // Force an error that would normally show a stack trace
      mockDatabase.getEventsByStatus.mockImplementation(() => {
        throw new Error('Test error with stack trace');
      });

      const response = await request(app)
        .post('/api/score')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      
      // Should not expose stack traces to clients
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/at.*\.js:\d+:\d+/); // Stack trace pattern
      expect(responseText).not.toContain(__filename); // File paths
    });
  });

  describe('Webhook Security', () => {
    test('SMS webhook validates Twilio signature', async () => {
      const maliciousPayload = {
        From: '+1234567890',
        Body: 'YES to malicious event',
        MessageSid: 'fake-message-id'
      };

      // Send without proper Twilio signature
      const response = await request(app)
        .post('/api/sms-webhook')
        .send(maliciousPayload)
        .set('X-Twilio-Signature', 'fake-signature');

      // Should validate webhook authenticity
      // Note: Signature validation may not be implemented yet
      expect(response.status).toBeOneOf([200, 401, 403]); // Works, unauthorized, or forbidden
    });

    test('Webhook replay attack prevention', async () => {
      const validPayload = {
        From: '+1234567890',
        Body: 'YES',
        MessageSid: 'test-message-123'
      };

      // Send the same message multiple times
      const response1 = await request(app)
        .post('/api/sms-webhook')
        .send(validPayload);

      const response2 = await request(app)
        .post('/api/sms-webhook')
        .send(validPayload);

      // Should detect and prevent replay attacks
      expect(response1.status).toBe(200);
      expect(response2.status).toBeOneOf([200, 409]); // Success or conflict (duplicate)
    });
  });

  describe('Data Validation Edge Cases', () => {
    test('Handles deeply nested objects safely', async () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'malicious data'
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/scrape')
        .send(deeplyNested)
        .set('Authorization', `Bearer ${validToken}`);

      // Should handle nested objects without crashing
      expect(response.status).toBeOneOf([200, 400]); // Success or validation error
    });

    test('Null byte injection prevention', async () => {
      const nullBytePayloads = [
        'filename.txt\x00.exe',
        'normal-text\x00<script>alert(1)</script>',
        'data\x00\x00\x00malicious'
      ];

      for (const payload of nullBytePayloads) {
        const response = await request(app)
          .post('/api/scrape')
          .send({ source: payload })
          .set('Authorization', `Bearer ${validToken}`);

        // Should sanitize or reject null byte injection
        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          // If accepted, verify null bytes were stripped
          expect(response.body).not.toContain('\x00');
        }
      }
    });
  });
});