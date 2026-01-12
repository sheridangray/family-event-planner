const express = require("express");
const { authenticateFlexible } = require("../middleware/auth");

/**
 * Notifications API Router
 * Handles device token registration and notification settings
 */
function createNotificationsRouter(database, logger) {
  const router = express.Router();

  /**
   * POST /api/notifications/register-token
   * Register or update a device push token for the current user
   */
  router.post("/register-token", authenticateFlexible, async (req, res) => {
    try {
      const { deviceToken, platform } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (!deviceToken || !platform) {
        return res.status(400).json({
          success: false,
          error: "deviceToken and platform ('ios' or 'android') are required",
        });
      }

      // Upsert token
      const sql = `
        INSERT INTO user_push_tokens (user_id, device_token, platform, last_used_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, device_token)
        DO UPDATE SET last_used_at = NOW(), platform = EXCLUDED.platform
        RETURNING id
      `;

      await database.query(sql, [userId, deviceToken, platform]);

      logger.info(`📱 Registered ${platform} push token for user ${userId}`);

      res.json({
        success: true,
        message: "Device token registered successfully",
      });
    } catch (error) {
      logger.error("Error registering device token:", error);
      res.status(500).json({
        success: false,
        error: "Failed to register device token",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/notifications/unregister-token
   * Remove a device push token
   */
  router.delete("/unregister-token", authenticateFlexible, async (req, res) => {
    try {
      const { deviceToken } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (!deviceToken) {
        return res.status(400).json({
          success: false,
          error: "deviceToken is required",
        });
      }

      const sql = "DELETE FROM user_push_tokens WHERE user_id = $1 AND device_token = $2";
      const result = await database.query(sql, [userId, deviceToken]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Token not found for this user",
        });
      }

      logger.info(`📱 Unregistered push token for user ${userId}`);

      res.json({
        success: true,
        message: "Device token unregistered successfully",
      });
    } catch (error) {
      logger.error("Error unregistering device token:", error);
      res.status(500).json({
        success: false,
        error: "Failed to unregister device token",
        message: error.message,
      });
    }
  });

  return router;
}

module.exports = createNotificationsRouter;
