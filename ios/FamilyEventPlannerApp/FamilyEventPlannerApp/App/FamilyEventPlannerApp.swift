import SwiftUI
import GoogleSignIn

@main
struct FamilyEventPlannerApp: App {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var healthManager = HealthKitManager()
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    HealthSyncView()
                        .environmentObject(authManager)
                        .environmentObject(healthManager)
                } else {
                    SignInView()
                        .environmentObject(authManager)
                }
            }
            .onOpenURL { url in
                // Handle Google Sign-In callback
                GIDSignIn.sharedInstance.handle(url)
            }
        }
    }
}


