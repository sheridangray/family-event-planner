import Foundation
import GoogleSignIn
import Combine

/// Manages Google Calendar integration
class CalendarManager: ObservableObject {
    @Published var isAuthorized = false
    @Published var upcomingEvents: [GoogleCalendarEvent] = []
    @Published var isSyncing = false
    @Published var lastSyncDate: Date?
    
    private var backendURL: String { AppConfig.baseURL }
    
    // MARK: - Initialization
    
    init() {
        checkAuthorizationStatus()
    }
    
    // MARK: - Authorization
    
    /// Check if user has granted calendar permissions
    func checkAuthorizationStatus() {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            Task { @MainActor in
                self.isAuthorized = false
            }
            return
        }
        
        let calendarScopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events"
        ]
        
        // Check if user has granted calendar scopes
        let grantedScopes = user.grantedScopes ?? []
        let hasCalendarAccess = calendarScopes.allSatisfy { grantedScopes.contains($0) }
        
        Task { @MainActor in
            self.isAuthorized = hasCalendarAccess
        }
        
        print(hasCalendarAccess ? "✅ Calendar authorized" : "⚠️ Calendar not authorized")
    }
    
    /// Request calendar permissions
    func requestAuthorization(authManager: AuthenticationManager) async throws {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            throw CalendarError.noViewController
        }
        
        let additionalScopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events"
        ]
        
        do {
            // Request additional scopes using the signIn method
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: rootViewController,
                hint: nil,
                additionalScopes: additionalScopes
            )
            
            await MainActor.run {
                self.isAuthorized = true
            }
            
            // Send tokens to backend
            try await syncTokensToBackend(user: result.user, authManager: authManager)
            
            print("✅ Calendar permissions granted")
        } catch {
            print("❌ Calendar authorization failed: \(error)")
            throw error
        }
    }
    
    /// Disconnect calendar (revoke permissions)
    func disconnect(authManager: AuthenticationManager) async throws {
        await MainActor.run {
            self.isSyncing = true
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
            }
        }
        
        // Remove tokens from backend
        try await removeTokensFromBackend(authManager: authManager)
        
        await MainActor.run {
            self.isAuthorized = false
            self.upcomingEvents = []
        }
        
        print("✅ Calendar disconnected")
    }
    
    // MARK: - Backend Sync
    
    private func syncTokensToBackend(user: GIDGoogleUser, authManager: AuthenticationManager) async throws {
        guard let sessionToken = authManager.sessionToken else {
            throw CalendarError.noToken
        }
        
        let accessToken = user.accessToken.tokenString
        
        let url = URL(string: "\(backendURL)/api/calendar/connect")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "access_token": accessToken,
            "refresh_token": user.refreshToken.tokenString,
            "expires_at": user.accessToken.expirationDate?.timeIntervalSince1970 ?? 0,
            "scope": user.grantedScopes?.joined(separator: " ") ?? ""
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CalendarError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ Backend sync failed: \(errorMessage)")
            throw CalendarError.backendError(errorMessage)
        }
        
        print("✅ Calendar tokens synced to backend")
    }
    
    private func removeTokensFromBackend(authManager: AuthenticationManager) async throws {
        guard let sessionToken = authManager.sessionToken else {
            throw CalendarError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/calendar/disconnect")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CalendarError.backendError("Failed to disconnect")
        }
    }
    
    // MARK: - Fetch Events
    
    /// Fetch upcoming calendar events
    func fetchUpcomingEvents(authManager: AuthenticationManager, days: Int = 30) async throws {
        guard let sessionToken = authManager.sessionToken else {
            throw CalendarError.notAuthenticated
        }
        
        await MainActor.run {
            self.isSyncing = true
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
            }
        }
        
        let url = URL(string: "\(backendURL)/api/calendar/events?days=\(days)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CalendarError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw CalendarError.backendError("Failed to fetch events")
        }
        
        let result = try JSONDecoder().decode(CalendarEventsResponse.self, from: data)
        
        await MainActor.run {
            self.upcomingEvents = result.events
            self.lastSyncDate = Date()
        }
        
        print("✅ Fetched \(result.events.count) calendar events")
    }
}

// MARK: - Models

struct GoogleCalendarEvent: Codable, Identifiable {
    let id: String
    let summary: String
    let description: String?
    let location: String?
    let start: String
    let end: String
    let htmlLink: String?
}

struct CalendarEventsResponse: Codable {
    let success: Bool
    let events: [GoogleCalendarEvent]
}

// MARK: - Errors

enum CalendarError: LocalizedError {
    case noViewController
    case noToken
    case notAuthenticated
    case invalidResponse
    case backendError(String)
    
    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "Unable to present authorization screen"
        case .noToken:
            return "No authentication token available"
        case .notAuthenticated:
            return "User not authenticated"
        case .invalidResponse:
            return "Invalid response from server"
        case .backendError(let message):
            return "Server error: \(message)"
        }
    }
}

