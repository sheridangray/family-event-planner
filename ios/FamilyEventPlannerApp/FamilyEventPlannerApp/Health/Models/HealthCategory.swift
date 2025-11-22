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
        case .activity: return .blue
        case .body: return .purple
        case .heart: return .red
        case .nutrition: return .green
        case .sleep: return .indigo
        case .mindfulness: return .orange
        }
    }
    
    var gradient: LinearGradient {
        switch self {
        case .activity:
            return LinearGradient(colors: [.blue, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .body:
            return LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .heart:
            return LinearGradient(colors: [.red, .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .nutrition:
            return LinearGradient(colors: [.green, .mint], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .sleep:
            return LinearGradient(colors: [.indigo, .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .mindfulness:
            return LinearGradient(colors: [.orange, .yellow], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

