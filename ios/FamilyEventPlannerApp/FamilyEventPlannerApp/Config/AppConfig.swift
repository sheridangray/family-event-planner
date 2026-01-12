import Foundation

/// Global configuration for the app
struct AppConfig {
    /// The base URL for the backend server.
    static var baseURL: String {
        #if DEBUG
        // --- DEVELOPMENT SETTINGS ---
        // For Simulator: Use "http://127.0.0.1:3000"
        // For Physical Device: Use your Mac's local IP (e.g., "http://192.168.1.28:3000")
        return "http://127.0.0.1:3000"
        #else
        // --- PRODUCTION SETTINGS ---
        return "https://family-event-planner-backend.onrender.com"
        #endif
    }
    
    /// The API base URL
    static var apiBaseURL: String {
        return "\(baseURL)/api"
    }
}

