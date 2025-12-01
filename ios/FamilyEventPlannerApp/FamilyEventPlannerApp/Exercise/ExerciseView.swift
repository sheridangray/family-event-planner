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
                Text("Workouts").tag(1)
                Text("Routines").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()
            
            // Content based on tab
            TabView(selection: $selectedTab) {
                ExercisesListView()
                    .tag(0)
                
                WorkoutHistoryView()
                    .tag(1)
                
                ExerciseRoutinesView()
                    .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle("Exercise")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ProfileMenuButton()
                    .environmentObject(AuthenticationManager.shared)
            }
        }
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

