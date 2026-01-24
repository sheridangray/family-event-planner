import SwiftUI

// MARK: - Models
struct KidEvent: Identifiable, Codable {
    let id: Int
    let title: String
    let description: String?
    let eventDate: String?
    let eventTime: String?
    let venue: String?
    let location: String?
    let costMin: Double?
    let costMax: Double?
    let ageMin: Int?
    let ageMax: Int?
    let sourceUrl: String?
    let relevanceScore: Double?
    let status: String
    
    enum CodingKeys: String, CodingKey {
        case id, title, description, venue, location, status
        case eventDate = "event_date"
        case eventTime = "event_time"
        case costMin = "cost_min"
        case costMax = "cost_max"
        case ageMin = "age_min"
        case ageMax = "age_max"
        case sourceUrl = "source_url"
        case relevanceScore = "relevance_score"
    }
    
    var formattedDate: String {
        guard let dateStr = eventDate else { return "TBD" }
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
        if let min = costMin, let max = costMax {
            if min == 0 && max == 0 {
                return "Free"
            } else if min == max {
                return "$\(Int(min))"
            } else {
                return "$\(Int(min))-$\(Int(max))"
            }
        } else if let min = costMin {
            return min == 0 ? "Free" : "$\(Int(min))"
        }
        return "Free"
    }
    
    var formattedAge: String {
        if let min = ageMin, let max = ageMax {
            if min == max {
                return "Age \(min)"
            } else {
                return "Ages \(min)-\(max)"
            }
        } else if let min = ageMin {
            return "Ages \(min)+"
        }
        return "All ages"
    }
}

struct KidEventsResponse: Codable {
    let success: Bool
    let events: [KidEvent]
    let total: Int
    let page: Int
    let limit: Int
}

// MARK: - View Model
class KidsEventsViewModel: ObservableObject {
    @Published var events: [KidEvent] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var selectedFilter: EventFilter = .all
    
    private let authManager = AuthenticationManager.shared
    private var apiBaseURL: String { AppConfig.apiBaseURL }
    
    enum EventFilter: String, CaseIterable {
        case all = "All"
        case thisWeek = "This Week"
        case free = "Free"
        case saved = "Saved"
    }
    
    func fetchEvents() async {
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
                // Could add date filtering
                break
            case .all:
                break
            }
            
            if !queryItems.isEmpty {
                urlComponents.queryItems = queryItems
            }
            
            let request = authManager.authenticatedRequest(url: urlComponents.url!)
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    let decoded = try JSONDecoder().decode(KidEventsResponse.self, from: data)
                    await MainActor.run {
                        self.events = decoded.events
                        self.isLoading = false
                    }
                } else {
                    throw NSError(domain: "API", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Failed to load events"])
                }
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                self.isLoading = false
            }
        }
    }
    
    func updateEventStatus(eventId: Int, status: String) async {
        do {
            let url = URL(string: "\(apiBaseURL)/kid-events/\(eventId)/status")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "PATCH"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["status": status])
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                await fetchEvents()
            }
        } catch {
            print("❌ Failed to update status: \(error)")
        }
    }
    
    func rateEvent(eventId: Int, rating: Int, notes: String?) async {
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
            print("❌ Failed to rate event: \(error)")
        }
    }
    
    func triggerDiscovery() async {
        await MainActor.run { isLoading = true }
        
        do {
            let url = URL(string: "\(apiBaseURL)/kid-events/discover")!
            var request = authManager.authenticatedRequest(url: url)
            request.httpMethod = "POST"
            
            let (_, _) = try await URLSession.shared.data(for: request)
            
            // Wait a moment then refresh
            try await Task.sleep(nanoseconds: 2_000_000_000)
            await fetchEvents()
        } catch {
            await MainActor.run {
                self.error = "Failed to trigger discovery"
                self.isLoading = false
            }
        }
    }
}

// MARK: - Main View
struct KidsEventsView: View {
    @StateObject private var viewModel = KidsEventsViewModel()
    @State private var showingDiscoverySheet = false
    
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
                    Button("Retry") {
                        Task { await viewModel.fetchEvents() }
                    }
                    .buttonStyle(.bordered)
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
                Button(action: { showingDiscoverySheet = true }) {
                    Image(systemName: "plus.magnifyingglass")
                }
            }
        }
        .sheet(isPresented: $showingDiscoverySheet) {
            DiscoverySheet(viewModel: viewModel, isPresented: $showingDiscoverySheet)
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

// MARK: - Discovery Sheet
struct DiscoverySheet: View {
    @ObservedObject var viewModel: KidsEventsViewModel
    @Binding var isPresented: Bool
    @State private var isRunning = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "sparkles")
                    .font(.system(size: 60))
                    .foregroundColor(.orange)
                
                Text("Discover Events")
                    .font(.title)
                    .bold()
                
                Text("Search for kid-friendly events using Google, Eventbrite, and your subscribed newsletters.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Google Search for local events")
                    }
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Eventbrite family activities")
                    }
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Newsletter parsing")
                    }
                }
                .font(.subheadline)
                .padding()
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(12)
                
                Spacer()
                
                if isRunning {
                    ProgressView("Discovering events...")
                        .padding()
                } else {
                    Button(action: {
                        isRunning = true
                        Task {
                            await viewModel.triggerDiscovery()
                            isRunning = false
                            isPresented = false
                        }
                    }) {
                        Text("Start Discovery")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                }
            }
            .padding()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
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
