const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createOnboardingRouter(database, logger) {
  const router = express.Router();

  // Middleware to ensure user is authenticated
  router.use(authenticateMobileJWT);

  /**
   * GET /api/onboarding/state
   * Retrieve current onboarding progress for the authenticated user
   */
  router.get("/state", async (req, res) => {
    const userId = req.user.id;

    try {
      const sql = `
        SELECT current_step_id, steps_status, payload, is_complete, completed_at
        FROM onboarding_state
        WHERE user_id = $1
      `;
      const result = await database.query(sql, [userId]);

      if (result.rows.length === 0) {
        // Return default state if none exists
        return res.json({
          currentStepId: "welcome",
          stepsStatus: {},
          payload: {},
          isComplete: false,
          completedAt: null,
        });
      }

      const state = result.rows[0];
      res.json({
        currentStepId: state.current_step_id,
        stepsStatus: state.steps_status,
        payload: state.payload,
        isComplete: state.is_complete,
        completedAt: state.completed_at,
      });
    } catch (error) {
      logger.error(
        `Error fetching onboarding state for user ${userId}:`,
        error
      );
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch onboarding state" });
    }
  });

  /**
   * PATCH /api/onboarding/state
   * Update onboarding progress (current step, status, and data payload)
   */
  router.patch("/state", async (req, res) => {
    const userId = req.user.id;
    const { currentStepId, stepsStatus, payloadDelta } = req.body;

    try {
      // 1. Get existing state to merge payload
      const getSql = `SELECT payload FROM onboarding_state WHERE user_id = $1`;
      const getResult = await database.query(getSql, [userId]);

      let currentPayload = {};
      let insert = false;

      if (getResult.rows.length > 0) {
        currentPayload = getResult.rows[0].payload || {};
      } else {
        insert = true;
      }

      // Merge new payload data (deep merge not strictly required if client sends section chunks)
      // Simple spread merge for v1
      const newPayload = { ...currentPayload, ...(payloadDelta || {}) };

      if (insert) {
        const insertSql = `
          INSERT INTO onboarding_state (user_id, current_step_id, steps_status, payload)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        await database.query(insertSql, [
          userId,
          currentStepId || "welcome",
          stepsStatus || {},
          newPayload,
        ]);
      } else {
        // Build dynamic update query
        const updates = [];
        const params = [userId];
        let paramIdx = 2;

        if (currentStepId) {
          updates.push(`current_step_id = $${paramIdx++}`);
          params.push(currentStepId);
        }
        if (stepsStatus) {
          updates.push(`steps_status = $${paramIdx++}`);
          params.push(stepsStatus);
        }

        updates.push(`payload = $${paramIdx++}`);
        params.push(newPayload);

        const updateSql = `
          UPDATE onboarding_state 
          SET ${updates.join(", ")}, updated_at = NOW()
          WHERE user_id = $1
        `;
        await database.query(updateSql, params);
      }

      res.json({ success: true, message: "Onboarding state updated" });
    } catch (error) {
      logger.error(
        `Error updating onboarding state for user ${userId}:`,
        error
      );
      res
        .status(500)
        .json({ success: false, error: "Failed to update onboarding state" });
    }
  });

  /**
   * POST /api/onboarding/complete
   * Finalize onboarding, mark as complete, and trigger downstream setup (Households, etc.)
   */
  router.post("/complete", async (req, res) => {
    const userId = req.user.id;

    try {
      // 1. Mark onboarding as complete
      const completeSql = `
        UPDATE onboarding_state
        SET is_complete = true, completed_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
        RETURNING payload
      `;
      const result = await database.query(completeSql, [userId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "No onboarding state found" });
      }

      const payload = result.rows[0].payload;

      // 2. Create Household (if not exists)
      // Use "Family Name" from payload or fallback to "My Household"
      const familyName = payload.goals?.familyName || "My Household"; // Assuming payload structure

      // Check if user already owns a household
      const checkHousehold = `SELECT id FROM households WHERE created_by_user_id = $1`;
      const householdResult = await database.query(checkHousehold, [userId]);

      let householdId;
      if (householdResult.rows.length > 0) {
        householdId = householdResult.rows[0].id;
      } else {
        const createHousehold = `
          INSERT INTO households (name, created_by_user_id)
          VALUES ($1, $2)
          RETURNING id
        `;
        const newHousehold = await database.query(createHousehold, [
          familyName,
          userId,
        ]);
        householdId = newHousehold.rows[0].id;
      }

      // 3. Create/Update Profile for the user (Owner)
      // Check if profile exists
      const checkProfile = `SELECT id FROM profiles WHERE user_id = $1`;
      const profileResult = await database.query(checkProfile, [userId]);

      if (profileResult.rows.length === 0) {
        const createProfile = `
          INSERT INTO profiles (household_id, user_id, display_name, role, relationship_type, is_active)
          VALUES ($1, $2, $3, 'owner', 'self', true)
        `;
        // Use name from user table or payload
        // We'll fetch current user name for display_name default
        const userRes = await database.query(
          "SELECT name FROM users WHERE id = $1",
          [userId]
        );
        const userName = userRes.rows[0]?.name || "Me";

        await database.query(createProfile, [householdId, userId, userName]);
      }

      // 4. (Optional) Create profiles for other family members from payload
      // TODO: Parse payload.familyMembers and insert into profiles

      res.json({ success: true, message: "Onboarding completed successfully" });
    } catch (error) {
      logger.error(`Error completing onboarding for user ${userId}:`, error);
      res
        .status(500)
        .json({ success: false, error: "Failed to complete onboarding" });
    }
  });

  return router;
}

module.exports = createOnboardingRouter;
