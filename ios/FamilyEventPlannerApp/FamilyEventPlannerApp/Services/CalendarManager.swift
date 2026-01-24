import Foundation
import GoogleSignIn
import Combine

/// Manages Google Calendar integration
class CalendarManager: ObservableObject {
    /// Shared singleton instance
    static let shared = CalendarManager()
    
    @Published var isAuthorized = false
    @Published var isExpired = false
    @Published var upcomingEvents: [GoogleCalendarEvent] = []
    @Published var isSyncing = false
    @Published var lastSyncDate: Date?
    @Published var connectionError: String?
    
    private var backendURL: String { AppConfig.baseURL }
    
    // MARK: - Initialization
    
    private init() {
        print("📅 CalendarManager singleton initialized")
        checkAuthorizationStatus()
    }
    
    // MARK: - Authorization
    
    /// Check if user has granted calendar permissions (checks backend status)
    func checkAuthorizationStatus() {
        // First check local Google Sign-In status
        let user = GIDSignIn.sharedInstance.currentUser
        let calendarScopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events"
        ]
        
        let grantedScopes = user?.grantedScopes ?? []
        let hasLocalCalendarAccess = calendarScopes.allSatisfy { grantedScopes.contains($0) }
        
        print("📅 [CalendarManager] Local Google Sign-In calendar access: \(hasLocalCalendarAccess)")
        
        // Also check backend status
        Task {
            await checkBackendStatus()
        }
    }
    
    /// Check backend calendar connection status
    func checkBackendStatus() async {
        guard let sessionToken = AuthenticationManager.shared.sessionToken else {
            await MainActor.run {
                self.isAuthorized = false
                self.isExpired = false
                self.connectionError = nil
            }
            print("📅 [CalendarManager] No session token, calendar not connected")
            return
        }
        
        let url = URL(string: "\(backendURL)/api/calendar/status")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw CalendarError.invalidResponse
            }
            
            if httpResponse.statusCode == 200 {
                let result = try JSONDecoder().decode(CalendarStatusResponse.self, from: data)
                
                await MainActor.run {
                    self.isAuthorized = result.connected && !result.expired
                    self.isExpired = result.expired
                    self.connectionError = result.expired ? "Token expired - please reconnect" : nil
                }
                
                print("📅 [CalendarManager] Backend status: connected=\(result.connected), expired=\(result.expired)")
            } else {
                await MainActor.run {
                    self.isAuthorized = false
                    self.isExpired = false
                }
                print("📅 [CalendarManager] Backend status check failed: \(httpResponse.statusCode)")
            }
        } catch {
            print("📅 [CalendarManager] Failed to check backend status: \(error)")
            await MainActor.run {
                self.isAuthorized = false
                self.connectionError = error.localizedDescription
            }
        }
    }
    
    /// Request calendar and Gmail permissions
    func requestAuthorization(authManager: AuthenticationManager) async throws {
        guard let windowScene = await UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = await windowScene.windows.first?.rootViewController else {
            throw CalendarError.noViewController
        }
        
        // Request both Calendar and Gmail scopes
        let additionalScopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
        ]
        
        print("📅 [CalendarManager] Requesting authorization with scopes: \(additionalScopes)")
        
        do {
            // Request additional scopes using the signIn method
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: rootViewController,
                hint: authManager.currentUser?.email,
                additionalScopes: additionalScopes
            )
            
            print("📅 [CalendarManager] Google Sign-In successful, granted scopes: \(result.user.grantedScopes ?? [])")
            
            // Send tokens to backend
            try await syncTokensToBackend(user: result.user, authManager: authManager)
            
            await MainActor.run {
                self.isAuthorized = true
                self.isExpired = false
                self.connectionError = nil
            }
            
            print("✅ Calendar and Gmail permissions granted")
        } catch {
            print("❌ Calendar authorization failed: \(error)")
            await MainActor.run {
                self.connectionError = error.localizedDescription
            }
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

struct CalendarStatusResponse: Codable {
    let success: Bool
    let connected: Bool
    let expired: Bool
    let expires_at: Double?
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

