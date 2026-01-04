import Foundation

/// Global configuration for the app
struct AppConfig {
    /// The base URL for the backend server.
    /// Production: "https://family-event-planner-backend.onrender.com"
    /// Local: "http://192.168.1.28:3000"
    static let baseURL = "https://family-event-planner-backend.onrender.com"
    
    /// The API base URL
    static var apiBaseURL: String {
        return "\(baseURL)/api"
    }
}

