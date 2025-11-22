import SwiftUI

/// Main health sync view showing metrics and sync button
struct HealthSyncView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var navigateToHealth = false
    @State private var navigateToIntegrations = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if healthManager.isAuthorized {
                    // Date header
                    VStack(spacing: 4) {
                        Text("Yesterday's Health Data")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                        Text(yesterday, style: .date)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    
                    // Category cards
                    VStack(spacing: 16) {
                        ForEach(HealthCategory.allCases) { category in
                            NavigationLink(destination: CategoryDetailView(category: category)
                                .environmentObject(healthManager)) {
                                CategoryCardView(
                                    category: category,
                                    summary: healthManager.getCategorySummary(for: category)
                                )
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
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
                    // Health permission not connected - encourage setup
                    VStack(spacing: 24) {
                        Image(systemName: "heart.circle")
                            .font(.system(size: 70))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.red, .pink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        
                        VStack(spacing: 8) {
                            Text("Connect Apple Health")
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text("Sync your activity data")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        
                        Text("Track your steps, exercise, sleep, and heart rate by connecting to Apple Health")
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 32)
                        
                        // Button to navigate to Integrations
                        Button(action: {
                            navigateToIntegrations = true
                        }) {
                            HStack {
                                Image(systemName: "link.circle.fill")
                                Text("Connect in Settings")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [.red, .pink],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: .red.opacity(0.3), radius: 10, y: 5)
                        }
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                        
                        // Alternative: Grant Access directly
                        Button("Grant Access Now") {
                            requestHealthAccess()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                    }
                    .padding()
                }
                
                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .navigationTitle("Health")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ProfileMenuButton(
                    navigateToHealth: $navigateToHealth,
                    navigateToSettings: .constant(false)
                )
                .environmentObject(authManager)
            }
        }
        .navigationDestination(isPresented: $navigateToIntegrations) {
            IntegrationsView()
                .environmentObject(authManager)
                .environmentObject(healthManager)
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


