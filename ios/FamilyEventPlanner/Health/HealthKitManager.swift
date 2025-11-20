import Foundation
import HealthKit

/// Manages HealthKit data reading and syncing to backend
class HealthKitManager: ObservableObject {
    let healthStore = HKHealthStore()
    
    @Published var isAuthorized = false
    @Published var lastSyncDate: Date?
    @Published var isSyncing = false
    
    // Today's metrics
    @Published var todaySteps: Int = 0
    @Published var todayExercise: Int = 0
    @Published var todaySleep: Double = 0
    @Published var restingHeartRate: Int = 0
    
    private let backendURL = "https://sheridangray.com"
    // For local development, change to:
    // private let backendURL = "http://localhost:3000"
    
    // MARK: - Authorization
    
    /// Request HealthKit permissions
    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.notAvailable
        }
        
        let typesToRead: Set = [
            HKQuantityType(.stepCount),
            HKQuantityType(.appleExerciseTime),
            HKQuantityType(.restingHeartRate),
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.flightsClimbed)
        ]
        
        do {
            try await healthStore.requestAuthorization(toShare: [], read: typesToRead)
            await MainActor.run {
                self.isAuthorized = true
            }
            print("✅ HealthKit authorized")
        } catch {
            print("❌ HealthKit authorization failed: \(error)")
            throw error
        }
    }
    
    // MARK: - Fetch Health Data
    
    /// Fetch today's health data from HealthKit
    func fetchTodayData() async {
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        
        print("📊 Fetching today's health data...")
        
        // Fetch steps
        let steps = await fetchQuantity(
            type: HKQuantityType(.stepCount),
            unit: HKUnit.count(),
            start: startOfDay,
            end: now
        )
        
        // Fetch exercise minutes
        let exercise = await fetchQuantity(
            type: HKQuantityType(.appleExerciseTime),
            unit: HKUnit.minute(),
            start: startOfDay,
            end: now
        )
        
        // Fetch sleep (from last night)
        let sleepStart = calendar.date(byAdding: .hour, value: -12, to: startOfDay)!
        let sleep = await fetchSleepHours(start: sleepStart, end: now)
        
        // Fetch resting heart rate
        let heartRate = await fetchLatestHeartRate()
        
        await MainActor.run {
            self.todaySteps = steps
            self.todayExercise = exercise
            self.todaySleep = sleep
            self.restingHeartRate = heartRate
        }
        
        print("✅ Fetched: \(steps) steps, \(exercise) min exercise, \(String(format: "%.1f", sleep))h sleep, \(heartRate) bpm")
    }
    
    /// Fetch quantity sum (steps, exercise, etc.)
    private func fetchQuantity(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async -> Int {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    print("❌ Error fetching \(type.identifier): \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let sum = result?.sumQuantity()?.doubleValue(for: unit) ?? 0
                continuation.resume(returning: Int(sum))
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch sleep hours
    private func fetchSleepHours(start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKCategoryType(.sleepAnalysis),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching sleep: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let samples = samples as? [HKCategorySample] else {
                    continuation.resume(returning: 0)
                    return
                }
                
                // Calculate total sleep duration (in bed asleep)
                var totalSeconds: TimeInterval = 0
                for sample in samples {
                    if sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                       sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
                        totalSeconds += sample.endDate.timeIntervalSince(sample.startDate)
                    }
                }
                
                let hours = totalSeconds / 3600
                continuation.resume(returning: hours)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest resting heart rate
    private func fetchLatestHeartRate() async -> Int {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: yesterday, end: now)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.restingHeartRate),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching heart rate: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: 0)
                    return
                }
                
                let bpm = Int(sample.quantity.doubleValue(for: HKUnit(from: "count/min")))
                continuation.resume(returning: bpm)
            }
            
            healthStore.execute(query)
        }
    }
    
    // MARK: - Sync to Backend
    
    /// Sync health data to backend
    func syncToBackend(authManager: AuthenticationManager) async throws {
        guard let token = authManager.sessionToken,
              let userId = authManager.currentUser?.id else {
            throw HealthKitError.notAuthenticated
        }
        
        await MainActor.run {
            self.isSyncing = true
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
            }
        }
        
        // Fetch latest data
        await fetchTodayData()
        
        print("🔄 Syncing to backend...")
        
        // Prepare data
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]
        let todayString = dateFormatter.string(from: Date())
        
        let healthData: [String: Any] = [
            "date": todayString,
            "metrics": [
                "steps": todaySteps,
                "exercise_minutes": todayExercise,
                "sleep_hours": todaySleep,
                "resting_heart_rate": restingHeartRate
            ],
            "source": "ios_app"
        ]
        
        // Create request
        let url = URL(string: "\(backendURL)/api/health/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: healthData)
        
        // Send request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            if let errorData = try? JSONDecoder().decode(AuthErrorResponse.self, from: data) {
                throw HealthKitError.syncFailed(errorData.error)
            }
            throw HealthKitError.syncFailed("Sync failed")
        }
        
        await MainActor.run {
            self.lastSyncDate = Date()
        }
        
        print("✅ Sync successful")
    }
}

// MARK: - Error Types

enum HealthKitError: Error, LocalizedError {
    case notAvailable
    case notAuthenticated
    case syncFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "HealthKit is not available on this device"
        case .notAuthenticated:
            return "Please sign in first"
        case .syncFailed(let message):
            return "Sync failed: \(message)"
        }
    }
}


