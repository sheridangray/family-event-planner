import Foundation

/// Notification rule for health-based notifications (step count)
class StepCountNotificationRule: BaseNotificationRule {
    let threshold: Int
    let currentSteps: () -> Int // Closure to get current step count
    
    init(
        threshold: Int = 5000,
        checkHour: Int = 16, // 4 PM
        checkMinute: Int = 0,
        isEnabled: Bool = true,
        currentSteps: @escaping () -> Int
    ) {
        self.threshold = threshold
        self.currentSteps = currentSteps
        
        super.init(
            identifier: "stepCountReminder",
            name: "Step Count Reminder",
            hour: checkHour,
            minute: checkMinute,
            isEnabled: isEnabled
        )
    }
    
    override func checkCondition() async -> (shouldNotify: Bool, message: String?) {
        guard isEnabled else {
            return (false, nil)
        }
        
        // Fetch current day data to get latest step count
        await CurrentDaySyncManager.shared.fetchCurrentDayData()
        
        let steps = currentSteps()
        let shouldNotify = steps < threshold
        
        if shouldNotify {
            let remaining = threshold - steps
            let message = "You're at \(steps) steps today. Walk \(remaining) more steps to reach your goal of \(threshold)!"
            return (true, message)
        }
        
        return (false, nil)
    }
    
    override func getTitle() -> String {
        return "Keep Moving! 🚶‍♂️"
    }
    
    override func getBody() -> String {
        let steps = currentSteps()
        let remaining = threshold - steps
        return "You're at \(steps) steps today. Walk \(remaining) more steps to reach your goal of \(threshold)!"
    }
}


