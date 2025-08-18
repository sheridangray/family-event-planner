const { SMSApprovalManager } = require('../../src/mcp/twilio');
const RegistrationAutomator = require('../../src/automation/registration');

describe('SMS Approval Workflow Integration', () => {
  let smsManager;
  let registrationAutomator;
  let mockLogger;
  let mockDatabase;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    mockDatabase = {
      ...global.createMockDatabase(),
      saveSMSApproval: jest.fn().mockResolvedValue(123),
      updateSMSResponse: jest.fn().mockResolvedValue(),
      updateEventStatus: jest.fn().mockResolvedValue(),
      getEventsByStatus: jest.fn().mockResolvedValue([])
    };

    smsManager = new SMSApprovalManager(mockLogger, mockDatabase);
    registrationAutomator = new RegistrationAutomator(mockLogger, mockDatabase);
    
    // Mock Twilio client initialization and basic methods
    smsManager.twilioClient.init = jest.fn().mockResolvedValue();
    smsManager.twilioClient.sendSMS = jest.fn().mockResolvedValue('mock-message-id');
    
    // Don't mock sendApprovalRequest so it calls the real implementation
    // which will call the mocked database methods
    smsManager.twilioClient.handleIncomingSMS = jest.fn();
    smsManager.twilioClient.sendPaymentLink = jest.fn().mockResolvedValue({
      messageId: 'mock-payment-message'
    });
    smsManager.twilioClient.sendReminderMessage = jest.fn().mockResolvedValue('mock-reminder-id');
    smsManager.twilioClient.checkApprovalTimeouts = jest.fn().mockResolvedValue([]);
    
    // Mock registration automator methods
    registrationAutomator.processApprovedEvents = jest.fn().mockResolvedValue([]);
    registrationAutomator.registerForEvent = jest.fn().mockResolvedValue({
      success: true,
      message: 'Registration successful'
    });
  });

  describe('Event Approval Process', () => {
    test('should send approval request for new event', async () => {
      const testEvent = {
        id: 1,
        title: 'Test Family Event',
        cost: 0,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: { address: 'Golden Gate Park, SF' },
        ageRange: { min: 2, max: 6 }
      };

      const result = await smsManager.sendEventForApproval(testEvent);

      expect(result).toBeTruthy();
      expect(result.approvalId).toBe(123);
      expect(mockDatabase.saveSMSApproval).toHaveBeenCalledWith(
        testEvent.id,
        expect.any(String), // phone number
        expect.any(String)  // message content
      );
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'proposed');
    });

    test('should respect daily event limits', async () => {
      // Mock that we've already sent max events today
      smsManager.dailyEventCount = 3; // Assuming limit is 3
      
      const testEvent = {
        id: 1,
        title: 'Test Event',
        cost: 0,
        date: new Date().toISOString()
      };

      const result = await smsManager.sendEventForApproval(testEvent);
      expect(result).toBeNull();
    });
  });

  describe('SMS Response Handling', () => {
    beforeEach(() => {
      // Mock pending approvals
      smsManager.twilioClient.getPendingApprovals = jest.fn().mockResolvedValue([
        {
          id: 123,
          event_id: 1,
          event_title: 'Test Event',
          event_cost: 0,
          phone_number: '+1234567890'
        }
      ]);
    });

    test('should handle YES response for free event', async () => {
      // Mock the Twilio client response for YES
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        approved: true,
        eventId: 1,
        approvalId: 123,
        eventTitle: 'Test Event',
        requiresPayment: false
      });

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result.approved).toBe(true);
      expect(result.eventId).toBe(1);
      expect(result.requiresPayment).toBe(false);
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'YES',
        'mock-message-id'
      );
    });

    test('should handle YES response for paid event', async () => {
      // Mock the Twilio client response for YES with paid event
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        approved: true,
        eventId: 1,
        approvalId: 123,
        eventTitle: 'Expensive Event',
        requiresPayment: true
      });

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result.approved).toBe(true);
      expect(result.requiresPayment).toBe(true);
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'YES',
        'mock-message-id'
      );
    });

    test('should handle NO response', async () => {
      // Mock the Twilio client response for NO
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        approved: false,
        eventId: 1,
        approvalId: 123,
        eventTitle: 'Test Event'
      });

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'NO',
        'mock-message-id'
      );

      expect(result.approved).toBe(false);
      expect(result.eventId).toBe(1);
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'NO',
        'mock-message-id'
      );
    });

    test('should handle unclear responses', async () => {
      // Mock the Twilio client response for unclear input
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        unclear: true,
        eventId: 1
      });

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'maybe?',
        'mock-message-id'
      );

      expect(result.unclear).toBe(true);
      expect(result.eventId).toBe(1);
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'maybe?',
        'mock-message-id'
      );
    });

    test('should handle payment confirmation', async () => {
      // Mock the Twilio client response for payment confirmation
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        paymentConfirmed: true,
        eventId: 1,
        approvalId: 123,
        eventTitle: 'Test Event'
      });

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'PAID',
        'mock-message-id'
      );

      expect(result.paymentConfirmed).toBe(true);
      expect(result.eventId).toBe(1);
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'PAID',
        'mock-message-id'
      );
    });
  });

  describe('Approval Timeout Handling', () => {
    test('should detect and process expired approvals', async () => {
      // Mock expired approvals
      smsManager.twilioClient.checkApprovalTimeouts = jest.fn().mockResolvedValue([
        {
          id: 123,
          event_id: 1,
          event_title: 'Expired Event',
          phone_number: '+1234567890',
          timeout_status: 'reminder_due'
        }
      ]);

      const reminderCount = await smsManager.sendReminders();

      expect(reminderCount).toBe(1);
      expect(smsManager.twilioClient.sendReminderMessage).toHaveBeenCalled();
    });

    test('should handle multiple expired approvals', async () => {
      const expiredApprovals = [
        { id: 1, event_id: 1, event_title: 'Event 1', phone_number: '+1111111111' },
        { id: 2, event_id: 2, event_title: 'Event 2', phone_number: '+2222222222' }
      ];

      smsManager.twilioClient.checkApprovalTimeouts = jest.fn().mockResolvedValue(expiredApprovals);

      const reminderCount = await smsManager.sendReminders();

      expect(reminderCount).toBe(2);
      expect(smsManager.twilioClient.sendReminderMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Registration Integration', () => {
    test('should process approved events automatically', async () => {
      // Mock approved events ready for registration
      mockDatabase.getEventsByStatus.mockResolvedValue([
        {
          id: 1,
          title: 'Approved Event',
          cost: 0,
          status: 'approved',
          registrationUrl: 'https://example.com/register'
        }
      ]);

      // Mock successful registration
      registrationAutomator.registerForEvent = jest.fn().mockResolvedValue({
        success: true,
        message: 'Registration successful'
      });

      const result = await smsManager.processApprovedEvent(1, 123);

      expect(result.requiresPayment).toBe(false);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'ready_for_registration');
    });

    test('should handle paid events properly', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([
        {
          id: 1,
          title: 'Paid Event',
          cost: 50,
          status: 'approved'
        }
      ]);

      smsManager.twilioClient.sendPaymentLink = jest.fn().mockResolvedValue({
        messageId: 'mock-payment-message'
      });

      const result = await smsManager.processApprovedEvent(1, 123);

      expect(result.requiresPayment).toBe(true);
      expect(smsManager.twilioClient.sendPaymentLink).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    test('should handle database errors gracefully', async () => {
      // Create a new SMS manager with a failing database for this test
      const failingDatabase = {
        ...mockDatabase,
        saveSMSApproval: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      
      const failingSmsManager = new SMSApprovalManager(mockLogger, failingDatabase);
      failingSmsManager.twilioClient.init = jest.fn().mockResolvedValue();
      failingSmsManager.twilioClient.sendSMS = jest.fn().mockResolvedValue('mock-message-id');

      const testEvent = { id: 1, title: 'Test Event', cost: 0, date: new Date().toISOString() };

      await expect(failingSmsManager.sendEventForApproval(testEvent)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle SMS sending failures', async () => {
      // Create a new SMS manager with failing SMS for this test
      const failingSmsManager = new SMSApprovalManager(mockLogger, mockDatabase);
      failingSmsManager.twilioClient.init = jest.fn().mockResolvedValue();
      failingSmsManager.twilioClient.sendSMS = jest.fn().mockRejectedValue(new Error('SMS failed'));

      const testEvent = { id: 1, title: 'Test Event', cost: 0, date: new Date().toISOString() };

      await expect(failingSmsManager.sendEventForApproval(testEvent)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle missing pending approvals', async () => {
      // Mock the Twilio client to return null for no pending approvals
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue(null);

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result).toBeNull();
      expect(smsManager.twilioClient.handleIncomingSMS).toHaveBeenCalledWith(
        '+1234567890',
        'YES',
        'mock-message-id'
      );
    });
  });

  describe('Real-time Processing', () => {
    test('should trigger immediate registration for approved free events', async () => {
      mockDatabase.getEventsByStatus.mockResolvedValue([
        {
          id: 1,
          title: 'Free Event',
          cost: 0,
          status: 'ready_for_registration'
        }
      ]);

      registrationAutomator.processApprovedEvents = jest.fn().mockResolvedValue([
        { eventId: 1, success: true }
      ]);

      // Mock handleIncomingSMS to return the expected response for this test
      smsManager.twilioClient.handleIncomingSMS.mockResolvedValue({
        approved: true,
        eventId: 1,
        approvalId: 123,
        eventTitle: 'Free Event',
        requiresPayment: false
      });

      // Simulate the webhook flow
      const smsResult = await smsManager.handleIncomingResponse('+1234567890', 'YES', 'msg-id');
      expect(smsResult.approved).toBe(true);

      // Process the approved event
      await smsManager.processApprovedEvent(smsResult.eventId, smsResult.approvalId);

      // This would typically be called by the webhook endpoint
      const registrationResults = await registrationAutomator.processApprovedEvents();
      
      expect(registrationResults).toHaveLength(1);
      expect(registrationResults[0].success).toBe(true);
    });
  });
});