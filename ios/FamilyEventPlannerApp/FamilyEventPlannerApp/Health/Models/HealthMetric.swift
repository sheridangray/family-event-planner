import Foundation

/// Individual health metric representation
struct HealthMetric: Identifiable {
    let id = UUID()
    let name: String
    let value: String
    let icon: String
    let isPrimary: Bool
    
    init(name: String, value: String, icon: String, isPrimary: Bool = false) {
        self.name = name
        self.value = value
        self.icon = icon
        self.isPrimary = isPrimary
    }
}

