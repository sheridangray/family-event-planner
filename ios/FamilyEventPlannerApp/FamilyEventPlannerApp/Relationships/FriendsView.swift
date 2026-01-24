import SwiftUI

struct FriendsView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 60))
                .foregroundColor(.blue)
            
            Text("Friends")
                .font(.title2)
                .bold()
            
            Text("Track friendships, social activities, and staying connected")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Spacer()
            
            // Coming Soon Notice
            VStack(spacing: 8) {
                Text("Coming Soon")
                    .font(.headline)
                    .foregroundColor(.blue)
                
                Text("Friend tracking and social activity suggestions will be available in a future update.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(12)
            .padding(.horizontal)
            
            Spacer()
        }
        .padding(.top, 60)
        .navigationTitle("Friends")
    }
}

#Preview {
    NavigationStack {
        FriendsView()
    }
}
