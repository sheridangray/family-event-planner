import SwiftUI

/// Main dashboard view - blank canvas for future content
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var showingProfileMenu = false
    @State private var navigateToHealth = false
    
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
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ProfileMenuButton(
                        showingMenu: $showingProfileMenu,
                        navigateToHealth: $navigateToHealth
                    )
                    .environmentObject(authManager)
                }
            }
        }
    }
}

// MARK: - Profile Menu Button

struct ProfileMenuButton: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @Binding var showingMenu: Bool
    @Binding var navigateToHealth: Bool
    
    var body: some View {
        Menu {
            // User info section
            VStack(alignment: .leading) {
                Text(authManager.currentUser?.name ?? "User")
                    .font(.headline)
                Text(authManager.currentUser?.email ?? "")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Divider()
            
            // Health option
            Button(action: {
                navigateToHealth = true
            }) {
                Label("Health", systemImage: "heart.fill")
            }
            
            Divider()
            
            // Logout option
            Button(role: .destructive, action: {
                authManager.signOut()
            }) {
                Label("Logout", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            // Profile image button
            if let imageURL = authManager.currentUser?.image,
               let url = URL(string: imageURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .overlay(ProgressView())
                }
                .frame(width: 32, height: 32)
                .clipShape(Circle())
            } else {
                // Fallback initial avatar
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(authManager.currentUser?.name.prefix(1).uppercased() ?? "?")
                            .foregroundColor(.white)
                            .font(.caption)
                            .fontWeight(.semibold)
                    )
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AuthenticationManager())
        .environmentObject(HealthKitManager())
}
