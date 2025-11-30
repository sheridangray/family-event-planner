import SwiftUI

/// Today's exercise view showing routine and quick log
struct ExerciseTodayView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var showingLogView = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let routine = exerciseManager.todayRoutine {
                    // Today's routine card
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Today's Routine")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                        
                        RoutineCard(routine: routine)
                            .padding(.horizontal)
                        
                        // Quick log button
                        Button(action: {
                            showingLogView = true
                        }) {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                Text("Log Workout")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [.sunsetCoral, .sunsetRose],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: .sunsetCoral.opacity(0.3), radius: 10, y: 5)
                        }
                        .padding(.horizontal)
                    }
                } else {
                    // No routine for today
                    VStack(spacing: 16) {
                        Image(systemName: "dumbbell.fill")
                            .font(.system(size: 50))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.sunsetCoral, .sunsetRose],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        
                        Text("No Routine for Today")
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        Text("Check the Routines tab to set up your weekly schedule")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .padding()
                }
                
                // Recent workouts
                if !exerciseManager.recentLogs.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recent Workouts")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                        
                        ForEach(exerciseManager.recentLogs.prefix(5)) { log in
                            WorkoutLogCard(log: log)
                                .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .sheet(isPresented: $showingLogView) {
            if let routine = exerciseManager.todayRoutine {
                NavigationStack {
                    ExerciseLogView(routine: routine)
                        .environmentObject(exerciseManager)
                }
            }
        }
    }
}

// MARK: - Routine Card

struct RoutineCard: View {
    let routine: ExerciseRoutine
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(routine.routineName)
                    .font(.headline)
                Spacer()
                if let description = routine.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if !routine.exercises.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(routine.exercises) { exercise in
                        HStack {
                            Text("• \(exercise.exerciseName)")
                                .font(.subheadline)
                            Spacer()
                            if let repsMin = exercise.targetRepsMin, let repsMax = exercise.targetRepsMax {
                                Text("\(exercise.targetSets) × \(repsMin)-\(repsMax)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            } else if let duration = exercise.targetDurationSeconds {
                                Text("\(exercise.targetSets) × \(duration)s")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

// MARK: - Workout Log Card

struct WorkoutLogCard: View {
    let log: ExerciseLog
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(log.exerciseDate)
                    .font(.headline)
                Spacer()
                if let duration = log.totalDurationMinutes {
                    Text("\(duration) min")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            
            if !log.entries.isEmpty {
                Text(log.entries.map { $0.exerciseName }.joined(separator: ", "))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
        )
    }
}

#Preview {
    ExerciseTodayView()
        .environmentObject(ExerciseManager.shared)
}

