const { CalendarConflictChecker } = require('../../src/mcp/gmail');

// Mock googleapis before requiring
jest.mock('googleapis');

describe('Calendar Conflict Integration', () => {
  let calendarChecker;
  let mockLogger;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    calendarChecker = new CalendarConflictChecker(mockLogger);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Conflict Detection', () => {
    test('should detect Joyce conflicts as blocking', async () => {
      // Mock calendar events for Joyce (parent1)
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [
                    {
                      id: 'conflict-1',
                      summary: 'Joyce Work Meeting',
                      start: { dateTime: '2024-01-15T14:00:00Z' },
                      end: { dateTime: '2024-01-15T15:00:00Z' }
                    }
                  ]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z'; // Conflicts with Joyce's meeting
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true); // Joyce's conflicts block
      expect(result.hasWarning).toBe(false);
      expect(result.blockingConflicts).toHaveLength(1);
      expect(result.blockingConflicts[0].title).toBe('Joyce Work Meeting');
    });

    test('should detect Sheridan conflicts as warnings only', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'sheridan@example.com') {
              return Promise.resolve({
                data: {
                  items: [
                    {
                      id: 'warning-1',
                      summary: 'Sheridan Gym Session',
                      start: { dateTime: '2024-01-15T14:00:00Z' },
                      end: { dateTime: '2024-01-15T15:00:00Z' }
                    }
                  ]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false); // Sheridan's conflicts don't block
      expect(result.hasWarning).toBe(true);
      expect(result.warningConflicts).toHaveLength(1);
      expect(result.warningConflicts[0].title).toBe('Sheridan Gym Session');
    });

    test('should handle both Joyce and Sheridan conflicts correctly', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'joyce-conflict',
                    summary: 'Joyce Meeting',
                    start: { dateTime: '2024-01-15T14:00:00Z' },
                    end: { dateTime: '2024-01-15T15:00:00Z' }
                  }]
                }
              });
            }
            if (params.calendarId === 'sheridan@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'sheridan-conflict',
                    summary: 'Sheridan Workout',
                    start: { dateTime: '2024-01-15T14:00:00Z' },
                    end: { dateTime: '2024-01-15T15:00:00Z' }
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true); // Blocked because of Joyce
      expect(result.hasWarning).toBe(true);  // Warning because of Sheridan
      expect(result.blockingConflicts).toHaveLength(1);
      expect(result.warningConflicts).toHaveLength(1);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle individual calendar failures gracefully', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.reject(new Error('Joyce calendar unavailable'));
            }
            if (params.calendarId === 'sheridan@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'sheridan-event',
                    summary: 'Sheridan Event',
                    start: { dateTime: '2024-01-15T14:00:00Z' },
                    end: { dateTime: '2024-01-15T15:00:00Z' }
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false); // No blocking since Joyce failed
      expect(result.hasWarning).toBe(true);   // Warning from Sheridan
      expect(result.warnings).toContain(expect.stringContaining('Joyce'));
      expect(result.calendarAccessible.joyce).toBe(false);
      expect(result.calendarAccessible.sheridan).toBe(true);
    });

    test('should handle complete calendar system failure', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockRejectedValue(new Error('Calendar system down'))
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.hasWarning).toBe(false);
      expect(result.warnings).toHaveLength(2); // Both calendars failed
      expect(result.calendarAccessible.joyce).toBe(false);
      expect(result.calendarAccessible.sheridan).toBe(false);
    });

    test('should handle authentication errors', async () => {
      const { google } = require('googleapis');
      const authError = new Error('Authentication failed');
      authError.code = 401;

      const mockCalendar = {
        events: {
          list: jest.fn().mockRejectedValue(authError)
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('Authentication failed'));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('calendar check failed')
      );
    });

    test('should handle permission errors', async () => {
      const { google } = require('googleapis');
      const permError = new Error('Permission denied');
      permError.code = 403;

      const mockCalendar = {
        events: {
          list: jest.fn().mockRejectedValue(permError)
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.warnings).toContain(expect.stringContaining('Permission denied'));
    });
  });

  describe('Time Buffer and Overlap Logic', () => {
    test('should detect conflicts with time buffer', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'close-event',
                    summary: 'Joyce Close Event',
                    start: { dateTime: '2024-01-15T13:45:00Z' }, // 15 min before target
                    end: { dateTime: '2024-01-15T14:15:00Z' }     // 15 min after target start
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      // Target event at 2:00 PM should conflict due to 30-minute buffer
      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate, 60); // 1 hour duration

      expect(result.hasConflict).toBe(true);
      expect(result.blockingConflicts).toHaveLength(1);
    });

    test('should not detect conflicts outside buffer', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'distant-event',
                    summary: 'Joyce Distant Event',
                    start: { dateTime: '2024-01-15T12:00:00Z' }, // 2 hours before
                    end: { dateTime: '2024-01-15T13:00:00Z' }     // 1 hour before
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.blockingConflicts).toHaveLength(0);
    });
  });

  describe('All-day Events', () => {
    test('should handle all-day events correctly', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'all-day-event',
                    summary: 'Joyce All Day Event',
                    start: { date: '2024-01-15' },
                    end: { date: '2024-01-16' }
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true);
      expect(result.blockingConflicts[0].title).toBe('Joyce All Day Event');
    });
  });

  describe('Simple hasConflict Method', () => {
    test('should return boolean for simple conflict check', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockImplementation((params) => {
            if (params.calendarId === 'joyce@example.com') {
              return Promise.resolve({
                data: {
                  items: [{
                    id: 'conflict',
                    summary: 'Conflict',
                    start: { dateTime: '2024-01-15T14:00:00Z' },
                    end: { dateTime: '2024-01-15T15:00:00Z' }
                  }]
                }
              });
            }
            return Promise.resolve({ data: { items: [] } });
          })
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const hasConflict = await calendarChecker.hasConflict('2024-01-15T14:30:00Z');
      expect(hasConflict).toBe(true);
    });

    test('should return false on calendar errors for safety', async () => {
      const { google } = require('googleapis');
      const mockCalendar = {
        events: {
          list: jest.fn().mockRejectedValue(new Error('Calendar error'))
        }
      };

      google.calendar.mockReturnValue(mockCalendar);

      const hasConflict = await calendarChecker.hasConflict('2024-01-15T14:30:00Z');
      expect(hasConflict).toBe(false); // Safe default
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});