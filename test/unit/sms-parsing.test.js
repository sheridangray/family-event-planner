const { TwilioMCPClient } = require('../../src/mcp/twilio');

describe('SMS Response Parsing', () => {
  let twilioClient;
  let mockLogger;
  let mockDatabase;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    mockDatabase = global.createMockDatabase();
    twilioClient = new TwilioMCPClient(mockLogger, mockDatabase);
  });

  describe('Basic Approval Responses', () => {
    test.each([
      ['YES', { approved: true, status: 'approved', confidence: 'high' }],
      ['yes', { approved: true, status: 'approved', confidence: 'high' }],
      ['Y', { approved: true, status: 'approved', confidence: 'high' }],
      ['y', { approved: true, status: 'approved', confidence: 'high' }],
      ['1', { approved: true, status: 'approved', confidence: 'high' }],
      ['OK', { approved: true, status: 'approved', confidence: 'high' }],
      ['ok', { approved: true, status: 'approved', confidence: 'high' }]
    ])('should parse "%s" as approval', (input, expected) => {
      const result = twilioClient.parseResponse(input);
      expect(result.approved).toBe(expected.approved);
      expect(result.status).toBe(expected.status);
      expect(result.confidence).toBe(expected.confidence);
    });
  });

  describe('Basic Rejection Responses', () => {
    test.each([
      ['NO', { approved: false, rejected: true, status: 'rejected', confidence: 'high' }],
      ['no', { approved: false, rejected: true, status: 'rejected', confidence: 'high' }],
      ['N', { approved: false, rejected: true, status: 'rejected', confidence: 'high' }],
      ['n', { approved: false, rejected: true, status: 'rejected', confidence: 'high' }],
      ['0', { approved: false, rejected: true, status: 'rejected', confidence: 'high' }],
      ['nope', { approved: false, rejected: true, status: 'rejected', confidence: 'medium' }],
      ['pass', { approved: false, rejected: true, status: 'rejected', confidence: 'medium' }]
    ])('should parse "%s" as rejection', (input, expected) => {
      const result = twilioClient.parseResponse(input);
      expect(result.approved).toBe(expected.approved);
      expect(result.rejected).toBe(expected.rejected);
      expect(result.status).toBe(expected.status);
    });
  });

  describe('Payment Confirmations', () => {
    test.each([
      'PAY', 'pay', 'Paid', 'Payment complete', 'Done', 'Complete'
    ])('should parse "%s" as payment confirmation', (input) => {
      const result = twilioClient.parseResponse(input);
      expect(result.isPaymentConfirmation).toBe(true);
      expect(result.status).toBe('payment_confirmed');
      expect(result.confidence).toBe('high');
    });
  });

  describe('Cancellations', () => {
    test.each([
      'Cancel', 'Cancelled', 'CANCEL', 'Abort'
    ])('should parse "%s" as cancellation', (input) => {
      const result = twilioClient.parseResponse(input);
      expect(result.rejected).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(result.confidence).toBe('high');
    });
  });

  describe('Unclear Responses', () => {
    test.each([
      'Maybe', 'I think so', 'Not sure', 'Hmm', 'What event?', 'asdfghjkl', '', '   '
    ])('should parse "%s" as unclear', (input) => {
      const result = twilioClient.parseResponse(input);
      expect(result.status).toBe('unclear');
      expect(result.confidence).toBe('low');
      expect(result.approved).toBe(false);
      expect(result.rejected).toBe(false);
    });
  });

  describe('Emoji Support', () => {
    test('should handle approval emojis', () => {
      const result = twilioClient.parseResponse('👍');
      expect(result.approved).toBe(true);
      expect(result.status).toBe('approved');
    });

    test('should handle rejection emojis', () => {
      const result = twilioClient.parseResponse('👎');
      expect(result.rejected).toBe(true);
      expect(result.status).toBe('rejected');
    });

    test('should handle checkmark emoji', () => {
      const result = twilioClient.parseResponse('✓');
      expect(result.approved).toBe(true);
      expect(result.status).toBe('approved');
    });
  });

  describe('Ambiguous Responses', () => {
    test('should handle conflicting keywords with priority', () => {
      const result = twilioClient.parseResponse('yes no');
      expect(result.status).toBe('unclear');
      expect(result.confidence).toBe('low');
    });

    test('should prioritize direct approval over rejection in mixed responses', () => {
      const result = twilioClient.parseResponse('ok cancel');
      expect(result.status).toBe('unclear');
    });
  });

  describe('Natural Language Responses', () => {
    test.each([
      ['Sure thing!', true],
      ['Sounds good', true],
      ['Love it', true],
      ['Not interested', false],
      ['Maybe later', false],
      ['Next time', false]
    ])('should parse natural language: "%s"', (input, shouldApprove) => {
      const result = twilioClient.parseResponse(input);
      if (shouldApprove) {
        expect(result.approved).toBe(true);
        expect(result.status).toBe('approved');
      } else {
        expect(result.rejected).toBe(true);
        expect(result.status).toBe('rejected');
      }
    });
  });

  describe('Response Metadata', () => {
    test('should preserve original text', () => {
      const input = '  YES  ';
      const result = twilioClient.parseResponse(input);
      expect(result.originalText).toBe('YES');
    });

    test('should handle whitespace correctly', () => {
      const result = twilioClient.parseResponse('   yes   ');
      expect(result.approved).toBe(true);
      expect(result.originalText).toBe('yes');
    });
  });
});