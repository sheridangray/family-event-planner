import Foundation
import BackgroundTasks

/// Manages notification rule scheduling and execution
class NotificationScheduler {
    static let shared = NotificationScheduler()
    
    private let taskIdentifier = "com.sheridangray.FamilyEventPlanner.notificationCheck"
    private var rules: [NotificationRule] = []
    
    private init() {
        print("📅 NotificationScheduler initialized")
    }
    
    // MARK: - Rule Management
    
    /// Register a notification rule
    func registerRule(_ rule: NotificationRule) {
        // Remove existing rule with same identifier
        rules.removeAll { $0.identifier == rule.identifier }
        
        // Add new rule
        rules.append(rule)
        
        print("✅ Registered notification rule: \(rule.name)")
    }
    
    /// Unregister a notification rule
    func unregisterRule(identifier: String) {
        rules.removeAll { $0.identifier == identifier }
        print("🚫 Unregistered notification rule: \(identifier)")
    }
    
    /// Get all registered rules
    func getAllRules() -> [NotificationRule] {
        return rules
    }
    
    /// Get a specific rule by identifier
    func getRule(identifier: String) -> NotificationRule? {
        return rules.first { $0.identifier == identifier }
    }
    
    // MARK: - Background Task Registration
    
    /// Register background task handler - call from App init
    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            self.handleNotificationCheck(task: task as! BGAppRefreshTask)
        }
        
        print("✅ Notification check background task registered")
    }
    
    // MARK: - Scheduling
    
    /// Schedule next notification check
    func scheduleNextCheck() {
        // Find the next rule that needs checking
        guard let nextRule = getNextRuleToCheck() else {
            print("⏭️ No rules to check, skipping scheduling")
            return
        }
        
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        
        // Calculate next check time based on rule's checkTime
        let calendar = Calendar.current
        var components = nextRule.checkTime
        let now = Date()
        
        // Set date components
        components.year = calendar.component(.year, from: now)
        components.month = calendar.component(.month, from: now)
        components.day = calendar.component(.day, from: now)
        
        var nextCheckDate = calendar.date(from: components) ?? now
        
        // If the time has already passed today, schedule for tomorrow
        if nextCheckDate <= now {
            nextCheckDate = calendar.date(byAdding: .day, value: 1, to: nextCheckDate) ?? now
        }
        
        request.earliestBeginDate = nextCheckDate
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("✅ Notification check scheduled for: \(nextCheckDate)")
        } catch {
            print("❌ Failed to schedule notification check: \(error)")
        }
    }
    
    /// Get the next rule that needs checking
    private func getNextRuleToCheck() -> NotificationRule? {
        let enabledRules = rules.filter { $0.isEnabled }
        guard !enabledRules.isEmpty else { return nil }
        
        let now = Date()
        let calendar = Calendar.current
        let currentHour = calendar.component(.hour, from: now)
        let currentMinute = calendar.component(.minute, from: now)
        
        // Find rules that haven't been checked today yet
        // For now, return the first enabled rule
        // In a more sophisticated implementation, you'd track last check times
        return enabledRules.first
    }
    
    // MARK: - Task Handler
    
    private func handleNotificationCheck(task: BGAppRefreshTask) {
        print("🔔 Notification check task starting...")
        print("📅 Current time: \(Date())")
        
        // Schedule next check before starting work
        scheduleNextCheck()
        
        let checkTask = Task {
            // Check all enabled rules
            for rule in rules where rule.isEnabled {
                let (shouldNotify, message) = await rule.checkCondition()
                
                if shouldNotify {
                    let notificationManager = NotificationManager.shared
                    
                    // Check if we've already sent this notification today
                    let todayKey = "\(rule.identifier)_lastSent_\(getTodayString())"
                    let lastSent = UserDefaults.standard.string(forKey: todayKey)
                    
                    if lastSent == nil {
                        // Send notification
                        notificationManager.sendNotification(
                            identifier: "\(rule.identifier)_\(Date().timeIntervalSince1970)",
                            title: rule.getTitle(),
                            body: rule.getBody(),
                            userInfo: ["ruleIdentifier": rule.identifier]
                        )
                        
                        // Mark as sent today
                        UserDefaults.standard.set(getTodayString(), forKey: todayKey)
                        print("✅ Sent notification for rule: \(rule.name)")
                    } else {
                        print("⏭️ Already sent notification for \(rule.name) today")
                    }
                }
            }
            
            task.setTaskCompleted(success: true)
        }
        
        task.expirationHandler = {
            print("⚠️ Notification check task time limit reached")
            checkTask.cancel()
        }
    }
    
    /// Check all rules immediately (for testing or manual triggers)
    func checkAllRulesNow() async {
        for rule in rules where rule.isEnabled {
            let (shouldNotify, _) = await rule.checkCondition()
            if shouldNotify {
                NotificationManager.shared.sendNotification(
                    identifier: "\(rule.identifier)_\(Date().timeIntervalSince1970)",
                    title: rule.getTitle(),
                    body: rule.getBody(),
                    userInfo: ["ruleIdentifier": rule.identifier]
                )
            }
        }
    }
    
    // MARK: - Helpers
    
    private func getTodayString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}


