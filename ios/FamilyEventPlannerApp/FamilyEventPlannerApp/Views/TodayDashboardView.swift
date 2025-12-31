import SwiftUI

struct TodayDashboardView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @ObservedObject var coordinator: AppCoordinator
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading) {
                        Text("Welcome back, \(authManager.currentUser?.name.split(separator: " ").first ?? "there")!")
                            .font(.title2)
                            .bold()
                        Text("Here's your proactive briefing.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    // Profile/Avatar could go here
                }
                .padding(.horizontal)
                
                // Coach Card (Placeholder)
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
                    
                    Button("See suggestion") {
                        // Action
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(15)
                .padding(.horizontal)
                
                // Today's Pillars Summary
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 15) {
                    PillarSummaryCard(title: "Time", icon: "clock.fill", value: "3 focus blocks", color: .blue)
                    PillarSummaryCard(title: "Health", icon: "heart.fill", value: "80% goal", color: .red)
                    PillarSummaryCard(title: "Food", icon: "fork.knife", value: "Salmon tonight", color: .orange)
                    PillarSummaryCard(title: "Money", icon: "banknote.fill", value: "+$240 today", color: .green)
                }
                .padding(.horizontal)
                
                // Timeline / Agenda List (Placeholder)
                VStack(alignment: .leading) {
                    Text("Next Up")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    VStack(spacing: 0) {
                        AgendaRow(time: "12:00", title: "Lunch with Joyce", category: "Relationship")
                        AgendaRow(time: "14:00", title: "Deep Work: Project X", category: "Time")
                        AgendaRow(time: "17:00", title: "Gym Session", category: "Health")
                    }
                    .background(Color.secondary.opacity(0.05))
                    .cornerRadius(15)
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Color(.systemBackground))
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
