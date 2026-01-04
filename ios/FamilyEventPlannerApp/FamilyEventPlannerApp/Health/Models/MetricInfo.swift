import SwiftUI

/// Educational information about health metrics
struct MetricInfo {
    let identifier: MetricIdentifier
    let name: String
    let description: String
    let importance: String
    let typicalRange: String
    let unit: String
    let category: HealthCategory
    let color: Color
    
    static func get(for identifier: MetricIdentifier) -> MetricInfo {
        switch identifier {
        case .steps:
            return MetricInfo(
                identifier: .steps,
                name: "Steps",
                description: "Steps represent the total number of steps you take throughout the day.",
                importance: "Tracking steps helps monitor daily activity levels and can motivate you to stay active. The widely recommended goal is 10,000 steps per day for general health.",
                typicalRange: "5,000-10,000 steps/day (sedentary), 10,000-15,000 steps/day (active), 15,000+ steps/day (very active)",
                unit: "steps",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .exercise:
            return MetricInfo(
                identifier: .exercise,
                name: "Exercise Minutes",
                description: "Exercise minutes track the time spent doing moderate to vigorous physical activity.",
                importance: "Regular exercise improves cardiovascular health, strengthens muscles, and boosts mental well-being. Aim for at least 150 minutes per week.",
                typicalRange: "150-300 minutes/week (moderate activity), 75-150 minutes/week (vigorous activity)",
                unit: "minutes",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .distance:
            return MetricInfo(
                identifier: .distance,
                name: "Distance",
                description: "Distance measures the total miles or kilometers you've walked or run.",
                importance: "Tracking distance helps set and achieve fitness goals, and provides a clear measure of your movement throughout the day.",
                typicalRange: "2-5 miles/day (moderate activity), 5-10 miles/day (active)",
                unit: "miles",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .activeCalories:
            return MetricInfo(
                identifier: .activeCalories,
                name: "Active Calories",
                description: "Active calories are calories burned through physical activity, excluding your basal metabolic rate.",
                importance: "Understanding active calorie burn helps balance energy intake and expenditure, supporting weight management goals.",
                typicalRange: "200-400 calories/day (light activity), 400-800 calories/day (moderate activity), 800+ calories/day (intense activity)",
                unit: "calories",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .flightsClimbed:
            return MetricInfo(
                identifier: .flightsClimbed,
                name: "Flights Climbed",
                description: "Flights climbed count the number of staircases (typically 10-12 steps) you've ascended.",
                importance: "Climbing stairs is an excellent cardiovascular exercise that strengthens leg muscles and improves endurance.",
                typicalRange: "5-10 flights/day (moderate), 10-20 flights/day (active)",
                unit: "flights",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .standHours:
            return MetricInfo(
                identifier: .standHours,
                name: "Stand Hours",
                description: "Stand hours track how many hours per day you've stood and moved for at least one minute.",
                importance: "Reducing sedentary time by standing regularly can improve circulation, reduce back pain, and lower health risks.",
                typicalRange: "8-12 hours/day (recommended)",
                unit: "hours",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .walkingSpeed:
            return MetricInfo(
                identifier: .walkingSpeed,
                name: "Walking Speed",
                description: "Walking speed measures your average pace while walking.",
                importance: "Walking speed is a strong indicator of overall health and mobility. Faster walking speeds are associated with better health outcomes.",
                typicalRange: "2.5-3.5 mph (normal), 3.5-4.5 mph (brisk), 4.5+ mph (very fast)",
                unit: "mph",
                category: .activity,
                color: .sunsetDustyBlue
            )
        case .weight:
            return MetricInfo(
                identifier: .weight,
                name: "Weight",
                description: "Body weight is a fundamental health metric that reflects overall body composition.",
                importance: "Maintaining a healthy weight reduces risk of chronic diseases. Weight should be monitored in context with other metrics like BMI and body fat percentage.",
                typicalRange: "Varies by height, age, and body composition. Consult with healthcare provider for personalized targets.",
                unit: "lbs",
                category: .body,
                color: .sunsetLavender
            )
        case .bmi:
            return MetricInfo(
                identifier: .bmi,
                name: "BMI",
                description: "Body Mass Index (BMI) is a calculation using height and weight to estimate body fat.",
                importance: "BMI provides a quick screening tool for weight categories, though it doesn't account for muscle mass or body composition.",
                typicalRange: "18.5-24.9 (normal), 25-29.9 (overweight), 30+ (obese), Below 18.5 (underweight)",
                unit: "",
                category: .body,
                color: .sunsetLavender
            )
        case .bodyFat:
            return MetricInfo(
                identifier: .bodyFat,
                name: "Body Fat",
                description: "Body fat percentage measures the proportion of fat to total body weight.",
                importance: "Body fat percentage is a more accurate indicator of health than weight alone, as it accounts for muscle mass and body composition.",
                typicalRange: "Men: 10-20% (athletic), 20-25% (acceptable), 25%+ (high). Women: 16-24% (athletic), 24-30% (acceptable), 30%+ (high)",
                unit: "%",
                category: .body,
                color: .sunsetLavender
            )
        case .height:
            return MetricInfo(
                identifier: .height,
                name: "Height",
                description: "Height is a static measurement that rarely changes after adulthood.",
                importance: "Height is used in calculations like BMI and helps healthcare providers assess growth and development.",
                typicalRange: "Varies by genetics, age, and gender",
                unit: "inches",
                category: .body,
                color: .sunsetLavender
            )
        case .leanBodyMass:
            return MetricInfo(
                identifier: .leanBodyMass,
                name: "Lean Body Mass",
                description: "Lean body mass includes all body weight except fat (muscle, bones, organs, water).",
                importance: "Higher lean body mass is associated with better metabolic health, strength, and functional ability.",
                typicalRange: "Varies significantly by age, gender, and activity level",
                unit: "lbs",
                category: .body,
                color: .sunsetLavender
            )
        case .restingHeartRate:
            return MetricInfo(
                identifier: .restingHeartRate,
                name: "Resting Heart Rate",
                description: "Resting heart rate is the number of times your heart beats per minute while at rest.",
                importance: "A lower resting heart rate generally indicates better cardiovascular fitness. It's a key indicator of heart health.",
                typicalRange: "60-100 bpm (normal), 40-60 bpm (athletic), Below 40 or above 100 (consult doctor)",
                unit: "bpm",
                category: .heart,
                color: .sunsetCoral
            )
        case .bloodOxygen:
            return MetricInfo(
                identifier: .bloodOxygen,
                name: "Blood Oxygen",
                description: "Blood oxygen saturation (SpO2) measures the percentage of oxygen-carrying hemoglobin in your blood.",
                importance: "Normal oxygen levels are essential for proper body function. Low levels can indicate respiratory or cardiovascular issues.",
                typicalRange: "95-100% (normal), 90-95% (low, consult doctor), Below 90% (seek immediate medical attention)",
                unit: "%",
                category: .heart,
                color: .sunsetCoral
            )
        case .vo2Max:
            return MetricInfo(
                identifier: .vo2Max,
                name: "VO2 Max",
                description: "VO2 Max measures your body's maximum ability to consume oxygen during exercise.",
                importance: "VO2 Max is considered the gold standard for cardiovascular fitness. Higher values indicate better aerobic capacity.",
                typicalRange: "Varies by age and gender. Men: 35-45 (average), 45-55 (good), 55+ (excellent). Women: 27-35 (average), 35-45 (good), 45+ (excellent)",
                unit: "ml/kg/min",
                category: .heart,
                color: .sunsetCoral
            )
        case .hrv:
            return MetricInfo(
                identifier: .hrv,
                name: "HRV",
                description: "Heart Rate Variability (HRV) measures the variation in time between heartbeats.",
                importance: "Higher HRV generally indicates better recovery, lower stress, and improved fitness. It's a key metric for training optimization.",
                typicalRange: "Varies widely by individual. Generally 20-60ms (low), 60-100ms (moderate), 100+ms (high). Higher is typically better.",
                unit: "ms",
                category: .heart,
                color: .sunsetCoral
            )
        case .respiratoryRate:
            return MetricInfo(
                identifier: .respiratoryRate,
                name: "Respiratory Rate",
                description: "Respiratory rate is the number of breaths you take per minute.",
                importance: "Normal respiratory rate indicates healthy lung function. Abnormal rates can signal respiratory or cardiovascular issues.",
                typicalRange: "12-20 breaths/min (normal adult), Above 20 or below 12 (consult doctor)",
                unit: "breaths/min",
                category: .heart,
                color: .sunsetCoral
            )
        case .calories:
            return MetricInfo(
                identifier: .calories,
                name: "Calories",
                description: "Calories consumed represent the total energy intake from food and beverages.",
                importance: "Tracking calories helps maintain energy balance. Consuming appropriate calories supports weight management and overall health.",
                typicalRange: "1,800-2,400 calories/day (women), 2,200-3,000 calories/day (men). Varies by activity level and goals.",
                unit: "calories",
                category: .nutrition,
                color: .sunsetGold
            )
        case .water:
            return MetricInfo(
                identifier: .water,
                name: "Water",
                description: "Water intake measures the amount of fluids you consume throughout the day.",
                importance: "Adequate hydration is essential for all bodily functions, including temperature regulation, digestion, and cognitive function.",
                typicalRange: "64-96 oz/day (8-12 cups) for most adults. More may be needed with exercise or hot weather.",
                unit: "oz",
                category: .nutrition,
                color: .sunsetGold
            )
        case .protein:
            return MetricInfo(
                identifier: .protein,
                name: "Protein",
                description: "Protein is an essential macronutrient needed for muscle repair, immune function, and many bodily processes.",
                importance: "Adequate protein intake supports muscle maintenance, recovery from exercise, and overall health.",
                typicalRange: "0.8-1.0g per kg body weight (minimum), 1.2-2.0g per kg (active individuals), 2.0+ g per kg (athletes)",
                unit: "grams",
                category: .nutrition,
                color: .sunsetGold
            )
        case .carbs:
            return MetricInfo(
                identifier: .carbs,
                name: "Carbohydrates",
                description: "Carbohydrates are the body's primary energy source, found in foods like grains, fruits, and vegetables.",
                importance: "Carbs fuel your brain and muscles. The right amount depends on activity level and health goals.",
                typicalRange: "45-65% of total calories. 130g/day minimum for brain function. Active individuals may need 3-5g per kg body weight.",
                unit: "grams",
                category: .nutrition,
                color: .sunsetGold
            )
        case .fat:
            return MetricInfo(
                identifier: .fat,
                name: "Fat",
                description: "Dietary fat is essential for hormone production, vitamin absorption, and energy storage.",
                importance: "Healthy fats support brain function, cell structure, and nutrient absorption. Focus on unsaturated fats.",
                typicalRange: "20-35% of total calories. Minimum 0.5g per kg body weight for essential functions.",
                unit: "grams",
                category: .nutrition,
                color: .sunsetGold
            )
        case .sugar:
            return MetricInfo(
                identifier: .sugar,
                name: "Sugar",
                description: "Sugar intake includes both natural and added sugars from foods and beverages.",
                importance: "Excessive sugar consumption is linked to weight gain, diabetes, and other health issues. Moderation is key.",
                typicalRange: "Less than 10% of total calories (WHO recommendation). For 2000 calories: less than 50g added sugar/day.",
                unit: "grams",
                category: .nutrition,
                color: .sunsetGold
            )
        case .fiber:
            return MetricInfo(
                identifier: .fiber,
                name: "Fiber",
                description: "Fiber is a type of carbohydrate that supports digestive health and helps regulate blood sugar.",
                importance: "Adequate fiber intake promotes healthy digestion, helps maintain healthy weight, and reduces disease risk.",
                typicalRange: "25g/day (women), 38g/day (men). Most people consume less than half the recommended amount.",
                unit: "grams",
                category: .nutrition,
                color: .sunsetGold
            )
        case .caffeine:
            return MetricInfo(
                identifier: .caffeine,
                name: "Caffeine",
                description: "Caffeine is a stimulant found in coffee, tea, and other beverages.",
                importance: "Moderate caffeine can improve focus and performance, but excessive amounts can cause anxiety and sleep disruption.",
                typicalRange: "Up to 400mg/day (about 4 cups of coffee) is generally safe for most adults. Individual tolerance varies.",
                unit: "mg",
                category: .nutrition,
                color: .sunsetGold
            )
        case .sleep:
            return MetricInfo(
                identifier: .sleep,
                name: "Sleep",
                description: "Sleep duration measures the total time spent sleeping, including all sleep stages.",
                importance: "Quality sleep is essential for physical recovery, cognitive function, immune health, and overall well-being.",
                typicalRange: "7-9 hours/night (adults), 9-11 hours (teens), 10-13 hours (children). Consistency matters as much as duration.",
                unit: "hours",
                category: .sleep,
                color: .sunsetSlate
            )
        case .mindfulMinutes:
            return MetricInfo(
                identifier: .mindfulMinutes,
                name: "Mindful Minutes",
                description: "Mindful minutes track time spent in meditation, breathing exercises, or other mindfulness practices.",
                importance: "Regular mindfulness practice reduces stress, improves focus, and enhances emotional well-being.",
                typicalRange: "10-20 minutes/day (beginner), 20-30 minutes/day (regular practice), 30+ minutes/day (advanced)",
                unit: "minutes",
                category: .mindfulness,
                color: .sunsetPeach
            )
        }
    }
}
