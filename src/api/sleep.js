const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createSleepRouter(database, logger) {
  const router = express.Router();

  router.use(authenticateMobileJWT);

  /**
   * GET /api/sleep/sessions
   */
  router.get("/sessions", async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await database.query(
        "SELECT * FROM sleep_sessions WHERE user_id = $1 ORDER BY start_at DESC LIMIT 30",
        [userId]
      );
      res.json({ success: true, sessions: result.rows });
    } catch (error) {
      logger.error("Error fetching sleep sessions:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch sleep sessions" });
    }
  });

  /**
   * POST /api/sleep/sessions
   */
  router.post("/sessions", async (req, res) => {
    try {
      const userId = req.user.id;
      const { startAt, endAt, qualityRating, notes, tags, sessionType } =
        req.body;

      // Simple duration calc
      const start = new Date(startAt);
      const end = new Date(endAt);
      const durationMinutes = Math.floor((end - start) / 60000);

      const sql = `
        INSERT INTO sleep_sessions (
          user_id, start_at, end_at, duration_minutes, quality_rating, notes, tags, session_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await database.query(sql, [
        userId,
        startAt,
        endAt,
        durationMinutes,
        qualityRating,
        notes,
        tags,
        sessionType || "overnight",
      ]);

      res.json({ success: true, session: result.rows[0] });
    } catch (error) {
      logger.error("Error creating sleep session:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create sleep session" });
    }
  });

  return router;
}

module.exports = createSleepRouter;
