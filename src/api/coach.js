const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createCoachRouter(database, logger) {
  const router = express.Router();

  router.use(authenticateMobileJWT);

  /**
   * GET /api/coach/briefing
   * Fetches the current context and top suggestions
   */
  router.get("/briefing", async (req, res) => {
    try {
      const userId = req.user.id;

      // 0. Fetch profile for enabled pillars
      const profileRes = await database.query(
        "SELECT enabled_pillars FROM profiles WHERE user_id = $1",
        [userId]
      );
      const enabledPillars = profileRes.rows[0]?.enabled_pillars || [];

      // 1. Fetch active suggestions
      const suggestionsRes = await database.query(
        "SELECT * FROM coach_suggestions WHERE user_id = $1 AND status = 'presented' ORDER BY created_at DESC LIMIT 3",
        [userId]
      );

      // 2. Fetch current plan
      const planRes = await database.query(
        "SELECT * FROM coach_plans WHERE user_id = $1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE",
        [userId]
      );

      res.json({
        success: true,
        briefing: {
          enabledPillars,
          suggestions: suggestionsRes.rows,
          currentPlan: planRes.rows[0] || null,
          greeting: "You're on track for your sleep goal today.", // Placeholder logic
        },
      });
    } catch (error) {
      logger.error("Error fetching coach briefing:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch coach briefing" });
    }
  });

  /**
   * POST /api/coach/calibrate
   * Update calibration settings
   */
  router.post("/calibrate", async (req, res) => {
    try {
      const userId = req.user.id;
      const { intent, availability, tonePreference, verbosity } = req.body;

      const sql = `
        INSERT INTO coach_calibration (user_id, intent, availability, tone_preference, verbosity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          intent = EXCLUDED.intent,
          availability = EXCLUDED.availability,
          tone_preference = EXCLUDED.tone_preference,
          verbosity = EXCLUDED.verbosity,
          updated_at = NOW()
        RETURNING *
      `;
      const result = await database.query(sql, [
        userId,
        JSON.stringify(intent || {}),
        JSON.stringify(availability || {}),
        tonePreference,
        verbosity,
      ]);

      res.json({ success: true, calibration: result.rows[0] });
    } catch (error) {
      logger.error("Error updating coach calibration:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update calibration" });
    }
  });

  /**
   * PATCH /api/coach/pillars
   * Update enabled pillars for the user
   */
  router.patch("/pillars", async (req, res) => {
    try {
      const userId = req.user.id;
      const { enabledPillars } = req.body;

      if (!Array.isArray(enabledPillars)) {
        return res
          .status(400)
          .json({ success: false, error: "enabledPillars must be an array" });
      }

      await database.query(
        "UPDATE profiles SET enabled_pillars = $1 WHERE user_id = $2",
        [enabledPillars, userId]
      );

      res.json({ success: true, message: "Enabled pillars updated" });
    } catch (error) {
      logger.error("Error updating enabled pillars:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update enabled pillars" });
    }
  });

  return router;
}

module.exports = createCoachRouter;
