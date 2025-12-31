const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createTimeRouter(database, logger) {
  const router = express.Router();

  // All routes require authentication
  router.use(authenticateMobileJWT);

  // --- Tasks ---

  /**
   * GET /api/time/tasks
   * List tasks for the authenticated user
   */
  router.get("/tasks", async (req, res) => {
    try {
      const userId = req.user.id;
      // Get profile ID for the user
      const profileRes = await database.query(
        "SELECT id FROM profiles WHERE user_id = $1",
        [userId]
      );
      if (profileRes.rows.length === 0)
        return res.status(404).json({ error: "Profile not found" });
      const profileId = profileRes.rows[0].id;

      const sql = `
        SELECT * FROM tasks 
        WHERE owner_profile_id = $1 
        ORDER BY priority ASC, due_at ASC NULLS LAST
      `;
      const result = await database.query(sql, [profileId]);
      res.json({ success: true, tasks: result.rows });
    } catch (error) {
      logger.error("Error fetching tasks:", error);
      res.status(500).json({ success: false, error: "Failed to fetch tasks" });
    }
  });

  /**
   * POST /api/time/tasks
   * Create a new task
   */
  router.post("/tasks", async (req, res) => {
    try {
      const userId = req.user.id;
      const { title, notes, priority, dueAt, projectId, recurrenceRule, tags } =
        req.body;

      const profileRes = await database.query(
        "SELECT id, household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const { id: profileId, household_id: householdId } = profileRes.rows[0];

      const sql = `
        INSERT INTO tasks (
          household_id, owner_profile_id, project_id, title, notes, 
          priority, due_at, recurrence_rule, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const result = await database.query(sql, [
        householdId,
        profileId,
        projectId,
        title,
        notes,
        priority || 4,
        dueAt,
        recurrenceRule,
        tags,
      ]);

      res.json({ success: true, task: result.rows[0] });
    } catch (error) {
      logger.error("Error creating task:", error);
      res.status(500).json({ success: false, error: "Failed to create task" });
    }
  });

  // --- Projects ---

  /**
   * GET /api/time/projects
   */
  router.get("/projects", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const profileId = profileRes.rows[0].id;

      const sql = `SELECT * FROM projects WHERE owner_profile_id = $1 AND status = 'active'`;
      const result = await database.query(sql, [profileId]);
      res.json({ success: true, projects: result.rows });
    } catch (error) {
      logger.error("Error fetching projects:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch projects" });
    }
  });

  // --- Focus Blocks ---

  /**
   * GET /api/time/focus-blocks
   * Fetches internal events of type 'focus_block' with their details
   */
  router.get("/focus-blocks", async (req, res) => {
    try {
      const userId = req.user.id;
      // Note: events table doesn't have owner_profile_id yet, but we can join via household
      // For MVP, we'll just filter by household if possible, or just user_id if we add it
      // Adding household_id to events or joining via something else.
      // Existing events table uses 'id' (string) which might be an external ID.

      const sql = `
        SELECT e.*, fbd.* 
        FROM events e
        JOIN focus_block_details fbd ON e.id = fbd.event_id
        WHERE e.event_type = 'focus_block'
        ORDER BY e.date ASC
      `;
      const result = await database.query(sql);
      res.json({ success: true, focusBlocks: result.rows });
    } catch (error) {
      logger.error("Error fetching focus blocks:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch focus blocks" });
    }
  });

  /**
   * PATCH /api/time/tasks/:id
   */
  router.patch("/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, title, notes, priority, dueAt } = req.body;

      const updates = [];
      const params = [id];
      let idx = 2;

      if (status) {
        updates.push(`status = $${idx++}`);
        params.push(status);
      }
      if (title) {
        updates.push(`title = $${idx++}`);
        params.push(title);
      }
      if (notes) {
        updates.push(`notes = $${idx++}`);
        params.push(notes);
      }
      if (priority) {
        updates.push(`priority = $${idx++}`);
        params.push(priority);
      }
      if (dueAt) {
        updates.push(`due_at = $${idx++}`);
        params.push(dueAt);
      }

      if (updates.length === 0)
        return res.status(400).json({ error: "No fields to update" });

      const sql = `UPDATE tasks SET ${updates.join(
        ", "
      )}, updated_at = NOW() WHERE id = $1 RETURNING *`;
      const result = await database.query(sql, params);
      res.json({ success: true, task: result.rows[0] });
    } catch (error) {
      logger.error("Error updating task:", error);
      res.status(500).json({ success: false, error: "Failed to update task" });
    }
  });

  return router;
}

module.exports = createTimeRouter;
