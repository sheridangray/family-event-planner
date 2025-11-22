import SwiftUI

/// Main dashboard view - blank canvas for future content
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var navigateToHealth = false
    @State private var navigateToSettings = false
    
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
                .navigationDestination(isPresented: $navigateToHealth) {
                    HealthSyncView()
                        .environmentObject(authManager)
                        .environmentObject(healthManager)
                }
                
                // Navigation destination for Settings view
                .navigationDestination(isPresented: $navigateToSettings) {
                    SettingsView()
                        .environmentObject(authManager)
                        .environmentObject(healthManager)
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ProfileMenuButton(
                        navigateToHealth: $navigateToHealth,
                        navigateToSettings: $navigateToSettings
                    )
                    .environmentObject(authManager)
                }
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AuthenticationManager())
        .environmentObject(HealthKitManager())
}
