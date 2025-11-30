import SwiftUI

/// Health data categories for organization
enum HealthCategory: String, CaseIterable, Identifiable {
    case activity = "Activity & Fitness"
    case body = "Body Metrics"
    case heart = "Heart & Vitals"
    case nutrition = "Nutrition"
    case sleep = "Sleep & Recovery"
    case mindfulness = "Mindfulness"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .activity: return "figure.run"
        case .body: return "figure.arms.open"
        case .heart: return "heart.fill"
        case .nutrition: return "fork.knife"
        case .sleep: return "bed.double.fill"
        case .mindfulness: return "brain.head.profile"
        }
    }
    
    var color: Color {
        switch self {
        case .activity: return .sunsetDustyBlue
        case .body: return .sunsetLavender
        case .heart: return .sunsetCoral
        case .nutrition: return .sunsetGold
        case .sleep: return .sunsetSlate
        case .mindfulness: return .sunsetPeach
        }
    }
    
    var gradient: LinearGradient {
        switch self {
        case .activity:
            // Dusty blue → soft periwinkle
            return LinearGradient(colors: [.sunsetDustyBlue, .sunsetLavender], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .body:
            // Soft lavender → peachy pink
            return LinearGradient(colors: [.sunsetLavender, .sunsetPeach], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .heart:
            // Rose → warm coral
            return LinearGradient(colors: [.sunsetCoral, .sunsetRose], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .nutrition:
            // Warm gold → peach
            return LinearGradient(colors: [.sunsetGold, .sunsetGoldLight], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .sleep:
            // Deep slate → dusty blue
            return LinearGradient(colors: [.sunsetSlate, .sunsetDustyBlue], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .mindfulness:
            // Peachy pink → soft lavender
            return LinearGradient(colors: [.sunsetPeach, .sunsetLavender], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

