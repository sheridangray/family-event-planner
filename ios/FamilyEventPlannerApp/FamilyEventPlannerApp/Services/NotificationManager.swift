import Foundation
import Combine
import UserNotifications

/// Core notification manager for handling iOS local notifications
class NotificationManager: ObservableObject {
    static let shared = NotificationManager()
    
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    
    private init() {
        checkAuthorizationStatus()
    }
    
    // MARK: - Authorization
    
    /// Request notification permissions
    func requestAuthorization() async throws {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        
        await MainActor.run {
            self.authorizationStatus = granted ? .authorized : .denied
        }
        
        if granted {
            print("✅ Notification permissions granted")
        } else {
            print("❌ Notification permissions denied")
        }
    }
    
    /// Check current authorization status
    func checkAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.authorizationStatus = settings.authorizationStatus
            }
        }
    }
    
    // MARK: - Send Notifications
    
    /// Send a local notification
    func sendNotification(
        identifier: String,
        title: String,
        body: String,
        sound: UNNotificationSound = .default,
        badge: NSNumber? = nil,
        userInfo: [AnyHashable: Any]? = nil
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = sound
        if let badge = badge {
            content.badge = badge
        }
        if let userInfo = userInfo {
            content.userInfo = userInfo
        }
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil // Immediate delivery
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ Failed to send notification: \(error)")
            } else {
                print("✅ Notification sent: \(title)")
            }
        }
    }
    
    /// Schedule a notification for a specific time
    func scheduleNotification(
        identifier: String,
        title: String,
        body: String,
        date: Date,
        repeats: Bool = false,
        sound: UNNotificationSound = .default,
        userInfo: [AnyHashable: Any]? = nil
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = sound
        if let userInfo = userInfo {
            content.userInfo = userInfo
        }
        
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: repeats)
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ Failed to schedule notification: \(error)")
            } else {
                print("✅ Notification scheduled: \(title) at \(date)")
            }
        }
    }
    
    /// Cancel a scheduled notification
    func cancelNotification(identifier: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        print("🚫 Cancelled notification: \(identifier)")
    }
    
    /// Cancel all notifications
    func cancelAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        print("🚫 Cancelled all notifications")
    }
}

