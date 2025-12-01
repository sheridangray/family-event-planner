/**
 * Health Coach Service
 * Generates personalized health and fitness recommendations using LLM
 */

const HealthContextBuilder = require("./health-context-builder");
const LLMAgeEvaluator = require("./llm-age-evaluator");

class HealthCoachService {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.contextBuilder = new HealthContextBuilder(database, logger);

    // Initialize LLM client (reusing LLMAgeEvaluator's callTogetherAI method)
    try {
      this.llmClient = new LLMAgeEvaluator(logger);
    } catch (error) {
      this.logger.warn("LLM client not available:", error.message);
      this.llmClient = null;
    }

    // Cache for recommendations (6 hour TTL)
    this.recommendationCache = new Map();
  }

  /**
   * Generate health coach recommendations for a user
   * @param {number} userId - User ID
   * @param {Object} options - Options
   * @param {string} options.focusArea - Optional focus area ('activity', 'sleep', 'nutrition', 'overall')
   * @param {string} options.timeRange - 'week' or 'month' (default: 'month')
   * @returns {Promise<Object>} Recommendations
   */
  async generateRecommendations(userId, options = {}) {
    try {
      const { focusArea, timeRange = "month" } = options;

      // Check cache first
      const cacheKey = this._getCacheKey(userId, focusArea, timeRange);
      const cached = this.recommendationCache.get(cacheKey);
      if (cached && this._isCacheValid(cached)) {
        this.logger.debug(`Using cached recommendations for user ${userId}`);
        return cached.data;
      }

      this.logger.info(
        `Generating health coach recommendations for user ${userId}`
      );

      if (!this.llmClient) {
        throw new Error(
          "LLM client not available. TOGETHER_AI_API_KEY required."
        );
      }

      // Build context (includes exercise data)
      const context = await this.contextBuilder.buildContext(userId, {
        timeRange,
      });

      // Build prompt (exercise data is already in context)
      const prompt = this._buildRecommendationPrompt(context, focusArea);

      // Call LLM
      const startTime = Date.now();
      const llmResponse = await this.llmClient.callTogetherAI(prompt, {
        model: "Qwen/Qwen2.5-72B-Instruct-Turbo", // High-performance model for health recommendations
        max_tokens: 2000,
        temperature: 0.7,
        systemMessage: this._getSystemPrompt(),
      });
      const tokensUsed = this._estimateTokens(prompt + llmResponse);
      const latency = Date.now() - startTime;

      this.logger.info(
        `LLM response received (${latency}ms, ~${tokensUsed} tokens)`
      );

      // Parse response
      const recommendations = this._parseRecommendations(llmResponse, context);

      // Store in database
      const recommendationId = await this._storeRecommendation(
        userId,
        recommendations,
        context,
        "openai/gpt-oss-20b",
        tokensUsed,
        false // cache_hit
      );

      // Cache the result
      this.recommendationCache.set(cacheKey, {
        data: recommendations,
        timestamp: Date.now(),
        id: recommendationId,
      });

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error generating recommendations for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Build recommendation prompt
   */
  _buildRecommendationPrompt(context, focusArea) {
    const contextText = this.contextBuilder.formatContextForPrompt(context);

    let prompt = `${contextText}

Based on this health data, provide personalized health and fitness recommendations.`;

    if (focusArea) {
      const focusMap = {
        activity: "Focus on activity and exercise recommendations",
        sleep: "Focus on sleep quality and duration recommendations",
        nutrition: "Focus on nutrition and diet recommendations",
        overall: "Provide overall health recommendations",
      };
      prompt += ` ${focusMap[focusArea] || ""}`;
    }

    prompt += `

Please provide:
1. **2-3 Priority Areas** that need attention, with:
   - Current state description
   - Trend (improving/declining/stable)
   - Specific, actionable recommendation
   - 2-3 concrete action items
   - Realistic timeline for improvement

2. **Quick Wins** - 2-3 easy improvements that can be implemented immediately

3. **Encouragement** - A brief, positive message acknowledging progress

Format your response as JSON:
{
  "focusAreas": [
    {
      "metric": "steps",
      "priority": "high|medium|low",
      "currentState": "description",
      "trend": "improving|declining|stable",
      "recommendation": "specific recommendation",
      "actionItems": ["action 1", "action 2"],
      "targetTimeline": "e.g., 2-3 weeks"
    }
  ],
  "quickWins": ["win 1", "win 2"],
  "encouragement": "encouraging message"
}`;

    return prompt;
  }

  /**
   * Get system prompt for health coach
   */
  _getSystemPrompt() {
    return `You are a personalized health and fitness coach analyzing real health data. Your role is to:

1. Analyze health metrics and identify 2-3 priority areas for improvement
2. Provide specific, actionable recommendations based on actual data patterns
3. Celebrate wins and progress toward goals
4. Suggest realistic, incremental improvements

Guidelines:
- Base recommendations on actual data trends, not assumptions
- If data is incomplete, acknowledge limitations
- Focus on sustainable changes, not drastic overhauls
- Consider correlations between metrics (e.g., sleep quality and exercise)
- Provide specific targets and timelines
- Use encouraging, supportive language
- Be realistic about what can be achieved
- Prioritize health and safety`;
  }

  /**
   * Parse LLM response into structured recommendations
   */
  _parseRecommendations(llmResponse, context) {
    try {
      // Try to extract JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and structure
        return {
          focusAreas: (parsed.focusAreas || []).slice(0, 3).map((area) => ({
            metric: area.metric || "overall",
            priority: area.priority || "medium",
            currentState: area.currentState || "No data available",
            trend: area.trend || "stable",
            recommendation: area.recommendation || "Continue current routine",
            actionItems: Array.isArray(area.actionItems)
              ? area.actionItems.slice(0, 3)
              : [],
            targetTimeline: area.targetTimeline || "2-4 weeks",
          })),
          quickWins: Array.isArray(parsed.quickWins)
            ? parsed.quickWins.slice(0, 3)
            : [],
          encouragement: parsed.encouragement || "Keep up the great work!",
          nextReviewDate: this._getNextReviewDate(),
        };
      }

      // Fallback: parse from text
      return this._parseTextResponse(llmResponse, context);
    } catch (error) {
      this.logger.warn(
        "Error parsing JSON response, using fallback:",
        error.message
      );
      return this._parseTextResponse(llmResponse, context);
    }
  }

  /**
   * Fallback text parsing
   */
  _parseTextResponse(response, context) {
    const recommendations = {
      focusAreas: [],
      quickWins: [],
      encouragement: "Keep up the great work!",
      nextReviewDate: this._getNextReviewDate(),
    };

    // Extract focus areas (look for numbered lists or headers)
    const focusMatches = response.match(
      /(?:Priority|Focus|Area)[\s\S]{0,200}/gi
    );
    if (focusMatches) {
      focusMatches.slice(0, 3).forEach((match, index) => {
        recommendations.focusAreas.push({
          metric: "overall",
          priority: index === 0 ? "high" : "medium",
          currentState: "See recommendation",
          trend: "stable",
          recommendation: match.substring(0, 200),
          actionItems: [],
          targetTimeline: "2-4 weeks",
        });
      });
    }

    // Extract quick wins
    const quickWinMatches = response.match(
      /(?:Quick|Easy|Simple)[\s\S]{0,150}/gi
    );
    if (quickWinMatches) {
      recommendations.quickWins = quickWinMatches
        .slice(0, 3)
        .map((m) => m.substring(0, 150));
    }

    // Extract encouragement
    const encouragementMatch = response.match(
      /(?:Great|Good|Excellent|Keep|Continue)[\s\S]{0,100}/i
    );
    if (encouragementMatch) {
      recommendations.encouragement = encouragementMatch[0].substring(0, 200);
    }

    // If no focus areas found, create default based on context
    if (recommendations.focusAreas.length === 0) {
      const declining = context.trends.declining || [];
      if (declining.length > 0) {
        recommendations.focusAreas.push({
          metric: declining[0],
          priority: "high",
          currentState: "See trends",
          trend: "declining",
          recommendation: `Focus on improving ${declining[0]}`,
          actionItems: [
            `Set a daily goal for ${declining[0]}`,
            "Track progress daily",
          ],
          targetTimeline: "2-3 weeks",
        });
      }
    }

    return recommendations;
  }

  /**
   * Store recommendation in database
   */
  async _storeRecommendation(
    userId,
    recommendations,
    context,
    modelUsed,
    tokensUsed,
    cacheHit
  ) {
    try {
      const sql = `
        INSERT INTO health_coach_recommendations (
          user_id, focus_areas, recommendations, context_snapshot,
          model_used, tokens_used, cache_hit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const result = await this.database.query(sql, [
        userId,
        JSON.stringify(recommendations.focusAreas),
        JSON.stringify(recommendations),
        JSON.stringify(context),
        modelUsed,
        tokensUsed,
        cacheHit,
      ]);

      return result.rows[0].id;
    } catch (error) {
      this.logger.error("Error storing recommendation:", error);
      // Don't throw - this is not critical
      return null;
    }
  }

  /**
   * Send recommendation notification to user
   */
  async sendRecommendationNotification(
    userId,
    userEmail,
    userName,
    recommendations
  ) {
    try {
      const { EmailApprovalManager } = require("../mcp/email-notifications");
      const emailManager = new EmailApprovalManager(
        this.logger,
        this.database,
        null, // calendarManager not needed
        userId
      );
      await emailManager.init();

      const subject = `Your Weekly Health Coach Recommendations - ${new Date().toLocaleDateString()}`;
      const emailBody = this._buildRecommendationEmailBody(
        userName,
        recommendations
      );

      // Use GmailClient directly to send email
      const GmailClient = require("../mcp/gmail-client");
      const gmailClient = new GmailClient(this.logger, this.database);

      const result = await gmailClient.sendEmail(
        userId,
        userEmail,
        subject,
        emailBody,
        { isHtml: true }
      );

      // Save notification to database
      await this.database.saveNotification(
        null, // event_id (not applicable)
        "email",
        userEmail,
        subject,
        emailBody,
        result.messageId
      );

      // Update recommendation record
      await this._markNotificationSent(userId);

      this.logger.info(`Health coach notification sent to ${userEmail}`);
      return result;
    } catch (error) {
      this.logger.error("Error sending health coach notification:", error);
      throw error;
    }
  }

  /**
   * Build HTML email body
   */
  _buildRecommendationEmailBody(userName, recommendations) {
    let html = `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e67e22;">Hi ${userName}! 👋</h2>
          <p>Here are your personalized health and fitness recommendations for this week:</p>
    `;

    // Add focus areas
    if (recommendations.focusAreas && recommendations.focusAreas.length > 0) {
      html += `<h3 style="color: #2c3e50; margin-top: 30px;">🎯 Priority Areas</h3>`;
      recommendations.focusAreas.forEach((area, index) => {
        html += `
          <div style="background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid ${this._getPriorityColor(
            area.priority
          )};">
            <h4 style="margin-top: 0; color: #2c3e50;">${
              index + 1
            }. ${this._formatMetricName(area.metric)}</h4>
            <p><strong>Current State:</strong> ${area.currentState}</p>
            <p><strong>Trend:</strong> ${this._formatTrend(area.trend)}</p>
            <p><strong>Recommendation:</strong> ${area.recommendation}</p>
            ${
              area.actionItems && area.actionItems.length > 0
                ? `
              <ul>
                ${area.actionItems.map((item) => `<li>${item}</li>`).join("")}
              </ul>
            `
                : ""
            }
            <p style="color: #7f8c8d; font-size: 14px;"><em>Target timeline: ${
              area.targetTimeline
            }</em></p>
          </div>
        `;
      });
    }

    // Add quick wins
    if (recommendations.quickWins && recommendations.quickWins.length > 0) {
      html += `<h3 style="color: #27ae60; margin-top: 30px;">⚡ Quick Wins</h3><ul>`;
      recommendations.quickWins.forEach((win) => {
        html += `<li>${win}</li>`;
      });
      html += `</ul>`;
    }

    // Add encouragement
    if (recommendations.encouragement) {
      html += `
        <div style="background: #e8f5e9; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0;"><strong>💪 Keep it up!</strong></p>
          <p style="margin: 10px 0 0 0;">${recommendations.encouragement}</p>
        </div>
      `;
    }

    html += `
          <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px;">
            View more details in the Family Event Planner app!
          </p>
          <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
            Next review: ${recommendations.nextReviewDate}
          </p>
        </body>
      </html>
    `;

    return html;
  }

  /**
   * Helper methods
   */
  _getPriorityColor(priority) {
    const colors = {
      high: "#e74c3c",
      medium: "#f39c12",
      low: "#3498db",
    };
    return colors[priority] || "#95a5a6";
  }

  _formatMetricName(metric) {
    const names = {
      steps: "Daily Steps",
      exercise_minutes: "Exercise Minutes",
      sleep_hours: "Sleep Hours",
      resting_heart_rate: "Resting Heart Rate",
      weight_lbs: "Weight",
      active_calories: "Active Calories",
      distance_miles: "Distance",
      overall: "Overall Health",
    };
    return (
      names[metric] ||
      metric.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  _formatTrend(trend) {
    const emojis = {
      improving: "📈 Improving",
      declining: "📉 Declining",
      stable: "➡️ Stable",
    };
    return emojis[trend] || trend;
  }

  _getCacheKey(userId, focusArea, timeRange) {
    const today = new Date().toISOString().split("T")[0];
    return `health_coach_${userId}_${
      focusArea || "overall"
    }_${timeRange}_${today}`;
  }

  _isCacheValid(cached) {
    const sixHours = 6 * 60 * 60 * 1000;
    return Date.now() - cached.timestamp < sixHours;
  }

  _getNextReviewDate() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  _estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  async _markNotificationSent(userId) {
    try {
      const sql = `
        UPDATE health_coach_recommendations
        SET notification_sent = true, notification_sent_at = NOW()
        WHERE user_id = $1
          AND id = (SELECT id FROM health_coach_recommendations WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1)
      `;
      await this.database.query(sql, [userId]);
    } catch (error) {
      this.logger.error("Error marking notification as sent:", error);
    }
  }
}

module.exports = HealthCoachService;
