import Foundation

/// User model matching backend user structure
struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let name: String
    let image: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case image
    }
}

/// Session data stored in Keychain
struct SessionData: Codable {
    let token: String
    let user: User
    let expiresAt: Date
}

/// Authentication response from backend
struct AuthResponse: Codable {
    let success: Bool
    let token: String
    let user: User
}

/// Authentication error response
struct AuthErrorResponse: Codable {
    let success: Bool
    let error: String
}


