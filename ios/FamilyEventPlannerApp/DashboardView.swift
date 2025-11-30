import SwiftUI

/// Main dashboard view - blank canvas for future content
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Main content area - blank canvas
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()
                
                VStack {
                    Text("Dashboard coming soon...")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                
                // Navigation destination for Health view
                .navigationDestination(isPresented: $navigationCoordinator.navigateToHealth) {
                    HealthSyncView()
                        .environmentObject(authManager)
                        .environmentObject(healthManager)
                        .environmentObject(ExerciseManager.shared)
                        .environmentObject(navigationCoordinator)
                }
                
                // Navigation destination for Settings view
                .navigationDestination(isPresented: $navigationCoordinator.navigateToSettings) {
                    SettingsView()
                        .environmentObject(authManager)
                        .environmentObject(healthManager)
                        .environmentObject(navigationCoordinator)
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ProfileMenuButton()
                        .environmentObject(authManager)
                }
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AuthenticationManager.shared)
        .environmentObject(HealthKitManager.shared)
        .environmentObject(NavigationCoordinator.shared)
}
