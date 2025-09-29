// Security-focused test setup
const crypto = require('crypto');

// Security test utilities
global.generateMaliciousPayload = (type) => {
  const payloads = {
    sql_injection: [
      "'; DROP TABLE events; --",
      "' UNION SELECT * FROM family_settings --",
      "1' OR '1'='1",
      "admin'/**/OR/**/1=1/**/--"
    ],
    xss: [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>'
    ],
    path_traversal: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd'
    ],
    null_byte: [
      'filename.txt\x00.exe',
      'normal-text\x00<script>alert(1)</script>'
    ]
  };
  
  return payloads[type] || [];
};

global.createSecureTestEvent = () => ({
  id: `test-${crypto.randomUUID()}`,
  title: 'Secure Test Event',
  cost: 0, // Always free for testing
  date: new Date(),
  location: 'Test Location',
  registration_url: 'https://example.com/register'
});

global.createPaidTestEvent = (cost = 25.00) => ({
  id: `paid-test-${crypto.randomUUID()}`,
  title: 'Paid Test Event',
  cost: cost,
  date: new Date(),
  location: 'Test Location',
  registration_url: 'https://example.com/paid-register'
});

global.expectSecurityViolation = (testFunction) => {
  return expect(testFunction()).rejects.toThrow(/SAFETY|SECURITY|VIOLATION|INVALID/i);
};

// Enhanced mock for security testing
global.createSecurityMockDatabase = () => {
  const mockDb = createMockDatabase();
  
  // Add security-specific behaviors
  mockDb.query = jest.fn().mockImplementation((sql, params = []) => {
    // Detect potential SQL injection
    if (typeof sql === 'string' && 
        (sql.includes(';') || sql.includes('--') || 
         sql.toUpperCase().includes('DROP') || 
         sql.toUpperCase().includes('UNION SELECT'))) {
      throw new Error('SQL syntax error - potential injection detected');
    }
    return Promise.resolve([]);
  });
  
  mockDb.saveEvent = jest.fn().mockImplementation((event) => {
    // Validate event data for security issues
    if (event.title && typeof event.title === 'string') {
      if (event.title.includes('<script>') || event.title.includes('javascript:')) {
        throw new Error('Invalid input - potential XSS detected');
      }
    }
    
    if (event.cost && (typeof event.cost !== 'number' || event.cost < 0)) {
      throw new Error('Invalid cost value');
    }
    
    return Promise.resolve({ id: `secure-${Date.now()}`, ...event });
  });
  
  return mockDb;
};

// Security test matchers
expect.extend({
  toBeSecurityCompliant(received) {
    const pass = !this.utils.matcherHint(/script|javascript|sql|drop|union|delete/i).test(received);
    return {
      message: () => `Expected ${received} to be security compliant`,
      pass
    };
  },
  
  toPreventInjection(received, injectionType) {
    const dangerousPatterns = {
      sql: /(\;|\-\-|union|drop|delete|update.*set)/i,
      xss: /(<script|javascript\:|on\w+\s*=)/i,
      path: /(\.\.\/|\.\.\\|\x00)/i
    };
    
    const pattern = dangerousPatterns[injectionType];
    const pass = !pattern.test(received);
    
    return {
      message: () => `Expected ${received} to prevent ${injectionType} injection`,
      pass
    };
  }
});

// Global security test timeout
jest.setTimeout(60000);

// Log security test execution
beforeEach(() => {
  if (global.expect.getState().currentTestName?.includes('security')) {
    console.log(`🔒 Running security test: ${global.expect.getState().currentTestName}`);
  }
});

// Cleanup security test artifacts
afterEach(() => {
  // Clear any sensitive test data
  if (global.testSecrets) {
    delete global.testSecrets;
  }
});