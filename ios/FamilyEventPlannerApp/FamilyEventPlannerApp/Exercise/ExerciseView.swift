import SwiftUI

/// Main exercise tracking view with tab-based interface
struct ExerciseView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var selectedTab = 0
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab selector
            Picker("View", selection: $selectedTab) {
                Text("Exercises").tag(0)
                Text("Routines").tag(1)
                Text("Workout Log").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()
            
            // Content based on tab
            TabView(selection: $selectedTab) {
                ExercisesListView(selectedTab: $selectedTab)
                    .tag(0)
                
                ExerciseRoutinesView()
                    .tag(1)
                
                WorkoutHistoryView()
                    .tag(2)
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

