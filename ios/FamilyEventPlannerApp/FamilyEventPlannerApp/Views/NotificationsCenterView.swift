import SwiftUI

struct NotificationsCenterView: View {
    var body: some View {
        List {
            NotificationRow(
                title: "Workout Suggestion",
                content: "Based on your sleep debt, we suggest a light mobility session today.",
                time: "2h ago",
                icon: "sparkles",
                color: .yellow
            )
            
            NotificationRow(
                title: "Relationship Nudge",
                content: "You haven't had 1:1 time with Apollo in 10 days. How about a 30-min walk after daycare?",
                time: "5h ago",
                icon: "person.2.fill",
                color: .blue
            )
            
            NotificationRow(
                title: "Budget Alert",
                content: "You've reached 80% of your 'Eating Out' budget for December.",
                time: "Yesterday",
                icon: "banknote.fill",
                color: .green
            )
        }
    }
}

struct NotificationRow: View {
    let title: String
    let content: String
    let time: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(alignment: .top, spacing: 15) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(title).font(.headline)
                    Spacer()
                    Text(time).font(.caption).foregroundColor(.secondary)
                }
                Text(content)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 5)
    }
}
