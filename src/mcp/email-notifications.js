const { config } = require("../config");
const RegistrationOrchestrator = require("../services/registration-orchestrator");

class EmailNotificationClient {
  constructor(logger, database, userId = null) {
    this.logger = logger;
    this.database = database;
    this.userId = userId; // User ID for multi-user support
    this.gmailClient = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      this.logger.info(
        `Initializing Email notification client for user ${
          this.userId || "default"
        }...`
      );

      if (!config.gmail.parent1Email && !config.gmail.parent2Email) {
        throw new Error("No parent email addresses configured");
      }

      // Use unified Gmail client
      const { GmailClient } = require("./gmail-client");
      const Database = require("../database");
      const database = new Database();
      await database.init();
      this.gmailClient = new GmailClient(this.logger, database);

      this.isInitialized = true;

      this.logger.info(
        `Email notification client initialized successfully for user ${
          this.userId || "default"
        }`
      );
      return true;
    } catch (error) {
      this.logger.error(
        "Failed to initialize Email notification client:",
        error.message
      );
      throw error;
    }
  }

  async sendApprovalRequest(event) {
    try {
      this.logger.info(
        `Sending email approval request for event: ${event.title}`
      );

      if (!this.isInitialized) {
        try {
          this.logger.debug("Initializing Gmail client...");
          await this.init();
          this.logger.debug("Gmail client initialized successfully");
        } catch (error) {
          this.logger.error("Error initializing Gmail client:", error.message, {
            stack: error.stack,
          });
          throw error;
        }
      }

      const recipient = this.getRecipientEmail();
      const subject = this.buildEmailSubject(event);
      const emailBody = this.buildApprovalEmailBody(event);

      let emailResult;
      try {
        this.logger.debug(
          `Sending email to ${recipient} with subject: ${subject} using user ID: ${this.userId}`
        );
        emailResult = await this.gmailClient.sendEmail(
          this.userId,
          [recipient],
          subject,
          emailBody
        );
        this.logger.debug("Email sent successfully, result:", emailResult);
      } catch (error) {
        this.logger.error(
          "Error sending email via Gmail client:",
          error.message,
          { stack: error.stack }
        );
        throw error;
      }

      let notificationId;
      try {
        this.logger.debug("Saving email notification to database...");
        notificationId = await this.database.saveNotification(
          event.id,
          "email",
          recipient,
          subject,
          emailBody,
          emailResult.messageId
        );
        this.logger.debug(
          `Email notification saved with ID: ${notificationId}`
        );
      } catch (error) {
        this.logger.error(
          "Error saving email notification to database:",
          error.message,
          { stack: error.stack }
        );
        throw error;
      }

      this.logger.info(
        `Email notification sent for ${event.title}, notification ID: ${notificationId}`
      );

      return {
        notificationId,
        messageId: emailResult.messageId,
        message: emailBody,
        sentAt: new Date(),
        recipient,
      };
    } catch (error) {
      this.logger.error(
        `Error sending email approval request for ${event.title}:`,
        error.message,
        { stack: error.stack }
      );
      throw error;
    }
  }

  getRecipientEmail() {
    // Send all emails to parent1 (Sheridan) in both production and development
    return config.gmail.parent1Email;
  }

  buildEmailSubject(event) {
    const eventDate = new Date(event.date);
    const weeksAway = Math.round(
      (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)
    );

    let subject = `New Family Event: ${event.title}`;

    if (event.cost === 0) {
      subject += " (FREE)";
    } else {
      subject += ` ($${event.cost})`;
    }

    if (weeksAway <= 2) {
      const timePhrase =
        weeksAway === 1 ? "1 week away" : `${weeksAway} weeks away`;
      subject = `${subject} - ${timePhrase}`;
    }

    return subject;
  }

  buildApprovalEmailBody(event) {
    const eventDate = new Date(event.date);
    const weeksAway = Math.round(
      (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)
    );
    const dateFormatted = eventDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    let emailBody = `Hi ${
      config.app.nodeEnv === "production"
        ? config.family.parent1Name
        : config.family.parent2Name
    }!\n\n`;

    emailBody += `I found a great family event that looks perfect for ${config.family.child1Name} and ${config.family.child2Name}:\n\n`;

    emailBody += `**${event.title}**\n`;

    if (event.socialProof?.yelpRating || event.socialProof?.googleRating) {
      const rating =
        event.socialProof.yelpRating || event.socialProof.googleRating;
      emailBody += `⭐ Rating: ${rating.toFixed(1)}/5\n`;
    }

    const timePhrase =
      weeksAway === 1 ? "1 week away" : `${weeksAway} weeks away`;
    emailBody += `📅 **Date:** ${dateFormatted} (${timePhrase})\n`;
    emailBody += `📍 **Location:** ${
      event.location?.address || "San Francisco, CA"
    }\n`;

    if (event.cost === 0) {
      emailBody += `💰 **Cost:** FREE! 🎉\n`;
    } else {
      emailBody += `💰 **Cost:** $${event.cost} per person\n`;
    }

    if (event.ageRange) {
      emailBody += `👶 **Ages:** ${event.ageRange.min}-${event.ageRange.max} years old\n`;
    }

    if (event.description) {
      emailBody += `\n📝 **Description:**\n${event.description}\n`;
    }

    emailBody += this.addSpecialNotesEmail(event);

    if (event.registrationUrl) {
      emailBody += `\n🔗 **Registration:** ${event.registrationUrl}\n`;
    }

    emailBody += `\n---\n\n`;

    emailBody += `📋 **NEXT STEP - MANUAL REGISTRATION:**\n\n`;
    emailBody += `Please reply with Yes or No if you want to register. If so, I'll create a placeholder calendar event. If not, I'll update my preferences to improve my recommendations for the future.\n\n`;
    emailBody += `Please register at: ${
      event.registrationUrl || event.registration_url || "Check event website"
    }\n`;
    emailBody += `${
      event.cost === 0 ? "(This is a FREE event! 🎉)" : `(Cost: $${event.cost})`
    }\n\n`;
    emailBody += `After you register and receive confirmation, the system will automatically detect the official event in your calendar and remove the placeholder.\n\n`;

    emailBody += `💡 *Just reply to this email with YES or NO - I'll handle the calendar management!*\n\n`;

    emailBody += `Best,\n`;
    emailBody += `Your Family Event Assistant 🤖`;

    return emailBody;
  }

  async sendManualRegistrationConfirmation(event, placeholderResult) {
    const subject = `✅ Calendar Updated: ${event.title}`;

    const emailBody = `Great! I've added "${event.title}" to your calendar as requested.

📅 **Calendar Event:** ${placeholderResult.eventLink}

The placeholder will be automatically removed once you complete registration and I detect the official event.

🤖 Your Family Event Planner`;

    const recipient = this.getRecipientEmail();

    const emailResult = await this.gmailClient.sendEmail({
      to: recipient,
      subject: subject,
      body: emailBody,
    });

    this.logger.info(
      `Manual registration confirmation email sent for: ${event.title} to ${recipient}`
    );

    return {
      messageId: emailResult.messageId,
      message: emailBody,
      sentAt: new Date(),
      recipient,
    };
  }

  addSpecialNotesEmail(event) {
    let notes = "";

    if (this.isUrgentEvent(event)) {
      if (event.registrationOpens) {
        notes += `\n📅 **Registration recently opened**\n`;
      } else if (
        event.currentCapacity &&
        event.currentCapacity.available < event.currentCapacity.total * 0.3
      ) {
        const available = event.currentCapacity.available;
        notes += `\n📊 **Limited availability:** ${available} spots remaining\n`;
      }
    }

    if (event.socialProof?.influencerMentions?.length > 0) {
      notes += `\n📸 **Trending:** Popular on Instagram\n`;
    }

    if (this.isNewVenue(event)) {
      notes += `\n✨ **New Venue:** We haven't been here before!\n`;
    }

    return notes;
  }

  isUrgentEvent(event) {
    if (event.registrationOpens) {
      const now = new Date();
      const regOpens = new Date(event.registrationOpens);
      const timeDiff = regOpens.getTime() - now.getTime();
      const hoursUntilOpen = timeDiff / (1000 * 60 * 60);

      return hoursUntilOpen <= 2 && hoursUntilOpen >= -2;
    }

    if (event.currentCapacity && event.currentCapacity.total) {
      const capacityRatio =
        event.currentCapacity.available / event.currentCapacity.total;
      return capacityRatio <= 0.3;
    }

    return false;
  }

  isNewVenue(event) {
    return !event.previouslyAttended && !event.isRecurring;
  }

  extractEventTitleFromSubject(subject) {
    // Extract event title from email subject like "Re: New Family Event: Glow (FREE)"
    // Pattern: "Re: New Family Event: TITLE (additional info)"
    const match = subject.match(
      /Re:\s*New Family Event:\s*([^(]+?)(?:\s*\(|$)/i
    );
    if (match) {
      return match[1].trim();
    }

    // Fallback: try to extract any text after "Re: New Family Event:"
    const fallbackMatch = subject.match(
      /Re:\s*New Family Event:\s*(.+?)(?:\s*-|$)/i
    );
    if (fallbackMatch) {
      return fallbackMatch[1].trim();
    }

    this.logger.warn(
      `Could not extract event title from subject: "${subject}"`
    );
    return null;
  }

  async handleIncomingEmail(from, subject, body, messageId) {
    try {
      this.logger.info(`Received email response from ${from}: ${subject}`);
      this.logger.debug(`Email body preview: "${body.substring(0, 100)}..."`);

      const response = this.parseEmailResponse(body);

      // Extract event title from subject line
      const eventTitle = this.extractEventTitleFromSubject(subject);
      this.logger.debug(`Extracted event title from subject: "${eventTitle}"`);

      const pendingApprovals = await this.getPendingApprovals(from, eventTitle);

      if (pendingApprovals.length === 0) {
        this.logger.warn(`No pending approvals found for ${from}`);

        // Send helpful response if no pending approvals
        await this.sendConfirmationEmail(from, {
          type: "no_pending",
          message:
            "No pending event approvals found. You'll receive new event suggestions soon! 🎉",
        });

        return null;
      }

      const latestApproval = pendingApprovals[0];

      // Handle unclear responses
      if (response.confidence === "low" || response.status === "unclear") {
        this.logger.warn(
          `Unclear email response from ${from}: "${body.substring(0, 100)}..."`
        );

        await this.sendConfirmationEmail(from, {
          type: "unclear",
          eventTitle: latestApproval.event_title,
          message: `I didn't understand your response. Please reply with YES to book "${latestApproval.event_title}" or NO to skip it.`,
        });

        return { unclear: true, eventId: latestApproval.event_id };
      }

      // Update response in database using new notifications system
      await this.database.updateNotificationResponse(
        latestApproval.id,
        body.substring(0, 500), // Truncate long emails
        response.status
      );

      if (response.approved) {
        // Check if this is a "DONE" response for a paid event
        const isDoneResponse = [
          "done",
          "completed",
          "finished",
          "registered",
        ].some((keyword) =>
          response.originalText.toLowerCase().includes(keyword)
        );

        if (isDoneResponse && latestApproval.event_cost > 0) {
          // User completed registration for paid event
          await this.database.updateEventStatus(
            latestApproval.event_id,
            "registered"
          );
          this.logger.info(
            `✅ Paid event ${latestApproval.event_id} (${latestApproval.event_title}) registration completed`
          );

          await this.sendConfirmationEmail(from, {
            type: "registration_completed",
            eventTitle: latestApproval.event_title,
            message: `✅ Perfect! Registration confirmed for "${latestApproval.event_title}". Thanks for letting me know!`,
          });

          return {
            approved: true,
            eventId: latestApproval.event_id,
            notificationId: latestApproval.id,
            eventTitle: latestApproval.event_title,
            registrationCompleted: true,
          };
        } else {
          // Regular approval
          await this.database.updateEventStatus(
            latestApproval.event_id,
            "approved"
          );
          this.logger.info(
            `✅ Event ${latestApproval.event_id} (${latestApproval.event_title}) approved via email`
          );
        }

        // No confirmation email - just create calendar event silently

        return {
          approved: true,
          eventId: latestApproval.event_id,
          notificationId: latestApproval.id,
          eventTitle: latestApproval.event_title,
          requiresPayment: latestApproval.event_cost > 0,
        };
      } else if (response.rejected || response.status === "cancelled") {
        await this.database.updateEventStatus(
          latestApproval.event_id,
          "rejected"
        );
        this.logger.info(
          `❌ Event ${latestApproval.event_id} (${latestApproval.event_title}) rejected via email`
        );

        // Send confirmation
        await this.sendConfirmationEmail(from, {
          type: "rejected",
          eventTitle: latestApproval.event_title,
          message: `👍 Got it! Skipping "${latestApproval.event_title}". I'll keep looking for other great events for the family!`,
        });

        return {
          approved: false,
          eventId: latestApproval.event_id,
          notificationId: latestApproval.id,
          eventTitle: latestApproval.event_title,
        };
      } else if (response.isPaymentConfirmation) {
        // Handle payment confirmation for paid events
        this.logger.info(
          `💳 Payment confirmation received via email for ${latestApproval.event_title}`
        );

        await this.database.updateEventStatus(
          latestApproval.event_id,
          "ready_for_registration"
        );

        await this.sendConfirmationEmail(from, {
          type: "payment_confirmed",
          eventTitle: latestApproval.event_title,
          message: `💳 Payment confirmed for "${latestApproval.event_title}"! Now processing registration...`,
        });

        return {
          paymentConfirmed: true,
          eventId: latestApproval.event_id,
          notificationId: latestApproval.id,
          eventTitle: latestApproval.event_title,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error handling incoming email from ${from}:`,
        error.message
      );

      // Send error message to user
      try {
        await this.sendConfirmationEmail(from, {
          type: "error",
          message:
            "Sorry, there was an error processing your email response. Please try again or contact support.",
        });
      } catch (confirmError) {
        this.logger.error(
          "Failed to send error confirmation email:",
          confirmError.message
        );
      }

      throw error;
    }
  }

  parseEmailResponse(body) {
    // Handle null/undefined/empty input
    if (!body || typeof body !== "string") {
      return {
        approved: false,
        rejected: false,
        status: "unclear",
        originalText: body || "",
        confidence: "low",
      };
    }

    // Clean up email body - remove quoted text and signatures
    let cleanBody = this.cleanEmailBody(body);
    const text = cleanBody.toLowerCase().trim();

    // Use the same parsing logic as SMS
    return this.parseResponseText(text, body);
  }

  cleanEmailBody(body) {
    // Remove common email artifacts
    let cleaned = body;

    // Remove quoted text (lines starting with >)
    cleaned = cleaned.replace(/^>.*$/gm, "");

    // Remove common email signatures
    cleaned = cleaned.replace(/--\s*$/gm, "");
    cleaned = cleaned.replace(/Best regards?.*$/is, "");
    cleaned = cleaned.replace(/Thanks?.*$/is, "");

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, "\n").trim();

    // Take only the first few lines (likely the actual response)
    const lines = cleaned.split("\n");
    if (lines.length > 3) {
      cleaned = lines.slice(0, 3).join("\n");
    }

    return cleaned;
  }

  parseResponseText(text, originalBody) {
    // Reuse the same parsing logic from SMS
    const exactApprovalKeywords = [
      "yes",
      "y",
      "yeah",
      "yep",
      "yup",
      "yas",
      "ya",
      "yea",
      "sure",
      "ok",
      "okay",
      "good",
      "great",
      "perfect",
      "awesome",
      "approve",
      "book",
      "register",
      "go",
      "done",
      "completed",
      "finished",
      "registered",
      "1",
      "true",
      "accept",
      "✓",
      "👍",
    ];

    const exactRejectionKeywords = [
      "no",
      "n",
      "nope",
      "nah",
      "na",
      "nay",
      "pass",
      "skip",
      "reject",
      "decline",
      "0",
      "false",
      "❌",
      "👎",
    ];

    const approvalPhrases = [
      "sounds good",
      "sure thing",
      "do it",
      "lets do it",
      "let's do it",
      "love it",
      "want it",
      "sign us up",
      "count me in",
    ];

    const rejectionPhrases = [
      "not interested",
      "not now",
      "next time",
      "not this time",
      "maybe later",
      "no thanks",
      "not really",
    ];

    const ambiguousKeywords = [
      "maybe",
      "perhaps",
      "possibly",
      "might",
      "not sure",
      "hmm",
      "dunno",
    ];

    const paymentKeywords = ["pay", "paid", "payment", "complete", "done"];
    const cancelKeywords = ["cancel", "cancelled", "abort"];

    // Check for exact matches first
    if (["yes", "y", "1", "ok"].includes(text)) {
      return {
        approved: true,
        rejected: false,
        status: "approved",
        originalText: originalBody.trim(),
        confidence: "high",
      };
    }

    if (["no", "n", "0"].includes(text)) {
      return {
        approved: false,
        rejected: true,
        status: "rejected",
        originalText: originalBody.trim(),
        confidence: "high",
      };
    }

    // Check for payment confirmation
    if (paymentKeywords.some((keyword) => text.includes(keyword))) {
      return {
        approved: false,
        rejected: false,
        status: "payment_confirmed",
        originalText: originalBody.trim(),
        isPaymentConfirmation: true,
        confidence: "high",
      };
    }

    // Check for ambiguous responses
    if (ambiguousKeywords.some((keyword) => text.includes(keyword))) {
      return {
        approved: false,
        rejected: false,
        status: "unclear",
        originalText: originalBody.trim(),
        confidence: "low",
      };
    }

    // Check for rejection patterns
    const hasRejectionPhrase = rejectionPhrases.some((phrase) =>
      text.includes(phrase)
    );
    const hasRejectionWord = exactRejectionKeywords.some((keyword) => {
      if (["❌", "👎"].includes(keyword)) {
        return text.includes(keyword);
      }
      const wordPattern = new RegExp(
        `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
      );
      return wordPattern.test(text);
    });
    const rejected = hasRejectionPhrase || hasRejectionWord;

    // Check for approval patterns
    let approved = false;
    if (!hasRejectionPhrase) {
      const hasApprovalPhrase = approvalPhrases.some((phrase) =>
        text.includes(phrase)
      );
      const hasApprovalWord = exactApprovalKeywords.some((keyword) => {
        if (["✓", "👍"].includes(keyword)) {
          return text.includes(keyword);
        }
        const wordPattern = new RegExp(
          `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
        );
        return wordPattern.test(text);
      });
      approved = hasApprovalPhrase || hasApprovalWord;
    }

    // Handle cancellation
    const hasCancellation = cancelKeywords.some((keyword) =>
      text.includes(keyword)
    );

    if ((approved && hasCancellation) || (approved && rejected)) {
      return {
        approved: false,
        rejected: false,
        status: "unclear",
        originalText: originalBody.trim(),
        confidence: "low",
      };
    }

    if (hasCancellation && !approved) {
      return {
        approved: false,
        rejected: true,
        status: "cancelled",
        originalText: originalBody.trim(),
        confidence: "high",
      };
    }

    let status = "sent";
    let confidence = "medium";

    if (approved) {
      status = "approved";
    } else if (rejected) {
      status = "rejected";
    } else {
      status = "unclear";
      confidence = "low";
    }

    return {
      approved,
      rejected,
      status,
      originalText: originalBody.trim(),
      confidence,
      isPaymentConfirmation: false,
    };
  }

  async getPendingApprovals(emailAddress, eventTitle = null) {
    try {
      if (eventTitle) {
        // If we have an event title from the email subject, look for notifications for that specific event
        this.logger.debug(
          `Looking for notifications for specific event: "${eventTitle}"`
        );
        const allNotifications = await this.database.postgres.pool.query(
          `SELECT n.*, e.title as event_title, e.date as event_date, e.cost as event_cost
           FROM notifications n
           LEFT JOIN events e ON n.event_id = e.id  
           WHERE n.recipient = $1 
           AND n.notification_type = 'email'
           AND e.title = $2
           AND n.status IN ('sent', 'pending')
           ORDER BY n.created_at DESC
           LIMIT 1`,
          [emailAddress, eventTitle]
        );
        const notifications = allNotifications.rows;
        this.logger.debug(
          `Found ${notifications.length} notifications for event "${eventTitle}":`,
          notifications.map((n) => ({
            id: n.id,
            event_title: n.event_title,
            status: n.status,
            created_at: n.created_at,
          }))
        );
        return notifications;
      } else {
        // Fallback to the original 24-hour window logic
        const notifications = await this.database.getPendingNotifications(
          emailAddress,
          "email"
        );
        this.logger.debug(
          `Found ${notifications.length} pending notifications (24hr window) for ${emailAddress}:`,
          notifications.map((n) => ({
            id: n.id,
            event_title: n.event_title,
            status: n.status,
            created_at: n.created_at,
          }))
        );
        return notifications;
      }
    } catch (error) {
      this.logger.error(
        `Error getting pending approvals for ${emailAddress}:`,
        error.message
      );
      this.logger.error(`Error stack:`, error.stack);
      return [];
    }
  }

  async sendConfirmationEmail(emailAddress, confirmation) {
    try {
      const subject = this.buildConfirmationSubject(confirmation);
      const body = this.buildConfirmationBody(confirmation);

      const messageId = await this.gmailClient.sendEmail(
        [emailAddress],
        subject,
        body
      );
      this.logger.info(
        `Sent confirmation email to ${emailAddress}: ${confirmation.type}`
      );
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to send confirmation email:`, error.message);
      // Don't throw - confirmation failures shouldn't break the main flow
    }
  }

  buildConfirmationSubject(confirmation) {
    switch (confirmation.type) {
      case "approved":
        return `✅ Event Approved: ${confirmation.eventTitle}`;
      case "rejected":
        return `👍 Event Skipped: ${confirmation.eventTitle}`;
      case "payment_confirmed":
        return `💳 Payment Confirmed: ${confirmation.eventTitle}`;
      case "registration_completed":
        return `🎉 Registration Confirmed: ${confirmation.eventTitle}`;
      case "unclear":
        return `❓ Please clarify your response`;
      case "no_pending":
        return `🎉 No pending approvals`;
      case "error":
        return `❌ Error processing response`;
      default:
        return `🤖 Family Event Update`;
    }
  }

  buildConfirmationBody(confirmation) {
    const recipientName =
      config.app.nodeEnv === "production"
        ? config.family.parent1Name
        : config.family.parent2Name;

    let body = `Hi ${recipientName}!\n\n${confirmation.message}\n\n`;

    if (confirmation.type === "approved" && confirmation.eventCost === 0) {
      body += `I'll handle the registration automatically and send you a calendar invite once it's confirmed.\n\n`;
    } else if (confirmation.type === "approved" && confirmation.eventCost > 0) {
      body += `I'll send the payment details in a separate email.\n\n`;
    }

    body += `Best,\n`;
    body += `Your Family Event Assistant 🤖`;

    return body;
  }

  async sendPaymentLink(event, approvalId) {
    try {
      this.logger.info(`Sending payment link email for event: ${event.title}`);

      const recipient = this.getRecipientEmail();
      const subject = `💳 Payment Required: ${event.title}`;
      const emailBody = this.buildPaymentEmailBody(event);

      const messageId = await this.gmailClient.sendEmail(
        [recipient],
        subject,
        emailBody
      );

      this.logger.info(`Payment link email sent for ${event.title}`);

      return {
        messageId,
        message: emailBody,
        sentAt: new Date(),
        recipient,
      };
    } catch (error) {
      this.logger.error(
        `Error sending payment link email for ${event.title}:`,
        error.message
      );
      throw error;
    }
  }

  buildPaymentEmailBody(event) {
    const recipientName =
      config.app.nodeEnv === "production"
        ? config.family.parent1Name
        : config.family.parent2Name;

    let emailBody = `Hi ${recipientName}!\n\n`;
    emailBody += `Great news! You've approved "${event.title}" for the family.\n\n`;
    emailBody += `**Payment Details:**\n`;
    emailBody += `• Event: ${event.title}\n`;
    emailBody += `• Amount: $${event.cost}\n`;

    if (event.registrationUrl) {
      emailBody += `• Payment Link: ${event.registrationUrl}\n\n`;
    } else {
      emailBody += `\n`;
    }

    emailBody += `**Next Steps:**\n`;
    emailBody += `1. Click the payment link above to complete your registration\n`;
    emailBody += `2. Complete the payment process\n`;
    emailBody += `3. Reply to this email with "PAID" to confirm completion\n\n`;

    emailBody += `⚠️ **Important:** Please complete payment manually and reply "PAID" when done.\n\n`;
    emailBody += `If you've changed your mind, just reply "CANCEL" and I'll skip this event.\n\n`;

    emailBody += `Thanks!\n`;
    emailBody += `Your Family Event Assistant 🤖`;

    return emailBody;
  }
}

class EmailApprovalManager {
  constructor(logger, database, calendarManager = null, userId = null) {
    this.logger = logger;
    this.database = database;
    this.calendarManager = calendarManager;
    this.userId = userId; // User ID for multi-user support
    this.emailClient = new EmailNotificationClient(logger, database, userId);
    this.registrationOrchestrator = new RegistrationOrchestrator(
      logger,
      database,
      this.emailClient
    );
    this.dailyEventCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.calendarMonitor = null; // Will be set later if monitoring is available
  }

  async init() {
    await this.emailClient.init();
    await this.registrationOrchestrator.init();
  }

  async sendEventForApproval(event) {
    try {
      this.logger.info(
        `📧 EmailApprovalManager: Processing approval request for: ${event.title}`
      );

      // Check if we've already sent a recent email for this event (within 24 hours)
      const recentNotifications = await this.database.getPendingNotifications(
        this.emailClient.getRecipientEmail(),
        "email"
      );
      const existingForThisEvent = recentNotifications.find(
        (notification) => notification.event_id === event.id
      );
      if (existingForThisEvent) {
        this.logger.info(
          `⏭️ Skipping duplicate email for event: ${event.title} (recent notification exists: ${existingForThisEvent.id})`
        );
        return null;
      }

      const shouldSend = this.shouldSendEvent();
      this.logger.info(
        `🔍 Should send check: ${shouldSend} (dailyEventCount: ${this.dailyEventCount}/${config.discovery.eventsPerDayMax})`
      );

      if (!shouldSend) {
        this.logger.info(
          `⏭️ Daily event limit reached (${this.dailyEventCount}/${config.discovery.eventsPerDayMax}), queuing event: ${event.title}`
        );
        return null;
      }

      this.logger.info(
        `📤 Calling emailClient.sendApprovalRequest for: ${event.title}`
      );
      const result = await this.emailClient.sendApprovalRequest(event);
      this.logger.info(
        `✅ Email client returned result for: ${event.title}`,
        result
      );

      this.logger.info(
        `💾 Updating event status to 'proposed' for: ${event.title}`
      );
      await this.database.updateEventStatus(event.id, "proposed");

      this.incrementDailyCount();
      this.logger.info(
        `📊 Daily count incremented to: ${this.dailyEventCount}/${config.discovery.eventsPerDayMax}`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ EmailApprovalManager error sending event for approval: ${event.title}`,
        error.message
      );
      this.logger.error(`📍 Error stack:`, error.stack);
      this.logger.error(`📍 Full error object:`, error);
      throw error;
    }
  }

  shouldSendEvent() {
    this.resetDailyCountIfNeeded();
    return this.dailyEventCount < config.discovery.eventsPerDayMax;
  }

  resetDailyCountIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyEventCount = 0;
      this.lastResetDate = today;
      this.logger.debug("Reset daily event count for email notifications");
    }
  }

  incrementDailyCount() {
    this.dailyEventCount++;
    this.logger.debug(
      `Daily email event count: ${this.dailyEventCount}/${config.discovery.eventsPerDayMax}`
    );
  }

  async handleIncomingResponse(from, subject, body, messageId) {
    return await this.emailClient.handleIncomingEmail(
      from,
      subject,
      body,
      messageId
    );
  }

  async processApprovedEvent(eventId, approvalId) {
    try {
      const events = await this.database.getEventsByStatus("approved");
      const event = events.find((e) => e.id === eventId);

      if (!event) {
        throw new Error(`Approved event not found: ${eventId}`);
      }

      this.logger.info(
        `Processing approved event for manual registration: ${event.title}`
      );

      // Create placeholder calendar event immediately after "Yes" response
      const placeholderResult =
        await this.calendarManager.createPlaceholderEvent(event);

      // Update database with placeholder info
      await this.database.updateEventStatus(eventId, "approved_manual", {
        placeholder_calendar_id: placeholderResult.calendarEventId,
        manual_registration_pending: true,
        placeholder_created_at: new Date(),
      });

      // No confirmation email - placeholder created silently

      // Start monitoring for duplicate calendar events (if we have the monitoring service)
      if (this.calendarMonitor) {
        await this.calendarMonitor.scheduleEventMonitoring(
          eventId,
          event.date,
          placeholderResult.calendarEventId
        );
      }

      return {
        success: true,
        method: "manual",
        placeholderCreated: true,
        calendarEventId: placeholderResult.calendarEventId,
        requiresPayment: event.cost > 0,
      };
    } catch (error) {
      this.logger.error(
        `Error processing approved event ${eventId}:`,
        error.message
      );
      throw error;
    }
  }
}

module.exports = { EmailNotificationClient, EmailApprovalManager };
