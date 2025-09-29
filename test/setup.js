// Jest setup file - runs before all tests
const winston = require('winston');

// Set up test environment
process.env.NODE_ENV = 'test';

// Disable logging during tests (unless DEBUG is set)
if (!process.env.DEBUG) {
  winston.configure({
    level: 'error',
    format: winston.format.simple(),
    transports: [
      new winston.transports.Console({ silent: true })
    ]
  });
}

// Mock external services by default
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'mock-message-id' })
    }
  }));
});

// Mock the Gmail MCP client methods specifically for calendar tests
jest.mock('../src/mcp/gmail-client', () => {
  const original = jest.requireActual('../src/mcp/gmail-client');

  return {
    ...original,
    GmailClient: jest.fn().mockImplementation(() => ({
      init: jest.fn().mockResolvedValue(),
      checkCalendarConflicts: jest.fn().mockImplementation(async (eventDate, durationMinutes = 120) => {
        // Default to no conflicts
        return {
          hasConflict: false,
          hasWarning: false,
          blockingConflicts: [],
          warningConflicts: [],
          conflicts: [],
          warnings: [],
          calendarAccessible: {
            joyce: true,
            sheridan: true
          },
          checkedTimeRange: {
            start: new Date(eventDate),
            end: new Date(new Date(eventDate).getTime() + durationMinutes * 60000)
          }
        };
      }),
      checkSingleCalendar: jest.fn().mockResolvedValue([])
    })),
    CalendarConflictChecker: original.CalendarConflictChecker
  };
});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        generateAuthUrl: jest.fn().mockReturnValue('mock-auth-url'),
        getToken: jest.fn().mockResolvedValue({ tokens: {} })
      }))
    },
    calendar: jest.fn().mockImplementation(() => ({
      events: {
        list: jest.fn().mockResolvedValue({ data: { items: [] } }),
        insert: jest.fn().mockResolvedValue({ 
          data: { 
            id: 'mock-event-id',
            htmlLink: 'mock-event-link' 
          } 
        })
      }
    })),
    gmail: jest.fn().mockImplementation(() => ({
      users: {
        messages: {
          send: jest.fn().mockResolvedValue({ 
            data: { id: 'mock-email-id' } 
          })
        }
      }
    }))
  }
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue(),
      $: jest.fn().mockResolvedValue(null),
      $$: jest.fn().mockResolvedValue([]),
      content: jest.fn().mockResolvedValue('<html></html>'),
      close: jest.fn().mockResolvedValue()
    }),
    close: jest.fn().mockResolvedValue()
  })
}));

// Global test utilities
global.createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

global.createMockDatabase = () => ({
  getEventsByStatus: jest.fn().mockResolvedValue([]),
  saveEvent: jest.fn().mockResolvedValue({ id: 1 }),
  updateEventStatus: jest.fn().mockResolvedValue(),
  saveSMSApproval: jest.fn().mockResolvedValue(1),
  updateSMSResponse: jest.fn().mockResolvedValue(),
  getFamilyMembers: jest.fn().mockResolvedValue([
    { name: 'Apollo', birthdate: '2021-04-26' },
    { name: 'Athena', birthdate: '2023-03-10' }
  ]),
  saveEventScore: jest.fn().mockResolvedValue(),
  isVenueVisited: jest.fn().mockResolvedValue(false),
  db: {
    all: jest.fn((sql, params, callback) => callback(null, [])),
    run: jest.fn((sql, params, callback) => callback(null)),
    get: jest.fn((sql, params, callback) => callback(null, null))
  },
  usePostgres: false,
  postgres: null
});

// Increase timeout for integration tests
jest.setTimeout(30000);