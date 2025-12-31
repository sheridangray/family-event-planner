import SwiftUI
import Combine

// App States as defined in the plan
enum AppState: Equatable {
    case booting          // Initial launch
    case configFetch      // Fetching remote config
    case updateRequired   // Hard block: app too old
    case maintenance      // Hard block: backend down
    case authCheck        // Checking keychain/session
    case unauthenticated  // Show Welcome/Login
    case onboarding       // Authenticated but profile incomplete
    case active           // Main app usage
}

// Global coordinator that drives the root view
class AppCoordinator: ObservableObject {
    @Published var state: AppState = .booting
    @Published var config: RemoteConfig?
    
    private var cancellables = Set<AnyCancellable>()
    
    // Dependencies
    private let authService = AuthenticationManager.shared
    
    init() {
        print("📱 AppCoordinator initialized")
        setupObservers()
        bootstrap()
    }
    
    private func setupObservers() {
        // Observe auth state changes
        authService.$isAuthenticated
            .dropFirst() // Ignore initial state
            .receive(on: RunLoop.main)
            .sink { [weak self] isAuthenticated in
                print("🔐 Auth state changed: \(isAuthenticated)")
                if isAuthenticated {
                    self?.checkOnboardingStatus()
                } else {
                    self?.state = .unauthenticated
                }
            }
            .store(in: &cancellables)
    }
    
    // The "Brain": Move from Boot -> Active
    func bootstrap() {
        self.state = .booting
        
        // 1. Fetch Config (Simulated delay)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.fetchRemoteConfig()
        }
    }
    
    private func fetchRemoteConfig() {
        self.state = .configFetch
        print("🔄 Fetching remote config...")
        
        Task {
            do {
                let remoteConfig = try await RemoteConfigService.shared.fetchConfig()
                
                await MainActor.run {
                    self.config = remoteConfig
                    
                    if remoteConfig.maintenanceMode {
                        self.state = .maintenance
                        return
                    }
                    
                    // Version Check
                    let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
                    print("📱 App Version: \(appVersion), Min Supported: \(remoteConfig.minSupportedVersion)")
                    
                    if isVersionOlder(appVersion, than: remoteConfig.minSupportedVersion) {
                        print("❌ Version mismatch: App is too old")
                        self.state = .updateRequired
                        return
                    }
                    
                    checkAuth()
                }
            } catch {
                print("❌ Config fetch failed: \(error.localizedDescription)")
                await MainActor.run {
                    // If we have NO config and fetch failed, we might want to show an error or retry
                    if self.config == nil {
                        // Fallback or retry logic
                        checkAuth() // Proceeding for now to avoid hard block in dev
                    } else {
                        checkAuth()
                    }
                }
            }
        }
    }
    
    private func isVersionOlder(_ current: String, than minVersion: String) -> Bool {
        let currentComponents = current.split(separator: ".").compactMap { Int($0) }
        let minComponents = minVersion.split(separator: ".").compactMap { Int($0) }
        
        let maxLength = max(currentComponents.count, minComponents.count)
        
        for i in 0..<maxLength {
            let currentPart = i < currentComponents.count ? currentComponents[i] : 0
            let minPart = i < minComponents.count ? minComponents[i] : 0
            
            if currentPart < minPart {
                return true
            } else if currentPart > minPart {
                return false
            }
        }
        
        return false // Versions are equal
    }
    
    private func checkAuth() {
        self.state = .authCheck
        
        if authService.isAuthenticated {
            // Check if onboarding is complete
            // For now, assume if authenticated -> active (or check a flag later)
            print("✅ User is authenticated")
            checkOnboardingStatus()
        } else {
            print("⚠️ User not authenticated")
            self.state = .unauthenticated
        }
    }
    
    private func checkOnboardingStatus() {
        self.state = .authCheck
        
        guard let token = authService.sessionToken else {
            self.state = .unauthenticated
            return
        }
        
        print("🔍 Checking onboarding status...")
        
        let url = URL(string: "http://127.0.0.1:3000/api/onboarding/state")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(for: request)
                let onboardingState = try JSONDecoder().decode(OnboardingStateResponse.self, from: data)
                
                await MainActor.run {
                    if onboardingState.isComplete {
                        print("✅ Onboarding complete, entering active state")
                        self.state = .active
                    } else {
                        print("ℹ️ Onboarding incomplete, current step: \(onboardingState.currentStepId)")
                        self.state = .onboarding
                    }
                }
            } catch {
                print("❌ Failed to fetch onboarding state: \(error.localizedDescription)")
                await MainActor.run {
                    // Fallback: if we can't check, stay in onboarding or retry
                    self.state = .onboarding
                }
            }
        }
    }

    // Response model for onboarding state
    struct OnboardingStateResponse: Codable {
        let currentStepId: String
        let stepsStatus: [String: String]
        let payload: [String: AnyCodable]
        let isComplete: Bool
        let completedAt: String?
    }
    
    // A simple wrapper for dynamic JSON in payload
    struct AnyCodable: Codable {} // Just a placeholder for now or use a proper AnyCodable library
    
    // Actions
    func didLogin() {
        checkOnboardingStatus()
    }
    
    func didCompleteOnboarding() {
        self.state = .active
    }
}
