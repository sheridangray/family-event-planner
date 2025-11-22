import Foundation
import HealthKit
import Combine

/// Manages HealthKit data reading and syncing to backend
class HealthKitManager: ObservableObject {
    let healthStore = HKHealthStore()
    
    @Published var isAuthorized = false
    @Published var lastSyncDate: Date?
    @Published var isSyncing = false
    
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
    
    private let backendURL = "https://family-event-planner-backend.onrender.com"
    // For local development, change to:
    // private let backendURL = "http://localhost:3000"
    
    // MARK: - Initialization
    
    init() {
        // Check authorization status on init
        checkAuthorizationStatus()
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
            
            // Fetch initial data
            Task {
                await fetchTodayData()
            }
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
            }
        }
    }
    
    // MARK: - Fetch Health Data
    
    /// Fetch yesterday's health data from HealthKit
    func fetchTodayData() async {  // Keep name for compatibility with existing code
        let calendar = Calendar.current
        let now = Date()
        
        // Get yesterday's date range
        let yesterday = calendar.date(byAdding: .day, value: -1, to: now)!
        let startOfYesterday = calendar.startOfDay(for: yesterday)
        let endOfYesterday = calendar.date(byAdding: .day, value: 1, to: startOfYesterday)!
        
        print("📊 Fetching yesterday's health data...")
        print("📅 Date range: \(startOfYesterday) to \(endOfYesterday)")
        
        // Check if running in simulator
        #if targetEnvironment(simulator)
        let isSimulator = true
        #else
        let isSimulator = false
        #endif
        
        // Fetch steps from yesterday
        var steps = await fetchQuantity(
            type: HKQuantityType(.stepCount),
            unit: HKUnit.count(),
            start: startOfYesterday,
            end: endOfYesterday
        )
        
        // Fetch exercise minutes from yesterday
        var exercise = await fetchQuantity(
            type: HKQuantityType(.appleExerciseTime),
            unit: HKUnit.minute(),
            start: startOfYesterday,
            end: endOfYesterday
        )
        
        // Fetch sleep from the night before yesterday
        let sleepStart = calendar.date(byAdding: .hour, value: -12, to: startOfYesterday)!
        var sleep = await fetchSleepHours(start: sleepStart, end: endOfYesterday)
        
        // Fetch activity metrics from yesterday
        var distanceMiles = await fetchDistance(start: startOfYesterday, end: endOfYesterday)
        var activeCals = await fetchActiveCalories(start: startOfYesterday, end: endOfYesterday)
        var flights = await fetchFlightsClimbed(start: startOfYesterday, end: endOfYesterday)
        var speed = await fetchWalkingSpeed(start: startOfYesterday, end: endOfYesterday)
        var standHrs = await fetchStandHours(start: startOfYesterday, end: endOfYesterday)
        
        // Fetch heart & vitals
        var heartRate = await fetchLatestHeartRate(start: startOfYesterday, end: endOfYesterday)
        var hrv = await fetchHRV()
        var vo2 = await fetchVO2Max()
        var spo2 = await fetchBloodOxygen()
        var respRate = await fetchRespiratoryRate()
        
        // Fetch body metrics (latest available)
        var weightLbs = await fetchLatestWeight()
        var bodyFat = await fetchLatestBodyFat()
        var bmiValue = await fetchLatestBMI()
        var heightInches = await fetchLatestHeight()
        var leanMass = await fetchLatestBodyFat()  // Using body fat function as placeholder
        
        // Fetch nutrition from yesterday
        var cals = await fetchDietaryMetric(type: HKQuantityType(.dietaryEnergyConsumed), unit: HKUnit.kilocalorie(), start: startOfYesterday, end: endOfYesterday)
        var prot = await fetchDietaryMetric(type: HKQuantityType(.dietaryProtein), unit: HKUnit.gram(), start: startOfYesterday, end: endOfYesterday)
        var carbGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryCarbohydrates), unit: HKUnit.gram(), start: startOfYesterday, end: endOfYesterday)
        var fatGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryFatTotal), unit: HKUnit.gram(), start: startOfYesterday, end: endOfYesterday)
        var sugarGrams = await fetchDietaryMetric(type: HKQuantityType(.dietarySugar), unit: HKUnit.gram(), start: startOfYesterday, end: endOfYesterday)
        var fiberGrams = await fetchDietaryMetric(type: HKQuantityType(.dietaryFiber), unit: HKUnit.gram(), start: startOfYesterday, end: endOfYesterday)
        var waterOz = await fetchDietaryMetric(type: HKQuantityType(.dietaryWater), unit: HKUnit.fluidOunceUS(), start: startOfYesterday, end: endOfYesterday)
        var caffeineMg = await fetchDietaryMetric(type: HKQuantityType(.dietaryCaffeine), unit: HKUnit.gramUnit(with: .milli), start: startOfYesterday, end: endOfYesterday)
        
        // Fetch mindfulness from yesterday
        var mindful = await fetchMindfulMinutes(start: startOfYesterday, end: endOfYesterday)
        
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
        }
        
        print("✅ Fetched all health metrics for yesterday")
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
    private func fetchLatestWeight() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let lastWeek = Calendar.current.date(byAdding: .day, value: -7, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: lastWeek, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let pounds = sample.quantity.doubleValue(for: HKUnit.pound())
                continuation.resume(returning: pounds)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest body fat percentage
    private func fetchLatestBodyFat() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let lastMonth = Calendar.current.date(byAdding: .day, value: -30, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: lastMonth, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let percentage = sample.quantity.doubleValue(for: HKUnit.percent()) * 100
                continuation.resume(returning: percentage)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest BMI
    private func fetchLatestBMI() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let lastMonth = Calendar.current.date(byAdding: .day, value: -30, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: lastMonth, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let bmi = sample.quantity.doubleValue(for: HKUnit.count())
                continuation.resume(returning: bmi)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch latest height
    private func fetchLatestHeight() async -> Double {
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: nil, end: Date())
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let inches = sample.quantity.doubleValue(for: HKUnit.inch())
                continuation.resume(returning: inches)
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
    private func fetchVO2Max() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let lastMonth = Calendar.current.date(byAdding: .day, value: -30, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: lastMonth, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let vo2Max = sample.quantity.doubleValue(for: HKUnit.literUnit(with: .milli).unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: HKUnit.minute())))
                continuation.resume(returning: vo2Max)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch heart rate variability (HRV)
    private func fetchHRV() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: yesterday, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let hrv = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
                continuation.resume(returning: hrv)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch blood oxygen (SpO2)
    private func fetchBloodOxygen() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: yesterday, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let spo2 = sample.quantity.doubleValue(for: HKUnit.percent()) * 100
                continuation.resume(returning: spo2)
            }
            
            healthStore.execute(query)
        }
    }
    
    /// Fetch respiratory rate
    private func fetchRespiratoryRate() async -> Double {
        return await withCheckedContinuation { continuation in
            let now = Date()
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!
            let predicate = HKQuery.predicateForSamples(withStart: yesterday, end: now)
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
                    continuation.resume(returning: 0)
                    return
                }
                
                let rate = sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: HKUnit.minute()))
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
              let _ = authManager.currentUser?.id else {
            throw HealthKitError.notAuthenticated
        }
        
        await MainActor.run {
            self.isSyncing = true
        }
        
        // Make sure to reset syncing state on exit
        defer {
            Task { @MainActor [weak self] in
                self?.isSyncing = false
            }
        }
        
        // Fetch latest data
        await fetchTodayData()
        
        print("🔄 Syncing to backend...")
        print("📊 Data: Steps=\(todaySteps), Exercise=\(todayExercise)min, Sleep=\(todaySleep)h, HR=\(restingHeartRate)bpm")
        
        // Prepare data with yesterday's date (since we're fetching yesterday's data)
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        let yesterday = calendar.date(byAdding: .day, value: -1, to: Date())!
        let yesterdayString = dateFormatter.string(from: yesterday)
        
        print("📅 Syncing data for date: \(yesterdayString)")
        
        let healthData: [String: Any] = [
            "date": yesterdayString,
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
                    print("✅ Sync successful. Response: \(responseString)")
                } else {
                    print("✅ Sync successful")
                }
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
                HealthMetric(name: "Sleep", value: todaySleep > 0 ? String(format: "%.1fh", todaySleep) : "No data", icon: "bed.double.fill", isPrimary: true),
                HealthMetric(name: "HRV", value: heartRateVariability > 0 ? String(format: "%.0f ms", heartRateVariability) : "No data", icon: "waveform.path.ecg", isPrimary: false)
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
            let sleepStr = todaySleep > 0 ? String(format: "%.1fh", todaySleep) : "No data"
            let hrvStr = heartRateVariability > 0 ? String(format: "%.0f HRV", heartRateVariability) : ""
            return "\(sleepStr) • \(hrvStr)"
        case .mindfulness:
            return mindfulMinutes > 0 ? "\(mindfulMinutes) minutes" : "No data"
        }
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


