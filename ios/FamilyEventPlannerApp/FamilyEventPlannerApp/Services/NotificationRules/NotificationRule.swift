import Foundation

/// Protocol for defining notification rules
protocol NotificationRule {
    /// Unique identifier for this rule
    var identifier: String { get }
    
    /// Human-readable name
    var name: String { get }
    
    /// Whether this rule is enabled
    var isEnabled: Bool { get set }
    
    /// Time of day to check this rule (24-hour format)
    var checkTime: DateComponents { get }
    
    /// Check if notification condition is met
    /// Returns: (shouldNotify: Bool, message: String?)
    func checkCondition() async -> (shouldNotify: Bool, message: String?)
    
    /// Get notification title
    func getTitle() -> String
    
    /// Get notification body (if condition is met)
    func getBody() -> String
}

/// Base implementation with common functionality
class BaseNotificationRule: NotificationRule {
    let identifier: String
    let name: String
    var isEnabled: Bool
    let checkTime: DateComponents
    let weekdaysOnly: Bool
    
    init(identifier: String, name: String, hour: Int, minute: Int = 0, isEnabled: Bool = true, weekdaysOnly: Bool = false) {
        self.identifier = identifier
        self.name = name
        self.isEnabled = isEnabled
        self.weekdaysOnly = weekdaysOnly
        var components = DateComponents(hour: hour, minute: minute)
        if weekdaysOnly {
            // Set weekday to Monday-Friday (2-6)
            components.weekday = 2 // Monday, but we'll check in the rule
        }
        self.checkTime = components
    }
    
    func checkCondition() async -> (shouldNotify: Bool, message: String?) {
        // Override in subclasses
        return (false, nil)
    }
    
    func getTitle() -> String {
        return name
    }
    
    func getBody() -> String {
        return ""
    }
}

