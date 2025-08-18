// Database mocks for testing
class MockDatabase {
  constructor() {
    this.events = new Map();
    this.smsApprovals = new Map();
    this.familyMembers = [
      { name: 'Apollo', birthdate: '2021-04-26' },
      { name: 'Athena', birthdate: '2023-03-10' }
    ];
    this.nextId = 1;
    this.usePostgres = false;
  }

  reset() {
    this.events.clear();
    this.smsApprovals.clear();
    this.nextId = 1;
  }

  // Event methods
  async saveEvent(eventData) {
    const id = this.nextId++;
    const event = { id, ...eventData, createdAt: new Date() };
    this.events.set(id, event);
    return event;
  }

  async getEventById(id) {
    return this.events.get(id) || null;
  }

  async getEventsByStatus(status) {
    return Array.from(this.events.values()).filter(event => event.status === status);
  }

  async getAllEvents() {
    return Array.from(this.events.values());
  }

  async updateEventStatus(eventId, status) {
    const event = this.events.get(eventId);
    if (event) {
      event.status = status;
      event.updatedAt = new Date();
      this.events.set(eventId, event);
    }
    return event;
  }

  async deleteEvent(eventId) {
    return this.events.delete(eventId);
  }

  // SMS Approval methods
  async saveSMSApproval(eventId, phoneNumber, message) {
    const id = this.nextId++;
    const approval = {
      id,
      event_id: eventId,
      phone_number: phoneNumber,
      message,
      status: 'sent',
      sent_at: new Date()
    };
    this.smsApprovals.set(id, approval);
    return id;
  }

  async updateSMSResponse(approvalId, response, status) {
    const approval = this.smsApprovals.get(approvalId);
    if (approval) {
      approval.response = response;
      approval.status = status;
      approval.responded_at = new Date();
      this.smsApprovals.set(approvalId, approval);
    }
    return approval;
  }

  async getPendingApprovals(phoneNumber, hoursBack = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursBack);

    return Array.from(this.smsApprovals.values())
      .filter(approval => 
        approval.phone_number === phoneNumber &&
        approval.status === 'sent' &&
        new Date(approval.sent_at) > cutoff
      )
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  }

  // Family member methods
  async getFamilyMembers() {
    return [...this.familyMembers];
  }

  async saveFamilyMember(member) {
    this.familyMembers.push(member);
    return member;
  }

  // Registration methods
  async saveRegistration(registrationData) {
    const id = this.nextId++;
    const registration = { id, ...registrationData, createdAt: new Date() };
    return registration;
  }

  // Utility methods
  async healthCheck() {
    return { healthy: true, timestamp: new Date() };
  }

  async close() {
    // Mock cleanup
    this.reset();
  }
}

// Factory functions for different scenarios
function createMockDatabase() {
  return new MockDatabase();
}

function createMockDatabaseWithEvents(events = []) {
  const db = new MockDatabase();
  events.forEach(event => {
    db.saveEvent(event);
  });
  return db;
}

function createMockDatabaseWithApprovals(approvals = []) {
  const db = new MockDatabase();
  approvals.forEach(approval => {
    const id = db.nextId++;
    db.smsApprovals.set(id, { id, ...approval });
  });
  return db;
}

// Mock database that simulates failures
class FailingMockDatabase extends MockDatabase {
  constructor(failureMode = 'random') {
    super();
    this.failureMode = failureMode;
    this.failureRate = 0.3; // 30% failure rate for random mode
  }

  shouldFail(method) {
    if (this.failureMode === 'always') return true;
    if (this.failureMode === 'never') return false;
    if (this.failureMode === method) return true;
    if (this.failureMode === 'random') return Math.random() < this.failureRate;
    return false;
  }

  async saveEvent(eventData) {
    if (this.shouldFail('saveEvent')) {
      throw new Error('Database connection failed');
    }
    return super.saveEvent(eventData);
  }

  async getEventsByStatus(status) {
    if (this.shouldFail('getEventsByStatus')) {
      throw new Error('Query timeout');
    }
    return super.getEventsByStatus(status);
  }

  async updateEventStatus(eventId, status) {
    if (this.shouldFail('updateEventStatus')) {
      throw new Error('Lock timeout');
    }
    return super.updateEventStatus(eventId, status);
  }
}

module.exports = {
  MockDatabase,
  createMockDatabase,
  createMockDatabaseWithEvents,
  createMockDatabaseWithApprovals,
  FailingMockDatabase
};