const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createRelationshipsRouter(database, logger) {
  const router = express.Router();

  router.use(authenticateMobileJWT);

  // --- People ---

  /**
   * GET /api/relationships/people
   */
  router.get("/people", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      const sql = `
        SELECT p.*, rp.importance, rp.preferences, rp.important_dates, rp.notes, 
               rp.last_interaction_at, rp.next_moment_at
        FROM profiles p
        LEFT JOIN relationship_people rp ON p.id = rp.profile_id
        WHERE p.household_id = $1 AND p.is_active = true
        ORDER BY p.role ASC, p.display_name ASC
      `;
      const result = await database.query(sql, [householdId]);
      res.json({ success: true, people: result.rows });
    } catch (error) {
      logger.error("Error fetching people:", error);
      res.status(500).json({ success: false, error: "Failed to fetch people" });
    }
  });

  // --- Rituals ---

  /**
   * GET /api/relationships/rituals
   */
  router.get("/rituals", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      const result = await database.query(
        "SELECT * FROM rituals WHERE household_id = $1 AND is_active = true",
        [householdId]
      );
      res.json({ success: true, rituals: result.rows });
    } catch (error) {
      logger.error("Error fetching rituals:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch rituals" });
    }
  });

  // --- Memories ---

  /**
   * POST /api/relationships/memories
   */
  router.post("/memories", async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        title,
        note,
        photoUrls,
        targetProfileIds,
        occurredAt,
        tags,
        sentiment,
      } = req.body;

      const profileRes = await database.query(
        "SELECT id, household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const { id: profileId, household_id: householdId } = profileRes.rows[0];

      const sql = `
        INSERT INTO memories (
          household_id, owner_profile_id, title, note, photo_urls, 
          target_profile_ids, occurred_at, tags, sentiment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const result = await database.query(sql, [
        householdId,
        profileId,
        title,
        note,
        photoUrls,
        targetProfileIds,
        occurredAt,
        tags,
        sentiment,
      ]);

      res.json({ success: true, memory: result.rows[0] });
    } catch (error) {
      logger.error("Error creating memory:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create memory" });
    }
  });

  return router;
}

module.exports = createRelationshipsRouter;
