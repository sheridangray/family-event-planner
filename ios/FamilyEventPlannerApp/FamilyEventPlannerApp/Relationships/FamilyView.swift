import SwiftUI

struct FamilyView: View {
    var body: some View {
        List {
            // Kids Section - Kid Event Discovery
            Section {
                NavigationLink(destination: KidsEventsView()) {
                    HStack(spacing: 12) {
                        Image(systemName: "figure.2.and.child.holdinghands")
                            .foregroundColor(.orange)
                            .frame(width: 30)
                        VStack(alignment: .leading) {
                            Text("Kids Events")
                                .font(.headline)
                            Text("Discover activities for your children")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        // Badge for new events
                        Text("3 new")
                            .font(.caption2)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.orange.opacity(0.2))
                            .foregroundColor(.orange)
                            .cornerRadius(8)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Kids")
            } footer: {
                Text("AI-powered event discovery based on your children's ages and interests")
            }
            
            // Partner Section
            Section {
                NavigationLink(destination: PartnerView()) {
                    HStack(spacing: 12) {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.red)
                            .frame(width: 30)
                        VStack(alignment: .leading) {
                            Text("Partner")
                                .font(.headline)
                            Text("Date nights and quality time")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Partner")
            }
            
            // Family Settings
            Section {
                NavigationLink(destination: FamilySettingsView()) {
                    HStack(spacing: 12) {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(.gray)
                            .frame(width: 30)
                        Text("Family Settings")
                            .font(.headline)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Family")
    }
}

// MARK: - Partner View (Placeholder)
struct PartnerView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "heart.fill")
                .font(.system(size: 60))
                .foregroundColor(.red)
            
            Text("Partner Activities")
                .font(.title2)
                .bold()
            
            Text("Track date nights, quality time, and relationship rituals")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Spacer()
        }
        .padding(.top, 60)
        .navigationTitle("Partner")
    }
}

// MARK: - Family Settings View (Placeholder)
struct FamilySettingsView: View {
    var body: some View {
        List {
            Section {
                HStack {
                    Text("Children")
                    Spacer()
                    Text("2 kids")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Location")
                    Spacer()
                    Text("San Francisco, CA")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Search Radius")
                    Spacer()
                    Text("25 miles")
                        .foregroundColor(.secondary)
                }
            } header: {
                Text("Event Discovery")
            }
            
            Section {
                HStack {
                    Text("Max Cost per Event")
                    Spacer()
                    Text("$50")
                        .foregroundColor(.secondary)
                }
                
                Toggle("Prefer Free Events", isOn: .constant(true))
                
                Toggle("Weekend Events Only", isOn: .constant(false))
            } header: {
                Text("Preferences")
            }
        }
        .navigationTitle("Family Settings")
    }
}

#Preview {
    NavigationStack {
        FamilyView()
    }
}
