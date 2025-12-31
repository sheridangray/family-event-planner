const express = require("express");
const { authenticateMobileJWT } = require("../middleware/auth");

function createMoneyRouter(database, logger) {
  const router = express.Router();

  router.use(authenticateMobileJWT);

  // --- Accounts ---

  /**
   * GET /api/money/accounts
   */
  router.get("/accounts", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      const result = await database.query(
        "SELECT * FROM financial_accounts WHERE household_id = $1 AND is_active = true",
        [householdId]
      );
      res.json({ success: true, accounts: result.rows });
    } catch (error) {
      logger.error("Error fetching accounts:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch accounts" });
    }
  });

  /**
   * GET /api/money/net-worth
   * Calculate current net worth based on account balances
   */
  router.get("/net-worth", async (req, res) => {
    try {
      const userId = req.user.id;
      const profileRes = await database.query(
        "SELECT household_id FROM profiles WHERE user_id = $1",
        [userId]
      );
      const householdId = profileRes.rows[0].household_id;

      const sql = `
        SELECT 
          SUM(CASE WHEN is_asset = true THEN balance ELSE 0 END) as total_assets,
          SUM(CASE WHEN is_asset = false THEN balance ELSE 0 END) as total_liabilities
        FROM financial_accounts
        WHERE household_id = $1 AND is_active = true
      `;
      const result = await database.query(sql, [householdId]);
      const { total_assets, total_liabilities } = result.rows[0];
      const netWorth =
        (parseFloat(total_assets) || 0) - (parseFloat(total_liabilities) || 0);

      res.json({
        success: true,
        netWorth,
        assets: parseFloat(total_assets) || 0,
        liabilities: parseFloat(total_liabilities) || 0,
      });
    } catch (error) {
      logger.error("Error calculating net worth:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to calculate net worth" });
    }
  });

  return router;
}

module.exports = createMoneyRouter;
