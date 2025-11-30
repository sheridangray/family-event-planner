import SwiftUI

/// Main exercise tracking view with tab-based interface
struct ExerciseView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var selectedTab = 0
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab selector
            Picker("View", selection: $selectedTab) {
                Text("Today").tag(0)
                Text("Routines").tag(1)
                Text("History").tag(2)
                Text("AI Coach").tag(3)
            }
            .pickerStyle(.segmented)
            .padding()
            
            // Content based on tab
            TabView(selection: $selectedTab) {
                ExerciseTodayView()
                    .tag(0)
                
                ExerciseRoutinesView()
                    .tag(1)
                
                ExerciseHistoryView()
                    .tag(2)
                
                ExerciseChatView()
                    .tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle("Exercise")
        .navigationBarTitleDisplayMode(.large)
        .task {
            // Fetch data on appear
            do {
                try await exerciseManager.fetchRoutines()
                try await exerciseManager.fetchWorkoutHistory(days: 30)
            } catch {
                print("Error fetching exercise data: \(error)")
            }
        }
    }
}

#Preview {
    NavigationStack {
        ExerciseView()
            .environmentObject(ExerciseManager.shared)
    }
}

