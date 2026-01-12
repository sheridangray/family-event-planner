/**
 * Workout Reminder Notification Rule
 * Checks if a user has a routine scheduled for today but hasn't logged a workout yet.
 */

class WorkoutReminderRule {
  constructor(logger, database, exerciseService, notificationService) {
    this.logger = logger;
    this.database = database;
    this.exerciseService = exerciseService;
    this.notificationService = notificationService;
  }

  /**
   * Run the rule for all active users
   */
  async execute() {
    this.logger.info("🏃 [WorkoutReminderRule] Running workout reminder checks...");
    
    try {
      // 1. Get all active users
      const usersResult = await this.database.query(
        "SELECT id, name, email FROM users WHERE active = true"
      );
      const users = usersResult.rows;

      let notificationsTriggered = 0;

      for (const user of users) {
        try {
          // 2. Check if they have a routine scheduled for today
          const todayRoutine = await this.exerciseService.getTodayRoutine(user.id);
          
          if (!todayRoutine) {
            this.logger.debug(`[WorkoutReminderRule] User ${user.id} has no routine scheduled for today.`);
            continue;
          }

          // 3. Check if they have already logged a workout today
          const hasLogged = await this.exerciseService.hasLoggedToday(user.id);
          
          if (hasLogged) {
            this.logger.debug(`[WorkoutReminderRule] User ${user.id} has already logged a workout today.`);
            continue;
          }

          // 4. Trigger notification
          this.logger.info(`[WorkoutReminderRule] Triggering reminder for user ${user.id} (${user.name})`);
          
          await this.notificationService.sendNotification(user.id, {
            title: "Time to Work Out! 💪",
            body: `You have your "${todayRoutine.routine_name}" routine scheduled for today. Don't forget to log it!`,
            data: {
              type: "workout_reminder",
              routineId: todayRoutine.id,
              routineName: todayRoutine.routine_name
            }
          });

          notificationsTriggered++;
        } catch (userError) {
          this.logger.error(`[WorkoutReminderRule] Error checking user ${user.id}:`, userError.message);
        }
      }

      this.logger.info(`✅ [WorkoutReminderRule] Completed. Notifications triggered: ${notificationsTriggered}`);
      return notificationsTriggered;
    } catch (error) {
      this.logger.error("❌ [WorkoutReminderRule] Failed to execute rule:", error.message);
      throw error;
    }
  }
}

module.exports = WorkoutReminderRule;
