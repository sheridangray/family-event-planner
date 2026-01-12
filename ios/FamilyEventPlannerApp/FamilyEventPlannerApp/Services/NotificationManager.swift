import Foundation
import Combine
import UserNotifications
import UIKit

/// Core notification manager for handling iOS local notifications
class NotificationManager: ObservableObject {
    static let shared = NotificationManager()
    
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var pushToken: String?
    
    private var backendURL: String { AppConfig.baseURL }
    
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
                
                // If authorized, trigger remote notification registration
                if settings.authorizationStatus == .authorized {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
            }
        }
    }
    
    // MARK: - Push Notifications
    
    /// Handle successfully registered device token
    func handleDeviceTokenRegistration(token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        print("✅ Registered for remote notifications with token: \(tokenString)")
        
        Task { @MainActor in
            self.pushToken = tokenString
            // Automatically sync token if user is already authenticated
            if AuthenticationManager.shared.isAuthenticated {
                try? await syncPushTokenToBackend()
            }
        }
    }
    
    /// Handle failed registration for remote notifications
    func handleDeviceTokenRegistrationFailure(error: Error) {
        print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
    }
    
    /// Sync the current push token to the backend
    func syncPushTokenToBackend() async throws {
        guard let token = pushToken else {
            print("⚠️ No push token available to sync")
            return
        }
        
        guard let sessionToken = AuthenticationManager.shared.sessionToken else {
            print("⚠️ No session token available to sync push token")
            return
        }
        
        let url = URL(string: "\(backendURL)/api/notifications/register-token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "deviceToken": token,
            "platform": "ios"
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📤 Syncing push token to backend...")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ Failed to sync push token to backend: \(errorMsg)")
            return
        }
        
        print("✅ Push token synced successfully to backend")
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

