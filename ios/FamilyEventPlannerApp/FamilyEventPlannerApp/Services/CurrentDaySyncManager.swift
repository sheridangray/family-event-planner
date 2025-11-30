import Foundation
import HealthKit
import Combine

/// Manages current day health data syncing with smart intervals
class CurrentDaySyncManager: ObservableObject {
    static let shared = CurrentDaySyncManager()
    
    @Published var lastCurrentDaySync: Date?
    @Published var isSyncing = false
    
    private var healthObservers: [HKAnchoredObjectQuery] = []
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        print("📱 CurrentDaySyncManager singleton initialized")
    }
    
    deinit {
        stopAllObservers()
        print("⚠️ CurrentDaySyncManager deallocated")
    }
    
    // MARK: - Smart Sync Intervals
    
    /// Calculate sync interval based on time of day
    private var syncInterval: TimeInterval {
        let hour = Calendar.current.component(.hour, from: Date())
        // Active hours (9 AM - 9 PM): sync every 2 hours
        // Night hours: sync every 6 hours
        return (9...21).contains(hour) ? 2 * 3600 : 6 * 3600
    }
    
    /// Check if we should sync based on last sync time
    func shouldSync() -> Bool {
        guard let lastSync = lastCurrentDaySync else {
            return true // Never synced, should sync
        }
        
        let timeSinceLastSync = Date().timeIntervalSince(lastSync)
        return timeSinceLastSync >= syncInterval
    }
    
    // MARK: - Current Day Data Fetching
    
    /// Fetch current day's health data (today's partial data)
    func fetchCurrentDayData() async {
        await MainActor.run {
            self.isSyncing = true
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
                self.lastCurrentDaySync = Date()
            }
        }
        
        let today = Date()
        await HealthKitManager.shared.fetchDataForDate(date: today)
        
        print("✅ Current day data fetched at \(Date())")
    }
    
    /// Sync current day data to backend
    func syncCurrentDayToBackend(authManager: AuthenticationManager) async throws {
        await MainActor.run {
            self.isSyncing = true
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
                self.lastCurrentDaySync = Date()
            }
        }
        
        let today = Date()
        try await HealthKitManager.shared.syncToBackend(
            authManager: authManager,
            date: today,
            isBackgroundSync: true
        )
        
        print("✅ Current day data synced to backend at \(Date())")
    }
    
    // MARK: - HealthKit Observers
    
    /// Start observing HealthKit data changes for real-time updates
    func startHealthObservers(healthStore: HKHealthStore) {
        guard HealthKitManager.shared.isAuthorized else {
            print("⚠️ HealthKit not authorized - cannot start observers")
            return
        }
        
            // Stop existing observers first
        stopAllObservers()
        
        // Observe steps
        observeQuantityType(
            healthStore: healthStore,
            type: HKQuantityType(.stepCount),
            unit: HKUnit.count()
        )
        
        // Observe exercise time
        observeQuantityType(
            healthStore: healthStore,
            type: HKQuantityType(.appleExerciseTime),
            unit: HKUnit.minute()
        )
        
        // Observe active calories
        observeQuantityType(
            healthStore: healthStore,
            type: HKQuantityType(.activeEnergyBurned),
            unit: HKUnit.kilocalorie()
        )
        
        print("👁️ HealthKit observers started")
    }
    
    /// Stop all HealthKit observers
    func stopAllObservers() {
        let healthStore = HealthKitManager.shared.healthStore
        for observer in healthObservers {
            healthStore.stop(observer)
        }
        healthObservers.removeAll()
        print("🛑 HealthKit observers stopped")
    }
    
    /// Observe a specific quantity type for changes
    private func observeQuantityType(healthStore: HKHealthStore, type: HKQuantityType, unit: HKUnit) {
        let query = HKAnchoredObjectQuery(
            type: type,
            predicate: nil,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] query, samples, deletedObjects, anchor, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ Observer error for \(type.identifier): \(error)")
                return
            }
            
            // Check if we have new samples for today
            let today = Calendar.current.startOfDay(for: Date())
            let hasNewData = samples?.contains { sample in
                sample.startDate >= today
            } ?? false
            
            if hasNewData {
                print("📊 New \(type.identifier) data detected - triggering sync")
                Task {
                    await self.fetchCurrentDayData()
                }
            }
        }
        
        // Update handler for ongoing updates
        query.updateHandler = { [weak self] query, samples, deletedObjects, anchor, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ Observer update error for \(type.identifier): \(error)")
                return
            }
            
            let today = Calendar.current.startOfDay(for: Date())
            let hasNewData = samples?.contains { sample in
                sample.startDate >= today
            } ?? false
            
            if hasNewData {
                print("📊 Updated \(type.identifier) data detected - triggering sync")
                Task {
                    await self.fetchCurrentDayData()
                }
            }
        }
        
        healthStore.execute(query)
        healthObservers.append(query)
    }
}

