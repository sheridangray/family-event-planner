import SwiftUI
import GoogleSignIn
import Combine

/// Manages user authentication with Google Sign-In and backend validation
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var sessionToken: String?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let keychainKey = "family_planner_session"
    private let backendURL = "https://family-event-planner-backend.onrender.com"
    
    // For local development, change to:
    // private let backendURL = "http://localhost:3000"
    
    init() {
        // Try to restore session from Keychain on app launch
        restoreSession()
    }
    
    // MARK: - Google Sign-In
    
    /// Sign in with Google and validate with backend
    func signInWithGoogle() async throws {
        isLoading = true
        errorMessage = nil
        
        defer {
            Task { @MainActor in
                isLoading = false
            }
        }
        
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            throw AuthError.noViewController
        }
        
        // Configure Google Sign-In
        // TODO: Replace with your iOS client ID from Google Cloud Console
        let clientID = "584799141962-cbnd0u748aup2m0da500o7d2hig4cqth.apps.googleusercontent.com"
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config
        
        // Perform sign-in
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: rootViewController
        )
        
        let user = result.user
        guard let idToken = user.idToken?.tokenString else {
            throw AuthError.noToken
        }
        
        // Validate with backend
        try await validateWithBackend(
            idToken: idToken,
            email: user.profile?.email ?? "",
            name: user.profile?.name ?? "",
            imageURL: user.profile?.imageURL(withDimension: 200)?.absoluteString
        )
    }
    
    // MARK: - Backend Validation
    
    private func validateWithBackend(idToken: String, email: String, name: String, imageURL: String?) async throws {
        print("🔐 Validating with backend: \(email)")
        print("📱 Using iOS client ID token")
        
        let url = URL(string: "\(backendURL)/api/auth/mobile-signin")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "idToken": idToken,
            "email": email,
            "name": name,
            "image": imageURL ?? ""
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📤 Sending request to: \(url.absoluteString)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.serverError("Invalid response")
        }
        
        if httpResponse.statusCode != 200 {
            // Log the full response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("❌ Backend error response: \(responseString)")
            }
            
            // Try to parse error message
            if let errorResponse = try? JSONDecoder().decode(AuthErrorResponse.self, from: data) {
                throw AuthError.serverError(errorResponse.error)
            }
            throw AuthError.serverError("Authentication failed (\(httpResponse.statusCode))")
        }
        
        // Parse success response
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        print("✅ Backend validation successful")
        
        // Save to state and Keychain
        await MainActor.run {
            self.currentUser = authResponse.user
            self.sessionToken = authResponse.token
            self.isAuthenticated = true
        }
        
        saveSessionToKeychain(token: authResponse.token, user: authResponse.user)
    }
    
    // MARK: - Session Management
    
    /// Sign out and clear session
    func signOut() {
        print("👋 Signing out")
        
        GIDSignIn.sharedInstance.signOut()
        
        currentUser = nil
        sessionToken = nil
        isAuthenticated = false
        errorMessage = nil
        
        deleteSessionFromKeychain()
    }
    
    /// Restore session from Keychain if valid
    private func restoreSession() {
        guard let sessionData = KeychainHelper.load(key: keychainKey),
              let session = try? JSONDecoder().decode(SessionData.self, from: sessionData) else {
            print("ℹ️ No saved session found")
            return
        }
        
        // Check if session is still valid (not expired)
        if session.expiresAt > Date() {
            print("✅ Restored session for: \(session.user.email)")
            self.currentUser = session.user
            self.sessionToken = session.token
            self.isAuthenticated = true
        } else {
            print("⚠️ Session expired, clearing")
            deleteSessionFromKeychain()
        }
    }
    
    /// Save session to Keychain
    private func saveSessionToKeychain(token: String, user: User) {
        let expiresAt = Date().addingTimeInterval(30 * 24 * 60 * 60) // 30 days
        let session = SessionData(token: token, user: user, expiresAt: expiresAt)
        
        if let encoded = try? JSONEncoder().encode(session) {
            KeychainHelper.save(key: keychainKey, data: encoded)
        }
    }
    
    /// Delete session from Keychain
    private func deleteSessionFromKeychain() {
        KeychainHelper.delete(key: keychainKey)
    }
    
    // MARK: - API Helper
    
    /// Create an authenticated URLRequest with Bearer token
    func authenticatedRequest(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        if let token = sessionToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }
}

// MARK: - Error Types

enum AuthError: Error, LocalizedError {
    case noViewController
    case noToken
    case notAllowed
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "Could not find view controller"
        case .noToken:
            return "Failed to get authentication token"
        case .notAllowed:
            return "Your email is not authorized for this app"
        case .serverError(let message):
            return message
        }
    }
}


