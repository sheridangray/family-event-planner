import Foundation
import BackgroundTasks
import UIKit

/// Manages background task scheduling for automatic health data sync
class BackgroundTaskManager {
    static let shared = BackgroundTaskManager()
    
    private let taskIdentifier = "com.sheridangray.FamilyEventPlanner.healthSync"
    private let currentDayTaskIdentifier = "com.sheridangray.FamilyEventPlanner.currentDayHealthSync"
    
    private init() {
        print("⏰ BackgroundTaskManager singleton initialized")
    }
    
    deinit {
        print("⚠️ BackgroundTaskManager deallocated - THIS SHOULD NEVER HAPPEN WITH SINGLETON!")
    }
    
    // MARK: - Registration
    
    /// Register background task handler - call this from App init
    func registerBackgroundTasks() {
        // Register overnight sync (yesterday's complete data)
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            self.handleHealthSync(task: task as! BGAppRefreshTask)
        }
        
        // Register current day sync (today's partial data)
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: currentDayTaskIdentifier,
            using: nil
        ) { task in
            self.handleCurrentDaySync(task: task as! BGAppRefreshTask)
        }
        
        print("✅ Background tasks registered: \(taskIdentifier), \(currentDayTaskIdentifier)")
    }
    
    // MARK: - Scheduling
    
    /// Schedule next background health sync (typically runs overnight)
    func scheduleHealthSync() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        
        // Request task to run in ~24 hours
        // iOS will choose optimal time based on:
        // - Device charging
        // - WiFi connection
        // - User's app usage patterns
        // - Typically runs overnight between 1-4 AM
        request.earliestBeginDate = Calendar.current.date(
            byAdding: .hour,
            value: 20, // Allow iOS to run anytime after 20 hours
            to: Date()
        )
        
        do {
            try BGTaskScheduler.shared.submit(request)
            let nextSync = request.earliestBeginDate ?? Date()
            print("✅ Health sync scheduled - earliest: \(nextSync)")
            
            // Store last schedule time
            UserDefaults.standard.set(Date(), forKey: "lastScheduledBackgroundSync")
        } catch {
            print("❌ Failed to schedule background sync: \(error)")
        }
    }
    
    /// Cancel scheduled background sync
    func cancelHealthSync() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskIdentifier)
        print("🚫 Background health sync cancelled")
    }
    
    // MARK: - Current Day Sync Scheduling
    
    /// Schedule next current day health sync (runs periodically throughout the day)
    func scheduleCurrentDaySync() {
        let request = BGAppRefreshTaskRequest(identifier: currentDayTaskIdentifier)
        
        // Calculate next sync time based on time of day
        let hour = Calendar.current.component(.hour, from: Date())
        let hoursUntilNextSync: Int
        
        if (9...21).contains(hour) {
            // Active hours: sync every 2 hours
            hoursUntilNextSync = 2
        } else {
            // Night hours: sync every 6 hours
            hoursUntilNextSync = 6
        }
        
        request.earliestBeginDate = Calendar.current.date(
            byAdding: .hour,
            value: hoursUntilNextSync,
            to: Date()
        )
        
        do {
            try BGTaskScheduler.shared.submit(request)
            let nextSync = request.earliestBeginDate ?? Date()
            print("✅ Current day sync scheduled - earliest: \(nextSync)")
            
            UserDefaults.standard.set(Date(), forKey: "lastScheduledCurrentDaySync")
        } catch {
            print("❌ Failed to schedule current day sync: \(error)")
        }
    }
    
    /// Cancel scheduled current day sync
    func cancelCurrentDaySync() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: currentDayTaskIdentifier)
        print("🚫 Current day sync cancelled")
    }
    
    // MARK: - Current Day Task Handler
    
    private func handleCurrentDaySync(task: BGAppRefreshTask) {
        print("📱 Current day background sync starting...")
        print("📅 Current time: \(Date())")
        
        // Schedule next sync before starting work
        scheduleCurrentDaySync()
        
        // Create async task to perform sync
        let syncTask = Task {
            do {
                let authManager = AuthenticationManager.shared
                let healthManager = HealthKitManager.shared
                let currentDayManager = CurrentDaySyncManager.shared
                
                // Check if we should sync (respect smart intervals)
                guard currentDayManager.shouldSync() else {
                    print("⏭️ Skipping current day sync - too soon since last sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                // Check authentication
                guard authManager.isAuthenticated else {
                    print("⚠️ User not authenticated - skipping current day sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                guard healthManager.isAuthorized else {
                    print("⚠️ HealthKit not authorized - skipping current day sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                // Validate session
                let sessionValid = await authManager.validateSession()
                guard sessionValid else {
                    print("⚠️ Session expired - skipping current day sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                print("✅ Current day sync auth passed")
                print("🔄 Syncing current day health data...")
                
                // Sync current day data
                try await currentDayManager.syncCurrentDayToBackend(authManager: authManager)
                
                // Log success
                UserDefaults.standard.set(Date(), forKey: "lastSuccessfulCurrentDaySync")
                print("✅ Current day sync completed successfully")
                
                task.setTaskCompleted(success: true)
                
            } catch {
                print("❌ Current day sync failed: \(error)")
                
                UserDefaults.standard.set(Date(), forKey: "lastFailedCurrentDaySync")
                UserDefaults.standard.set(error.localizedDescription, forKey: "lastCurrentDaySyncError")
                
                task.setTaskCompleted(success: false)
            }
        }
        
        // Handle task expiration
        task.expirationHandler = {
            print("⚠️ Current day sync task time limit reached, cancelling...")
            syncTask.cancel()
        }
    }
    
    // MARK: - Task Handler
    
    private func handleHealthSync(task: BGAppRefreshTask) {
        print("🌙 Background health sync starting...")
        print("📅 Current time: \(Date())")
        
        // Schedule next sync before starting work
        scheduleHealthSync()
        
        // Create async task to perform sync
        let syncTask = Task {
            do {
                // Get singleton instances
                let authManager = AuthenticationManager.shared
                let healthManager = HealthKitManager.shared
                
                // Detailed auth check logging
                print("🔐 Background sync auth check:")
                print("   - isAuthenticated: \(authManager.isAuthenticated)")
                print("   - sessionToken exists: \(authManager.sessionToken != nil)")
                print("   - currentUser exists: \(authManager.currentUser != nil)")
                print("   - currentUser.id: \(authManager.currentUser?.id ?? 0)")
                print("   - HealthKit isAuthorized: \(healthManager.isAuthorized)")
                
                // Check if user is authenticated and has health access
                guard authManager.isAuthenticated else {
                    print("⚠️ User not authenticated - skipping background sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                guard healthManager.isAuthorized else {
                    print("⚠️ HealthKit not authorized - skipping background sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                // Validate session is still active (token not expired)
                let sessionValid = await authManager.validateSession()
                guard sessionValid else {
                    print("⚠️ Session expired - skipping background sync")
                    task.setTaskCompleted(success: true)
                    return
                }
                
                print("✅ Background sync auth passed")
                print("🔄 Starting health data sync in background...")
                
                // Perform sync with background flag
                try await healthManager.syncToBackend(
                    authManager: authManager,
                    isBackgroundSync: true
                )
                
                // Log success
                UserDefaults.standard.set(Date(), forKey: "lastSuccessfulBackgroundSync")
                print("✅ Background health sync completed successfully")
                
                task.setTaskCompleted(success: true)
                
            } catch {
                print("❌ Background health sync failed: \(error)")
                
                // Log failure
                UserDefaults.standard.set(Date(), forKey: "lastFailedBackgroundSync")
                UserDefaults.standard.set(error.localizedDescription, forKey: "lastBackgroundSyncError")
                
                task.setTaskCompleted(success: false)
            }
        }
        
        // Handle task expiration (iOS gives ~30 seconds for app refresh tasks)
        task.expirationHandler = {
            print("⚠️ Background task time limit reached, cancelling...")
            syncTask.cancel()
        }
    }
    
    // MARK: - Status & Debugging
    
    /// Get information about last background sync
    func getLastSyncInfo() -> (success: Date?, failed: Date?, scheduled: Date?) {
        let lastSuccess = UserDefaults.standard.object(forKey: "lastSuccessfulBackgroundSync") as? Date
        let lastFailed = UserDefaults.standard.object(forKey: "lastFailedBackgroundSync") as? Date
        let lastScheduled = UserDefaults.standard.object(forKey: "lastScheduledBackgroundSync") as? Date
        
        return (lastSuccess, lastFailed, lastScheduled)
    }
    
    /// Get last error message (if any)
    func getLastError() -> String? {
        return UserDefaults.standard.string(forKey: "lastBackgroundSyncError")
    }
    
    /// Get information about last current day sync
    func getLastCurrentDaySyncInfo() -> (success: Date?, failed: Date?, scheduled: Date?) {
        let lastSuccess = UserDefaults.standard.object(forKey: "lastSuccessfulCurrentDaySync") as? Date
        let lastFailed = UserDefaults.standard.object(forKey: "lastFailedCurrentDaySync") as? Date
        let lastScheduled = UserDefaults.standard.object(forKey: "lastScheduledCurrentDaySync") as? Date
        
        return (lastSuccess, lastFailed, lastScheduled)
    }
    
    /// Get last current day sync error message (if any)
    func getLastCurrentDaySyncError() -> String? {
        return UserDefaults.standard.string(forKey: "lastCurrentDaySyncError")
    }
}

