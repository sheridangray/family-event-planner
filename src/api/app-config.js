const express = require("express");

function createAppConfigRouter(database, logger) {
  const router = express.Router();

  /**
   * GET /api/app-config
   * Retrieve remote configuration for the mobile app
   */
  router.get("/", async (req, res) => {
    try {
      const sql = `SELECT key, value FROM app_config`;
      const result = await database.query(sql);

      const config = {};
      result.rows.forEach((row) => {
        config[row.key] = row.value;
      });

      res.json({
        success: true,
        config: {
          minSupportedVersion: String(config.min_supported_version || "1.0"),
          maintenanceMode: String(config.maintenance_mode) === "true",
          featureFlags:
            typeof config.feature_flags === "string"
              ? JSON.parse(config.feature_flags)
              : config.feature_flags || {},
          apiBaseUrl: process.env.API_BASE_URL || "",
        },
      });
    } catch (error) {
      logger.error("Error fetching app config:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch app configuration" });
    }
  });

  return router;
}

module.exports = createAppConfigRouter;
