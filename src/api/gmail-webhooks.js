const express = require('express');
const crypto = require('crypto');
const { GmailMCPClient } = require('../mcp/gmail');
const UnifiedNotificationService = require('../services/unified-notification');
const Database = require('../database');

class GmailWebhookHandler {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.gmailClient = new GmailMCPClient(logger);
    this.notificationService = new UnifiedNotificationService(logger, database);
    this.processedMessages = new Set(); // Prevent duplicate processing
  }

  async init() {
    await this.gmailClient.init();
    await this.notificationService.init();
    this.logger.info('Gmail webhook handler initialized');
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
    if (!this.verifyPubSubMessage(req)) {
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
  verifyPubSubMessage(req) {
    // For now, we'll skip signature verification in development
    // In production, you should verify the JWT token in the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      this.logger.debug('No authorization header found (OK for development)');
      return true; // Allow in development
    }

    // TODO: Implement proper JWT verification for production
    // const token = authHeader.replace('Bearer ', '');
    // Verify token signature and claims
    
    return true;
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
      const historyResponse = await this.gmailClient.gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX'
      });

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
      this.logger.error('Error processing Gmail notification:', error);
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
      const messageResponse = await this.gmailClient.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = messageResponse.data;
      const headers = this.extractHeaders(message.payload.headers);

      this.logger.debug(`Processing message: ${headers.subject}`);

      // Check if this is a reply to one of our event notifications
      if (this.isEventReply(headers, message)) {
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
  isEventReply(headers, message) {
    // Check if subject contains our event notification keywords
    const subject = headers.subject || '';
    const isReply = subject.toLowerCase().includes('re:') || 
                   subject.toLowerCase().includes('new family event');

    // Check if sender is one of our family members
    const from = headers.from || '';
    const isFamilyMember = from.includes(process.env.PARENT1_EMAIL) || 
                          from.includes(process.env.PARENT2_EMAIL);

    // TODO: Better approach would be to check In-Reply-To or References headers
    // to match against Message-IDs we sent

    this.logger.debug(`Reply check - Subject: "${subject}", From: "${from}", IsReply: ${isReply}, IsFamilyMember: ${isFamilyMember}`);

    return isReply && isFamilyMember;
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

      // Process the reply using our unified notification service
      const result = await this.notificationService.handleIncomingResponse(
        headers.from,
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
      
      const messagesResponse = await this.gmailClient.gmail.users.messages.list({
        userId: 'me',
        q: `in:inbox after:${oneHourAgo}`,
        maxResults: 10
      });

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