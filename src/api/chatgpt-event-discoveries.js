const express = require("express");
const router = express.Router();

// Middleware to validate API key for ChatGPT requests
function validateChatGPTApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.CHATGPT_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      success: false,
      error: "Server configuration error: API key not configured",
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing API key",
    });
  }

  next();
}

// Rate limiting tracker (simple in-memory implementation)
const rateLimitTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(req, res, next) {
  const identifier = req.ip || "unknown";
  const now = Date.now();

  if (!rateLimitTracker.has(identifier)) {
    rateLimitTracker.set(identifier, []);
  }

  const requests = rateLimitTracker.get(identifier);
  const recentRequests = requests.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
  );

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded. Maximum 5 requests per hour.",
    });
  }

  recentRequests.push(now);
  rateLimitTracker.set(identifier, recentRequests);

  next();
}

// POST /api/chatgpt-event-discoveries - Save a new discovery from ChatGPT
router.post("/", validateChatGPTApiKey, checkRateLimit, async (req, res) => {
  try {
    const { database, logger } = req.app.locals;

    // Validate required fields
    const { dateSearched, searchContext, events, metadata } = req.body;

    if (!dateSearched || !searchContext || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: dateSearched, searchContext, events (array)",
      });
    }

    // Extract target date from search context
    const targetDate = searchContext.targetDate;
    if (!targetDate) {
      return res.status(400).json({
        success: false,
        error: "Missing targetDate in searchContext",
      });
    }

    // Insert into database
    const query = `
      INSERT INTO chatgpt_event_discoveries 
        (date_searched, target_date, search_context, events, metadata)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;

    const values = [
      new Date(dateSearched),
      new Date(targetDate),
      JSON.stringify(searchContext),
      JSON.stringify(events),
      metadata ? JSON.stringify(metadata) : null,
    ];

    const result = await database.postgres.pool.query(query, values);
    const discovery = result.rows[0];

    if (logger) {
      logger.info(
        `ChatGPT event discovery saved: ID ${discovery.id}, ${events.length} events for ${targetDate}`
      );
    }

    res.status(201).json({
      success: true,
      message: "Event discovery saved successfully",
      discoveryId: discovery.id,
      eventsCount: events.length,
      createdAt: discovery.created_at,
    });
  } catch (error) {
    const { logger } = req.app.locals;
    if (logger) {
      logger.error("Error saving ChatGPT event discovery:", error);
    }
    res.status(500).json({
      success: false,
      error: "Failed to save event discovery",
    });
  }
});

// GET /api/chatgpt-event-discoveries - List all discoveries with pagination
router.get("/", async (req, res) => {
  try {
    const { database } = req.app.locals;

    const { limit = 10, offset = 0, targetDate = null } = req.query;

    let query = `
      SELECT 
        id,
        date_searched,
        target_date,
        search_context,
        events,
        metadata,
        interested_event_ranks,
        created_at
      FROM chatgpt_event_discoveries
    `;

    const values = [];
    let paramIndex = 1;

    if (targetDate) {
      query += ` WHERE target_date = $${paramIndex++}`;
      values.push(new Date(targetDate));
    }

    query += ` ORDER BY date_searched DESC, created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await database.postgres.pool.query(query, values);

    // Get total count
    let countQuery = "SELECT COUNT(*) FROM chatgpt_event_discoveries";
    if (targetDate) {
      countQuery += " WHERE target_date = $1";
    }
    const countResult = await database.postgres.pool.query(
      countQuery,
      targetDate ? [new Date(targetDate)] : []
    );
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      discoveries: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount,
      },
    });
  } catch (error) {
    const { logger } = req.app.locals;
    if (logger) {
      logger.error("Error fetching ChatGPT event discoveries:", error);
    }
    res.status(500).json({
      success: false,
      error: "Failed to fetch event discoveries",
    });
  }
});

// GET /api/chatgpt-event-discoveries/:id - Get a single discovery by ID
router.get("/:id", async (req, res) => {
  try {
    const { database } = req.app.locals;
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        date_searched,
        target_date,
        search_context,
        events,
        metadata,
        interested_event_ranks,
        created_at
      FROM chatgpt_event_discoveries
      WHERE id = $1
    `;

    const result = await database.postgres.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Discovery not found",
      });
    }

    res.json({
      success: true,
      discovery: result.rows[0],
    });
  } catch (error) {
    const { logger } = req.app.locals;
    if (logger) {
      logger.error("Error fetching ChatGPT event discovery:", error);
    }
    res.status(500).json({
      success: false,
      error: "Failed to fetch event discovery",
    });
  }
});

// PATCH /api/chatgpt-event-discoveries/:id/mark-interested - Mark specific events as interested
router.patch("/:id/mark-interested", async (req, res) => {
  try {
    const { database, logger } = req.app.locals;
    const { id } = req.params;
    const { eventRank } = req.body;

    if (typeof eventRank !== "number") {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid eventRank (must be a number)",
      });
    }

    // Get current interested ranks
    const selectQuery = `
      SELECT interested_event_ranks 
      FROM chatgpt_event_discoveries 
      WHERE id = $1
    `;
    const selectResult = await database.postgres.pool.query(selectQuery, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Discovery not found",
      });
    }

    let interestedRanks = selectResult.rows[0].interested_event_ranks || [];

    // Toggle the rank
    if (interestedRanks.includes(eventRank)) {
      interestedRanks = interestedRanks.filter((r) => r !== eventRank);
    } else {
      interestedRanks.push(eventRank);
    }

    // Update the database
    const updateQuery = `
      UPDATE chatgpt_event_discoveries 
      SET interested_event_ranks = $1
      WHERE id = $2
      RETURNING interested_event_ranks
    `;

    const updateResult = await database.postgres.pool.query(updateQuery, [
      interestedRanks,
      id,
    ]);

    if (logger) {
      logger.info(
        `Updated interested ranks for discovery ${id}: ${interestedRanks}`
      );
    }

    res.json({
      success: true,
      interestedRanks: updateResult.rows[0].interested_event_ranks,
    });
  } catch (error) {
    const { logger } = req.app.locals;
    if (logger) {
      logger.error("Error marking event as interested:", error);
    }
    res.status(500).json({
      success: false,
      error: "Failed to update interested status",
    });
  }
});

module.exports = router;
