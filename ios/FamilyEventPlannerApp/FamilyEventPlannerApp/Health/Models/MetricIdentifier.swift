import Foundation

/// Unique identifier for health metrics
enum MetricIdentifier: String, CaseIterable {
    // Activity & Fitness
    case steps = "Steps"
    case exercise = "Exercise"
    case distance = "Distance"
    case activeCalories = "Active Calories"
    case flightsClimbed = "Flights Climbed"
    case standHours = "Stand Hours"
    case walkingSpeed = "Walking Speed"
    
    // Body Metrics
    case weight = "Weight"
    case bmi = "BMI"
    case bodyFat = "Body Fat"
    case height = "Height"
    case leanBodyMass = "Lean Body Mass"
    
    // Heart & Vitals
    case restingHeartRate = "Resting Heart Rate"
    case bloodOxygen = "Blood Oxygen"
    case vo2Max = "VO2 Max"
    case hrv = "HRV"
    case respiratoryRate = "Respiratory Rate"
    
    // Nutrition
    case calories = "Calories"
    case water = "Water"
    case protein = "Protein"
    case carbs = "Carbs"
    case fat = "Fat"
    case sugar = "Sugar"
    case fiber = "Fiber"
    case caffeine = "Caffeine"
    
    // Sleep & Recovery
    case sleep = "Sleep"
    
    // Mindfulness
    case mindfulMinutes = "Mindful Minutes"
    
    /// Get the HealthKit type for this metric
    var healthKitType: String? {
        switch self {
        case .steps: return "stepCount"
        case .exercise: return "appleExerciseTime"
        case .distance: return "distanceWalkingRunning"
        case .activeCalories: return "activeEnergyBurned"
        case .flightsClimbed: return "flightsClimbed"
        case .standHours: return "appleStandTime"
        case .walkingSpeed: return "walkingSpeed"
        case .weight: return "bodyMass"
        case .bmi: return "bodyMassIndex"
        case .bodyFat: return "bodyFatPercentage"
        case .height: return "height"
        case .leanBodyMass: return "leanBodyMass"
        case .restingHeartRate: return "restingHeartRate"
        case .bloodOxygen: return "oxygenSaturation"
        case .vo2Max: return "vo2Max"
        case .hrv: return "heartRateVariabilitySDNN"
        case .respiratoryRate: return "respiratoryRate"
        case .calories: return "dietaryEnergyConsumed"
        case .water: return "dietaryWater"
        case .protein: return "dietaryProtein"
        case .carbs: return "dietaryCarbohydrates"
        case .fat: return "dietaryFatTotal"
        case .sugar: return "dietarySugar"
        case .fiber: return "dietaryFiber"
        case .caffeine: return "dietaryCaffeine"
        case .sleep: return "sleepAnalysis"
        case .mindfulMinutes: return "mindfulSession"
        }
    }
    
    /// Check if this metric should be aggregated (sum) vs averaged
    var isAggregated: Bool {
        switch self {
        case .steps, .exercise, .distance, .activeCalories, .flightsClimbed, .standHours,
             .calories, .water, .protein, .carbs, .fat, .sugar, .fiber, .caffeine,
             .sleep, .mindfulMinutes:
            return true // Sum these
        case .weight, .bmi, .bodyFat, .height, .leanBodyMass,
             .restingHeartRate, .bloodOxygen, .vo2Max, .hrv, .respiratoryRate,
             .walkingSpeed:
            return false // Average these
        }
    }
}

