const express = require("express");
const { authenticateAPI } = require("../middleware/auth");

function createHealthRouter(database, logger) {
  const router = express.Router();
  const HealthSyncService = require("../services/health-sync");
  const healthService = new HealthSyncService(database, logger);

  /**
   * POST /api/health/sync
   * Sync health data from iOS shortcut or external source
   */
  router.post("/sync", authenticateAPI, async (req, res) => {
    try {
      const { userId, date, metrics, source } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required",
        });
      }

      // Validate user exists and is active
      const userCheck = await database.query(
        "SELECT id FROM users WHERE id = $1 AND active = true",
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found or inactive",
        });
      }

      const healthData = { date, ...metrics };
      const result = await healthService.syncHealthData(
        userId,
        healthData,
        source || "ios_shortcut"
      );

      res.json({
        success: true,
        message: "Health data synced successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error syncing health data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to sync health data",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/health/metrics/:userId
   * Get health metrics for a user
   */
  router.get("/metrics/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const metrics = await healthService.getHealthMetrics(
        parseInt(userId),
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error("Error fetching health metrics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch health metrics",
      });
    }
  });

  /**
   * GET /api/health/today/:userId
   * Get today's health summary with goals
   */
  router.get("/today/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const summary = await healthService.getTodaySummary(parseInt(userId));

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error("Error fetching today's summary:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch today's summary",
      });
    }
  });

  /**
   * GET /api/health/trends/:userId
   * Get weekly trend data
   */
  router.get("/trends/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const trends = await healthService.getWeeklyTrends(parseInt(userId));

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      logger.error("Error fetching trends:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch trends",
      });
    }
  });

  /**
   * GET /api/health/debug/:userId
   * Debug endpoint to see raw data
   */
  router.get("/debug/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await database.query(
        `SELECT id, email, name, active FROM users WHERE id = $1`,
        [userId]
      );
      
      // Get all health data for this user
      const metrics = await database.query(
        `SELECT * FROM health_physical_metrics WHERE user_id = $1 ORDER BY metric_date DESC LIMIT 10`,
        [userId]
      );
      
      const goals = await database.query(
        `SELECT * FROM health_goals WHERE user_id = $1`,
        [userId]
      );
      
      const profiles = await database.query(
        `SELECT * FROM health_profiles WHERE user_id = $1`,
        [userId]
      );
      
      const syncLogs = await database.query(
        `SELECT * FROM health_sync_logs WHERE user_id = $1 ORDER BY sync_date DESC LIMIT 5`,
        [userId]
      );

      res.json({
        success: true,
        userId: parseInt(userId),
        user: user.rows[0] || null,
        metrics: metrics.rows,
        goals: goals.rows,
        profiles: profiles.rows,
        syncLogs: syncLogs.rows,
        today: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      logger.error("Error in debug endpoint:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/health/sync-logs/:userId
   * Get sync history logs
   */
  router.get("/sync-logs/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await database.query(
        `SELECT * FROM health_sync_logs 
         WHERE user_id = $1 
         ORDER BY sync_date DESC 
         LIMIT 50`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error("Error fetching sync logs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch sync logs",
      });
    }
  });

  return router;
}

module.exports = createHealthRouter;
