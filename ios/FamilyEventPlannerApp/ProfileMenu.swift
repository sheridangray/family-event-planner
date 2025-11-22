import SwiftUI

// MARK: - Shared Profile Menu Component

/// Reusable profile menu button that appears in the navigation bar
struct ProfileMenuButton: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @Binding var navigateToHealth: Bool
    
    var body: some View {
        Menu {
            // User info section
            VStack(alignment: .leading) {
                Text(authManager.currentUser?.name ?? "User")
                    .font(.headline)
                    .foregroundStyle(.primary)  // Darker color for name
                Text(authManager.currentUser?.email ?? "")
                    .font(.caption2)  // Smaller font for email
                    .foregroundStyle(.secondary)
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
            ProfileAvatar(user: authManager.currentUser)
        }
    }
}

// MARK: - Reusable Profile Avatar

struct ProfileAvatar: View {
    let user: User?
    
    var body: some View {
        if let imageURL = user?.image,
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
                    Text(user?.name.prefix(1).uppercased() ?? "?")
                        .foregroundColor(.white)
                        .font(.caption)
                        .fontWeight(.semibold)
                )
        }
    }
}
