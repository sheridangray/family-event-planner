import SwiftUI

@main
struct FamilyEventPlannerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    
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
            RootView()
                .environmentObject(AuthenticationManager.shared)
                .environmentObject(HealthKitManager.shared)
                .environmentObject(NavigationCoordinator.shared)
                .environmentObject(ExerciseManager.shared)
                .environmentObject(CalendarManager.shared)
        }
    }
}