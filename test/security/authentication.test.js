const { authenticateAPI } = require('../../src/middleware/auth');
const request = require('supertest');
const express = require('express');

describe('Authentication Boundary Tests', () => {
  let app;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Setup Express app for integration testing
    app = express();
    app.use(express.json());
    
    // Test route with authentication
    app.get('/protected', authenticateAPI, (req, res) => {
      res.json({ success: true, message: 'Authenticated access granted' });
    });
    
    app.post('/protected-post', authenticateAPI, (req, res) => {
      res.json({ success: true, data: req.body });
    });
    
    // Mock objects for unit testing
    mockReq = {
      headers: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    // Set up test API key
    process.env.API_KEY = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
  });

  describe('API Key Authentication', () => {
    describe('Valid Authentication', () => {
      test('Accepts valid API key in Authorization header', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      test('Accepts valid API key in x-api-key header', async () => {
        const response = await request(app)
          .get('/protected')
          .set('x-api-key', 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      test('Handles escaped dollar signs in API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_\\$7mK9pL2nQ8xV3wR6zA');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      test('Works with POST requests', async () => {
        const response = await request(app)
          .post('/protected-post')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA')
          .send({ data: 'test' });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.data).toBe('test');
      });
    });

    describe('Invalid Authentication', () => {
      test('Rejects request with no API key', async () => {
        const response = await request(app)
          .get('/protected');
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      });

      test('Rejects request with wrong API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer wrong_api_key');
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid API key');
      });

      test('Rejects request with empty API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer ');
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid API key');
      });

      test('Rejects request with malformed Authorization header', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'InvalidFormat token');
        
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('API key required');
      });
    });

    describe('Security Attack Vectors', () => {
      test('Prevents API key enumeration through timing attacks', async () => {
        const startTime = Date.now();
        
        const response1 = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer short');
        
        const midTime = Date.now();
        
        const response2 = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer very_long_api_key_that_might_take_longer_to_compare');
        
        const endTime = Date.now();
        
        // Both should fail
        expect(response1.status).toBe(403);
        expect(response2.status).toBe(403);
        
        // Timing should not reveal key length (within reasonable bounds)
        const time1 = midTime - startTime;
        const time2 = endTime - midTime;
        const timeDifference = Math.abs(time1 - time2);
        
        // Should not have significant timing difference (within 100ms tolerance)
        expect(timeDifference).toBeLessThan(100);
      });

      test('Prevents injection attacks in API key header', async () => {
        const injectionPayloads = [
          'Bearer ; DROP TABLE users; --',
          'Bearer <script>alert("xss")</script>',
          'Bearer ../../../etc/passwd',
          'Bearer ${process.env.API_KEY}',
          'Bearer `whoami`'
        ];

        for (const payload of injectionPayloads) {
          const response = await request(app)
            .get('/protected')
            .set('Authorization', payload);
          
          expect(response.status).toBeOneOf([401, 403]);
          expect(response.body.success).toBe(false);
        }
      });

      test('Handles null byte injection in API key', async () => {
        const nullByteKey = 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA\x00malicious';
        
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${nullByteKey}`);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      test('Prevents header pollution attacks', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer valid_key')
          .set('x-api-key', 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA');
        
        // Should prioritize Authorization header or handle consistently
        expect(response.status).toBe(403); // 'valid_key' is wrong
      });

      test('Handles extremely long API key attempts', async () => {
        const longKey = 'a'.repeat(10000);
        
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${longKey}`);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      test('Handles missing process.env.API_KEY gracefully', () => {
        const originalApiKey = process.env.API_KEY;
        delete process.env.API_KEY;
        
        mockReq.headers.authorization = 'Bearer test_key';
        
        expect(() => {
          authenticateAPI(mockReq, mockRes, mockNext);
        }).toThrow(); // Should throw error when API_KEY not configured
        
        process.env.API_KEY = originalApiKey; // Restore
      });

      test('Handles undefined headers object', () => {
        mockReq.headers = undefined;
        
        authenticateAPI(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'API key required'
        });
      });

      test('Handles case-sensitive header names', async () => {
        // HTTP headers are case-insensitive, but test various cases
        const headerVariations = [
          'authorization',
          'Authorization',
          'AUTHORIZATION',
          'x-api-key',
          'X-API-KEY',
          'X-Api-Key'
        ];

        for (const header of headerVariations) {
          const response = await request(app)
            .get('/protected')
            .set(header, header.includes('auth') ? 
              'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA' : 
              'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA'
            );
          
          expect(response.status).toBe(200);
        }
      });

      test('Handles unicode characters in API key', async () => {
        const unicodeKey = 'Bearer fep_secure_api_key_2024_🔐_special';
        
        const response = await request(app)
          .get('/protected')
          .set('Authorization', unicodeKey);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Middleware Behavior', () => {
      test('Calls next() on successful authentication', () => {
        mockReq.headers.authorization = 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';
        
        authenticateAPI(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });

      test('Does not call next() on authentication failure', () => {
        mockReq.headers.authorization = 'Bearer wrong_key';
        
        authenticateAPI(mockReq, mockRes, mockNext);
        
        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      test('Middleware can be used multiple times in route chain', async () => {
        app.get('/double-protected', authenticateAPI, authenticateAPI, (req, res) => {
          res.json({ success: true, message: 'Double authenticated' });
        });
        
        const response = await request(app)
          .get('/double-protected')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Session Security', () => {
    test('API key authentication is stateless', async () => {
      // Multiple requests should each require authentication
      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('No session data is stored or leaked', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA');
      
      expect(response.status).toBe(200);
      
      // Verify no session cookies or tokens are set
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body).not.toHaveProperty('token');
      expect(response.body).not.toHaveProperty('sessionId');
    });
  });

  describe('Performance and Reliability', () => {
    test('Authentication performs efficiently under load', async () => {
      const startTime = Date.now();
      
      // Simulate 100 concurrent authentication requests
      const requests = Array(100).fill().map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', 'Bearer fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA')
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete in reasonable time (less than 5 seconds for 100 requests)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('Graceful handling of malformed headers', async () => {
      const malformedHeaders = [
        { 'authorization': null },
        { 'authorization': undefined },
        { 'authorization': '' },
        { 'authorization': {} },
        { 'authorization': ['Bearer', 'key'] },
        { 'x-api-key': Symbol('key') }
      ];

      for (const headers of malformedHeaders) {
        try {
          const response = await request(app)
            .get('/protected')
            .set(headers);
          
          // Should not crash and should return proper error
          expect(response.status).toBeOneOf([400, 401, 403]);
          expect(response.body.success).toBe(false);
        } catch (error) {
          // If it throws, should be a controlled error, not a crash
          expect(error.message).not.toMatch(/cannot read property/i);
        }
      }
    });
  });
});

// Custom matcher for multiple valid values
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    return {
      message: () => `Expected ${received} to be one of: ${validOptions.join(', ')}`,
      pass
    };
  }
});