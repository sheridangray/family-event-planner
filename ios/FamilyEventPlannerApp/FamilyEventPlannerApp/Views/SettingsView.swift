import SwiftUI

/// Main settings view with various configuration options
struct SettingsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var navigateToIntegrations = false
    
    var body: some View {
        List {
            // User Info Section
            Section {
                HStack(spacing: 12) {
                    ProfileAvatar(user: authManager.currentUser)
                        .frame(width: 50, height: 50)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(authManager.currentUser?.name ?? "User")
                            .font(.headline)
                        Text(authManager.currentUser?.email ?? "")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 8)
            }
            
            // Integrations Section
            Section {
                NavigationLink(destination: IntegrationsView()) {
                    Label("Integrations", systemImage: "link.circle.fill")
                }
            } header: {
                Text("Connected Services")
            } footer: {
                Text("Manage connections to external services and data sources")
            }
            
            // Health Data Section
            Section {
                NavigationLink(destination: BackfillView(healthManager: healthManager, authManager: authManager)) {
                    Label("Backfill Historical Data", systemImage: "arrow.counterclockwise.circle.fill")
                }
            } header: {
                Text("Health Data")
            } footer: {
                Text("Sync historical health data from Apple Health to your account")
            }
            
            // About Section
            Section {
                HStack {
                    Text("App Version")
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.secondary)
                }
                
                Link(destination: URL(string: "https://family-event-planner.com/privacy")!) {
                    HStack {
                        Text("Privacy Policy")
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .foregroundColor(.secondary)
                    }
                }
            } header: {
                Text("About")
            }
            
            // Danger Zone
            Section {
                Button(role: .destructive) {
                    authManager.signOut()
                } label: {
                    HStack {
                        Spacer()
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ProfileMenuButton()
                    .environmentObject(authManager)
            }
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environmentObject(AuthenticationManager())
    }
}

