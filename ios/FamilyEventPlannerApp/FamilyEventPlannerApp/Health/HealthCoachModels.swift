import Foundation

// MARK: - Health Coach Data Models

struct HealthCoachRecommendations: Codable {
    let focusAreas: [FocusArea]
    let quickWins: [String]
    let encouragement: String
    let nextReviewDate: String
}

struct FocusArea: Codable {
    let metric: String
    let priority: String
    let currentState: String
    let trend: String
    let recommendation: String
    let actionItems: [String]
    let targetTimeline: String
}

struct HealthCoachResponse: Codable {
    let success: Bool
    let data: HealthCoachRecommendations
    let timestamp: String?
}

