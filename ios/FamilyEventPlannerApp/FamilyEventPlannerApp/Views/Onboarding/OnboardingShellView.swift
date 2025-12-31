import SwiftUI
import Combine

// --- Models ---

enum OnboardingStep: String, CaseIterable, Codable {
    case welcome
    case goals
    case pillars
    case household
    case timezone
    case diet
    case health
    case permissions
    case review
    
    var index: Int {
        return OnboardingStep.allCases.firstIndex(of: self) ?? 0
    }
}

struct OnboardingPayload: Codable {
    var familyName: String?
    var selectedGoalIds: [String] = []
    var enabledPillarIds: [String] = []
    var timezone: String?
    var units: String = "imperial"
    var dietType: String?
    var allergens: [String] = []
    
    // Health & Fitness
    var activityLevel: String?
    var equipmentIds: [String] = []
    var preferredEquipmentIds: [String] = []
    var healthConstraints: String?
    // Add other fields as needed
}

struct OnboardingStateResponse: Codable {
    let currentStepId: String
    let stepsStatus: [String: String]
    let payload: OnboardingPayload
    let isComplete: Bool
}

// --- View Model ---

class OnboardingViewModel: ObservableObject {
    @Published var currentStep: OnboardingStep = .welcome
    @Published var payload = OnboardingPayload()
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let authManager = AuthenticationManager.shared
    private let apiBaseURL = "http://127.0.0.1:3000/api/onboarding"
    
    var progress: Double {
        return Double(currentStep.index + 1) / Double(OnboardingStep.allCases.count)
    }
    
    var isLastStep: Bool {
        return currentStep == .review
    }
    
    func fetchState() async {
        await MainActor.run { isLoading = true }
        
        do {
            let url = URL(string: "\(apiBaseURL)/state")!
            let request = authManager.authenticatedRequest(url: url)
            
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(OnboardingStateResponse.self, from: data)
            
            await MainActor.run {
                self.currentStep = OnboardingStep(rawValue: response.currentStepId) ?? .welcome
                self.payload = response.payload
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                print("❌ Fetch onboarding state failed: \(error)")
                self.isLoading = false
            }
        }
    }
    
    func saveState() async {
        do {
            let url = URL(string: "\(apiBaseURL)/state")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "PATCH"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "currentStepId": currentStep.rawValue,
                "payloadDelta": try payload.asDictionary()
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (_, _) = try await URLSession.shared.data(for: request)
            print("✅ Onboarding state saved: \(currentStep.rawValue)")
        } catch {
            print("❌ Failed to save onboarding state: \(error.localizedDescription)")
        }
    }
    
    func completeOnboarding() async -> Bool {
        do {
            let url = URL(string: "\(apiBaseURL)/complete")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "POST"
            
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            
            return httpResponse?.statusCode == 200
        } catch {
            print("❌ Completion failed: \(error.localizedDescription)")
            return false
        }
    }
    
    func goNext() {
        // Default pillars based on goals if we're leaving the goals step
        if currentStep == .goals {
            updatePillarsFromGoals()
        }
        
        Task {
            await saveState()
            await MainActor.run {
                if let next = OnboardingStep.allCases.first(where: { $0.index == currentStep.index + 1 }) {
                    currentStep = next
                }
            }
        }
    }
    
    private func updatePillarsFromGoals() {
        // Map goals to pillars
        // time -> time, food -> food, workout -> health, relationships -> relationships, sleep -> sleep, money -> money
        let mapping: [String: String] = [
            "time": "time",
            "food": "food",
            "workout": "health",
            "relationships": "relationships",
            "sleep": "sleep",
            "money": "money"
        ]
        
        var newPillars = Set(payload.enabledPillarIds)
        for goalId in payload.selectedGoalIds {
            if let pillarId = mapping[goalId] {
                newPillars.insert(pillarId)
            }
        }
        payload.enabledPillarIds = Array(newPillars)
    }
    
    func goBack() {
        if let prev = OnboardingStep.allCases.first(where: { $0.index == currentStep.index - 1 }) {
            currentStep = prev
        }
    }
}

// --- Views ---

struct OnboardingShellView: View {
    @ObservedObject var coordinator: AppCoordinator
    @StateObject private var viewModel = OnboardingViewModel()
    
    var body: some View {
        VStack {
            if viewModel.isLoading {
                ProgressView("Loading your setup...")
            } else {
                VStack {
                    // Progress Bar
                    ProgressView(value: viewModel.progress)
                        .padding()
                    
                    // Step Content
                    Group {
                        switch viewModel.currentStep {
                        case .welcome:
                            OnboardingWelcomeView(viewModel: viewModel)
                        case .goals:
                            OnboardingGoalsView(viewModel: viewModel)
                        case .pillars:
                            OnboardingPillarsView(viewModel: viewModel)
                        case .household:
                            OnboardingHouseholdView(viewModel: viewModel)
                        case .timezone:
                            OnboardingLocaleView(viewModel: viewModel)
                        case .diet:
                            OnboardingDietView(viewModel: viewModel)
                        case .health:
                            OnboardingHealthView(viewModel: viewModel)
                        case .permissions:
                            OnboardingPermissionsView(viewModel: viewModel)
                        case .review:
                            OnboardingReviewView(viewModel: viewModel)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    
                    Spacer() // Push buttons to the bottom
                    
                    // Navigation Buttons
                    VStack(spacing: 12) {
                        if viewModel.currentStep != .welcome {
                            Button("Back") {
                                withAnimation { viewModel.goBack() }
                            }
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        
                        Button(action: {
                            if viewModel.isLastStep {
                                Task {
                                    let success = await viewModel.completeOnboarding()
                                    if success {
                                        await MainActor.run {
                                            coordinator.didCompleteOnboarding()
                                        }
                                    }
                                }
                            } else {
                                withAnimation { viewModel.goNext() }
                            }
                        }) {
                            Text(viewModel.isLastStep ? "Finish" : "Next")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 30)
                }
            }
        }
        .task {
            await viewModel.fetchState()
        }
    }
}

// Helper for Encodable -> Dictionary
extension Encodable {
    func asDictionary() throws -> [String: Any] {
        let data = try JSONEncoder().encode(self)
        guard let dictionary = try JSONSerialization.jsonObject(with: data, options: .allowFragments) as? [String: Any] else {
            throw NSError()
        }
        return dictionary
    }
}

// --- Step Views (Refined) ---

struct OnboardingWelcomeView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 80))
                .foregroundColor(.yellow)
            Text("Welcome to Integrated Life")
                .font(.largeTitle)
                .bold()
                .multilineTextAlignment(.center)
            Text("Your proactive life operating system.")
                .font(.title3)
                .foregroundColor(.secondary)
            
            VStack(alignment: .leading, spacing: 15) {
                Label("Proactive suggestions", systemImage: "bolt.fill")
                Label("Orchestrates your tools", systemImage: "app.connected.to.app.below.fill")
                Label("Reduces decision fatigue", systemImage: "brain.head.profile")
            }
            .padding(.top, 20)
        }
        .padding()
    }
}

struct OnboardingGoalsView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    let options = [
        ("time", "Save Time", "calendar"),
        ("food", "Eat Better", "fork.knife"),
        ("workout", "Workout More", "figure.run"),
        ("relationships", "Deepen Relationships", "heart.fill"),
        ("sleep", "Sleep Better", "moon.fill"),
        ("money", "Track Wealth", "banknote.fill")
    ]
    
    var body: some View {
        VStack {
            Text("What are your primary goals?")
                .font(.title2).bold()
                .padding()
            
            List(options, id: \.0) { id, title, icon in
                HStack(spacing: 15) {
                    Image(systemName: icon)
                        .foregroundColor(.blue)
                        .frame(width: 30, alignment: .center)
                    Text(title)
                    Spacer()
                    if viewModel.payload.selectedGoalIds.contains(id) {
                        Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if viewModel.payload.selectedGoalIds.contains(id) {
                        viewModel.payload.selectedGoalIds.removeAll(where: { $0 == id })
                    } else {
                        viewModel.payload.selectedGoalIds.append(id)
                    }
                }
            }
        }
    }
}

struct OnboardingPillarsView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    let pillars = [
        ("time", "Time", "Clock & Planning"),
        ("food", "Food", "Recipes & Nutrition"),
        ("health", "Health", "Workouts & Body"),
        ("relationships", "Relationships", "People & Rituals"),
        ("sleep", "Sleep", "Recovery & Hygiene"),
        ("money", "Money", "Net Worth & Budget")
    ]
    
    var body: some View {
        VStack {
            Text("Select your active pillars")
                .font(.title2).bold()
            Text("We'll set up your dashboard based on these.")
                .font(.subheadline).foregroundColor(.secondary)
            
            ScrollView {
                VStack(spacing: 15) {
                    ForEach(pillars, id: \.0) { id, title, desc in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(title).font(.headline)
                                Text(desc).font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { viewModel.payload.enabledPillarIds.contains(id) },
                                set: { isOn in
                                    if isOn { viewModel.payload.enabledPillarIds.append(id) }
                                    else { viewModel.payload.enabledPillarIds.removeAll(where: { $0 == id }) }
                                }
                            ))
                        }
                        .padding()
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(10)
                    }
                }
                .padding()
            }
        }
    }
}

struct OnboardingHouseholdView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        VStack(spacing: 30) {
            Text("Your Household")
                .font(.title2).bold()
            
            VStack(alignment: .leading, spacing: 10) {
                Text("Family Name")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .bold()
                
                TextField("e.g. The Grays", text: Binding(
                    get: { viewModel.payload.familyName ?? "" },
                    set: { viewModel.payload.familyName = $0 }
                ))
                .textFieldStyle(.roundedBorder)
                .font(.title3)
            }
            .padding()
            
            Text("This will be used to label your shared plans and dashboard.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Spacer()
        }
        .padding(.top)
    }
}

struct OnboardingLocaleView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        VStack(spacing: 30) {
            Text("Locale & Units")
                .font(.title2).bold()
            
            Form {
                Section("Measurement Units") {
                    Picker("Units", selection: $viewModel.payload.units) {
                        Text("Imperial (lb, mi)").tag("imperial")
                        Text("Metric (kg, km)").tag("metric")
                    }
                    .pickerStyle(.menu)
                }
            }
            .scrollContentBackground(.hidden)
            
            Spacer()
        }
        .padding(.top)
    }
}

struct OnboardingDietView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        VStack {
            Text("Dietary Preferences")
                .font(.title2).bold()
            Text("Optional: Helps the coach suggest recipes.")
                .font(.caption).foregroundColor(.secondary)
            
            Form {
                Picker("Diet Type", selection: $viewModel.payload.dietType) {
                    Text("None").tag(String?.none)
                    Text("Vegetarian").tag(String?.some("vegetarian"))
                    Text("Vegan").tag(String?.some("vegan"))
                    Text("Keto").tag(String?.some("keto"))
                    Text("Paleo").tag(String?.some("paleo"))
                }
            }
        }
    }
}

struct OnboardingHealthView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    struct EquipmentOption: Identifiable {
        let id: String
        let name: String
        let icon: String
    }
    
    let equipmentList = [
        EquipmentOption(id: "mi7", name: "Mi7Smith Functional Trainer", icon: "gym.bag.fill"),
        EquipmentOption(id: "squat_rack", name: "Squat Rack", icon: "figure.strengthtraining.traditional"),
        EquipmentOption(id: "full_gym", name: "Full Gym Access", icon: "building.columns.fill"),
        EquipmentOption(id: "dumbbells", name: "Dumbbells / Kettlebells", icon: "dumbbell.fill"),
        EquipmentOption(id: "bodyweight", name: "Bodyweight Only", icon: "figure.walk")
    ]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Health & Fitness")
                .font(.title2).bold()
                .padding(.horizontal)
            
            Text("Select the equipment you have access to, and tap the star (★) for your preferred focus.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.horizontal)
            
            List(equipmentList) { item in
                HStack(spacing: 15) {
                    // Have Checkbox
                    Image(systemName: viewModel.payload.equipmentIds.contains(item.id) ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(viewModel.payload.equipmentIds.contains(item.id) ? .blue : .secondary)
                        .font(.title3)
                    
                    VStack(alignment: .leading) {
                        Text(item.name)
                            .font(.body)
                    }
                    
                    Spacer()
                    
                    // Prefer Star
                    if viewModel.payload.equipmentIds.contains(item.id) {
                        Button {
                            togglePreference(item.id)
                        } label: {
                            Image(systemName: viewModel.payload.preferredEquipmentIds.contains(item.id) ? "star.fill" : "star")
                                .foregroundColor(.yellow)
                                .font(.title3)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    toggleEquipment(item.id)
                }
            }
            .listStyle(.plain)
            
            VStack(alignment: .leading, spacing: 10) {
                Text("Constraints & Injuries (Optional)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .bold()
                
                TextField("e.g. knee pain, no overhead pressing", text: Binding(
                    get: { viewModel.payload.healthConstraints ?? "" },
                    set: { viewModel.payload.healthConstraints = $0 }
                ))
                .textFieldStyle(.roundedBorder)
            }
            .padding()
        }
    }
    
    func toggleEquipment(_ id: String) {
        if viewModel.payload.equipmentIds.contains(id) {
            viewModel.payload.equipmentIds.removeAll { $0 == id }
            viewModel.payload.preferredEquipmentIds.removeAll { $0 == id }
        } else {
            viewModel.payload.equipmentIds.append(id)
        }
    }
    
    func togglePreference(_ id: String) {
        if viewModel.payload.preferredEquipmentIds.contains(id) {
            viewModel.payload.preferredEquipmentIds.removeAll { $0 == id }
        } else {
            viewModel.payload.preferredEquipmentIds.append(id)
        }
    }
}

struct OnboardingPermissionsView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        VStack(spacing: 30) {
            Text("Enable Connections")
                .font(.title2).bold()
            
            VStack(alignment: .leading, spacing: 20) {
                PermissionRow(title: "Notifications", icon: "bell.fill", color: .red) {
                    // Trigger
                }
                PermissionRow(title: "Apple Health", icon: "heart.fill", color: .pink) {
                    // Trigger
                }
                PermissionRow(title: "Calendar", icon: "calendar", color: .blue) {
                    // Trigger
                }
            }
            .padding()
        }
    }
}

struct PermissionRow: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: icon).foregroundColor(color).font(.title3)
            Text(title).font(.headline)
            Spacer()
            Button("Enable", action: action).buttonStyle(.bordered)
        }
    }
}

struct OnboardingReviewView: View {
    @ObservedObject var viewModel: OnboardingViewModel
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Review your Setup").font(.title2).bold()
                
                SectionView(title: "Household", value: viewModel.payload.familyName ?? "Not set")
                SectionView(title: "Goals", value: viewModel.payload.selectedGoalIds.map { id in
                    // Map IDs to pretty names for the review screen
                    switch id {
                    case "time": return "Save Time"
                    case "food": return "Eat Better"
                    case "workout": return "Workout More"
                    case "relationships": return "Deepen Relationships"
                    case "sleep": return "Sleep Better"
                    case "money": return "Track Wealth"
                    default: return id
                    }
                }.joined(separator: ", "))
                SectionView(title: "Pillars", value: viewModel.payload.enabledPillarIds.map { $0.capitalized }.joined(separator: ", "))
                SectionView(title: "Units", value: viewModel.payload.units.capitalized)
                
                if !viewModel.payload.equipmentIds.isEmpty {
                    SectionView(title: "Equipment", value: viewModel.payload.equipmentIds.map { id in
                        switch id {
                        case "mi7": return "Mi7Smith"
                        case "squat_rack": return "Squat Rack"
                        case "full_gym": return "Full Gym"
                        case "dumbbells": return "Dumbbells"
                        case "bodyweight": return "Bodyweight"
                        default: return id
                        }
                    }.joined(separator: ", "))
                }
                
                if !viewModel.payload.preferredEquipmentIds.isEmpty {
                    SectionView(title: "Preferred Focus", value: viewModel.payload.preferredEquipmentIds.map { id in
                        switch id {
                        case "mi7": return "Mi7Smith"
                        case "squat_rack": return "Squat Rack"
                        case "full_gym": return "Full Gym"
                        case "dumbbells": return "Dumbbells"
                        case "bodyweight": return "Bodyweight"
                        default: return id
                        }
                    }.joined(separator: ", "))
                }
                
                if let constraints = viewModel.payload.healthConstraints, !constraints.isEmpty {
                    SectionView(title: "Constraints", value: constraints)
                }
            }
            .padding()
        }
    }
}

struct SectionView: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption).foregroundColor(.secondary).bold()
            Text(value).font(.body)
            Divider()
        }
    }
}
