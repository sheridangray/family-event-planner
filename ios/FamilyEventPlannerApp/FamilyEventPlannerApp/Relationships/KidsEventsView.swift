import SwiftUI
import Combine

// MARK: - Models
struct KidEvent: Identifiable, Codable {
    let id: Int
    let title: String
    let description: String?
    let date: String?
    let startTime: String?
    let venue: String?
    let city: String?
    let cost: KidEventCost?
    let ageRange: KidEventAgeRange?
    let urls: KidEventUrls?
    let relevanceScore: Double?
    let status: String
    
    struct KidEventCost: Codable {
        let adult: Double?
        let child: Double?
        let isFree: Bool?
    }
    
    struct KidEventAgeRange: Codable {
        let min: Int?
        let max: Int?
    }
    
    struct KidEventUrls: Codable {
        let event: String?
        let registration: String?
    }
    
    var formattedDate: String {
        guard let dateStr = date else { return "TBD" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        if let date = formatter.date(from: String(dateStr.prefix(10))) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "EEE, MMM d"
            return displayFormatter.string(from: date)
        }
        return dateStr
    }
    
    var formattedCost: String {
        if let isFree = cost?.isFree, isFree {
            return "Free"
        }
        if let adult = cost?.adult {
            return adult == 0 ? "Free" : "$\(Int(adult))"
        }
        return "Free"
    }
    
    var formattedAge: String {
        if let min = ageRange?.min, let max = ageRange?.max {
            if min == max {
                return "Age \(min)"
            } else {
                return "Ages \(min)-\(max)"
            }
        } else if let min = ageRange?.min {
            return "Ages \(min)+"
        }
        return "All ages"
    }
    
    var sourceUrl: String? {
        urls?.event ?? urls?.registration
    }
}

struct KidEventsApiResponse: Codable {
    let success: Bool
    let data: KidEventsData?
    let error: String?
    
    struct KidEventsData: Codable {
        let events: [KidEvent]
        let pagination: Pagination?
        
        struct Pagination: Codable {
            let total: Int
            let limit: Int
            let offset: Int
            let hasMore: Bool
        }
    }
}

struct DiscoveryResponse: Codable {
    let success: Bool
    let message: String?
    let config: DiscoveryConfig?
    let error: String?
    
    struct DiscoveryConfig: Codable {
        let location: String?
        let radiusMiles: Int?
        let daysAhead: Int?
    }
}

// MARK: - View Model
class KidsEventsViewModel: ObservableObject {
    @Published var events: [KidEvent] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var selectedFilter: EventFilter = .all
    @Published var discoveryLog: [String] = []
    
    private let authManager = AuthenticationManager.shared
    private var apiBaseURL: String { AppConfig.apiBaseURL }
    
    enum EventFilter: String, CaseIterable {
        case all = "All"
        case thisWeek = "This Week"
        case free = "Free"
        case saved = "Saved"
    }
    
    func log(_ message: String) {
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        let logMessage = "[\(timestamp)] \(message)"
        print("📱 [KidsEvents] \(message)")
        DispatchQueue.main.async {
            self.discoveryLog.append(logMessage)
        }
    }
    
    func fetchEvents() async {
        log("Fetching events with filter: \(selectedFilter.rawValue)")
        
        await MainActor.run { 
            isLoading = true 
            error = nil
        }
        
        do {
            var urlComponents = URLComponents(string: "\(apiBaseURL)/kid-events")!
            var queryItems: [URLQueryItem] = []
            
            switch selectedFilter {
            case .free:
                queryItems.append(URLQueryItem(name: "cost", value: "free"))
            case .saved:
                queryItems.append(URLQueryItem(name: "status", value: "saved"))
            case .thisWeek:
                break
            case .all:
                break
            }
            
            if !queryItems.isEmpty {
                urlComponents.queryItems = queryItems
            }
            
            log("Request URL: \(urlComponents.url?.absoluteString ?? "nil")")
            
            let request = authManager.authenticatedRequest(url: urlComponents.url!)
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                log("Response status: \(httpResponse.statusCode)")
                
                // Log raw response for debugging
                if let responseStr = String(data: data, encoding: .utf8) {
                    log("Response body (first 500 chars): \(String(responseStr.prefix(500)))")
                }
                
                if httpResponse.statusCode == 200 {
                    let decoded = try JSONDecoder().decode(KidEventsApiResponse.self, from: data)
                    
                    if decoded.success, let eventsData = decoded.data {
                        log("Successfully decoded \(eventsData.events.count) events")
                        await MainActor.run {
                            self.events = eventsData.events
                            self.isLoading = false
                        }
                    } else {
                        log("API returned success=false: \(decoded.error ?? "unknown")")
                        throw NSError(domain: "API", code: -1, userInfo: [NSLocalizedDescriptionKey: decoded.error ?? "Unknown error"])
                    }
                } else {
                    log("HTTP error: \(httpResponse.statusCode)")
                    throw NSError(domain: "API", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Failed to load events (HTTP \(httpResponse.statusCode))"])
                }
            }
        } catch {
            log("Error: \(error.localizedDescription)")
            await MainActor.run {
                self.error = error.localizedDescription
                self.isLoading = false
            }
        }
    }
    
    func updateEventStatus(eventId: Int, status: String) async {
        log("Updating event \(eventId) status to: \(status)")
        
        do {
            let url = URL(string: "\(apiBaseURL)/kid-events/\(eventId)/status")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "PATCH"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["status": status])
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                log("Update status response: \(httpResponse.statusCode)")
                if httpResponse.statusCode == 200 {
                    await fetchEvents()
                }
            }
        } catch {
            log("Failed to update status: \(error)")
        }
    }
    
    func rateEvent(eventId: Int, rating: Int, notes: String?) async {
        log("Rating event \(eventId): \(rating) stars")
        
        do {
            let url = URL(string: "\(apiBaseURL)/kid-events/\(eventId)/rate")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            var body: [String: Any] = ["rating": rating]
            if let notes = notes {
                body["notes"] = notes
            }
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (_, _) = try await URLSession.shared.data(for: request)
        } catch {
            log("Failed to rate event: \(error)")
        }
    }
    
    func triggerDiscovery(config: DiscoveryConfig) async -> Bool {
        log("========== STARTING DISCOVERY ==========")
        log("Config: \(config)")
        
        await MainActor.run { 
            isLoading = true 
            discoveryLog = []
        }
        
        do {
            let url = URL(string: "\(apiBaseURL)/kid-events/discover")!
            log("POST \(url.absoluteString)")
            
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "location": config.location,
                "radiusMiles": config.radiusMiles,
                "daysAhead": config.daysAhead,
                "ageMin": config.ageMin,
                "ageMax": config.ageMax,
                "enableSerp": config.enableSerp,
                "enableEventbrite": config.enableEventbrite,
                "enableNewsletters": config.enableNewsletters
            ]
            
            log("Request body: \(body)")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                log("Response status: \(httpResponse.statusCode)")
                
                if let responseStr = String(data: data, encoding: .utf8) {
                    log("Response: \(responseStr)")
                }
                
                if httpResponse.statusCode == 200 {
                    let decoded = try JSONDecoder().decode(DiscoveryResponse.self, from: data)
                    if decoded.success {
                        log("Discovery started successfully!")
                        log("Waiting for background processing...")
                        
                        // Wait for discovery to process
                        try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                        
                        log("Refreshing events...")
                        await fetchEvents()
                        log("========== DISCOVERY COMPLETE ==========")
                        return true
                    } else {
                        log("Discovery API returned error: \(decoded.error ?? "unknown")")
                    }
                }
            }
            
            await MainActor.run { self.isLoading = false }
            return false
        } catch {
            log("Discovery failed: \(error.localizedDescription)")
            await MainActor.run {
                self.error = "Discovery failed: \(error.localizedDescription)"
                self.isLoading = false
            }
            return false
        }
    }
}

// MARK: - Discovery Config
struct DiscoveryConfig: CustomStringConvertible {
    var location: String = "San Francisco, CA"
    var radiusMiles: Int = 25
    var daysAhead: Int = 14
    var ageMin: Int = 0
    var ageMax: Int = 12
    var enableSerp: Bool = true
    var enableEventbrite: Bool = false  // Disabled by default (Eventbrite API deprecated in 2019)
    var enableNewsletters: Bool = true
    
    var description: String {
        "location=\(location), radius=\(radiusMiles)mi, days=\(daysAhead), ages=\(ageMin)-\(ageMax), serp=\(enableSerp), eventbrite=\(enableEventbrite), newsletters=\(enableNewsletters)"
    }
}

// MARK: - Main View
struct KidsEventsView: View {
    @StateObject private var viewModel = KidsEventsViewModel()
    @State private var showingDiscoverySheet = false
    @State private var showingLogSheet = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Filter Pills
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(KidsEventsViewModel.EventFilter.allCases, id: \.self) { filter in
                        FilterPill(
                            title: filter.rawValue,
                            isSelected: viewModel.selectedFilter == filter
                        ) {
                            viewModel.selectedFilter = filter
                            Task { await viewModel.fetchEvents() }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
            }
            .background(Color(.systemBackground))
            
            if viewModel.isLoading {
                Spacer()
                ProgressView("Finding events...")
                Spacer()
            } else if let error = viewModel.error {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    HStack(spacing: 16) {
                        Button("Retry") {
                            Task { await viewModel.fetchEvents() }
                        }
                        .buttonStyle(.bordered)
                        
                        Button("View Log") {
                            showingLogSheet = true
                        }
                        .buttonStyle(.bordered)
                        .tint(.gray)
                    }
                }
                Spacer()
            } else if viewModel.events.isEmpty {
                Spacer()
                VStack(spacing: 16) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 50))
                        .foregroundColor(.orange)
                    
                    Text("No Events Yet")
                        .font(.title2)
                        .bold()
                    
                    Text("Run discovery to find kid-friendly events in your area")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    Button(action: { showingDiscoverySheet = true }) {
                        Label("Discover Events", systemImage: "magnifyingglass")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                }
                Spacer()
            } else {
                List {
                    ForEach(viewModel.events) { event in
                        KidEventCard(event: event, viewModel: viewModel)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.fetchEvents()
                }
            }
        }
        .navigationTitle("Kids Events")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 12) {
                    Button(action: { showingLogSheet = true }) {
                        Image(systemName: "doc.text.magnifyingglass")
                    }
                    
                    Button(action: { showingDiscoverySheet = true }) {
                        Image(systemName: "plus.magnifyingglass")
                    }
                }
            }
        }
        .sheet(isPresented: $showingDiscoverySheet) {
            DiscoverySheet(viewModel: viewModel, isPresented: $showingDiscoverySheet)
        }
        .sheet(isPresented: $showingLogSheet) {
            LogSheet(logs: viewModel.discoveryLog, isPresented: $showingLogSheet)
        }
        .task {
            await viewModel.fetchEvents()
        }
    }
}

// MARK: - Event Card
struct KidEventCard: View {
    let event: KidEvent
    @ObservedObject var viewModel: KidsEventsViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Title & Score
            HStack {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(2)
                
                Spacer()
                
                if let score = event.relevanceScore {
                    Text("\(Int(score * 100))%")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(scoreColor(score).opacity(0.2))
                        .foregroundColor(scoreColor(score))
                        .cornerRadius(8)
                }
            }
            
            // Details Row
            HStack(spacing: 16) {
                Label(event.formattedDate, systemImage: "calendar")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Label(event.formattedCost, systemImage: "dollarsign.circle")
                    .font(.caption)
                    .foregroundColor(event.formattedCost == "Free" ? .green : .secondary)
                
                Label(event.formattedAge, systemImage: "figure.2.and.child.holdinghands")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Venue
            if let venue = event.venue {
                Label(venue, systemImage: "mappin.circle")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            // Action Buttons
            HStack(spacing: 12) {
                Button(action: {
                    Task {
                        await viewModel.updateEventStatus(eventId: event.id, status: "saved")
                    }
                }) {
                    Label("Save", systemImage: event.status == "saved" ? "bookmark.fill" : "bookmark")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(event.status == "saved" ? .orange : .gray)
                
                Button(action: {
                    Task {
                        await viewModel.updateEventStatus(eventId: event.id, status: "dismissed")
                    }
                }) {
                    Label("Not Interested", systemImage: "xmark")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(.gray)
                
                Spacer()
                
                if let url = event.sourceUrl, let sourceUrl = URL(string: url) {
                    Link(destination: sourceUrl) {
                        Label("Details", systemImage: "arrow.up.right")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    private func scoreColor(_ score: Double) -> Color {
        if score >= 0.8 { return .green }
        if score >= 0.6 { return .orange }
        return .gray
    }
}

// MARK: - Filter Pill
struct FilterPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.orange : Color.secondary.opacity(0.1))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

// MARK: - Discovery Sheet (Configurable)
struct DiscoverySheet: View {
    @ObservedObject var viewModel: KidsEventsViewModel
    @Binding var isPresented: Bool
    
    @State private var config = DiscoveryConfig()
    @State private var isRunning = false
    @State private var showAdvanced = false
    
    var body: some View {
        NavigationStack {
            Form {
                // Location Section
                Section {
                    TextField("City or ZIP", text: $config.location)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Search Radius: \(config.radiusMiles) miles")
                            .font(.subheadline)
                        Slider(value: Binding(
                            get: { Double(config.radiusMiles) },
                            set: { config.radiusMiles = Int($0) }
                        ), in: 5...50, step: 5)
                    }
                } header: {
                    Text("Location")
                }
                
                // Date Range Section
                Section {
                    Picker("Look ahead", selection: $config.daysAhead) {
                        Text("This weekend").tag(3)
                        Text("Next week").tag(7)
                        Text("Next 2 weeks").tag(14)
                        Text("Next month").tag(30)
                    }
                } header: {
                    Text("Date Range")
                }
                
                // Age Range Section
                Section {
                    Stepper("Min Age: \(config.ageMin)", value: $config.ageMin, in: 0...17)
                    Stepper("Max Age: \(config.ageMax)", value: $config.ageMax, in: config.ageMin...18)
                } header: {
                    Text("Children's Ages")
                } footer: {
                    Text("Events will be filtered based on age appropriateness")
                }
                
                // Sources Section
                Section {
                    Toggle("Google Search", isOn: $config.enableSerp)
                    Toggle("Email Newsletters", isOn: $config.enableNewsletters)
                    
                    HStack {
                        Toggle("Eventbrite", isOn: $config.enableEventbrite)
                        Text("(API deprecated)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Event Sources")
                } footer: {
                    Text("Eventbrite's public API was deprecated in 2019. Eventbrite events can still be found via Google Search.")
                }
                
                // Status Section
                if isRunning {
                    Section {
                        HStack {
                            ProgressView()
                                .padding(.trailing, 8)
                            Text("Discovering events...")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Discover Events")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .disabled(isRunning)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: startDiscovery) {
                        if isRunning {
                            ProgressView()
                        } else {
                            Text("Start")
                                .bold()
                        }
                    }
                    .disabled(isRunning)
                }
            }
        }
    }
    
    private func startDiscovery() {
        isRunning = true
        Task {
            let success = await viewModel.triggerDiscovery(config: config)
            await MainActor.run {
                isRunning = false
                if success {
                    isPresented = false
                }
            }
        }
    }
}

// MARK: - Log Sheet
struct LogSheet: View {
    let logs: [String]
    @Binding var isPresented: Bool
    
    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    if logs.isEmpty {
                        Text("No logs yet. Run a discovery to see debug output.")
                            .foregroundColor(.secondary)
                            .padding()
                    } else {
                        ForEach(Array(logs.enumerated()), id: \.offset) { _, log in
                            Text(log)
                                .font(.system(.caption, design: .monospaced))
                                .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Discovery Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        KidsEventsView()
    }
}
