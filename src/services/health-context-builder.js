/**
 * Health Context Builder
 * Aggregates and structures health data for LLM context construction
 */

class HealthContextBuilder {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Build comprehensive health context for a user
   * @param {number} userId - User ID
   * @param {Object} options - Options for context building
   * @param {string} options.timeRange - 'week' or 'month' (default: 'month')
   * @returns {Promise<Object>} Structured health context
   */
  async buildContext(userId, options = {}) {
    try {
      const { timeRange = "month" } = options;
      const days = timeRange === "week" ? 7 : 30;

      this.logger.info(
        `Building health context for user ${userId} (${timeRange})`
      );

      // Get all required data in parallel
      const [metrics, goals, trends, user] = await Promise.all([
        this._getRecentMetrics(userId, days),
        this._getActiveGoals(userId),
        this._calculateTrends(userId, days),
        this._getUserInfo(userId),
      ]);

      // Calculate insights
      const insights = this._calculateInsights(metrics, trends);

      // Determine data quality
      const dataQuality = this._assessDataQuality(metrics);

      const context = {
        userProfile: {
          userId,
          userName: user?.name || "User",
          dataQuality,
          dataSpan: days,
          daysWithData: metrics.length,
        },
        currentState: {
          today: this._getTodayMetrics(metrics),
          thisWeek: this._getWeeklyAverages(metrics, 7),
          thisMonth: this._getWeeklyAverages(metrics, days),
        },
        trends: {
          improving: trends.improving || [],
          declining: trends.declining || [],
          stable: trends.stable || [],
        },
        goals: {
          active: this._formatGoals(goals, metrics),
          achievements: this._getRecentAchievements(goals, metrics),
        },
        insights: {
          correlations: insights.correlations || [],
          patterns: insights.patterns || [],
          anomalies: insights.anomalies || [],
        },
      };

      this.logger.debug(`Health context built: ${metrics.length} days of data`);
      return context;
    } catch (error) {
      this.logger.error(
        `Error building health context for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get recent health metrics
   */
  async _getRecentMetrics(userId, days) {
    const sql = `
      SELECT * FROM health_physical_metrics
      WHERE user_id = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY metric_date DESC
    `;
    const result = await this.database.query(sql, [userId]);
    return result.rows;
  }

  /**
   * Get active health goals
   */
  async _getActiveGoals(userId) {
    const sql = `
      SELECT * FROM health_goals
      WHERE user_id = $1 AND active = true
      ORDER BY goal_type
    `;
    const result = await this.database.query(sql, [userId]);
    return result.rows;
  }

  /**
   * Get user information
   */
  async _getUserInfo(userId) {
    return await this.database.getUserById(userId);
  }

  /**
   * Calculate trends for key metrics
   */
  async _calculateTrends(userId, days) {
    const sql = `
      SELECT 
        metric_date,
        steps,
        exercise_minutes,
        sleep_hours,
        resting_heart_rate,
        weight_lbs,
        active_calories
      FROM health_physical_metrics
      WHERE user_id = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY metric_date ASC
    `;
    const result = await this.database.query(sql, [userId]);
    const metrics = result.rows;

    if (metrics.length < 2) {
      return { improving: [], declining: [], stable: [] };
    }

    // Split into first half and second half
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const trends = {
      improving: [],
      declining: [],
      stable: [],
    };

    // Key metrics to track
    const metricKeys = [
      "steps",
      "exercise_minutes",
      "sleep_hours",
      "resting_heart_rate",
      "active_calories",
    ];

    metricKeys.forEach((key) => {
      const firstAvg = this._average(firstHalf, key);
      const secondAvg = this._average(secondHalf, key);

      if (firstAvg === null || secondAvg === null) return;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;

      // For resting_heart_rate, lower is better
      if (key === "resting_heart_rate") {
        if (change < -5) trends.improving.push(key);
        else if (change > 5) trends.declining.push(key);
        else trends.stable.push(key);
      } else {
        // For other metrics, higher is better
        if (change > 5) trends.improving.push(key);
        else if (change < -5) trends.declining.push(key);
        else trends.stable.push(key);
      }
    });

    return trends;
  }

  /**
   * Calculate average for a metric
   */
  _average(metrics, key) {
    const values = metrics
      .map((m) => m[key])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + parseFloat(v), 0) / values.length;
  }

  /**
   * Get today's metrics
   */
  _getTodayMetrics(metrics) {
    const today = new Date().toISOString().split("T")[0];
    return (
      metrics.find(
        (m) => m.metric_date.toISOString().split("T")[0] === today
      ) || {}
    );
  }

  /**
   * Get weekly averages
   */
  _getWeeklyAverages(metrics, days) {
    const recent = metrics.slice(0, days);
    const averages = {};

    const metricKeys = [
      "steps",
      "exercise_minutes",
      "sleep_hours",
      "resting_heart_rate",
      "active_calories",
      "distance_miles",
      "weight_lbs",
    ];

    metricKeys.forEach((key) => {
      const values = recent
        .map((m) => m[key])
        .filter((v) => v !== null && v !== undefined)
        .map((v) => parseFloat(v));

      if (values.length > 0) {
        averages[key] = Math.round(
          values.reduce((sum, v) => sum + v, 0) / values.length
        );
      }
    });

    return averages;
  }

  /**
   * Format goals with progress
   */
  _formatGoals(goals, metrics) {
    const today = this._getTodayMetrics(metrics);
    const thisWeek = this._getWeeklyAverages(metrics, 7);

    return goals.map((goal) => {
      const currentValue =
        today[goal.goal_type] || thisWeek[goal.goal_type] || 0;
      const percentage = Math.min(
        100,
        Math.round((currentValue / goal.target_value) * 100)
      );

      return {
        type: goal.goal_type,
        target: goal.target_value,
        current: currentValue,
        percentage,
        achieved: currentValue >= goal.target_value,
      };
    });
  }

  /**
   * Get recently achieved goals
   */
  _getRecentAchievements(goals, metrics) {
    const recent = metrics.slice(0, 7); // Last 7 days
    const achievements = [];

    goals.forEach((goal) => {
      const recentValues = recent
        .map((m) => m[goal.goal_type])
        .filter((v) => v !== null && v !== undefined);

      const achievedCount = recentValues.filter(
        (v) => v >= goal.target_value
      ).length;

      if (achievedCount >= 3) {
        // Achieved at least 3 out of 7 days
        achievements.push({
          type: goal.goal_type,
          target: goal.target_value,
          daysAchieved: achievedCount,
        });
      }
    });

    return achievements;
  }

  /**
   * Calculate insights (correlations, patterns, anomalies)
   */
  _calculateInsights(metrics, trends) {
    const insights = {
      correlations: [],
      patterns: [],
      anomalies: [],
    };

    if (metrics.length < 7) {
      return insights;
    }

    // Simple correlation: better sleep -> more steps next day
    const sleepStepCorrelation = this._checkCorrelation(
      metrics,
      "sleep_hours",
      "steps",
      1
    );
    if (sleepStepCorrelation > 0.3) {
      insights.correlations.push(
        `Better sleep (7.5+ hours) correlates with ${Math.round(
          sleepStepCorrelation * 100
        )}% more steps the next day`
      );
    }

    // Pattern: Weekend vs weekday activity
    const weekendActivity = this._compareWeekendWeekday(metrics, "steps");
    if (weekendActivity.difference > 20) {
      insights.patterns.push(
        `Weekend activity is ${Math.round(
          weekendActivity.difference
        )}% higher than weekdays`
      );
    }

    // Anomaly detection: unusually low sleep
    const lowSleepDays = metrics.filter(
      (m) => m.sleep_hours && m.sleep_hours < 6
    ).length;
    if (lowSleepDays > 0) {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const lowSleepDayOfWeek = this._findMostCommonDayOfWeek(
        metrics.filter((m) => m.sleep_hours && m.sleep_hours < 6)
      );
      if (lowSleepDayOfWeek) {
        insights.anomalies.push(
          `Unusually low sleep (<6 hours) most common on ${dayNames[lowSleepDayOfWeek]}s`
        );
      }
    }

    return insights;
  }

  /**
   * Check correlation between two metrics (lagged)
   */
  _checkCorrelation(metrics, metric1, metric2, lag = 0) {
    const pairs = [];
    for (let i = lag; i < metrics.length; i++) {
      const val1 = metrics[i - lag][metric1];
      const val2 = metrics[i][metric2];
      if (
        val1 !== null &&
        val2 !== null &&
        val1 !== undefined &&
        val2 !== undefined
      ) {
        pairs.push({ x: parseFloat(val1), y: parseFloat(val2) });
      }
    }

    if (pairs.length < 3) return 0;

    const avgX = pairs.reduce((sum, p) => sum + p.x, 0) / pairs.length;
    const avgY = pairs.reduce((sum, p) => sum + p.y, 0) / pairs.length;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    pairs.forEach((p) => {
      const dx = p.x - avgX;
      const dy = p.y - avgY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    });

    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }

  /**
   * Compare weekend vs weekday activity
   */
  _compareWeekendWeekday(metrics, metricKey) {
    const weekend = [];
    const weekday = [];

    metrics.forEach((m) => {
      const date = new Date(m.metric_date);
      const dayOfWeek = date.getDay();
      const value = m[metricKey];

      if (value !== null && value !== undefined) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekend.push(parseFloat(value));
        } else {
          weekday.push(parseFloat(value));
        }
      }
    });

    const weekendAvg =
      weekend.length > 0
        ? weekend.reduce((sum, v) => sum + v, 0) / weekend.length
        : 0;
    const weekdayAvg =
      weekday.length > 0
        ? weekday.reduce((sum, v) => sum + v, 0) / weekday.length
        : 0;

    const difference =
      weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0;

    return { weekendAvg, weekdayAvg, difference };
  }

  /**
   * Find most common day of week in metrics
   */
  _findMostCommonDayOfWeek(metrics) {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    metrics.forEach((m) => {
      const date = new Date(m.metric_date);
      dayCounts[date.getDay()]++;
    });

    const maxCount = Math.max(...dayCounts);
    if (maxCount === 0) return null;

    return dayCounts.indexOf(maxCount);
  }

  /**
   * Assess data quality
   */
  _assessDataQuality(metrics) {
    if (metrics.length === 0) return "none";

    const daysWithData = metrics.filter((m) => {
      // Consider a day to have data if at least one key metric is present
      return (
        m.steps !== null ||
        m.exercise_minutes !== null ||
        m.sleep_hours !== null
      );
    }).length;

    const completeness = daysWithData / metrics.length;

    if (completeness >= 0.8) return "high";
    if (completeness >= 0.5) return "medium";
    return "low";
  }

  /**
   * Format context as text for LLM prompt
   */
  formatContextForPrompt(context) {
    let text = `USER HEALTH PROFILE
Data Quality: ${
      context.userProfile.dataQuality.charAt(0).toUpperCase() +
      context.userProfile.dataQuality.slice(1)
    } (${context.userProfile.daysWithData} days of data)
Analysis Period: Last ${context.userProfile.dataSpan} days

CURRENT STATE (This Week):
`;

    const week = context.currentState.thisWeek;
    if (week.steps) text += `- Steps: ${week.steps.toLocaleString()}/day avg`;
    if (context.goals.active.find((g) => g.type === "steps")) {
      const goal = context.goals.active.find((g) => g.type === "steps");
      text += ` (Goal: ${goal.target.toLocaleString()}) - ${
        goal.percentage
      }% of goal`;
    }
    text += "\n";

    if (week.exercise_minutes)
      text += `- Exercise: ${week.exercise_minutes} min/day avg`;
    if (context.goals.active.find((g) => g.type === "exercise_minutes")) {
      const goal = context.goals.active.find(
        (g) => g.type === "exercise_minutes"
      );
      text += ` (Goal: ${goal.target} min) - ${goal.percentage}% of goal`;
    }
    text += "\n";

    if (week.sleep_hours)
      text += `- Sleep: ${week.sleep_hours.toFixed(1)} hours/day avg`;
    if (context.goals.active.find((g) => g.type === "sleep_hours")) {
      const goal = context.goals.active.find((g) => g.type === "sleep_hours");
      text += ` (Goal: ${goal.target} hours) - ${goal.percentage}% of goal`;
    }
    text += "\n";

    if (week.resting_heart_rate) {
      text += `- Resting HR: ${week.resting_heart_rate} bpm`;
      if (week.resting_heart_rate < 60) text += " (excellent)";
      else if (week.resting_heart_rate < 70) text += " (good)";
      text += "\n";
    }

    text += "\nTRENDS:\n";
    if (context.trends.improving.length > 0) {
      text += `- Improving: ${context.trends.improving
        .map((m) => this._formatMetricName(m))
        .join(", ")}\n`;
    }
    if (context.trends.declining.length > 0) {
      text += `- Declining: ${context.trends.declining
        .map((m) => this._formatMetricName(m))
        .join(", ")}\n`;
    }
    if (context.trends.stable.length > 0) {
      text += `- Stable: ${context.trends.stable
        .map((m) => this._formatMetricName(m))
        .join(", ")}\n`;
    }

    text += "\nGOALS:\n";
    context.goals.active.forEach((goal) => {
      text += `- ${this._formatMetricName(goal.type)}: ${
        goal.percentage
      }% progress`;
      if (goal.achieved) text += " ✅";
      text += "\n";
    });

    if (context.insights.correlations.length > 0) {
      text += "\nINSIGHTS:\n";
      context.insights.correlations.forEach((insight) => {
        text += `- ${insight}\n`;
      });
    }

    if (context.insights.patterns.length > 0) {
      context.insights.patterns.forEach((pattern) => {
        text += `- ${pattern}\n`;
      });
    }

    if (context.insights.anomalies.length > 0) {
      context.insights.anomalies.forEach((anomaly) => {
        text += `- ${anomaly}\n`;
      });
    }

    return text;
  }

  /**
   * Format metric name for display
   */
  _formatMetricName(metric) {
    const names = {
      steps: "Steps",
      exercise_minutes: "Exercise Minutes",
      sleep_hours: "Sleep Hours",
      resting_heart_rate: "Resting Heart Rate",
      weight_lbs: "Weight",
      active_calories: "Active Calories",
      distance_miles: "Distance",
    };
    return (
      names[metric] ||
      metric.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }
}

module.exports = HealthContextBuilder;
