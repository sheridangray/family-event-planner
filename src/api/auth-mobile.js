const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

function createMobileAuthRouter(database, logger) {
  const router = express.Router();
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  /**
   * POST /api/auth/mobile-signin
   * Authenticate iOS app users with Google ID token
   */
  router.post("/mobile-signin", async (req, res) => {
    try {
      const { idToken, email, name, image } = req.body;

      if (!idToken || !email) {
        return res.status(400).json({
          success: false,
          error: "idToken and email are required",
        });
      }

      logger.info(`📱 Mobile sign-in attempt for: ${email}`);

      // Verify Google ID token
      // Accept tokens from both web and iOS clients
      let payload;
      try {
        const audiences = [process.env.GOOGLE_CLIENT_ID];

        // Add iOS client ID if configured
        if (process.env.GOOGLE_IOS_CLIENT_ID) {
          audiences.push(process.env.GOOGLE_IOS_CLIENT_ID);
          logger.info(`✅ Accepting tokens from both web and iOS clients`);
        } else {
          logger.warn(
            `⚠️  GOOGLE_IOS_CLIENT_ID not configured - only accepting web tokens`
          );
        }

        logger.info(
          `🔐 Verifying token against audiences: ${audiences.length} client ID(s)`
        );

        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: audiences,
        });
        payload = ticket.getPayload();
        logger.info(`✅ Token verified successfully for: ${payload.email}`);
      } catch (verifyError) {
        logger.error("❌ Token verification failed:", verifyError.message);
        logger.error("Error details:", {
          name: verifyError.name,
          message: verifyError.message,
          hasIOSClientID: !!process.env.GOOGLE_IOS_CLIENT_ID,
        });
        return res.status(401).json({
          success: false,
          error: "Invalid Google token",
          details: verifyError.message,
        });
      }

      // Check if email is in allowed list
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",") || [
        "joyce.yan.zhang@gmail.com",
        "sheridan.gray@gmail.com",
      ];

      if (!allowedEmails.includes(payload.email)) {
        logger.warn(`❌ Unauthorized mobile sign-in attempt: ${payload.email}`);
        return res.status(403).json({
          success: false,
          error: "Email not authorized for this app",
        });
      }

      // Get or create user in database
      let userResult = await database.query(
        "SELECT id, email, name, role, active FROM users WHERE email = $1",
        [payload.email]
      );

      let user;
      if (userResult.rows.length === 0) {
        // Create new user
        logger.info(`Creating new user for mobile: ${payload.email}`);
        const newUserResult = await database.query(
          `INSERT INTO users (email, name, role, active) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id, email, name, role, active`,
          [payload.email, name || payload.name, "user", true]
        );
        user = newUserResult.rows[0];
      } else {
        user = userResult.rows[0];

        // Update name if provided and different
        if (name && name !== user.name) {
          await database.query("UPDATE users SET name = $1 WHERE id = $2", [
            name,
            user.id,
          ]);
          user.name = name;
        }
      }

      // Generate JWT session token
      const jwtSecret = process.env.JWT_SECRET || "family-planner-secret-key";
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: "mobile",
        },
        jwtSecret,
        { expiresIn: "30d" }
      );

      logger.info(
        `✅ Mobile sign-in successful for: ${email} (ID: ${user.id})`
      );

      res.json({
        success: true,
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: image || null,
        },
      });
    } catch (error) {
      logger.error("Mobile authentication error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication failed",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/auth/mobile-verify
   * Verify a mobile JWT token (for testing)
   */
  router.get("/mobile-verify", async (req, res) => {
    try {
      const token =
        req.headers.authorization?.replace("Bearer ", "") || req.query.token;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Token required",
        });
      }

      const jwtSecret = process.env.JWT_SECRET || "family-planner-secret-key";
      const decoded = jwt.verify(token, jwtSecret);

      // Get user from database
      const userResult = await database.query(
        "SELECT id, email, name, active FROM users WHERE id = $1",
        [decoded.userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].active) {
        return res.status(404).json({
          success: false,
          error: "User not found or inactive",
        });
      }

      res.json({
        success: true,
        valid: true,
        user: userResult.rows[0],
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token expired",
        });
      }

      res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }
  });

  return router;
}

module.exports = createMobileAuthRouter;
