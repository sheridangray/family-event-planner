import SwiftUI
import GoogleSignIn
import UIKit

@main
struct FamilyEventPlannerApp: App {
    // Use singletons directly - no @StateObject to avoid memory conflicts
    @StateObject private var calendarManager = CalendarManager()
    
    init() {
        // Register background tasks for health syncing
        BackgroundTaskManager.shared.registerBackgroundTasks()
        
        // Register notification background task
        NotificationScheduler.shared.registerBackgroundTask()
        
        // Request notification permissions
        Task {
            try? await NotificationManager.shared.requestAuthorization()
        }
        
        print("🚀 App initialized")
    }
    
    var body: some Scene {
        WindowGroup {
            Group {
                if AuthenticationManager.shared.isAuthenticated {
                    DashboardView()
                        .environmentObject(AuthenticationManager.shared)
                        .environmentObject(HealthKitManager.shared)
                        .environmentObject(calendarManager)
                        .environmentObject(NavigationCoordinator.shared)
                        .onAppear {
                            // Schedule health syncs when app appears
                            print("📱 Dashboard appeared, checking if should schedule sync...")
                            print("📱 HealthKit authorized: \(HealthKitManager.shared.isAuthorized)")
                            if HealthKitManager.shared.isAuthorized {
                                BackgroundTaskManager.shared.scheduleHealthSync()
                                BackgroundTaskManager.shared.scheduleCurrentDaySync()
                                
                                // Start HealthKit observers for real-time updates
                                CurrentDaySyncManager.shared.startHealthObservers(healthStore: HealthKitManager.shared.healthStore)
                                
                                // Fetch current day data when app opens
                                Task {
                                    await CurrentDaySyncManager.shared.fetchCurrentDayData()
                                }
                            } else {
                                print("⚠️ HealthKit not authorized yet - sync will be scheduled after authorization")
                            }
                        }
                        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                            // Sync current day data when app enters foreground
                            if HealthKitManager.shared.isAuthorized {
                                Task {
                                    await CurrentDaySyncManager.shared.fetchCurrentDayData()
                                }
                            }
                        }
                } else {
                    SignInView()
                        .environmentObject(AuthenticationManager.shared)
                }
            }
            .onOpenURL { url in
                // Handle Google Sign-In callback
                GIDSignIn.sharedInstance.handle(url)
            }
        }
    }
}


