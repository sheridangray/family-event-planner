import SwiftUI

/// Main health sync view showing metrics and sync button
struct HealthSyncView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if healthManager.isAuthorized {
                    // Date header with navigation
                    VStack(spacing: 12) {
                        // Date display
                        VStack(spacing: 4) {
                            HStack(spacing: 8) {
                                Text("Health Data")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                
                                // Live indicator for today's data
                                if healthManager.isViewingToday {
                                    HStack(spacing: 4) {
                                        Circle()
                                            .fill(Color.green)
                                            .frame(width: 8, height: 8)
                                        Text("Live")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.green)
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.green.opacity(0.1))
                                    .cornerRadius(8)
                                }
                            }
                            
                            Text(healthManager.selectedDate, style: .date)
                                .font(.title3)
                                .fontWeight(.semibold)
                            
                            // Show last update time for current day
                            if healthManager.isViewingToday, let lastUpdate = healthManager.lastCurrentDayUpdate {
                                Text("Updated \(lastUpdate, style: .relative)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        // Navigation buttons
                        HStack(spacing: 20) {
                            Button(action: {
                                healthManager.goToPreviousDay()
                            }) {
                                Image(systemName: "chevron.left.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(healthManager.isOnOldestDate ? .gray.opacity(0.3) : .sunsetDustyBlue)
                            }
                            .disabled(healthManager.isOnOldestDate)
                            
                            Button(action: {
                                healthManager.goToNextDay()
                            }) {
                                Image(systemName: "chevron.right.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(healthManager.isOnMostRecentDate ? .gray.opacity(0.3) : .sunsetDustyBlue)
                            }
                            .disabled(healthManager.isOnMostRecentDate)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    
                    // Exercise & Workouts section
                    VStack(spacing: 16) {
                        Text("Exercise & Workouts")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                        
                        ExerciseQuickView()
                            .environmentObject(ExerciseManager.shared)
                    }
                    .padding(.horizontal)
                    
                    // Category sections based on PRD 2.2
                    ForEach(HealthCategory.allCases) { category in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(category.rawValue)
                                .font(.title3)
                                .fontWeight(.bold)
                                .padding(.horizontal, 4)
                            
                            VStack(spacing: 12) {
                                ForEach(MetricIdentifier.allCases.filter { MetricInfo.get(for: $0).category == category }, id: \.self) { identifier in
                                    NavigationLink(destination: StandardizedMetricDetailView(identifier: identifier)
                                        .environmentObject(healthManager)) {
                                        MetricSummaryRow(
                                            identifier: identifier,
                                            value: healthManager.getMetricValue(for: identifier)
                                        )
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, 8)
                    }
                    .onAppear {
                        // Fetch data for selected date when view appears
                        Task {
                            if healthManager.isViewingToday {
                                // Fetch current day data
                                await CurrentDaySyncManager.shared.fetchCurrentDayData()
                            } else {
                                // Fetch historical data
                                await healthManager.fetchDataForDate(date: healthManager.selectedDate)
                            }
                        }
                    }
                    .onChange(of: healthManager.selectedDate) { newDate in
                        // Fetch data when date changes
                        Task {
                            let calendar = Calendar.current
                            if calendar.isDateInToday(newDate) {
                                // Fetch current day data
                                await CurrentDaySyncManager.shared.fetchCurrentDayData()
                            } else {
                                // Fetch historical data
                                await healthManager.fetchDataForDate(date: newDate)
                            }
                        }
                    }
                    
                    // Last sync info
                    VStack(spacing: 4) {
                        if healthManager.isViewingToday {
                            // Show current day sync info
                            if let lastSync = CurrentDaySyncManager.shared.lastCurrentDaySync {
                                HStack {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                        .foregroundColor(.blue)
                                    Text("Current day synced \(lastSync, style: .relative) ago")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        } else {
                            // Show historical sync info
                            if let lastSync = healthManager.lastSyncDate {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                    Text("Last synced \(lastSync, style: .relative) ago")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .padding(.top, 8)
                    
                    // Health Coach button
                    Button(action: {
                        navigationCoordinator.showHealthCoach()
                    }) {
                        HStack {
                            Image(systemName: "sparkles")
                            Text("Get Health Coach Recommendations")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                colors: [.sunsetPeach, .sunsetCoral],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .shadow(color: .sunsetPeach.opacity(0.3), radius: 10, y: 5)
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    
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
                                colors: [.sunsetDustyBlue, .sunsetDustyBlueDark],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .shadow(color: .sunsetDustyBlue.opacity(0.3), radius: 10, y: 5)
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
                                    colors: [.sunsetPeach, .sunsetCoral],
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
                            navigationCoordinator.showIntegrations()
                        }) {
                            HStack {
                                Image(systemName: "link.circle.fill")
                                Text("Connect in Settings")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [.sunsetCoral, .sunsetRose],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: .sunsetCoral.opacity(0.3), radius: 10, y: 5)
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
        .navigationDestination(isPresented: $navigationCoordinator.navigateToIntegrations) {
            IntegrationsView()
                .environmentObject(authManager)
                .environmentObject(healthManager)
        }
        .navigationDestination(isPresented: $navigationCoordinator.navigateToHealthCoach) {
            HealthCoachView()
                .environmentObject(authManager)
                .environmentObject(healthManager)
        }
        .navigationDestination(isPresented: $navigationCoordinator.navigateToExercise) {
            ExerciseView()
                .environmentObject(ExerciseManager.shared)
        }
        .navigationDestination(isPresented: $navigationCoordinator.navigateToSettings) {
            SettingsView()
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
                if healthManager.isViewingToday {
                    // Sync current day data
                    try await CurrentDaySyncManager.shared.syncCurrentDayToBackend(authManager: authManager)
                } else {
                    // Sync historical data
                    try await healthManager.syncToBackend(authManager: authManager)
                }
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
}

// MARK: - Metric Summary Row

struct MetricSummaryRow: View {
    let identifier: MetricIdentifier
    let value: String
    
    var info: MetricInfo {
        MetricInfo.get(for: identifier)
    }
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: info.identifier.iconName) // I need to add iconName to MetricIdentifier
                .font(.title3)
                .foregroundColor(info.color)
                .frame(width: 40, height: 40)
                .background(info.color.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(info.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(12)
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
        .environmentObject(AuthenticationManager.shared)
        .environmentObject(HealthKitManager.shared)
        .environmentObject(NavigationCoordinator.shared)
}


