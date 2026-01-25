import SwiftUI
import MapKit

struct KidEventDetailView: View {
    let event: KidEvent
    @ObservedObject var viewModel: KidsEventsViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var region: MKCoordinateRegion?
    @State private var coordinate: CLLocationCoordinate2D?
    @State private var isGeocoding = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header with status badge
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(event.title)
                            .font(.title2)
                            .bold()
                        
                        Spacer()
                        
                        if event.status == "saved" {
                            Label("Saved", systemImage: "bookmark.fill")
                                .font(.caption)
                                .foregroundColor(.orange)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.orange.opacity(0.15))
                                .cornerRadius(8)
                        }
                    }
                    
                    // Relevance score
                    if let score = event.relevanceScore {
                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .font(.caption)
                                .foregroundColor(scoreColor(score))
                            Text("\(Int(score * 100))% match")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.horizontal)
                
                // Quick Info Cards
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        InfoCard(icon: "calendar", title: "Date", value: event.formattedDate)
                        InfoCard(icon: "dollarsign.circle", title: "Cost", value: event.formattedCost, highlight: event.formattedCost == "Free")
                        InfoCard(icon: "figure.2.and.child.holdinghands", title: "Ages", value: event.formattedAge)
                        if let startTime = event.startTime {
                            InfoCard(icon: "clock", title: "Time", value: startTime)
                        }
                    }
                    .padding(.horizontal)
                }
                
                // Description
                if let description = event.description, !description.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("About")
                            .font(.headline)
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                }
                
                // Location Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Location")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    // Venue info
                    VStack(alignment: .leading, spacing: 4) {
                        if let venue = event.venue {
                            HStack {
                                Image(systemName: "building.2")
                                    .foregroundColor(.orange)
                                Text(venue)
                                    .font(.subheadline)
                                    .bold()
                            }
                        }
                        
                        if let address = fullAddress {
                            HStack(alignment: .top) {
                                Image(systemName: "mappin.circle")
                                    .foregroundColor(.secondary)
                                Text(address)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    // Map
                    if let region = region, let coord = coordinate {
                        Map(coordinateRegion: .constant(region), annotationItems: [MapPin(coordinate: coord)]) { pin in
                            MapAnnotation(coordinate: pin.coordinate) {
                                VStack {
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.title)
                                        .foregroundColor(.orange)
                                    Text(event.venue ?? "Event")
                                        .font(.caption2)
                                        .padding(4)
                                        .background(Color(.systemBackground))
                                        .cornerRadius(4)
                                        .shadow(radius: 2)
                                }
                            }
                        }
                        .frame(height: 200)
                        .cornerRadius(12)
                        .padding(.horizontal)
                        
                        // Directions button
                        Button(action: openInMaps) {
                            Label("Get Directions", systemImage: "arrow.triangle.turn.up.right.diamond")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .padding(.horizontal)
                    } else if isGeocoding {
                        HStack {
                            Spacer()
                            ProgressView("Loading map...")
                            Spacer()
                        }
                        .frame(height: 100)
                    } else if fullAddress == nil {
                        Text("No address available")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                    }
                }
                
                Divider()
                    .padding(.horizontal)
                
                // Action Buttons
                VStack(spacing: 12) {
                    // Primary: Open source
                    if let urlString = event.sourceUrl, let url = URL(string: urlString) {
                        Link(destination: url) {
                            Label("View on Website", systemImage: "safari")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)
                    }
                    
                    // Secondary actions
                    HStack(spacing: 12) {
                        Button(action: { saveEvent() }) {
                            Label(event.status == "saved" ? "Saved" : "Save", 
                                  systemImage: event.status == "saved" ? "bookmark.fill" : "bookmark")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(event.status == "saved" ? .orange : .gray)
                        
                        Button(action: { dismissEvent() }) {
                            Label("Not Interested", systemImage: "xmark")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(.gray)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
            .padding(.top)
        }
        .navigationTitle("Event Details")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await geocodeAddress()
        }
    }
    
    // MARK: - Computed Properties
    
    private var fullAddress: String? {
        var parts: [String] = []
        if let address = event.address { parts.append(address) }
        if let city = event.city { parts.append(city) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
    
    // MARK: - Helpers
    
    private func scoreColor(_ score: Double) -> Color {
        if score >= 0.8 { return .green }
        if score >= 0.6 { return .orange }
        return .gray
    }
    
    private func geocodeAddress() async {
        guard let address = fullAddress else { return }
        
        await MainActor.run { isGeocoding = true }
        
        let geocoder = CLGeocoder()
        do {
            let placemarks = try await geocoder.geocodeAddressString(address)
            if let location = placemarks.first?.location {
                await MainActor.run {
                    self.coordinate = location.coordinate
                    self.region = MKCoordinateRegion(
                        center: location.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    )
                    self.isGeocoding = false
                }
            } else {
                await MainActor.run { isGeocoding = false }
            }
        } catch {
            print("Geocoding failed: \(error)")
            await MainActor.run { isGeocoding = false }
        }
    }
    
    private func openInMaps() {
        guard let coord = coordinate else { return }
        let placemark = MKPlacemark(coordinate: coord)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = event.venue ?? event.title
        mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }
    
    private func saveEvent() {
        Task {
            await viewModel.updateEventStatus(eventId: event.id, status: "saved")
            await viewModel.fetchEvents()
        }
    }
    
    private func dismissEvent() {
        Task {
            await viewModel.updateEventStatus(eventId: event.id, status: "dismissed")
            dismiss()
            await viewModel.fetchEvents()
        }
    }
}

// MARK: - Info Card
struct InfoCard: View {
    let icon: String
    let title: String
    let value: String
    var highlight: Bool = false
    
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(highlight ? .green : .orange)
            
            Text(value)
                .font(.subheadline)
                .bold()
                .foregroundColor(highlight ? .green : .primary)
            
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(minWidth: 70)
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

// MARK: - Map Pin
struct MapPin: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
}

#Preview {
    NavigationStack {
        KidEventDetailView(
            event: KidEvent(
                id: "preview-123",
                title: "Story Time at the Library",
                description: "Join us for an engaging story time session with interactive activities for children ages 3-8. We'll read popular children's books and do related crafts.",
                date: "2026-01-25",
                startTime: "10:00",
                venue: "San Francisco Public Library",
                address: "100 Larkin St",
                city: "San Francisco",
                cost: KidEvent.KidEventCost(adult: nil, child: nil, isFree: true),
                ageRange: KidEvent.KidEventAgeRange(min: 3, max: 8),
                urls: KidEvent.KidEventUrls(event: "https://sfpl.org/events", registration: nil),
                relevanceScore: 0.85,
                status: "discovered"
            ),
            viewModel: KidsEventsViewModel()
        )
    }
}
