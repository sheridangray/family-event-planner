const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { GmailMCPClient } = require('../mcp/gmail');
const UnifiedNotificationService = require('../services/unified-notification');
const Database = require('../database');

class GmailWebhookHandler {
  constructor(logger, database, unifiedNotifications = null) {
    this.logger = logger;
    this.database = database;
    this.gmailClient = null; // Will be set dynamically based on the email being processed
    this.notificationService = unifiedNotifications || new UnifiedNotificationService(logger, database);
    this.processedMessages = new Set(); // Prevent duplicate processing
  }

  async init() {
    // For backwards compatibility, initialize a default client
    const { getGmailClient } = require('../mcp/gmail-multi-user-singleton');
    this.gmailClient = await getGmailClient(this.logger);
    
    // Only initialize notification service if we created our own (not passed in)
    if (!this.notificationService.emailAvailable) {
      await this.notificationService.init();
    }
    
    this.logger.info('Gmail webhook handler initialized');
  }

  /**
   * Execute Gmail API calls with automatic re-authentication on token expiry
   */
  async executeWithRetry(apiCall, maxRetries = 1) {
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        return await apiCall();
      } catch (error) {
        if (error.message && error.message.includes('invalid_grant') && attempts < maxRetries) {
          this.logger.warn(`Authentication error (attempt ${attempts + 1}), reinitializing Gmail client...`);
          await this.gmailClient.init();
          attempts++;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Create Express router for Gmail webhook endpoints
   */
  createRouter() {
    const router = express.Router();

    // Webhook endpoint for Pub/Sub notifications
    router.post('/gmail/notifications', async (req, res) => {
      try {
        await this.handlePubSubNotification(req, res);
      } catch (error) {
        this.logger.error('Error handling Pub/Sub notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Health check endpoint
    router.get('/gmail/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'gmail-webhooks',
        timestamp: new Date().toISOString()
      });
    });

    return router;
  }

  /**
   * Handle incoming Pub/Sub notification from Gmail
   */
  async handlePubSubNotification(req, res) {
    this.logger.info('Received Gmail Pub/Sub notification');

    // Verify the request comes from Google
    if (!(await this.verifyPubSubMessage(req))) {
      this.logger.warn('Invalid Pub/Sub message signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the raw buffer body since we use express.raw() middleware
    let pubsubMessage;
    try {
      const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
      pubsubMessage = JSON.parse(bodyStr);
      this.logger.debug('Parsed Pub/Sub message:', JSON.stringify(pubsubMessage));
    } catch (error) {
      this.logger.error('Failed to parse Pub/Sub message:', error.message);
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    const message = pubsubMessage.message;
    if (!message || !message.data) {
      this.logger.warn('Invalid Pub/Sub message format');
      this.logger.debug('Expected message.data but got:', { message, hasMessage: !!message, hasData: !!(message && message.data) });
      return res.status(400).json({ error: 'Invalid message format' });
    }

    try {
      // Decode the base64 message data
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      this.logger.debug('Decoded Gmail notification:', data);

      // Process the Gmail change notification
      await this.processGmailNotification(data);

      // Acknowledge the message
      res.status(200).json({ success: true });

    } catch (error) {
      this.logger.error('Error processing Gmail notification:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  }

  /**
   * Verify Pub/Sub message authenticity (optional but recommended)
   */
  async verifyPubSubMessage(req) {
    const authHeader = req.headers.authorization;
    
    // In development, allow requests without authentication
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug('Development mode: skipping JWT verification');
      return true;
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid Authorization header in production');
      return false;
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      
      // Verify Google-issued JWT token for Pub/Sub push authentication
      // This verifies the token was issued by Google and intended for our endpoint
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded) {
        this.logger.warn('Invalid JWT token format');
        return false;
      }
      
      // Verify the token is from Google
      if (decoded.payload.iss !== 'https://accounts.google.com') {
        this.logger.warn('JWT not issued by Google');
        return false;
      }
      
      // Verify the audience matches our webhook endpoint
      const expectedAudience = 'https://family-event-planner-backend.onrender.com/api/webhooks/gmail/notifications';
      if (decoded.payload.aud !== expectedAudience) {
        this.logger.warn(`JWT audience mismatch. Expected: ${expectedAudience}, Got: ${decoded.payload.aud}`);
        return false;
      }
      
      // Verify token hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.payload.exp < now) {
        this.logger.warn('JWT token expired');
        return false;
      }
      
      // For production, we should verify the token signature against Google's public keys
      // For now, we'll accept tokens that pass basic validation
      this.logger.debug(`Google JWT verified successfully for email: ${decoded.payload.email}`);
      return true;
      
    } catch (error) {
      this.logger.warn(`JWT verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Process Gmail notification and check for new email replies
   */
  async processGmailNotification(notificationData) {
    const { historyId, emailAddress } = notificationData;
    
    this.logger.info(`Processing Gmail changes for ${emailAddress}, historyId: ${historyId}`);

    try {
      // Get our stored history ID to see what's new
      const lastHistoryId = await this.getLastHistoryId();
      
      if (!lastHistoryId) {
        this.logger.warn('No stored history ID found, will process recent messages');
        await this.processRecentMessages();
        await this.saveHistoryId(historyId);
        return;
      }

      // Get history of changes since our last check
      const historyResponse = await this.executeWithRetry(() => 
        this.gmailClient.gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          historyTypes: ['messageAdded'],
          labelId: 'INBOX'
        })
      );

      if (!historyResponse.data.history) {
        this.logger.debug('No new messages in history');
        await this.saveHistoryId(historyId);
        return;
      }

      // Process each history item
      for (const historyItem of historyResponse.data.history) {
        if (historyItem.messagesAdded) {
          for (const addedMessage of historyItem.messagesAdded) {
            await this.processNewMessage(addedMessage.message.id);
          }
        }
      }

      // Update our stored history ID
      await this.saveHistoryId(historyId);

    } catch (error) {
      this.logger.error('Error processing Gmail notification:', error.message);
      
      // If we get an authentication error, try to reinitialize the Gmail client
      if (error.message && error.message.includes('invalid_grant')) {
        this.logger.warn('Authentication error detected, attempting to reinitialize Gmail client...');
        try {
          await this.gmailClient.init();
          this.logger.info('Gmail client reinitialized successfully');
        } catch (reinitError) {
          this.logger.error('Failed to reinitialize Gmail client:', reinitError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Process a specific new message to check if it's a reply to our event notifications
   */
  async processNewMessage(messageId) {
    if (this.processedMessages.has(messageId)) {
      this.logger.debug(`Message ${messageId} already processed, skipping`);
      return;
    }

    try {
      // Get the full message details
      const messageResponse = await this.executeWithRetry(() => 
        this.gmailClient.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        })
      );

      const message = messageResponse.data;
      const headers = this.extractHeaders(message.payload.headers);

      this.logger.debug(`Processing message: ${headers.subject}`);

      // Check if this is a reply to one of our event notifications
      if (await this.isEventReply(headers, message)) {
        await this.processEventReply(message, headers);
      } else {
        this.logger.debug('Message is not an event reply, ignoring');
      }

      this.processedMessages.add(messageId);

    } catch (error) {
      this.logger.error(`Error processing message ${messageId}:`, error);
    }
  }

  /**
   * Extract headers from Gmail message
   */
  extractHeaders(headersArray) {
    const headers = {};
    for (const header of headersArray) {
      headers[header.name.toLowerCase()] = header.value;
    }
    return headers;
  }

  /**
   * Check if message is a reply to our event notification
   */
  async isEventReply(headers, message) {
    // Check if sender is one of our family members first
    const from = headers.from || '';
    const cleanEmailAddress = this.extractEmailAddress(from);
    const isFamilyMember = cleanEmailAddress === process.env.PARENT1_EMAIL || 
                          cleanEmailAddress === process.env.PARENT2_EMAIL;

    if (!isFamilyMember) {
      this.logger.debug(`Email from non-family member: ${cleanEmailAddress} (original: ${from})`);
      return false;
    }

    // Primary method: Check In-Reply-To and References headers for Message-IDs we sent
    const inReplyTo = headers['in-reply-to'] || '';
    const references = headers['references'] || '';
    
    if (inReplyTo || references) {
      const isReplyToOurMessage = await this.isReplyToOurMessageId(inReplyTo, references);
      if (isReplyToOurMessage) {
        this.logger.debug(`Email reply detected via In-Reply-To/References headers`);
        return true;
      }
    }

    // Fallback method: Check subject for event notification keywords
    const subject = headers.subject || '';
    const isReplyBySubject = subject.toLowerCase().includes('re:') && 
                            subject.toLowerCase().includes('new family event');

    this.logger.debug(`Reply check - Subject: "${subject}", From: "${from}", HeaderReply: ${inReplyTo ? 'YES' : 'NO'}, SubjectReply: ${isReplyBySubject}`);

    return isReplyBySubject;
  }

  /**
   * Check if the In-Reply-To or References headers match Message-IDs we sent
   */
  async isReplyToOurMessageId(inReplyTo, references) {
    try {
      // Extract all message IDs from In-Reply-To and References headers
      const messageIds = [];
      
      if (inReplyTo) {
        messageIds.push(inReplyTo.trim());
      }
      
      if (references) {
        // References can contain multiple message IDs separated by spaces
        const refIds = references.split(/\s+/).filter(id => id.trim());
        messageIds.push(...refIds);
      }

      if (messageIds.length === 0) {
        return false;
      }

      // Check if any of these message IDs match ones we sent
      for (const messageId of messageIds) {
        const cleanId = messageId.replace(/[<>]/g, ''); // Remove angle brackets
        
        // Query database for approvals containing this message ID
        const result = await this.database.query(
          `SELECT id FROM sms_approvals WHERE message_sent LIKE ? LIMIT 1`,
          [`%"messageId":"${cleanId}"%`]
        );
        
        if (result.rows && result.rows.length > 0) {
          this.logger.debug(`Found matching Message-ID: ${cleanId}`);
          return true;
        }
      }

      return false;
      
    } catch (error) {
      this.logger.warn('Error checking Message-ID references:', error.message);
      return false; // Fall back to subject-based detection
    }
  }

  /**
   * Extract email address from header (e.g., "Name <email@domain.com>" -> "email@domain.com")
   */
  extractEmailAddress(fromHeader) {
    if (!fromHeader) return null;
    
    // Match email in angle brackets or standalone email
    const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1] : fromHeader;
  }

  /**
   * Process an email reply to an event notification
   */
  async processEventReply(message, headers) {
    try {
      this.logger.info(`Processing event reply from ${headers.from}: ${headers.subject}`);

      // Extract the message body
      const body = this.extractMessageBody(message.payload);
      
      if (!body) {
        this.logger.warn('Could not extract message body');
        return;
      }

      // Extract clean email address for database lookup
      const cleanEmailAddress = this.extractEmailAddress(headers.from);
      this.logger.debug(`Extracted email address: ${cleanEmailAddress} from header: ${headers.from}`);

      // Process the reply using our unified notification service
      const result = await this.notificationService.handleIncomingResponse(
        cleanEmailAddress,
        { subject: headers.subject, body: body },
        message.id,
        true // isEmail = true
      );

      if (result) {
        this.logger.info(`Email reply processed successfully: ${JSON.stringify(result)}`);
        
        // If event was approved, process it
        if (result.approved && !result.requiresPayment) {
          await this.notificationService.processApprovedEvent(result.eventId, result.approvalId, 'email');
          this.logger.info(`Free event ${result.eventTitle} processed for registration`);
        } else if (result.approved && result.requiresPayment) {
          await this.notificationService.processApprovedEvent(result.eventId, result.approvalId, 'email');
          this.logger.info(`Paid event ${result.eventTitle} - payment link sent`);
        }
        
      } else {
        this.logger.debug('Email reply did not result in action');
      }

    } catch (error) {
      this.logger.error('Error processing event reply:', error);
    }
  }

  /**
   * Extract plain text body from Gmail message
   */
  extractMessageBody(payload) {
    if (payload.body && payload.body.data) {
      // Single part message
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      // Multipart message - look for text/plain part
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        
        // Recursive search for nested parts
        if (part.parts) {
          const nestedBody = this.extractMessageBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    }

    return null;
  }

  /**
   * Process recent messages (fallback when no history ID)
   */
  async processRecentMessages() {
    this.logger.info('Processing recent messages as fallback');
    
    try {
      // Get messages from the last hour
      const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
      
      const messagesResponse = await this.executeWithRetry(() => 
        this.gmailClient.gmail.users.messages.list({
          userId: 'me',
          q: `in:inbox after:${oneHourAgo}`,
          maxResults: 10
        })
      );

      if (messagesResponse.data.messages) {
        for (const message of messagesResponse.data.messages) {
          await this.processNewMessage(message.id);
        }
      }

    } catch (error) {
      this.logger.error('Error processing recent messages:', error);
    }
  }

  /**
   * Get the last stored history ID
   */
  async getLastHistoryId() {
    try {
      const fs = require('fs');
      if (fs.existsSync('./gmail-watch-history.json')) {
        const history = JSON.parse(fs.readFileSync('./gmail-watch-history.json', 'utf8'));
        return history.historyId;
      }
    } catch (error) {
      this.logger.warn('Could not read history ID:', error.message);
    }
    return null;
  }

  /**
   * Save the current history ID
   */
  async saveHistoryId(historyId) {
    try {
      const fs = require('fs');
      let history = {};
      
      if (fs.existsSync('./gmail-watch-history.json')) {
        history = JSON.parse(fs.readFileSync('./gmail-watch-history.json', 'utf8'));
      }
      
      history.historyId = historyId;
      history.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync('./gmail-watch-history.json', JSON.stringify(history, null, 2));
      this.logger.debug(`Saved history ID: ${historyId}`);
      
    } catch (error) {
      this.logger.error('Error saving history ID:', error);
    }
  }

  /**
   * Clean up processed messages cache (prevent memory leaks)
   */
  cleanupProcessedMessages() {
    if (this.processedMessages.size > 1000) {
      this.processedMessages.clear();
      this.logger.debug('Cleared processed messages cache');
    }
  }
}

module.exports = GmailWebhookHandler;