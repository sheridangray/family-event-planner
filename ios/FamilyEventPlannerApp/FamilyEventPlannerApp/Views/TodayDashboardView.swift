import SwiftUI
import Combine

struct DashboardBriefing: Codable {
    let enabledPillars: [String]
    let greeting: String
    // Add other fields as needed
}

struct CalendarEvent: Codable, Identifiable {
    let id: String
    let summary: String
    let start: String
    let end: String
    let location: String?
    
    var startTime: String {
        // Simple formatting for now
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: start) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "HH:mm"
            return displayFormatter.string(from: date)
        }
        return start
    }
}

struct CalendarResponse: Codable {
    let success: Bool
    let events: [CalendarEvent]?
    let error: String?
}

struct BriefingResponse: Codable {
    let success: Bool
    let briefing: DashboardBriefing?
    let error: String?
}

class DashboardViewModel: ObservableObject {
    @Published var enabledPillars: [String] = []
    @Published var greeting: String = "Welcome!"
    @Published var nextEvents: [CalendarEvent] = []
    @Published var isLoading = false
    
    private let authManager = AuthenticationManager.shared
    private var apiBaseURL: String { AppConfig.apiBaseURL }
    
    func fetchDashboard() async {
        await MainActor.run { isLoading = true }
        
        do {
            // 1. Fetch Briefing
            let briefingUrl = URL(string: "\(apiBaseURL)/coach/briefing")!
            let briefingRequest = authManager.authenticatedRequest(url: briefingUrl)
            let (briefingData, briefingResp) = try await URLSession.shared.data(for: briefingRequest)
            
            if let httpResponse = briefingResp as? HTTPURLResponse, httpResponse.statusCode == 200 {
                let response = try JSONDecoder().decode(BriefingResponse.self, from: briefingData)
                await MainActor.run {
                    if let briefing = response.briefing {
                        self.enabledPillars = briefing.enabledPillars
                        self.greeting = briefing.greeting
                    }
                }
            }

            // 2. Fetch Calendar
            let calendarUrl = URL(string: "\(apiBaseURL)/calendar/events?days=7")!
            let calendarRequest = authManager.authenticatedRequest(url: calendarUrl)
            let (calendarData, calendarResp) = try await URLSession.shared.data(for: calendarRequest)
            
            if let httpResponse = calendarResp as? HTTPURLResponse, httpResponse.statusCode == 200 {
                let response = try JSONDecoder().decode(CalendarResponse.self, from: calendarData)
                await MainActor.run {
                    self.nextEvents = response.events ?? []
                }
            } else {
                // If calendar is not connected or fails, we just show empty events instead of crashing
                print("ℹ️ Calendar events not available (Status: \((calendarResp as? HTTPURLResponse)?.statusCode ?? 0))")
                await MainActor.run {
                    self.nextEvents = []
                }
            }
            
            await MainActor.run { self.isLoading = false }
        } catch {
            await MainActor.run {
                print("❌ Fetch dashboard failed: \(error)")
                self.isLoading = false
            }
        }
    }
    
    func updatePillars(_ pillars: [String]) async {
        do {
            let url = URL(string: "\(apiBaseURL)/coach/pillars")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "PATCH"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["enabledPillars": pillars])
            
            let (_, _) = try await URLSession.shared.data(for: request)
            await MainActor.run {
                self.enabledPillars = pillars
            }
        } catch {
            print("❌ Update pillars failed: \(error)")
        }
    }
}

struct TodayDashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @ObservedObject var coordinator: AppCoordinator
    @StateObject private var viewModel = DashboardViewModel()
    @State private var showingEditPillars = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading) {
                        Text("Welcome back, \(authManager.currentUser?.name.split(separator: " ").first ?? "there")!")
                            .font(.title2)
                            .bold()
                        Text(viewModel.greeting)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    
                    Button(action: { showingEditPillars = true }) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.title3)
                            .foregroundColor(.primary)
                    }
                }
                .padding(.horizontal)
                
                // Coach Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "sparkles")
                            .foregroundColor(.yellow)
                        Text("COACH")
                            .font(.caption)
                            .bold()
                            .foregroundColor(.secondary)
                    }
                    
                    Text("You've had 3 late dinners this week. Here's a faster plan for tonight.")
                        .font(.body)
                        .padding(.vertical, 5)
                    
                    HStack {
                        Button("See suggestion") {
                            // Action
                        }
                        .buttonStyle(.bordered)
                        
                        Spacer()
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(15)
                .padding(.horizontal)
                
                // Today's Pillars Summary
                let activePillars = viewModel.enabledPillars
                if !activePillars.isEmpty {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 15) {
                        if activePillars.contains("time") {
                            PillarSummaryCard(title: "Time", icon: "clock.fill", value: "3 blocks", color: .blue)
                        }
                        if activePillars.contains("health") {
                            NavigationLink(destination: HealthSyncView()) {
                                PillarSummaryCard(title: "Health", icon: "heart.fill", value: "80% goal", color: .red)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                        if activePillars.contains("food") {
                            PillarSummaryCard(title: "Food", icon: "fork.knife", value: "Salmon", color: .orange)
                        }
                        if activePillars.contains("money") {
                            PillarSummaryCard(title: "Money", icon: "banknote.fill", value: "+$240", color: .green)
                        }
                        if activePillars.contains("relationships") {
                            PillarSummaryCard(title: "Relationships", icon: "person.2.fill", value: "Date Night", color: .purple)
                        }
                        if activePillars.contains("sleep") {
                            PillarSummaryCard(title: "Sleep", icon: "moon.fill", value: "7.5h", color: .indigo)
                        }
                    }
                    .padding(.horizontal)
                }
                
                // Timeline / Agenda List
                VStack(alignment: .leading) {
                    Text("Next Up")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    if viewModel.nextEvents.isEmpty {
                        Text("No events scheduled for today.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(viewModel.nextEvents) { event in
                                AgendaRow(time: event.startTime, title: event.summary, category: event.location ?? "Calendar")
                            }
                        }
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(15)
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Color(.systemBackground))
        .task {
            await viewModel.fetchDashboard()
        }
        .sheet(isPresented: $showingEditPillars) {
            EditPillarsView(viewModel: viewModel)
        }
    }
}

struct EditPillarsView: View {
    @ObservedObject var viewModel: DashboardViewModel
    @Environment(\.dismiss) var dismiss
    @State private var localEnabledPillars: Set<String> = []
    
    let allPillars = [
        ("time", "Time", "Clock & Planning", "clock.fill", Color.blue),
        ("food", "Food", "Recipes & Nutrition", "fork.knife", Color.orange),
        ("health", "Health", "Workouts & Body", "heart.fill", Color.red),
        ("relationships", "Relationships", "People & Rituals", "person.2.fill", Color.purple),
        ("sleep", "Sleep", "Recovery & Hygiene", "moon.fill", Color.indigo),
        ("money", "Money", "Net Worth & Budget", "banknote.fill", Color.green)
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header matching Onboarding
            VStack(spacing: 8) {
                Text("Active Pillars")
                    .font(.title).bold()
                    .multilineTextAlignment(.center)
                Text("Customize your dashboard focus.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 40)
            .padding(.horizontal)
            
            ScrollView {
                VStack(spacing: 15) {
                    ForEach(allPillars, id: \.0) { id, title, desc, icon, color in
                        HStack {
                            VStack(alignment: .leading) {
                                HStack(spacing: 12) {
                                    Image(systemName: icon)
                                        .foregroundColor(color)
                                        .frame(width: 24, alignment: .center)
                                    Text(title).font(.headline)
                                }
                                Text(desc).font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { localEnabledPillars.contains(id) },
                                set: { isOn in
                                    if isOn { localEnabledPillars.insert(id) }
                                    else { localEnabledPillars.remove(id) }
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
            
            Spacer()
            
            // Bottom Buttons matching Onboarding
            VStack(spacing: 12) {
                Button(action: {
                    dismiss()
                }) {
                    Text("Cancel")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                
                Button(action: {
                    Task {
                        await viewModel.updatePillars(Array(localEnabledPillars))
                        await MainActor.run { dismiss() }
                    }
                }) {
                    Text("Save Changes")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal)
            .padding(.bottom, 30)
        }
        .onAppear {
            localEnabledPillars = Set(viewModel.enabledPillars)
        }
    }
}

struct PillarSummaryCard: View {
    let title: String
    let icon: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.headline)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(12)
    }
}

struct AgendaRow: View {
    let time: String
    let title: String
    let category: String
    
    var body: some View {
        HStack(spacing: 15) {
            Text(time)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 40)
            
            VStack(alignment: .leading) {
                Text(title)
                    .font(.body)
                Text(category)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        Divider().padding(.leading, 55)
    }
}
