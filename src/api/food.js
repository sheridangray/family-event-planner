const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createFoodRouter(database, logger) {
  const router = express.Router();

  router.use(authenticateMobileJWT);

  // --- Recipes ---

  /**
   * GET /api/food/recipes
   */
  router.get("/recipes", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      const result = await database.query(
        "SELECT * FROM recipes WHERE household_id = $1 ORDER BY created_at DESC",
        [householdId]
      );
      res.json({ success: true, recipes: result.rows });
    } catch (error) {
      logger.error("Error fetching recipes:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch recipes" });
    }
  });

  /**
   * POST /api/food/recipes
   */
  router.post("/recipes", async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        title,
        ingredients,
        steps,
        servingsDefault,
        mealTypes,
        cuisine,
        tags,
        imageUrl,
        sourceUrl,
      } = req.body;

      const profileRes = await database.query(
        "SELECT id, household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const { id: profileId, household_id: householdId } = profileRes.rows[0];

      const sql = `
        INSERT INTO recipes (
          household_id, owner_profile_id, title, ingredients, steps, 
          servings_default, meal_types, cuisine, tags, image_url, source_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const result = await database.query(sql, [
        householdId,
        profileId,
        title,
        JSON.stringify(ingredients || []),
        JSON.stringify(steps || []),
        servingsDefault || 2,
        mealTypes,
        cuisine,
        tags,
        imageUrl,
        sourceUrl,
      ]);

      res.json({ success: true, recipe: result.rows[0] });
    } catch (error) {
      logger.error("Error creating recipe:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create recipe" });
    }
  });

  // --- Meal Plans ---

  /**
   * GET /api/food/meal-plans/current
   */
  router.get("/meal-plans/current", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      // Get current week (Sunday)
      const now = new Date();
      const sunday = new Date(now.setDate(now.getDate() - now.getDay()));
      const dateString = sunday.toISOString().split("T")[0];

      const planRes = await database.query(
        "SELECT * FROM meal_plans WHERE household_id = $1 AND week_start_date = $2",
        [householdId, dateString]
      );

      if (planRes.rows.length === 0) {
        return res.json({ success: true, mealPlan: null });
      }

      const plan = planRes.rows[0];
      const mealsRes = await database.query(
        "SELECT pm.*, r.title as recipe_title FROM planned_meals pm LEFT JOIN recipes r ON pm.recipe_id = r.id WHERE pm.meal_plan_id = $1 ORDER BY pm.planned_date, pm.meal_type",
        [plan.id]
      );

      res.json({ success: true, mealPlan: { ...plan, meals: mealsRes.rows } });
    } catch (error) {
      logger.error("Error fetching current meal plan:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch meal plan" });
    }
  });

  return router;
}

module.exports = createFoodRouter;
