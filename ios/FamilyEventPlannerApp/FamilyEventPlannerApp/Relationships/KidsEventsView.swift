import SwiftUI
import Combine

// MARK: - Models
struct KidEvent: Identifiable, Codable {
    let id: String
    let title: String
    let description: String?
    let date: String?
    let startTime: String?
    let venue: String?
    let address: String?
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
    let config: DiscoveryResponseConfig?
    let error: String?
    
    struct DiscoveryResponseConfig: Codable {
        let location: String?
        let radiusMiles: Int?
        let startDate: String?
        let endDate: String?
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
            
            // Date formatter for API
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let today = dateFormatter.string(from: Date())
            
            switch selectedFilter {
            case .free:
                queryItems.append(URLQueryItem(name: "cost", value: "free"))
            case .saved:
                queryItems.append(URLQueryItem(name: "status", value: "saved"))
                queryItems.append(URLQueryItem(name: "excludePast", value: "false"))
            case .thisWeek:
                // From today to end of week (next Sunday)
                let calendar = Calendar.current
                let endOfWeek = calendar.date(byAdding: .day, value: 7 - calendar.component(.weekday, from: Date()) + 1, to: Date()) ?? Date()
                let endDate = dateFormatter.string(from: endOfWeek)
                queryItems.append(URLQueryItem(name: "dateFrom", value: today))
                queryItems.append(URLQueryItem(name: "dateTo", value: endDate))
            case .all:
                // Backend excludes past events by default
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
    
    func updateEventStatus(eventId: String, status: String) async {
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
    
    func rateEvent(eventId: String, rating: Int, notes: String?) async {
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
                "startDate": config.startDateString,
                "endDate": config.endDateString,
                "ageMin": config.ageMin,
                "ageMax": config.ageMax,
                "enableSerp": config.enableSerp,
                "enableEventbrite": config.enableEventbrite,
                "enableNewsletters": config.enableNewsletters,
                "maxUrls": config.maxUrls
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
    var startDate: Date = Date()
    var endDate: Date = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date()
    var ageMin: Int = 0
    var ageMax: Int = 12
    var enableSerp: Bool = true  // Uses Brave Search API
    var enableEventbrite: Bool = false  // Disabled by default (Eventbrite API deprecated in 2019)
    var enableNewsletters: Bool = true
    var maxUrls: Int = 5  // Limit URLs to process (for debugging)
    
    // Format dates for API
    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }
    
    var startDateString: String {
        dateFormatter.string(from: startDate)
    }
    
    var endDateString: String {
        dateFormatter.string(from: endDate)
    }
    
    var description: String {
        "location=\(location), radius=\(radiusMiles)mi, dates=\(startDateString) to \(endDateString), ages=\(ageMin)-\(ageMax), webSearch=\(enableSerp), eventbrite=\(enableEventbrite), newsletters=\(enableNewsletters), maxUrls=\(maxUrls)"
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
                        NavigationLink(destination: KidEventDetailView(event: event, viewModel: viewModel)) {
                            KidEventCard(event: event)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.updateEventStatus(eventId: event.id, status: "dismissed")
                                    await viewModel.fetchEvents()
                                }
                            } label: {
                                Label("Dismiss", systemImage: "xmark")
                            }
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                Task {
                                    await viewModel.updateEventStatus(eventId: event.id, status: "saved")
                                    await viewModel.fetchEvents()
                                }
                            } label: {
                                Label("Save", systemImage: "bookmark.fill")
                            }
                            .tint(.orange)
                        }
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
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Title & Status/Score
            HStack {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(2)
                    .foregroundColor(.primary)
                
                Spacer()
                
                if event.status == "saved" {
                    Image(systemName: "bookmark.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                } else if let score = event.relevanceScore {
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
        }
        .padding(.vertical, 6)
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

// MARK: - Quick Date Button
struct QuickDateButton: View {
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.orange.opacity(0.1))
                .foregroundColor(.orange)
                .cornerRadius(12)
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
                    DatePicker("From", selection: $config.startDate, in: Date()..., displayedComponents: .date)
                    DatePicker("To", selection: $config.endDate, in: config.startDate..., displayedComponents: .date)
                    
                    // Quick presets
                    HStack(spacing: 8) {
                        QuickDateButton(title: "Weekend") {
                            let calendar = Calendar.current
                            config.startDate = Date()
                            let daysUntilSunday = 7 - calendar.component(.weekday, from: Date()) + 1
                            config.endDate = calendar.date(byAdding: .day, value: daysUntilSunday, to: Date()) ?? Date()
                        }
                        QuickDateButton(title: "Week") {
                            config.startDate = Date()
                            config.endDate = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
                        }
                        QuickDateButton(title: "2 Weeks") {
                            config.startDate = Date()
                            config.endDate = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date()
                        }
                        QuickDateButton(title: "Month") {
                            config.startDate = Date()
                            config.endDate = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Date Range")
                } footer: {
                    Text("Search for events between \(config.startDate.formatted(date: .abbreviated, time: .omitted)) and \(config.endDate.formatted(date: .abbreviated, time: .omitted))")
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
                    Toggle("Web Search", isOn: $config.enableSerp)
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
                    Text("Web search uses Brave Search API to find kid events across the internet.")
                }
                
                // Debug Section
                Section {
                    Stepper("Max URLs to process: \(config.maxUrls)", value: $config.maxUrls, in: 1...50)
                } header: {
                    Text("Debug Options")
                } footer: {
                    Text("Limit URLs processed for faster debugging. Set higher for production use.")
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
