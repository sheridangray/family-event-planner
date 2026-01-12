/**
 * Modular Notification Service
 * Acts as a central dispatcher for different notification channels (Email, Push, etc.)
 */

class NotificationService {
  constructor(logger, database, providers = []) {
    this.logger = logger;
    this.database = database;
    this.providers = new Map();
    
    // Register initial providers
    providers.forEach(provider => this.registerProvider(provider));
  }

  /**
   * Register a notification provider (Email, Push, etc.)
   * @param {Object} provider - Provider instance
   */
  registerProvider(provider) {
    if (!provider.name) {
      throw new Error("Provider must have a name property");
    }
    this.providers.set(provider.name, provider);
    this.logger.info(`Registered notification provider: ${provider.name}`);
  }

  /**
   * Send a notification to a specific user via preferred or specified channels
   * @param {number} userId - User ID
   * @param {Object} notification - Notification content { title, body, data, templateId }
   * @param {Array} channels - Optional list of channels to use (e.g., ['push', 'email'])
   */
  async sendNotification(userId, notification, channels = null) {
    try {
      this.logger.info(`🔔 Dispatching notification to user ${userId}...`);
      
      // If no channels specified, we could look up user preferences in the future.
      // For now, default to all available providers that support the user.
      const activeChannels = channels || Array.from(this.providers.keys());
      const results = [];

      for (const channel of activeChannels) {
        const provider = this.providers.get(channel);
        if (!provider) {
          this.logger.warn(`Provider not found for channel: ${channel}`);
          continue;
        }

        try {
          const result = await provider.send(userId, notification);
          results.push({ channel, success: true, result });
        } catch (error) {
          this.logger.error(`Error sending notification via ${channel} to user ${userId}:`, error.message);
          results.push({ channel, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to dispatch notification to user ${userId}:`, error.message);
      throw error;
    }
  }
}

/**
 * Base class for notification providers
 */
class BaseNotificationProvider {
  constructor(name, logger, database) {
    this.name = name;
    this.logger = logger;
    this.database = database;
  }

  async send(userId, notification) {
    throw new Error("Provider.send() must be implemented");
  }
}

/**
 * Push Notification Provider
 */
class PushNotificationProvider extends BaseNotificationProvider {
  constructor(logger, database) {
    super("push", logger, database);
  }

  async send(userId, notification) {
    // 1. Look up push tokens for the user
    const tokensResult = await this.database.query(
      "SELECT device_token, platform FROM user_push_tokens WHERE user_id = $1",
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      this.logger.debug(`No push tokens found for user ${userId}`);
      return { sent: 0, reason: "no_tokens" };
    }

    // 2. Dispatch to APNs (iOS) or FCM (Android)
    // NOTE: This is where we would integrate with actual push services.
    // For this MVP, we'll log that we "would" send it.
    this.logger.info(`[PushProvider] Would send push to ${tokensResult.rows.length} devices for user ${userId}: "${notification.title}"`);
    
    // Future integration point:
    // await this._sendToAPNs(notification, tokensResult.rows.filter(r => r.platform === 'ios'));
    
    return { sent: tokensResult.rows.length };
  }
}

/**
 * Email Notification Provider
 * (Wrapper around existing EmailApprovalManager or similar)
 */
class EmailNotificationProvider extends BaseNotificationProvider {
  constructor(logger, database, unifiedNotifications) {
    super("email", logger, database);
    this.unifiedNotifications = unifiedNotifications;
  }

  async send(userId, notification) {
    this.logger.info(`[EmailProvider] Sending email to user ${userId}: "${notification.title}"`);
    
    // In this codebase, emails are currently handled by UnifiedNotificationService for approvals.
    // For generic notifications, we'll need a way to send plain emails.
    // For now, let's just log it.
    
    return { sent: 1 };
  }
}

module.exports = {
  NotificationService,
  BaseNotificationProvider,
  PushNotificationProvider,
  EmailNotificationProvider
};
