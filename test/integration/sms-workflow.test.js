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
    
    // Mock Twilio client initialization
    smsManager.twilioClient.init = jest.fn().mockResolvedValue();
    smsManager.twilioClient.sendSMS = jest.fn().mockResolvedValue('mock-message-id');
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
      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result.approved).toBe(true);
      expect(result.eventId).toBe(1);
      expect(result.requiresPayment).toBe(false);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'approved');
    });

    test('should handle YES response for paid event', async () => {
      // Update mock to return paid event
      smsManager.twilioClient.getPendingApprovals.mockResolvedValue([
        {
          id: 123,
          event_id: 1,
          event_title: 'Expensive Event',
          event_cost: 50,
          phone_number: '+1234567890'
        }
      ]);

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result.approved).toBe(true);
      expect(result.requiresPayment).toBe(true);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'approved');
    });

    test('should handle NO response', async () => {
      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'NO',
        'mock-message-id'
      );

      expect(result.approved).toBe(false);
      expect(result.eventId).toBe(1);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'rejected');
    });

    test('should handle unclear responses', async () => {
      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'maybe?',
        'mock-message-id'
      );

      expect(result.unclear).toBe(true);
      expect(result.eventId).toBe(1);
      // Should not update event status for unclear responses
      expect(mockDatabase.updateEventStatus).not.toHaveBeenCalled();
    });

    test('should handle payment confirmation', async () => {
      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'PAID',
        'mock-message-id'
      );

      expect(result.paymentConfirmed).toBe(true);
      expect(result.eventId).toBe(1);
      expect(mockDatabase.updateEventStatus).toHaveBeenCalledWith(1, 'ready_for_registration');
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
      mockDatabase.saveSMSApproval.mockRejectedValue(new Error('Database error'));

      const testEvent = { id: 1, title: 'Test Event', cost: 0 };

      await expect(smsManager.sendEventForApproval(testEvent)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle SMS sending failures', async () => {
      smsManager.twilioClient.sendSMS.mockRejectedValue(new Error('SMS failed'));

      const testEvent = { id: 1, title: 'Test Event', cost: 0, date: new Date().toISOString() };

      await expect(smsManager.sendEventForApproval(testEvent)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle missing pending approvals', async () => {
      smsManager.twilioClient.getPendingApprovals.mockResolvedValue([]);

      const result = await smsManager.handleIncomingResponse(
        '+1234567890',
        'YES',
        'mock-message-id'
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No pending approvals')
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