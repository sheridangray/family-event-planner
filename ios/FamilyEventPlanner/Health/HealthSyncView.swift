import SwiftUI

/// Main health sync view showing metrics and sync button
struct HealthSyncView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // User profile header
                    UserProfileHeader()
                        .environmentObject(authManager)
                    
                    if healthManager.isAuthorized {
                        // Health metrics cards
                        VStack(spacing: 16) {
                            HealthMetricRow(
                                icon: "figure.walk",
                                title: "Steps",
                                value: "\(healthManager.todaySteps.formatted())",
                                color: .blue
                            )
                            
                            HealthMetricRow(
                                icon: "flame.fill",
                                title: "Exercise",
                                value: "\(healthManager.todayExercise) min",
                                color: .orange
                            )
                            
                            HealthMetricRow(
                                icon: "bed.double.fill",
                                title: "Sleep",
                                value: String(format: "%.1fh", healthManager.todaySleep),
                                color: .purple
                            )
                            
                            HealthMetricRow(
                                icon: "heart.fill",
                                title: "Resting Heart Rate",
                                value: healthManager.restingHeartRate > 0 ? "\(healthManager.restingHeartRate) bpm" : "--",
                                color: .red
                            )
                        }
                        .padding(.horizontal)
                        
                        // Last sync info
                        if let lastSync = healthManager.lastSyncDate {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("Last synced \(lastSync, style: .relative) ago")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.top, 8)
                        }
                        
                        // Sync button
                        Button(action: syncData) {
                            HStack {
                                if healthManager.isSyncing {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                    Text(healthManager.lastSyncDate == nil ? "Sync Now" : "Sync Again")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [.blue, .indigo],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: .blue.opacity(0.3), radius: 10, y: 5)
                        }
                        .disabled(healthManager.isSyncing)
                        .padding(.horizontal)
                        .padding(.top, 8)
                        
                    } else {
                        // Health permission needed
                        VStack(spacing: 20) {
                            Image(systemName: "heart.circle")
                                .font(.system(size: 60))
                                .foregroundColor(.red)
                            
                            Text("Health Access Required")
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text("Grant access to sync your health data with the Family Event Planner")
                                .multilineTextAlignment(.center)
                                .foregroundColor(.secondary)
                                .padding(.horizontal)
                            
                            Button("Grant Access") {
                                requestHealthAccess()
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                        }
                        .padding()
                    }
                    
                    Spacer(minLength: 20)
                }
                .padding(.vertical)
            }
            .navigationTitle("Health Sync")
            .navigationBarTitleDisplayMode(.large)
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
    }
    
    func requestHealthAccess() {
        Task {
            do {
                try await healthManager.requestAuthorization()
                // Fetch initial data after authorization
                await healthManager.fetchTodayData()
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
    
    func syncData() {
        Task {
            do {
                try await healthManager.syncToBackend(authManager: authManager)
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
}

// MARK: - User Profile Header

struct UserProfileHeader: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        HStack(spacing: 12) {
            // Profile image
            if let imageURL = authManager.currentUser?.image,
               let url = URL(string: imageURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .overlay(
                            ProgressView()
                        )
                }
                .frame(width: 50, height: 50)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                    .overlay(
                        Text(authManager.currentUser?.name.prefix(1).uppercased() ?? "?")
                            .foregroundColor(.white)
                            .font(.title2)
                            .fontWeight(.semibold)
                    )
            }
            
            // User info
            VStack(alignment: .leading, spacing: 4) {
                Text(authManager.currentUser?.name ?? "User")
                    .font(.headline)
                
                Text(authManager.currentUser?.email ?? "")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 10, y: 5)
        )
        .padding(.horizontal)
    }
}

// MARK: - Health Metric Row

struct HealthMetricRow: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.white)
                .frame(width: 50, height: 50)
                .background(
                    LinearGradient(
                        colors: [color, color.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(value)
                    .font(.title2)
                    .fontWeight(.semibold)
            }
            
            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 10, y: 5)
        )
    }
}

#Preview {
    HealthSyncView()
        .environmentObject(AuthenticationManager())
        .environmentObject(HealthKitManager())
}


