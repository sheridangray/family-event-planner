import SwiftUI

/// Sign-in screen with Google authentication
struct SignInView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            // App logo/icon
            Image(systemName: "heart.text.square.fill")
                .font(.system(size: 80))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.sunsetPeach, .sunsetCoral],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            VStack(spacing: 8) {
                Text("Family Event Planner")
                    .font(.title)
                    .fontWeight(.bold)
                
                Text("Health Sync")
                    .font(.title3)
                    .foregroundColor(.secondary)
            }
            
            Text("Track your health and sync with your family event planner")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            Spacer()
            
            // Google Sign-In Button
            Button(action: signIn) {
                HStack(spacing: 12) {
                    if authManager.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "person.circle.fill")
                            .font(.title3)
                        Text("Sign in with Google")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: [.sunsetDustyBlue, .sunsetDustyBlueDark],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundColor(.white)
                .cornerRadius(12)
                .shadow(color: .sunsetDustyBlue.opacity(0.3), radius: 10, y: 5)
            }
            .disabled(authManager.isLoading)
            .padding(.horizontal, 40)
            
            // Error message
            if let errorMessage = authManager.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.red.opacity(0.1))
                    )
                    .padding(.horizontal, 20)
            }
            
            VStack(spacing: 4) {
                Text("Only authorized family members can sign in")
                    .font(.caption)
                    .foregroundColor(.gray)
                
                Text("joyce.yan.zhang@gmail.com • sheridan.gray@gmail.com")
                    .font(.caption2)
                    .foregroundColor(.gray.opacity(0.7))
            }
            .padding(.bottom, 40)
        }
        .padding()
    }
    
    func signIn() {
        Task {
            do {
                try await authManager.signInWithGoogle()
            } catch {
                await MainActor.run {
                    authManager.errorMessage = error.localizedDescription
                }
            }
        }
    }
}

#Preview {
    SignInView()
        .environmentObject(AuthenticationManager())
}


