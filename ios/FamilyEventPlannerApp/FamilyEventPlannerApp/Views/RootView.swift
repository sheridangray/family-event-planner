import SwiftUI

struct RootView: View {
    @StateObject private var coordinator = AppCoordinator()
    
    var body: some View {
        Group {
            switch coordinator.state {
            case .booting:
                LaunchScreenView()
            case .configFetch, .authCheck:
                LaunchScreenView(status: "Connecting...")
            case .maintenance:
                MaintenanceView()
            case .updateRequired:
                UpdateRequiredView()
            case .unauthenticated:
                AuthenticationView(coordinator: coordinator)
            case .onboarding:
                OnboardingShellView(coordinator: coordinator)
            case .active:
                MainTabView(coordinator: coordinator)
            }
        }
        .animation(.easeInOut, value: coordinator.state)
    }
}

// --- Placeholder Views for States ---

struct LaunchScreenView: View {
    var status: String = "Integrated Life"
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            VStack(spacing: 20) {
                Image(systemName: "circle.hexagonpath.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.white)
                Text(status)
                    .foregroundColor(.gray)
            }
        }
    }
}

struct MaintenanceView: View {
    var body: some View {
        VStack {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
            Text("We're upgrading the system.")
            Text("Please check back shortly.")
        }
    }
}

struct UpdateRequiredView: View {
    var body: some View {
        VStack {
            Image(systemName: "arrow.down.circle.fill")
                .font(.largeTitle)
            Text("Update Required")
            Text("Please update the app to continue.")
        }
    }
}

struct AuthenticationView: View {
    @ObservedObject var coordinator: AppCoordinator
    
    var body: some View {
        // Placeholder for the SignInView wrapper
        SignInView() // Existing view
            // In a real flow, SignInView would call coordinator.didLogin() on success
    }
}

struct MainTabView: View {
    @ObservedObject var coordinator: AppCoordinator
    
    var body: some View {
        TabView {
            NavigationStack {
                TodayDashboardView(coordinator: coordinator)
                    .navigationTitle("Today")
            }
            .tabItem { Label("Today", systemImage: "house") }
            
            NavigationStack {
                GlobalSearchView()
                    .navigationTitle("Search")
            }
            .tabItem { Label("Search", systemImage: "magnifyingglass") }
            
            NavigationStack {
                NotificationsCenterView()
                    .navigationTitle("Notifications")
            }
            .tabItem { Label("Notifications", systemImage: "bell") }
            
            NavigationStack {
                SettingsView()
                    .navigationTitle("Profile")
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}
