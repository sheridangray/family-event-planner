import SwiftUI

/// Integrations view for managing external service connections
struct IntegrationsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var isTogglingHealthKit = false
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var showingDisconnectAlert = false
    
    var body: some View {
        List {
            // HealthKit Section
            Section {
                HStack(spacing: 16) {
                    // HealthKit Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(
                                LinearGradient(
                                    colors: [.red, .pink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 44, height: 44)
                        
                        Image(systemName: "heart.fill")
                            .font(.title3)
                            .foregroundColor(.white)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Apple Health")
                            .font(.headline)
                        
                        if healthManager.isAuthorized {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                Text("Connected")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } else {
                            Text("Not connected")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    // Toggle
                    Toggle("", isOn: Binding(
                        get: { healthManager.isAuthorized },
                        set: { newValue in
                            handleHealthKitToggle(newValue)
                        }
                    ))
                    .labelsHidden()
                    .disabled(isTogglingHealthKit)
                }
                .padding(.vertical, 4)
            } header: {
                Text("Health & Fitness")
            } footer: {
                Text("Sync your steps, exercise, sleep, and heart rate data from Apple Health")
            }
            
            // Coming Soon Section
            Section {
                IntegrationRow(
                    icon: "calendar",
                    title: "Google Calendar",
                    isConnected: false,
                    color: .blue,
                    isComingSoon: true
                )
                
                IntegrationRow(
                    icon: "envelope.fill",
                    title: "Gmail",
                    isConnected: false,
                    color: .red,
                    isComingSoon: true
                )
            } header: {
                Text("Coming Soon")
            }
        }
        .navigationTitle("Integrations")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Check actual HealthKit status when view appears
            healthManager.checkCurrentAuthorizationStatus()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // Re-check when returning from iOS Settings
            healthManager.checkCurrentAuthorizationStatus()
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
        .alert("Disconnect Apple Health?", isPresented: $showingDisconnectAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Open Settings", role: .destructive) {
                disconnectHealthKit()
            }
        } message: {
            Text("This will open iOS Settings where you can revoke health data access.")
        }
    }
    
    private func handleHealthKitToggle(_ newValue: Bool) {
        if newValue {
            // User wants to connect
            connectHealthKit()
        } else {
            // User wants to disconnect - show alert
            showingDisconnectAlert = true
        }
    }
    
    private func connectHealthKit() {
        isTogglingHealthKit = true
        
        Task {
            do {
                try await healthManager.requestAuthorization()
                // Fetch initial data after authorization
                await healthManager.fetchTodayData()
                
                await MainActor.run {
                    isTogglingHealthKit = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isTogglingHealthKit = false
                }
            }
        }
    }
    
    private func disconnectHealthKit() {
        // Open iOS Settings app
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
        
        // Show guidance after opening Settings
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            errorMessage = "Navigate to:\nHealth → Data Access & Devices → FamilyEventPlanner\nand turn off all permissions."
            showingError = true
        }
    }
}

// MARK: - Integration Row Component

struct IntegrationRow: View {
    let icon: String
    let title: String
    let isConnected: Bool
    let color: Color
    let isComingSoon: Bool
    
    var body: some View {
        HStack(spacing: 16) {
            // Service Icon
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        LinearGradient(
                            colors: [color, color.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                
                if isComingSoon {
                    Text("Coming soon")
                        .font(.caption)
                        .foregroundColor(.orange)
                } else if isConnected {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                        Text("Connected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } else {
                    Text("Not connected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            if isComingSoon {
                Image(systemName: "clock")
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .opacity(isComingSoon ? 0.6 : 1.0)
    }
}

#Preview {
    NavigationStack {
        IntegrationsView()
            .environmentObject(AuthenticationManager())
            .environmentObject(HealthKitManager())
    }
}

