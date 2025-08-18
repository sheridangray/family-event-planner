// Mock external services for testing

// Mock Twilio Client
class MockTwilioClient {
  constructor() {
    this.messages = [];
    this.shouldFail = false;
    this.failureMessage = 'Mock Twilio failure';
  }

  setFailureMode(shouldFail, message = 'Mock Twilio failure') {
    this.shouldFail = shouldFail;
    this.failureMessage = message;
  }

  messages = {
    create: async (messageData) => {
      if (this.shouldFail) {
        throw new Error(this.failureMessage);
      }

      const message = {
        sid: `mock_message_${Date.now()}`,
        body: messageData.body,
        from: messageData.from,
        to: messageData.to,
        status: 'sent',
        dateCreated: new Date()
      };

      this.messages.push(message);
      return message;
    }
  };

  getMessageHistory() {
    return [...this.messages];
  }

  clearHistory() {
    this.messages = [];
  }
}

// Mock Google Calendar Client
class MockGoogleCalendar {
  constructor() {
    this.events = new Map();
    this.shouldFail = false;
    this.failureMode = null;
    this.calendars = {
      'joyce@example.com': [],
      'sheridan@example.com': [],
      'primary': []
    };
  }

  setFailureMode(mode, calendarId = null) {
    this.failureMode = mode;
    this.calendarId = calendarId;
  }

  setCalendarEvents(calendarId, events) {
    this.calendars[calendarId] = events;
  }

  events = {
    list: async (params) => {
      const calendarId = params.calendarId || 'primary';
      
      // Simulate different types of failures
      if (this.failureMode === 'auth' || (this.failureMode === 'calendar_specific' && this.calendarId === calendarId)) {
        const error = new Error('Authentication failed');
        error.code = 401;
        throw error;
      }

      if (this.failureMode === 'permission' || (this.failureMode === 'calendar_specific' && this.calendarId === calendarId)) {
        const error = new Error('Permission denied');
        error.code = 403;
        throw error;
      }

      if (this.failureMode === 'network') {
        throw new Error('Network timeout');
      }

      const events = this.calendars[calendarId] || [];
      
      // Filter by time range if provided
      let filteredEvents = events;
      if (params.timeMin || params.timeMax) {
        filteredEvents = events.filter(event => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          
          if (params.timeMin && eventEnd < new Date(params.timeMin)) return false;
          if (params.timeMax && eventStart > new Date(params.timeMax)) return false;
          
          return true;
        });
      }

      return {
        data: {
          items: filteredEvents
        }
      };
    },

    insert: async (params) => {
      if (this.failureMode === 'auth') {
        const error = new Error('Authentication failed');
        error.code = 401;
        throw error;
      }

      if (this.failureMode === 'quota') {
        const error = new Error('Quota exceeded');
        error.code = 429;
        throw error;
      }

      const event = {
        id: `mock_event_${Date.now()}`,
        htmlLink: `https://calendar.google.com/event?eid=mock_${Date.now()}`,
        ...params.resource
      };

      return { data: event };
    }
  };
}

// Mock Gmail Client
class MockGmailClient {
  constructor() {
    this.sentMessages = [];
    this.shouldFail = false;
    this.failureMode = null;
  }

  setFailureMode(mode) {
    this.failureMode = mode;
  }

  users = {
    messages: {
      send: async (params) => {
        if (this.failureMode === 'auth') {
          const error = new Error('Authentication failed');
          error.code = 401;
          throw error;
        }

        if (this.failureMode === 'quota') {
          const error = new Error('Daily quota exceeded');
          error.code = 429;
          throw error;
        }

        if (this.failureMode === 'invalid_recipient') {
          const error = new Error('Invalid recipient');
          error.code = 400;
          throw error;
        }

        const message = {
          id: `mock_email_${Date.now()}`,
          threadId: `mock_thread_${Date.now()}`,
          labelIds: ['SENT']
        };

        this.sentMessages.push({
          ...message,
          raw: params.requestBody.raw,
          sentAt: new Date()
        });

        return { data: message };
      }
    }
  };

  getSentMessages() {
    return [...this.sentMessages];
  }

  clearHistory() {
    this.sentMessages = [];
  }
}

// Mock Puppeteer Browser
class MockPuppeteerBrowser {
  constructor() {
    this.pages = [];
    this.shouldFail = false;
    this.mockPageContent = '<html><body>Mock page content</body></html>';
  }

  setFailureMode(shouldFail) {
    this.shouldFail = shouldFail;
  }

  setMockPageContent(content) {
    this.mockPageContent = content;
  }

  async newPage() {
    if (this.shouldFail) {
      throw new Error('Failed to create new page');
    }

    const page = new MockPuppeteerPage(this.mockPageContent);
    this.pages.push(page);
    return page;
  }

  async close() {
    this.pages.forEach(page => page.close());
    this.pages = [];
  }

  getPages() {
    return [...this.pages];
  }
}

class MockPuppeteerPage {
  constructor(content = '<html></html>') {
    this.content = content;
    this.url = 'about:blank';
    this.isClosed = false;
  }

  async goto(url, options = {}) {
    if (this.isClosed) throw new Error('Page is closed');
    
    this.url = url;
    
    // Simulate loading failures
    if (url.includes('timeout-test')) {
      throw new Error('Navigation timeout');
    }
    
    if (url.includes('404-test')) {
      throw new Error('Page not found');
    }
    
    return { url, status: 200 };
  }

  async content() {
    if (this.isClosed) throw new Error('Page is closed');
    return this.content;
  }

  async $(selector) {
    if (this.isClosed) throw new Error('Page is closed');
    // Mock element selection
    return selector.includes('not-found') ? null : { textContent: 'Mock element' };
  }

  async $$(selector) {
    if (this.isClosed) throw new Error('Page is closed');
    // Mock multiple element selection
    return selector.includes('empty') ? [] : [{ textContent: 'Mock element 1' }, { textContent: 'Mock element 2' }];
  }

  async close() {
    this.isClosed = true;
  }
}

// Factory functions
function createMockTwilioClient() {
  return jest.fn().mockImplementation(() => new MockTwilioClient());
}

function createMockGoogleServices() {
  const calendar = new MockGoogleCalendar();
  const gmail = new MockGmailClient();
  
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
          generateAuthUrl: jest.fn().mockReturnValue('mock-auth-url'),
          getToken: jest.fn().mockResolvedValue({ tokens: {} })
        }))
      },
      calendar: jest.fn().mockReturnValue(calendar),
      gmail: jest.fn().mockReturnValue(gmail)
    },
    _mockCalendar: calendar,
    _mockGmail: gmail
  };
}

function createMockPuppeteer() {
  const browser = new MockPuppeteerBrowser();
  
  return {
    launch: jest.fn().mockResolvedValue(browser),
    _mockBrowser: browser
  };
}

module.exports = {
  MockTwilioClient,
  MockGoogleCalendar,
  MockGmailClient,
  MockPuppeteerBrowser,
  MockPuppeteerPage,
  createMockTwilioClient,
  createMockGoogleServices,
  createMockPuppeteer
};