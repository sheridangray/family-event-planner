import SwiftUI
import Combine

/// Centralized navigation coordinator for managing app-wide navigation state
class NavigationCoordinator: ObservableObject {
    static let shared = NavigationCoordinator()
    
    // Navigation destinations
    @Published var navigateToHealth = false
    @Published var navigateToSettings = false
    @Published var navigateToIntegrations = false
    @Published var navigateToHealthCoach = false
    @Published var navigateToExercise = false
    
    private init() {
        // Private initializer for singleton pattern
    }
    
    // MARK: - Navigation Methods
    
    /// Navigate to Health view
    func showHealth() {
        navigateToHealth = true
    }
    
    /// Navigate to Settings view
    func showSettings() {
        navigateToSettings = true
    }
    
    /// Navigate to Integrations view
    func showIntegrations() {
        navigateToIntegrations = true
    }
    
    /// Navigate to Health Coach view
    func showHealthCoach() {
        navigateToHealthCoach = true
    }
    
    /// Navigate to Exercise view
    func showExercise() {
        navigateToExercise = true
    }
    
    /// Reset all navigation states (useful when navigation completes)
    func reset() {
        navigateToHealth = false
        navigateToSettings = false
        navigateToIntegrations = false
        navigateToHealthCoach = false
        navigateToExercise = false
    }
}

