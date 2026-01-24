/**
 * Newsletter Source - Gmail Newsletter Parser for Kid Events
 * 
 * Parses event newsletters from labeled Gmail messages.
 * Extracts event information using LLM processing.
 */

const { GmailClient } = require('../../../mcp/gmail-client');

class NewsletterSource {
  constructor(logger, database, config = {}) {
    this.logger = logger;
    this.database = database;
    this.gmailClient = new GmailClient(logger, database);
    
    this.config = {
      labelName: config.labelName || 'events/newsletters',
      maxEmails: config.maxEmails || 10,
      ...config
    };
  }

  /**
   * Fetch and parse newsletters for events
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of raw email content for LLM extraction
   */
  async search(options = {}) {
    const searchConfig = { ...this.config, ...options };
    
    try {
      // Get the primary user
      const user = await this.database.getUserByEmail('sheridan.gray@gmail.com');
      if (!user) {
        this.logger.warn('Newsletter Source: Primary user not found');
        return [];
      }

      const newsletters = await this.fetchNewsletters(user.id, searchConfig);
      
      this.logger.info(`Newsletter Source: Found ${newsletters.length} unread newsletters`);
      return newsletters;
    } catch (error) {
      this.logger.error('Newsletter search failed:', error.message);
      return [];
    }
  }

  /**
   * Fetch unread newsletters from Gmail
   */
  async fetchNewsletters(userId, config) {
    try {
      const authenticatedClient = await this.gmailClient.getAuthenticatedClient(userId);
      if (!authenticatedClient) {
        this.logger.warn('Newsletter Source: Could not authenticate Gmail');
        return [];
      }

      const gmail = authenticatedClient.gmail;
      
      // Search for unread newsletters with the specific label
      const query = `label:${config.labelName} is:unread`;
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: config.maxEmails
      });

      if (!response.data.messages) {
        return [];
      }

      // Fetch full message content
      const newsletters = [];
      for (const msg of response.data.messages) {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const newsletter = this.parseEmailContent(fullMsg.data);
          if (newsletter) {
            newsletters.push(newsletter);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch email ${msg.id}:`, error.message);
        }
      }

      return newsletters;
    } catch (error) {
      this.logger.error('Failed to fetch newsletters:', error.message);
      return [];
    }
  }

  /**
   * Parse email content into a processable format
   */
  parseEmailContent(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    const from = getHeader('from');
    const subject = getHeader('subject');
    const date = getHeader('date');

    // Get email body
    let body = '';
    const payload = message.payload;

    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      // Multi-part message
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
    }

    if (!body || body.length < 100) {
      return null;
    }

    return {
      sourceType: 'newsletter',
      messageId: message.id,
      threadId: message.threadId,
      from,
      subject,
      date,
      htmlContent: body,
      snippet: message.snippet,
      
      // These will be populated by the LLM extractor
      extractedEvents: [],
      
      rawData: {
        from,
        subject,
        date,
        messageId: message.id
      }
    };
  }

  /**
   * Mark a newsletter as processed
   */
  async markAsProcessed(userId, messageId) {
    try {
      const authenticatedClient = await this.gmailClient.getAuthenticatedClient(userId);
      if (!authenticatedClient) return false;

      await authenticatedClient.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

      return true;
    } catch (error) {
      this.logger.warn(`Failed to mark email ${messageId} as read:`, error.message);
      return false;
    }
  }

  /**
   * Register a newsletter source in the database
   */
  async registerNewsletterSource(emailFrom, labelName = 'events/newsletters') {
    try {
      const result = await this.database.query(`
        INSERT INTO newsletter_sources (email_from, label_name, is_active)
        VALUES ($1, $2, true)
        ON CONFLICT (email_from) DO UPDATE SET is_active = true
        RETURNING id
      `, [emailFrom, labelName]);
      
      return result.rows[0]?.id;
    } catch (error) {
      this.logger.error('Failed to register newsletter source:', error.message);
      return null;
    }
  }

  /**
   * Get active newsletter sources
   */
  async getActiveNewsletterSources() {
    try {
      const result = await this.database.query(`
        SELECT * FROM newsletter_sources WHERE is_active = true
      `);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get newsletter sources:', error.message);
      return [];
    }
  }
}

module.exports = NewsletterSource;
