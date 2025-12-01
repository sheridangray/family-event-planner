import SwiftUI

/// View showing history of past workouts with Repeat functionality
struct WorkoutHistoryView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var workouts: [ExerciseLog] = []
    @State private var isLoading = false
    @State private var selectedWorkout: ExerciseLog?
    @State private var isRepeating = false
    @State private var repeatingWorkoutId: Int?
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if workouts.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "figure.run")
                            .font(.system(size: 50))
                            .foregroundColor(.secondary)
                        Text("No workouts yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Start logging exercises to see your workout history")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(workouts) { workout in
                        WorkoutRow(workout: workout) {
                            selectedWorkout = workout
                        } onRepeat: {
                            repeatWorkout(workout.id)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Workout History")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ProfileMenuButton()
                        .environmentObject(AuthenticationManager.shared)
                }
            }
            .navigationDestination(item: $selectedWorkout) { workout in
                WorkoutDetailView(workout: workout)
                    .environmentObject(exerciseManager)
            }
            .refreshable {
                await loadWorkouts()
            }
            .task {
                await loadWorkouts()
            }
            .overlay {
                if isRepeating {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                    VStack {
                        ProgressView()
                        Text("Repeating workout...")
                            .padding(.top)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                }
            }
        }
    }
    
    private func loadWorkouts() async {
        isLoading = true
        do {
            try await exerciseManager.fetchWorkoutHistory(days: 90)
            await MainActor.run {
                workouts = exerciseManager.recentLogs
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
            }
            print("Error loading workouts: \(error)")
        }
    }
    
    private func repeatWorkout(_ workoutId: Int) {
        isRepeating = true
        repeatingWorkoutId = workoutId
        
        Task {
            do {
                let newWorkout = try await exerciseManager.repeatWorkout(workoutId: workoutId)
                await MainActor.run {
                    isRepeating = false
                    repeatingWorkoutId = nil
                    selectedWorkout = newWorkout
                }
            } catch {
                await MainActor.run {
                    isRepeating = false
                    repeatingWorkoutId = nil
                }
                print("Error repeating workout: \(error)")
            }
        }
    }
}

// MARK: - Workout Row

struct WorkoutRow: View {
    let workout: ExerciseLog
    let onTap: () -> Void
    let onRepeat: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                // Date icon
                VStack {
                    Text(dayOfMonth)
                        .font(.title2)
                        .fontWeight(.bold)
                    Text(monthAbbrev)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(width: 50)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
                
                // Workout info
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(workout.entries.count) exercise\(workout.entries.count == 1 ? "" : "s")")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    if let duration = workout.totalDurationMinutes {
                        Text("\(duration) minutes")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    if let location = workout.location {
                        Text(location.capitalized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Repeat button
                Button {
                    onRepeat()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(.blue)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var dayOfMonth: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: workout.exerciseDate) {
            formatter.dateFormat = "d"
            return formatter.string(from: date)
        }
        return ""
    }
    
    private var monthAbbrev: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: workout.exerciseDate) {
            formatter.dateFormat = "MMM"
            return formatter.string(from: date)
        }
        return ""
    }
}

#Preview {
    WorkoutHistoryView()
        .environmentObject(ExerciseManager.shared)
}

