const { CalendarConflictChecker } = require('../../src/mcp/gmail');

describe('Calendar Conflict Integration', () => {
  let calendarChecker;
  let mockLogger;
  let mockGmailClient;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    calendarChecker = new CalendarConflictChecker(mockLogger);
    
    // Override the gmail client with proper mock functions
    mockGmailClient = {
      checkCalendarConflicts: jest.fn().mockResolvedValue({
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      })
    };
    
    calendarChecker.gmailClient = mockGmailClient;
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Conflict Detection', () => {
    test('should detect Joyce conflicts as blocking', async () => {
      // Mock Joyce having a conflict
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: true,
        hasWarning: false,
        blockingConflicts: [{
          id: 'conflict-1',
          title: 'Joyce Work Meeting',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warningConflicts: [],
        conflicts: [{
          id: 'conflict-1',
          title: 'Joyce Work Meeting',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true);
      expect(result.hasWarning).toBe(false);
      expect(result.blockingConflicts).toHaveLength(1);
      expect(result.blockingConflicts[0].title).toBe('Joyce Work Meeting');
    });

    test('should detect Sheridan conflicts as warnings only', async () => {
      // Mock Sheridan having a conflict (warning only)
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: true,
        blockingConflicts: [],
        warningConflicts: [{
          id: 'warning-1',
          title: 'Sheridan Gym Session',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        conflicts: [{
          id: 'warning-1',
          title: 'Sheridan Gym Session',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.hasWarning).toBe(true);
      expect(result.warningConflicts).toHaveLength(1);
      expect(result.warningConflicts[0].title).toBe('Sheridan Gym Session');
    });

    test('should handle both Joyce and Sheridan conflicts correctly', async () => {
      // Mock both Joyce and Sheridan having conflicts
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: true,
        hasWarning: true,
        blockingConflicts: [{
          id: 'joyce-conflict',
          title: 'Joyce Meeting',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warningConflicts: [{
          id: 'sheridan-conflict',
          title: 'Sheridan Workout',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        conflicts: [
          {
            id: 'joyce-conflict',
            title: 'Joyce Meeting',
            start: '2024-01-15T14:00:00Z',
            end: '2024-01-15T15:00:00Z'
          },
          {
            id: 'sheridan-conflict',
            title: 'Sheridan Workout',
            start: '2024-01-15T14:00:00Z',
            end: '2024-01-15T15:00:00Z'
          }
        ],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true);
      expect(result.hasWarning).toBe(true);
      expect(result.blockingConflicts).toHaveLength(1);
      expect(result.warningConflicts).toHaveLength(1);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle individual calendar failures gracefully', async () => {
      // Mock Joyce's calendar failing but Sheridan's working
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: true,
        blockingConflicts: [],
        warningConflicts: [{
          id: 'sheridan-event',
          title: 'Sheridan Event',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        conflicts: [{
          id: 'sheridan-event',
          title: 'Sheridan Event',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warnings: ["Joyce's calendar unavailable (Joyce calendar unavailable)"],
        calendarAccessible: {
          joyce: false,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.hasWarning).toBe(true);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Joyce')]));
      expect(result.calendarAccessible.joyce).toBe(false);
      expect(result.calendarAccessible.sheridan).toBe(true);
    });

    test('should handle complete calendar system failure', async () => {
      // Mock complete system failure
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: ['Calendar system completely unavailable: Calendar system down'],
        calendarAccessible: {
          joyce: false,
          sheridan: false
        },
        error: 'Calendar system down',
        summary: 'Calendar check failed - proceeding with caution'
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.hasWarning).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.calendarAccessible.joyce).toBe(false);
      expect(result.calendarAccessible.sheridan).toBe(false);
    });

    test('should handle authentication errors', async () => {
      // Mock authentication error
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: ['Authentication failed'],
        calendarAccessible: {
          joyce: false,
          sheridan: false
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Authentication failed')]));
    });

    test('should handle permission errors', async () => {
      // Mock permission error
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: ['Permission denied'],
        calendarAccessible: {
          joyce: false,
          sheridan: false
        }
      });

      const eventDate = '2024-01-15T14:30:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Permission denied')]));
    });
  });

  describe('Time Buffer and Overlap Logic', () => {
    test('should detect conflicts with time buffer', async () => {
      // Mock a conflict that should be detected with buffer
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: true,
        hasWarning: false,
        blockingConflicts: [{
          id: 'close-event',
          title: 'Joyce Close Event',
          start: '2024-01-15T13:45:00Z',
          end: '2024-01-15T14:15:00Z'
        }],
        warningConflicts: [],
        conflicts: [{
          id: 'close-event',
          title: 'Joyce Close Event',
          start: '2024-01-15T13:45:00Z',
          end: '2024-01-15T14:15:00Z'
        }],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate, 60);

      expect(result.hasConflict).toBe(true);
      expect(result.blockingConflicts).toHaveLength(1);
    });

    test('should not detect conflicts outside buffer', async () => {
      // Mock no conflicts (distant event)
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: false,
        hasWarning: false,
        blockingConflicts: [],
        warningConflicts: [],
        conflicts: [],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(false);
      expect(result.blockingConflicts).toHaveLength(0);
    });
  });

  describe('All-day Events', () => {
    test('should handle all-day events correctly', async () => {
      // Mock all-day event conflict
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: true,
        hasWarning: false,
        blockingConflicts: [{
          id: 'all-day-event',
          title: 'Joyce All Day Event',
          start: '2024-01-15',
          end: '2024-01-16'
        }],
        warningConflicts: [],
        conflicts: [{
          id: 'all-day-event',
          title: 'Joyce All Day Event',
          start: '2024-01-15',
          end: '2024-01-16'
        }],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const eventDate = '2024-01-15T14:00:00Z';
      const result = await calendarChecker.getConflictDetails(eventDate);

      expect(result.hasConflict).toBe(true);
      expect(result.blockingConflicts[0].title).toBe('Joyce All Day Event');
    });
  });

  describe('Simple hasConflict Method', () => {
    test('should return boolean for simple conflict check', async () => {
      // Mock conflict for hasConflict test
      mockGmailClient.checkCalendarConflicts.mockResolvedValue({
        hasConflict: true,
        hasWarning: false,
        blockingConflicts: [{
          id: 'conflict',
          title: 'Conflict',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z'
        }],
        warningConflicts: [],
        conflicts: [],
        warnings: [],
        calendarAccessible: {
          joyce: true,
          sheridan: true
        }
      });

      const hasConflict = await calendarChecker.hasConflict('2024-01-15T14:30:00Z');
      expect(hasConflict).toBe(true);
    });

    test('should return false on calendar errors for safety', async () => {
      // Mock the checkCalendarConflicts to throw an error
      mockGmailClient.checkCalendarConflicts.mockRejectedValue(new Error('Calendar error'));

      const hasConflict = await calendarChecker.hasConflict('2024-01-15T14:30:00Z');
      expect(hasConflict).toBe(false); // Safe default
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});