import Foundation
import HealthKit
import Combine

/// Manages HealthKit data reading and syncing to backend
class HealthKitManager: ObservableObject {
    static let shared = HealthKitManager()
    
    let healthStore = HKHealthStore()
    
    @Published var isAuthorized = false
    @Published var lastSyncDate: Date?
    @Published var isSyncing = false
    @Published var selectedDate: Date = Date() // Default to today
    @Published var lastCurrentDayUpdate: Date? // Last time current day data was updated
    
    // Activity & Fitness
    @Published var todaySteps: Int = 0
    @Published var todayExercise: Int = 0
    @Published var distance: Double = 0
    @Published var activeCalories: Int = 0
    @Published var flightsClimbed: Int = 0
    @Published var walkingSpeed: Double = 0
    @Published var standHours: Int = 0
    
    // Body Metrics
    @Published var weight: Double = 0
    @Published var bodyFatPercentage: Double = 0
    @Published var bmi: Double = 0
    @Published var height: Double = 0
    @Published var leanBodyMass: Double = 0
    
    // Heart & Vitals
    @Published var restingHeartRate: Int = 0
    @Published var heartRateVariability: Double = 0
    @Published var vo2Max: Double = 0
    @Published var bloodOxygen: Double = 0
    @Published var respiratoryRate: Double = 0
    
    // Sleep & Recovery
    @Published var todaySleep: Double = 0
    
    // Nutrition
    @Published var caloriesConsumed: Double = 0
    @Published var protein: Double = 0
    @Published var carbs: Double = 0
    @Published var fat: Double = 0
    @Published var sugar: Double = 0
    @Published var fiber: Double = 0
    @Published var water: Double = 0
    @Published var caffeine: Double = 0
    
    // Mindfulness
    @Published var mindfulMinutes: Int = 0
    
    // Health Coach
    @Published var isLoadingRecommendations = false
    @Published var healthCoachRecommendations: HealthCoachRecommendations?
    
    private let backendURL = "https://family-event-planner-backend.onrender.com"
    // For local development, change to:
    // private let backendURL = "http://localhost:3000"
    
    // MARK: - Initialization
    
    init() {
        print("🏥 HealthKitManager singleton initialized")
        // Check authorization status on init
        checkAuthorizationStatus()
    }
    
    deinit {
        print("⚠️ HealthKitManager deallocated - THIS SHOULD NEVER HAPPEN WITH SINGLETON!")
    }
    
    /// Check if we already have HealthKit authorization
    private func checkAuthorizationStatus() {
        guard HKHealthStore.isHealthDataAvailable() else {
            return
        }
        
        let typesToRead: Set = [
            // Activity & Fitness
            HKQuantityType(.stepCount),
            HKQuantityType(.appleExerciseTime),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.flightsClimbed),
            HKQuantityType(.walkingSpeed),
            HKQuantityType(.appleStandTime),
            
            // Body Metrics
            HKQuantityType(.bodyMass),
            HKQuantityType(.bodyFatPercentage),
            HKQuantityType(.bodyMassIndex),
            HKQuantityType(.height),
            HKQuantityType(.leanBodyMass),
            
            // Heart & Vitals
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.vo2Max),
            HKQuantityType(.oxygenSaturation),
            HKQuantityType(.respiratoryRate),
            
            // Sleep
            HKCategoryType(.sleepAnalysis),
            
            // Nutrition
            HKQuantityType(.dietaryEnergyConsumed),
            HKQuantityType(.dietaryProtein),
            HKQuantityType(.dietaryCarbohydrates),
            HKQuantityType(.dietaryFatTotal),
            HKQuantityType(.dietarySugar),
            HKQuantityType(.dietaryFiber),
            HKQuantityType(.dietaryWater),
            HKQuantityType(.dietaryCaffeine),
            
            // Mindfulness
            HKCategoryType(.mindfulSession)
        ]
        
        // Check if we have authorization for at least one type
        // HealthKit doesn't provide a direct "are we authorized" check,
        // but we can check the authorization status for our key types
        let stepType = HKQuantityType(.stepCount)
        let status = healthStore.authorizationStatus(for: stepType)
        
        // If status is not notDetermined, user has already been prompted
        if status != .notDetermined {
            isAuthorized = true
            print("✅ HealthKit already authorized")
            // Note: Data is fetched only when user explicitly syncs or grants new permissions
        }
    }
    
    // MARK: - Authorization
    
    /// Request HealthKit permissions
    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.notAvailable
        }
        
        let typesToRead: Set = [
            // Activity & Fitness
            HKQuantityType(.stepCount),
            HKQuantityType(.appleExerciseTime),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.flightsClimbed),
            HKQuantityType(.walkingSpeed),
            HKQuantityType(.appleStandTime),
            
            // Body Metrics
            HKQuantityType(.bodyMass),
            HKQuantityType(.bodyFatPercentage),
            HKQuantityType(.bodyMassIndex),
            HKQuantityType(.height),
            HKQuantityType(.leanBodyMass),
            
            // Heart & Vitals
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.vo2Max),
            HKQuantityType(.oxygenSaturation),
            HKQuantityType(.respiratoryRate),
            
            // Sleep
            HKCategoryType(.sleepAnalysis),
            
            // Nutrition
            HKQuantityType(.dietaryEnergyConsumed),
            HKQuantityType(.dietaryProtein),
            HKQuantityType(.dietaryCarbohydrates),
            HKQuantityType(.dietaryFatTotal),
            HKQuantityType(.dietarySugar),
            HKQuantityType(.dietaryFiber),
            HKQuantityType(.dietaryWater),
            HKQuantityType(.dietaryCaffeine),
            
            // Mindfulness
            HKCategoryType(.mindfulSession)
        ]
        
        do {
            try await healthStore.requestAuthorization(toShare: [], read: typesToRead)
            await MainActor.run {
                self.isAuthorized = true
            }
            print("✅ HealthKit authorized")
            
            // Schedule background syncs after authorization
            BackgroundTaskManager.shared.scheduleHealthSync()
            BackgroundTaskManager.shared.scheduleCurrentDaySync()
            
            // Start HealthKit observers for real-time updates
            CurrentDaySyncManager.shared.startHealthObservers(healthStore: healthStore)
            
            // Setup notification rules
            setupNotificationRules()
        } catch {
            print("❌ HealthKit authorization failed: \(error)")
            throw error
        }
    }
    
    /// Check current authorization status for HealthKit
    func checkCurrentAuthorizationStatus() {
        guard HKHealthStore.isHealthDataAvailable() else {
            Task { @MainActor in
                self.isAuthorized = false
            }
            return
        }
        
        let stepType = HKQuantityType(.stepCount)
        let status = healthStore.authorizationStatus(for: stepType)
        
        Task { @MainActor in
            let wasAuthorized = self.isAuthorized
            self.isAuthorized = (status == .sharingAuthorized)
            
            if wasAuthorized != self.isAuthorized {
                print("⚠️ HealthKit authorization status changed: \(self.isAuthorized)")
                
                if self.isAuthorized {
                    // Start observers and schedule syncs when authorized
                    BackgroundTaskManager.shared.scheduleCurrentDaySync()
                    CurrentDaySyncManager.shared.startHealthObservers(healthStore: self.healthStore)
                } else {
                    // Stop observers when unauthorized
                    CurrentDaySyncManager.shared.stopAllObservers()
                }
            }
        }
    }
    
    // MARK: - Fetch Health Data
    
    /// Fetch yesterday's health data from HealthKit
    /// Fetch health data for a specific date
    func fetchDataForDate(date: Date) async {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: date)
        
        print("📊 Fetching health data for date: \(dateString)")
        print("📅 Date range: \(startOfDay) to \(endOfDay)")
        
        // Check if running in simulator
        #if targetEnvironment(simulator)
        let isSimulator = true
        #else
        let isSimulator = false
        #endif
        
        // Fetch steps for the date
        var steps = await fetchQuantity(
            type: HKQuantityType(.stepCount),
            unit: HKUnit.count(),
            start: startOfDay,
            end: endOfDay
        )
        
        // Fetch exercise minutes for the date
        var exercise = await fetchQuantity(
            type: HKQuantityType(.appleExerciseTime),
            unit: HKUnit.minute(),
            start: startOfDay,
            end: endOfDay
        )
        
        // Fetch sleep from the night before the date
        let sleepStart = calendar.date(byAdding: .hour, value: -12, to: startOfDay)!
        var sleep = await fetchSleepHours(start: sleepStart, end: endOfDay)
        
        // Fetch activity metrics for the date
        var distanceMiles = await fetchDistance(start: startOfDay, end: endOfDay)
        var activeCals = await fetchActiveCalories(start: startOfDay, end: endOfDay)
        var flights = await fetchFlightsClimbed(start: startOfDay, end: endOfDay)
        var speed = await fetchWalkingSpeed(start: startOfDay, end: endOfDay)
        var standHrs = await fetchStandHours(start: startOfDay, end: endOfDay)
        
        // Fetch heart & vitals (most recent value on or before the selected date)
        var heartRate = await fetchLatestHeartRate(start: startOfDay, end: endOfDay)
        var hrv = await fetchHRV(beforeDate: endOfDay)
        var vo2 = await fetchVO2Max(beforeDate: endOfDay)
        var spo2 = await fetchBloodOxygen(beforeDate: endOfDay)
        var respRate = await fetchRespiratoryRate(beforeDate: endOfDay)
        
        // Fetch body metrics (most recent value on or before the selected date)
        var weightLbs = await fetchLatestWeight(beforeDate: endOfDay)
        var bodyFat = await fetchLatestBodyFat(beforeDate: endOfDay)
        var bmiValue = await fetchLatestBMI(beforeDate: endOfDay)
        var heightInches = await fetchLatestHeight(beforeDate: endOfDay)
        var leanMass = await fetchLatestLeanBodyMass(beforeDate: endOfDay)
        
        // Fetch nutrition for the date
        var cals = await fetchDietaryMetric(type: HKQuantityType(.dietaryEnergyConsumed), unit: HKUnit.kilocalorie(), start: startOfDay, end: endOfDay)
        var prot = await fetchDietaryMetric(type: HKQuantityType(.dietaryProtein), unit: HKUnit.gram(), start: startOfDay, end: endOfDay)
        var carbGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryCarbohydrates), unit: HKUnit.gram(), start: startOfDay, end: endOfDay)
        var fatGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryFatTotal), unit: HKUnit.gram(), start: startOfDay, end: endOfDay)
        var sugarGrams = await fetchDietaryMetric(type: HKQuantityType(.dietarySugar), unit: HKUnit.gram(), start: startOfDay, end: endOfDay)
        var fiberGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryFiber), unit: HKUnit.gram(), start: startOfDay, end: endOfDay)
        var waterOz = await fetchDietaryMetric(type: HKQuantityType(.dietaryWater), unit: HKUnit.fluidOunceUS(), start: startOfDay, end: endOfDay)
        var caffeineMg = await fetchDietaryMetric(type: HKQuantityType(.dietaryCaffeine), unit: HKUnit.gramUnit(with: .milli), start: startOfDay, end: endOfDay)
        
        // Fetch mindfulness for the date
        var mindful = await fetchMindfulMinutes(start: startOfDay, end: endOfDay)
        
        // Use mock data in simulator if no real activity data available
        // (Note: Some simulators may have heart rate data but no step data)
        if isSimulator && steps == 0 && exercise == 0 {
            print("ℹ️ Using mock data for Simulator (no activity data)")
            steps = 8234
            exercise = 45
            
            // Only use mock sleep if we don't have real data
            if sleep == 0 {
                sleep = 7.5
            }
            
            // Only use mock heart rate if we don't have real data
            if heartRate == 0 {
                heartRate = 62
            }
        }
        
        await MainActor.run {
            // Activity & Fitness
            self.todaySteps = steps
            self.todayExercise = exercise
            self.distance = distanceMiles
            self.activeCalories = activeCals
            self.flightsClimbed = flights
            self.walkingSpeed = speed
            self.standHours = standHrs
            
            // Body Metrics
            self.weight = weightLbs
            self.bodyFatPercentage = bodyFat
            self.bmi = bmiValue
            self.height = heightInches
            self.leanBodyMass = leanMass
            
            // Heart & Vitals
            self.restingHeartRate = heartRate
            self.heartRateVariability = hrv
            self.vo2Max = vo2
            self.bloodOxygen = spo2
            self.respiratoryRate = respRate
            
            // Sleep
            self.todaySleep = sleep
            
            // Nutrition
            self.caloriesConsumed = cals
            self.protein = prot
            self.carbs = carbGrams
            self.fat = fatGrams
            self.sugar = sugarGrams
            self.fiber = fiberGrams
            self.water = waterOz
            self.caffeine = caffeineMg
            
            // Mindfulness
            self.mindfulMinutes = mindful
            
            // Update last current day update if this is today's data
            let calendar = Calendar.current
            if calendar.isDateInToday(date) {
                self.lastCurrentDayUpdate = Date()
            }
        }
        
        print("✅ Fetched all health metrics for \(dateString)")
    }
    
    /// Fetch yesterday's health data (backward compatibility)
    func fetchTodayData() async {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        await fetchDataForDate(date: yesterday)
    }
    
    /// Fetch current day's health data (today's partial data)
    func fetchCurrentDayData() async {
        let today = Date()
        await fetchDataForDate(date: today)
    }
    
    /// Check if the selected date is today
    var isViewingToday: Bool {
        Calendar.current.isDateInToday(selectedDate)
    }
    
    // MARK: - Date Navigation
    
    /// Get the oldest date we can view (defaults to 1 year ago)
    var oldestAvailableDate: Date {
        Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date()
    }
    
    /// Get the most recent date we can view (today, for current day tracking)
    var mostRecentDate: Date {
        Date()
    }
    
    /// Check if we're on the oldest available date
    var isOnOldestDate: Bool {
        let calendar = Calendar.current
        let selectedStart = calendar.startOfDay(for: selectedDate)
        let oldestStart = calendar.startOfDay(for: oldestAvailableDate)
        return selectedStart <= oldestStart
    }
    
    /// Check if we're on the most recent date
    var isOnMostRecentDate: Bool {
        let calendar = Calendar.current
        let selectedStart = calendar.startOfDay(for: selectedDate)
        let mostRecentStart = calendar.startOfDay(for: mostRecentDate)
        return selectedStart >= mostRecentStart
    }
    
    /// Navigate to previous day
    func goToPreviousDay() {
        guard !isOnOldestDate else { return }
        let calendar = Calendar.current
        if let previousDate = calendar.date(byAdding: .day, value: -1, to: selectedDate) {
            selectedDate = previousDate
            Task {
                await fetchDataForDate(date: previousDate)
            }
        }
    }
    
    /// Navigate to next day
    func goToNextDay() {
        guard !isOnMostRecentDate else { return }
        let calendar = Calendar.current
        if let nextDate = calendar.date(byAdding: .day, value: 1, to: selectedDate) {
            selectedDate = nextDate
            Task {
                await fetchDataForDate(date: nextDate)
            }
        }
    }
    
    // MARK: - Aggregated Data Fetching
    
    /// Data point for charts
    struct MetricDataPoint: Identifiable {
        let id = UUID()
        let date: Date
        let value: Double
    }
    
    /// Fetch aggregated data for a metric over a date range
    func fetchMetricData(for identifier: MetricIdentifier, from startDate: Date, to endDate: Date) async -> [MetricDataPoint] {
        print("📊 Fetching metric data for: \(identifier.rawValue)")
        print("📅 Date range: \(startDate) to \(endDate)")
        
        let calendar = Calendar.current
        var dataPoints: [MetricDataPoint] = []
        
        // Handle sleep specially (category type)
        if identifier == .sleep {
            var currentDate = calendar.startOfDay(for: startDate)
            let end = calendar.startOfDay(for: endDate)
            
            while currentDate <= end {
                let dayStart = calendar.date(byAdding: .hour, value: -12, to: currentDate)!
                let dayEnd = calendar.date(byAdding: .day, value: 1, to: currentDate)!
                
                let value = await fetchSleepHours(start: dayStart, end: dayEnd)
                dataPoints.append(MetricDataPoint(date: currentDate, value: value))
                
                currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
            }
            return dataPoints
        }
        
        // Handle mindful minutes specially (category type)
        if identifier == .mindfulMinutes {
            var currentDate = calendar.startOfDay(for: startDate)
            let end = calendar.startOfDay(for: endDate)
            
            while currentDate <= end {
                let dayStart = currentDate
                let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
                
                let value = await fetchMindfulMinutes(start: dayStart, end: dayEnd)
                dataPoints.append(MetricDataPoint(date: dayStart, value: Double(value)))
                
                currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
            }
            return dataPoints
        }
        
        // Handle quantity types
        guard let quantityType = getQuantityType(for: identifier) else {
            print("❌ No quantity type for metric: \(identifier.rawValue)")
            return []
        }
        
        print("✅ Using HealthKit type: \(identifier.healthKitType ?? "unknown")")
        
        // For aggregated metrics (steps, exercise, etc.), get daily totals
        // For averaged metrics (weight, heart rate, etc.), get daily averages
        if identifier.isAggregated {
            // Get daily sums
            var currentDate = calendar.startOfDay(for: startDate)
            let end = calendar.startOfDay(for: endDate)
            
            while currentDate <= end {
                let dayStart = currentDate
                let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
                
                let value = await fetchQuantityValue(type: quantityType, unit: getUnit(for: identifier), start: dayStart, end: dayEnd)
                dataPoints.append(MetricDataPoint(date: dayStart, value: value))
                
                currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
            }
            print("✅ Fetched \(dataPoints.count) data points (aggregated)")
        } else {
            // Get daily averages or latest values
            var currentDate = calendar.startOfDay(for: startDate)
            let end = calendar.startOfDay(for: endDate)
            
            while currentDate <= end {
                let dayStart = currentDate
                let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
                
                let value = await fetchAverageOrLatestValue(type: quantityType, unit: getUnit(for: identifier), start: dayStart, end: dayEnd)
                dataPoints.append(MetricDataPoint(date: dayStart, value: value))
                
                currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
            }
            print("✅ Fetched \(dataPoints.count) data points (averaged/latest)")
        }
        
        print("📊 Total data points: \(dataPoints.count)")
        if !dataPoints.isEmpty {
            print("📊 Sample values: \(dataPoints.prefix(3).map { "\($0.value)" }.joined(separator: ", "))")
        }
        
        return dataPoints
    }
    
    /// Get the HKQuantityType for a metric identifier
    private func getQuantityType(for identifier: MetricIdentifier) -> HKQuantityType? {
        switch identifier {
        case .steps: return HKQuantityType(.stepCount)
        case .exercise: return HKQuantityType(.appleExerciseTime)
        case .distance: return HKQuantityType(.distanceWalkingRunning)
        case .activeCalories: return HKQuantityType(.activeEnergyBurned)
        case .flightsClimbed: return HKQuantityType(.flightsClimbed)
        case .standHours: return HKQuantityType(.appleStandTime)
        case .walkingSpeed: return HKQuantityType(.walkingSpeed)
        case .weight: return HKQuantityType(.bodyMass)
        case .bmi: return HKQuantityType(.bodyMassIndex)
        case .bodyFat: return HKQuantityType(.bodyFatPercentage)
        case .height: return HKQuantityType(.height)
        case .leanBodyMass: return HKQuantityType(.leanBodyMass)
        case .restingHeartRate: return HKQuantityType(.restingHeartRate)
        case .bloodOxygen: return HKQuantityType(.oxygenSaturation)
        case .vo2Max: return HKQuantityType(.vo2Max)
        case .hrv: return HKQuantityType(.heartRateVariabilitySDNN)
        case .respiratoryRate: return HKQuantityType(.respiratoryRate)
        case .calories: return HKQuantityType(.dietaryEnergyConsumed)
        case .water: return HKQuantityType(.dietaryWater)
        case .protein: return HKQuantityType(.dietaryProtein)
        case .carbs: return HKQuantityType(.dietaryCarbohydrates)
        case .fat: return HKQuantityType(.dietaryFatTotal)
        case .sugar: return HKQuantityType(.dietarySugar)
        case .fiber: return HKQuantityType(.dietaryFiber)
        case .caffeine: return HKQuantityType(.dietaryCaffeine)
        case .sleep, .mindfulMinutes: return nil // These are category types, handled separately
        }
    }
    
    /// Get the appropriate unit for a metric
    private func getUnit(for identifier: MetricIdentifier) -> HKUnit {
        switch identifier {
        case .steps: return HKUnit.count()
        case .exercise, .mindfulMinutes: return HKUnit.minute()
        case .distance: return HKUnit.mile()
        case .activeCalories, .calories: return HKUnit.kilocalorie()
        case .flightsClimbed: return HKUnit.count()
        case .standHours: return HKUnit.hour()
        case .walkingSpeed: return HKUnit.mile().unitDivided(by: HKUnit.hour())
        case .weight, .leanBodyMass: return HKUnit.pound()
        case .bmi: return HKUnit.count()
        case .bodyFat: return HKUnit.percent()
        case .height: return HKUnit.inch()
        case .restingHeartRate: return HKUnit(from: "count/min")
        case .bloodOxygen: return HKUnit.percent()
        case .vo2Max: return HKUnit.literUnit(with: .milli).unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: HKUnit.minute()))
        case .hrv: return HKUnit.secondUnit(with: .milli)
        case .respiratoryRate: return HKUnit.count().unitDivided(by: HKUnit.minute())
        case .water: return HKUnit.fluidOunceUS()
        case .protein, .carbs, .fat, .sugar, .fiber: return HKUnit.gram()
        case .caffeine: return HKUnit.gramUnit(with: .milli)
        case .sleep: return HKUnit.hour()
        }
    }
    
    /// Fetch quantity value (sum or average)
    private func fetchQuantityValue(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    let nsError = error as NSError
                    if nsError.code != 11 { // Ignore "no data" errors
                        print("❌ Error fetching quantity: \(error)")
                    }
                    continuation.resume(returning: 0)
                    return
                }
                
                let value = result?.sumQuantity()?.doubleValue(for: unit) ?? 0
                continuation.resume(returning: value)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch average or latest value
    private func fetchAverageOrLatestValue(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    let nsError = error as NSError
                    if nsError.code != 11 {
                        print("❌ Error fetching average/latest: \(error)")
                    }
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: 0)
                    return
                }
                
                var value = sample.quantity.doubleValue(for: unit)
                
                // Convert percentages to readable format
                if unit == HKUnit.percent() {
                    value = value * 100
                }
                
                continuation.resume(returning: value)
            }
            
            healthStore.execute(query)
        }
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
                    let nsError = error as NSError
                    // Code 11 = no data available (expected in Simulator)
                    if nsError.code == 11 {
                        print("ℹ️ No data for \(type.identifier) (this is normal in Simulator)")
                    } else {
                        print("❌ Error fetching \(type.identifier): \(error)")
                    }
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
    
    /// Fetch latest weight
    private func fetchLatestWeight(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for weight data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.bodyMass),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching weight: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No weight data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let pounds = sample.quantity.doubleValue(for: HKUnit.pound())
                print("✅ Weight: \(pounds) lbs (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: pounds)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest body fat percentage
    private func fetchLatestBodyFat(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for body fat data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.bodyFatPercentage),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching body fat: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No body fat data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let percentage = sample.quantity.doubleValue(for: HKUnit.percent()) * 100
                print("✅ Body Fat: \(percentage)% (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: percentage)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest BMI
    private func fetchLatestBMI(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for BMI data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.bodyMassIndex),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching BMI: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No BMI data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let bmi = sample.quantity.doubleValue(for: HKUnit.count())
                print("✅ BMI: \(bmi) (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: bmi)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest height
    private func fetchLatestHeight(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Height rarely changes, so look back as far as needed
            let startDate = Calendar.current.date(byAdding: .year, value: -10, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.height),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching height: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No height data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let inches = sample.quantity.doubleValue(for: HKUnit.inch())
                print("✅ Height: \(inches) inches (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: inches)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest lean body mass
    private func fetchLatestLeanBodyMass(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for lean body mass data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.leanBodyMass),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching lean body mass: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No lean body mass data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let pounds = sample.quantity.doubleValue(for: HKUnit.pound())
                print("✅ Lean Body Mass: \(pounds) lbs (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: pounds)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch distance walked/ran from yesterday
    private func fetchDistance(start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: HKQuantityType(.distanceWalkingRunning),
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    print("❌ Error fetching distance: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let miles = result?.sumQuantity()?.doubleValue(for: HKUnit.mile()) ?? 0
                continuation.resume(returning: miles)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch active calories from yesterday
    private func fetchActiveCalories(start: Date, end: Date) async -> Int {
        return await fetchQuantity(
            type: HKQuantityType(.activeEnergyBurned),
            unit: HKUnit.kilocalorie(),
            start: start,
            end: end
        )
    }
    
    /// Fetch flights climbed from yesterday
    private func fetchFlightsClimbed(start: Date, end: Date) async -> Int {
        return await fetchQuantity(
            type: HKQuantityType(.flightsClimbed),
            unit: HKUnit.count(),
            start: start,
            end: end
        )
    }
    
    /// Fetch walking speed
    private func fetchWalkingSpeed(start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: HKQuantityType(.walkingSpeed),
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, result, error in
                if let error = error {
                    print("❌ Error fetching walking speed: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let metersPerSecond = result?.averageQuantity()?.doubleValue(for: HKUnit.meter().unitDivided(by: HKUnit.second())) ?? 0
                let mph = metersPerSecond * 2.23694  // Convert to mph
                continuation.resume(returning: mph)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch stand hours from yesterday
    private func fetchStandHours(start: Date, end: Date) async -> Int {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: HKQuantityType(.appleStandTime),
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    print("❌ Error fetching stand hours: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let minutes = result?.sumQuantity()?.doubleValue(for: HKUnit.minute()) ?? 0
                let hours = Int(minutes / 60)
                continuation.resume(returning: hours)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch VO2 Max
    private func fetchVO2Max(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for VO2 Max data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.vo2Max),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching VO2 Max: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No VO2 Max data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let vo2Max = sample.quantity.doubleValue(for: HKUnit.literUnit(with: .milli).unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: HKUnit.minute())))
                print("✅ VO2 Max: \(vo2Max) ml/kg/min (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: vo2Max)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch heart rate variability (HRV)
    private func fetchHRV(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for HRV data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.heartRateVariabilitySDNN),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching HRV: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No HRV data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let hrv = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                print("✅ HRV: \(hrv) ms (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: hrv)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch blood oxygen (SpO2)
    private func fetchBloodOxygen(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for blood oxygen data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.oxygenSaturation),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching blood oxygen: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No blood oxygen data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let spo2 = sample.quantity.doubleValue(for: HKUnit.percent()) * 100
                print("✅ Blood Oxygen: \(spo2)% (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: spo2)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch respiratory rate
    private func fetchRespiratoryRate(beforeDate: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            // Look back up to 1 year for respiratory rate data
            let startDate = Calendar.current.date(byAdding: .year, value: -1, to: beforeDate) ?? beforeDate
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: beforeDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.respiratoryRate),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching respiratory rate: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No respiratory rate data found before \(beforeDate)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let rate = sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: HKUnit.minute()))
                print("✅ Respiratory Rate: \(rate) breaths/min (from \(sample.startDate), requested date: \(beforeDate))")
                continuation.resume(returning: rate)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch dietary metric
    private func fetchDietaryMetric(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error = error {
                    print("❌ Error fetching dietary metric: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                let sum = result?.sumQuantity()?.doubleValue(for: unit) ?? 0
                continuation.resume(returning: sum)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch mindful minutes
    private func fetchMindfulMinutes(start: Date, end: Date) async -> Int {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            
            let query = HKSampleQuery(
                sampleType: HKCategoryType(.mindfulSession),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching mindful minutes: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let samples = samples as? [HKCategorySample] else {
                    continuation.resume(returning: 0)
                    return
                }
                
                var totalSeconds: TimeInterval = 0
                for sample in samples {
                    totalSeconds += sample.endDate.timeIntervalSince(sample.startDate)
                }
                
                let minutes = Int(totalSeconds / 60)
                continuation.resume(returning: minutes)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest resting heart rate for a date range
    private func fetchLatestHeartRate(start: Date? = nil, end: Date? = nil) async -> Int {
        return await withCheckedContinuation { continuation in
            let endDate = end ?? Date()
            let startDate = start ?? Calendar.current.date(byAdding: .day, value: -1, to: endDate)!
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate)
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            
            let query = HKSampleQuery(
                sampleType: HKQuantityType(.restingHeartRate),
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error = error {
                    print("❌ Error fetching resting heart rate: \(error)")
                    continuation.resume(returning: 0)
                    return
                }
                
                guard let sample = samples?.first as? HKQuantitySample else {
                    print("⚠️ No resting heart rate data found for date range")
                    continuation.resume(returning: 0)
                    return
                }
                
                let bpm = Int(sample.quantity.doubleValue(for: HKUnit(from: "count/min")))
                print("✅ Resting Heart Rate: \(bpm) bpm (from \(sample.startDate))")
                continuation.resume(returning: bpm)
            }
            
            healthStore.execute(query)
        }
    }
    
    // MARK: - Sync to Backend
    
    /// Sync health data to backend
    func syncToBackend(authManager: AuthenticationManager, date: Date? = nil, isBackgroundSync: Bool = false) async throws {
        // Add logging BEFORE the guard
        let syncType = isBackgroundSync ? "Background" : "Manual"
        print("🔐 \(syncType) sync - Checking authentication...")
        print("   - Has token: \(authManager.sessionToken != nil)")
        print("   - Has user: \(authManager.currentUser != nil)")
        print("   - User ID: \(authManager.currentUser?.id ?? 0)")
        
        guard let token = authManager.sessionToken,
              let userId = authManager.currentUser?.id else {
            print("❌ Authentication failed - cannot sync")
            throw HealthKitError.notAuthenticated
        }
        
        print("✅ Authenticated as user \(userId)")
        print("🔄 \(syncType) sync starting...")
        
        await MainActor.run {
            self.isSyncing = true
        }
        
        // Make sure to reset syncing state on exit
        defer {
            Task { @MainActor [weak self] in
                self?.isSyncing = false
            }
        }
        
        // Determine target date (use provided date or default to yesterday)
        let calendar = Calendar.current
        let targetDate = date ?? calendar.date(byAdding: .day, value: -1, to: Date())!
        
        // Fetch data for the target date
        await fetchDataForDate(date: targetDate)
        
        print("🔄 Syncing to backend...")
        print("📊 Data: Steps=\(todaySteps), Exercise=\(todayExercise)min, Sleep=\(todaySleep)h, HR=\(restingHeartRate)bpm")
        
        // Prepare data with target date
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: targetDate)
        
        print("📅 \(syncType) syncing data for date: \(dateString)")
        
        let healthData: [String: Any] = [
            "date": dateString,
            "metrics": [
                // Activity & Fitness
                "steps": todaySteps,
                "exercise_minutes": todayExercise,
                "distance_miles": distance,
                "active_calories": activeCalories,
                "flights_climbed": flightsClimbed,
                "walking_speed": walkingSpeed,
                "stand_hours": standHours,
                
                // Body Metrics
                "weight_lbs": weight,
                "body_fat_percentage": bodyFatPercentage,
                "bmi": bmi,
                "height_inches": height,
                "lean_body_mass": leanBodyMass,
                
                // Heart & Vitals
                "resting_heart_rate": restingHeartRate,
                "heart_rate_variability": heartRateVariability,
                "vo2_max": vo2Max,
                "blood_oxygen": bloodOxygen,
                "respiratory_rate": respiratoryRate,
                
                // Sleep
                "sleep_hours": todaySleep,
                
                // Nutrition
                "calories_consumed": caloriesConsumed,
                "protein_grams": protein,
                "carbs_grams": carbs,
                "fat_grams": fat,
                "sugar_grams": sugar,
                "fiber_grams": fiber,
                "water_oz": water,
                "caffeine_mg": caffeine,
                
                // Mindfulness
                "mindful_minutes": mindfulMinutes
            ],
            "source": "ios_app"
        ]
        
        // Create request
        let url = URL(string: "\(backendURL)/api/health/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30 // Add explicit timeout
        
        let jsonData = try JSONSerialization.data(withJSONObject: healthData)
        request.httpBody = jsonData
        
        // Log the request payload for debugging
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print("📤 Request payload: \(jsonString)")
        }
        
        // Send request
        do {
            print("🌐 Sending request to: \(url.absoluteString)")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw HealthKitError.syncFailed("Invalid response from server")
            }
            
            print("📥 Response status: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                await MainActor.run {
                    self.lastSyncDate = Date()
                }
                
                // Log success response
                if let responseString = String(data: data, encoding: .utf8) {
                    print("✅ \(syncType) sync successful. Response: \(responseString)")
                } else {
                    print("✅ \(syncType) sync successful")
                }
                
                // Store last successful sync time (especially useful for background syncs)
                UserDefaults.standard.set(Date(), forKey: isBackgroundSync ? "lastBackgroundHealthSync" : "lastManualHealthSync")
            } else {
                // Try to parse error message
                let responseString = String(data: data, encoding: .utf8) ?? "No response body"
                print("❌ Server error (\(httpResponse.statusCode)): \(responseString)")
                
                var errorMessage = "Failed to sync health data"
                
                // Check for specific database error
                if responseString.contains("health_physical_metrics") && responseString.contains("does not exist") {
                    errorMessage = "Backend database not set up yet. Please run database migrations on your backend server."
                } else if let errorData = try? JSONDecoder().decode(AuthErrorResponse.self, from: data) {
                    errorMessage = errorData.error
                } else {
                    errorMessage = "Server error (\(httpResponse.statusCode))"
                }
                
                throw HealthKitError.syncFailed(errorMessage)
            }
        } catch let error as HealthKitError {
            throw error
        } catch {
            print("❌ Network error: \(error)")
            print("❌ Error details: \(error.localizedDescription)")
            throw HealthKitError.syncFailed("Network error: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Historical Backfill
    
    /// Backfill health data for a date range
    func backfillHistoricalData(fromDate: Date, toDate: Date, authManager: AuthenticationManager) async throws {
        let calendar = Calendar.current
        let startDate = calendar.startOfDay(for: fromDate)
        let endDate = calendar.startOfDay(for: toDate)
        
        guard startDate <= endDate else {
            throw HealthKitError.syncFailed("Start date must be before or equal to end date")
        }
        
        // Calculate total days
        let days = calendar.dateComponents([.day], from: startDate, to: endDate).day ?? 0
        let totalDays = days + 1 // Include both start and end dates
        
        print("📚 Starting backfill from \(startDate) to \(endDate) (\(totalDays) days)")
        
        var currentDate = startDate
        var dayCount = 0
        var successCount = 0
        var failureCount = 0
        
        while currentDate <= endDate {
            dayCount += 1
            
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let dateString = dateFormatter.string(from: currentDate)
            
            print("📅 Processing day \(dayCount)/\(totalDays): \(dateString)")
            
            do {
                // Fetch and sync data for this date
                try await syncToBackend(authManager: authManager, date: currentDate, isBackgroundSync: false)
                successCount += 1
                print("✅ Successfully synced \(dateString)")
            } catch {
                failureCount += 1
                print("❌ Failed to sync \(dateString): \(error.localizedDescription)")
                // Continue with next day even if one fails
            }
            
            // Move to next day
            guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else {
                break
            }
            currentDate = nextDate
            
            // Small delay to avoid overwhelming backend
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        }
        
        print("🎉 Backfill complete! Synced \(successCount)/\(totalDays) days successfully")
        if failureCount > 0 {
            print("⚠️ \(failureCount) days failed to sync")
        }
    }
    
    // MARK: - Category Grouping
    
    /// Get metrics for a specific category
    func getMetrics(for category: HealthCategory) -> [HealthMetric] {
        switch category {
        case .activity:
            return [
                HealthMetric(name: "Steps", value: "\(todaySteps.formatted())", icon: "figure.walk", isPrimary: true),
                HealthMetric(name: "Exercise", value: "\(todayExercise) min", icon: "flame.fill", isPrimary: true),
                HealthMetric(name: "Distance", value: String(format: "%.1f mi", distance), icon: "map", isPrimary: true),
                HealthMetric(name: "Active Calories", value: "\(activeCalories) cal", icon: "flame", isPrimary: false),
                HealthMetric(name: "Flights Climbed", value: "\(flightsClimbed)", icon: "figure.stairs", isPrimary: false),
                HealthMetric(name: "Stand Hours", value: "\(standHours)h", icon: "figure.stand", isPrimary: false),
                HealthMetric(name: "Walking Speed", value: String(format: "%.1f mph", walkingSpeed), icon: "speedometer", isPrimary: false)
            ]
            
        case .body:
            return [
                HealthMetric(name: "Weight", value: weight > 0 ? String(format: "%.1f lbs", weight) : "No data", icon: "scalemass.fill", isPrimary: true),
                HealthMetric(name: "BMI", value: bmi > 0 ? String(format: "%.1f", bmi) : "No data", icon: "chart.bar", isPrimary: true),
                HealthMetric(name: "Body Fat", value: bodyFatPercentage > 0 ? String(format: "%.1f%%", bodyFatPercentage) : "No data", icon: "percent", isPrimary: true),
                HealthMetric(name: "Height", value: height > 0 ? String(format: "%.1f in", height) : "No data", icon: "ruler", isPrimary: false),
                HealthMetric(name: "Lean Body Mass", value: leanBodyMass > 0 ? String(format: "%.1f lbs", leanBodyMass) : "No data", icon: "figure.arms.open", isPrimary: false)
            ]
            
        case .heart:
            return [
                HealthMetric(name: "Resting Heart Rate", value: restingHeartRate > 0 ? "\(restingHeartRate) bpm" : "No data", icon: "heart.fill", isPrimary: true),
                HealthMetric(name: "Blood Oxygen", value: bloodOxygen > 0 ? String(format: "%.0f%%", bloodOxygen) : "No data", icon: "lungs.fill", isPrimary: true),
                HealthMetric(name: "VO2 Max", value: vo2Max > 0 ? String(format: "%.1f", vo2Max) : "No data", icon: "figure.run", isPrimary: true),
                HealthMetric(name: "HRV", value: heartRateVariability > 0 ? String(format: "%.0f ms", heartRateVariability) : "No data", icon: "waveform.path.ecg", isPrimary: false),
                HealthMetric(name: "Respiratory Rate", value: respiratoryRate > 0 ? String(format: "%.0f/min", respiratoryRate) : "No data", icon: "wind", isPrimary: false)
            ]
            
        case .nutrition:
            return [
                HealthMetric(name: "Calories", value: caloriesConsumed > 0 ? String(format: "%.0f cal", caloriesConsumed) : "No data", icon: "flame.fill", isPrimary: true),
                HealthMetric(name: "Water", value: water > 0 ? String(format: "%.0f oz", water) : "No data", icon: "drop.fill", isPrimary: true),
                HealthMetric(name: "Protein", value: protein > 0 ? String(format: "%.0fg", protein) : "No data", icon: "p.circle.fill", isPrimary: true),
                HealthMetric(name: "Carbs", value: carbs > 0 ? String(format: "%.0fg", carbs) : "No data", icon: "c.circle.fill", isPrimary: false),
                HealthMetric(name: "Fat", value: fat > 0 ? String(format: "%.0fg", fat) : "No data", icon: "f.circle.fill", isPrimary: false),
                HealthMetric(name: "Sugar", value: sugar > 0 ? String(format: "%.0fg", sugar) : "No data", icon: "s.circle.fill", isPrimary: false),
                HealthMetric(name: "Fiber", value: fiber > 0 ? String(format: "%.0fg", fiber) : "No data", icon: "leaf.fill", isPrimary: false),
                HealthMetric(name: "Caffeine", value: caffeine > 0 ? String(format: "%.0fmg", caffeine) : "No data", icon: "cup.and.saucer.fill", isPrimary: false)
            ]
            
        case .sleep:
            return [
                HealthMetric(name: "Sleep", value: todaySleep > 0 ? String(format: "%.1fh", todaySleep) : "No data", icon: "bed.double.fill", isPrimary: true)
            ]
            
        case .mindfulness:
            return [
                HealthMetric(name: "Mindful Minutes", value: mindfulMinutes > 0 ? "\(mindfulMinutes) min" : "No data", icon: "brain.head.profile", isPrimary: true)
            ]
        }
    }
    
    /// Get summary text for category card
    func getCategorySummary(for category: HealthCategory) -> String {
        switch category {
        case .activity:
            return "\(todaySteps.formatted()) steps • \(todayExercise) min"
        case .body:
            let weightStr = weight > 0 ? String(format: "%.1f lbs", weight) : "No data"
            let bfStr = bodyFatPercentage > 0 ? String(format: "%.1f%% BF", bodyFatPercentage) : ""
            return "\(weightStr) • \(bfStr)"
        case .heart:
            let hrStr = restingHeartRate > 0 ? "\(restingHeartRate) bpm" : "No data"
            let spo2Str = bloodOxygen > 0 ? String(format: "%.0f%% SpO2", bloodOxygen) : ""
            return "\(hrStr) • \(spo2Str)"
        case .nutrition:
            let calStr = caloriesConsumed > 0 ? String(format: "%.0f cal", caloriesConsumed) : "No data"
            let waterStr = water > 0 ? String(format: "%.0f oz", water) : ""
            return "\(calStr) • \(waterStr)"
        case .sleep:
            return todaySleep > 0 ? String(format: "%.1fh", todaySleep) : "No data"
        case .mindfulness:
            return mindfulMinutes > 0 ? "\(mindfulMinutes) minutes" : "No data"
        }
    }
    
    // MARK: - Health Coach
    
    /// Get health coach recommendations
    func getHealthCoachRecommendations(authManager: AuthenticationManager, timeRange: String = "week") async throws {
        guard let token = authManager.sessionToken,
              let userId = authManager.currentUser?.id else {
            throw HealthKitError.notAuthenticated
        }
        
        await MainActor.run {
            self.isLoadingRecommendations = true
        }
        
        defer {
            Task { @MainActor in
                self.isLoadingRecommendations = false
            }
        }
        
        let url = URL(string: "\(backendURL)/api/health/coach/recommendations")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "timeRange": timeRange
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            if let errorData = try? JSONDecoder().decode(AuthErrorResponse.self, from: data) {
                throw HealthKitError.syncFailed(errorData.error)
            }
            throw HealthKitError.syncFailed("Failed to get recommendations")
        }
        
        let responseData = try JSONDecoder().decode(HealthCoachResponse.self, from: data)
        
        await MainActor.run {
            self.healthCoachRecommendations = responseData.data
        }
    }
    
    // MARK: - Notification Setup
    
    /// Setup notification rules (called when HealthKit is authorized)
    private func setupNotificationRules() {
        // Register step count notification rule
        let stepRule = StepCountNotificationRule(
            threshold: 5000,
            checkHour: 16, // 4 PM
            checkMinute: 0,
            isEnabled: true,
            currentSteps: { self.todaySteps }
        )
        NotificationScheduler.shared.registerRule(stepRule)
        
        // Register exercise reminder notification rule
        setupExerciseNotificationRules()
        
        // Schedule next notification check
        NotificationScheduler.shared.scheduleNextCheck()
        
        print("✅ Notification rules registered and scheduled")
    }
    
    /// Setup exercise notification rules
    private func setupExerciseNotificationRules() {
        let exerciseRule = ExerciseReminderNotificationRule(
            checkHour: 20, // 8 PM
            checkMinute: 30, // 8:30 PM
            isEnabled: true,
            getTodayRoutine: {
                ExerciseManager.shared.getTodayRoutine()
            },
            hasLoggedToday: { routineId in
                do {
                    return try await ExerciseManager.shared.hasLoggedToday(routineId: routineId)
                } catch {
                    return false
                }
            }
        )
        NotificationScheduler.shared.registerRule(exerciseRule)
        print("✅ Exercise reminder notification rule registered")
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


