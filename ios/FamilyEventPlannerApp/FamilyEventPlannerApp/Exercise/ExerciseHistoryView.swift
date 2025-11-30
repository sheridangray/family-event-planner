import SwiftUI

/// View showing exercise history and progression
struct ExerciseHistoryView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if exerciseManager.recentLogs.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.system(size: 50))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.sunsetCoral, .sunsetRose],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        
                        Text("No Workout History")
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        Text("Start logging workouts to see your progress here")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .padding()
                } else {
                    ForEach(exerciseManager.recentLogs) { log in
                        WorkoutHistoryCard(log: log)
                            .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .refreshable {
            do {
                try await exerciseManager.fetchWorkoutHistory(days: 30)
            } catch {
                print("Error refreshing history: \(error)")
            }
        }
    }
}

// MARK: - Workout History Card

struct WorkoutHistoryCard: View {
    let log: ExerciseLog
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(log.exerciseDate)
                    .font(.headline)
                Spacer()
                if let location = log.location {
                    Text(location.capitalized)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.sunsetDustyBlue.opacity(0.2))
                        .foregroundColor(.sunsetDustyBlue)
                        .cornerRadius(8)
                }
            }
            
            if let duration = log.totalDurationMinutes {
                HStack {
                    Image(systemName: "clock.fill")
                        .foregroundColor(.secondary)
                    Text("\(duration) minutes")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            
            if !log.entries.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(log.entries.prefix(3)) { entry in
                        HStack {
                            Text("• \(entry.exerciseName)")
                                .font(.caption)
                            Spacer()
                            if !entry.repsPerformed.isEmpty {
                                Text("\(entry.setsPerformed) × \(entry.repsPerformed.first ?? 0) reps")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    if log.entries.count > 3 {
                        Text("+ \(log.entries.count - 3) more exercises")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if let notes = log.notes, !notes.isEmpty {
                Text(notes)
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
    ExerciseHistoryView()
        .environmentObject(ExerciseManager.shared)
}

