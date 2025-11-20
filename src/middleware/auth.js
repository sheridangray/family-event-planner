const jwt = require("jsonwebtoken");

const authenticateAPI = (req, res, next) => {
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "API key required",
    });
  }

  // Normalize API keys by removing backslashes (frontend may escape $ characters)
  const normalizedApiKey = apiKey.replace(/\\/g, "");
  const normalizedExpectedKey = process.env.API_KEY.replace(/\\/g, "");

  if (normalizedApiKey !== normalizedExpectedKey) {
    return res.status(403).json({
      success: false,
      error: "Invalid API key",
    });
  }

  next();
};

/**
 * Authenticate mobile JWT tokens from iOS app
 * Extracts userId and attaches to req.user
 */
const authenticateMobileJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Bearer token required",
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const jwtSecret = process.env.JWT_SECRET || "family-planner-secret-key";

  try {
    const decoded = jwt.verify(token, jwtSecret);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      type: decoded.type,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired",
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};

/**
 * Flexible authentication - accepts either API key or JWT token
 * Used for endpoints that can be called from web (API key) or mobile (JWT)
 */
const authenticateFlexible = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  // Try JWT first (mobile)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticateMobileJWT(req, res, next);
  }

  // Fall back to API key (web)
  if (apiKey) {
    return authenticateAPI(req, res, next);
  }

  return res.status(401).json({
    success: false,
    error: "Authentication required (API key or Bearer token)",
  });
};

module.exports = {
  authenticateAPI,
  authenticateMobileJWT,
  authenticateFlexible,
};
