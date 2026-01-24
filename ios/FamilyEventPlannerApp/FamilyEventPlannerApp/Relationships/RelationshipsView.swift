import SwiftUI

struct RelationshipsView: View {
    var body: some View {
        List {
            // Family Section
            Section {
                NavigationLink(destination: FamilyView()) {
                    HStack(spacing: 12) {
                        Image(systemName: "house.fill")
                            .foregroundColor(.purple)
                            .frame(width: 30)
                        VStack(alignment: .leading) {
                            Text("Family")
                                .font(.headline)
                            Text("Manage family activities and events")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Family")
            }
            
            // Friends Section
            Section {
                NavigationLink(destination: FriendsView()) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.2.fill")
                            .foregroundColor(.blue)
                            .frame(width: 30)
                        VStack(alignment: .leading) {
                            Text("Friends")
                                .font(.headline)
                            Text("Stay connected with friends")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Friends")
            }
            
            // Quick Stats
            Section {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Date Night")
                            .font(.headline)
                        Text("Next scheduled: This Saturday")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "heart.fill")
                        .foregroundColor(.red)
                }
                .padding(.vertical, 4)
                
                HStack {
                    VStack(alignment: .leading) {
                        Text("Family Time")
                            .font(.headline)
                        Text("3 activities this week")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "calendar")
                        .foregroundColor(.purple)
                }
                .padding(.vertical, 4)
            } header: {
                Text("This Week")
            }
        }
        .navigationTitle("Relationships")
    }
}

#Preview {
    NavigationStack {
        RelationshipsView()
    }
}
