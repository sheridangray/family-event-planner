import Foundation

/// Notification rule for exercise reminders (8:30 PM on weekdays)
class ExerciseReminderNotificationRule: BaseNotificationRule {
    let getTodayRoutine: () -> ExerciseRoutine? // Closure to get today's routine
    let hasLoggedToday: (Int?) async -> Bool // Closure to check if logged today
    
    init(
        checkHour: Int = 20, // 8 PM
        checkMinute: Int = 30, // 8:30 PM
        isEnabled: Bool = true,
        getTodayRoutine: @escaping () -> ExerciseRoutine?,
        hasLoggedToday: @escaping (Int?) async -> Bool
    ) {
        self.getTodayRoutine = getTodayRoutine
        self.hasLoggedToday = hasLoggedToday
        
        super.init(
            identifier: "exerciseReminder",
            name: "Exercise Reminder",
            hour: checkHour,
            minute: checkMinute,
            isEnabled: isEnabled,
            weekdaysOnly: true // Only weekdays (Monday-Friday)
        )
    }
    
    override func checkCondition() async -> (shouldNotify: Bool, message: String?) {
        guard isEnabled else {
            return (false, nil)
        }
        
        // Check if today is a weekday
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        // weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
        // We want Monday (2) through Friday (6)
        guard weekday >= 2 && weekday <= 6 else {
            return (false, nil) // Not a weekday
        }
        
        // Get today's routine
        guard let routine = getTodayRoutine() else {
            return (false, nil) // No routine for today
        }
        
        // Check if already logged today
        let logged = await hasLoggedToday(routine.id)
        if logged {
            return (false, nil) // Already logged
        }
        
        // Build exercise list for notification
        let exerciseList = routine.exercises.prefix(3).map { $0.exerciseName }.joined(separator: ", ")
        let moreExercises = routine.exercises.count > 3 ? " + \(routine.exercises.count - 3) more" : ""
        
        let message = "Time for your \(routine.routineName) workout! Today: \(exerciseList)\(moreExercises)"
        return (true, message)
    }
    
    override func getTitle() -> String {
        return "Time to Work Out! 💪"
    }
    
    override func getBody() -> String {
        guard let routine = getTodayRoutine() else {
            return "Ready for your workout today?"
        }
        
        let exerciseList = routine.exercises.prefix(3).map { $0.exerciseName }.joined(separator: ", ")
        let moreExercises = routine.exercises.count > 3 ? " + \(routine.exercises.count - 3) more" : ""
        
        return "Today's routine: \(routine.routineName)\n\(exerciseList)\(moreExercises)"
    }
}

