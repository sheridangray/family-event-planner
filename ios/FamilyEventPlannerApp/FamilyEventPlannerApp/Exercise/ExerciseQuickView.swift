import SwiftUI

/// Quick preview of exercise section shown in Health view
struct ExerciseQuickView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    
    var body: some View {
        // Today's routine card
        if let todayRoutine = exerciseManager.todayRoutine {
            NavigationLink(destination: ExerciseView()
                .environmentObject(exerciseManager)) {
                ExerciseRoutineCard(routine: todayRoutine)
            }
            .buttonStyle(PlainButtonStyle())
        } else {
            NavigationLink(destination: ExerciseView()
                .environmentObject(exerciseManager)) {
                ExerciseEmptyCard()
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

// MARK: - Exercise Routine Card

struct ExerciseRoutineCard: View {
    let routine: ExerciseRoutine
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var hasLogged = false
    @State private var checkingLogged = true
    
    var summary: String {
        if checkingLogged {
            return "\(routine.exercises.count) exercises"
        } else if hasLogged {
            return "\(routine.exercises.count) exercises • Logged today"
        } else {
            return "\(routine.exercises.count) exercises • Not logged yet"
        }
    }
    
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(
                            colors: [.sunsetCoral, .sunsetRose],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                
                Image(systemName: "dumbbell.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(routine.routineName)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            // Chevron
            Image(systemName: "chevron.right")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: Color.sunsetCoral.opacity(0.1), radius: 8, y: 4)
        )
        .task {
            do {
                hasLogged = try await exerciseManager.hasLoggedToday(routineId: routine.id)
            } catch {
                // Ignore errors
            }
        }
    }
}

// MARK: - Exercise Empty Card

struct ExerciseEmptyCard: View {
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(
                            colors: [.sunsetCoral, .sunsetRose],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                
                Image(systemName: "dumbbell.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text("Exercise & Workouts")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("No routine for today")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            // Chevron
            Image(systemName: "chevron.right")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: Color.sunsetCoral.opacity(0.1), radius: 8, y: 4)
        )
    }
}

#Preview {
    ExerciseQuickView()
        .environmentObject(ExerciseManager.shared)
}

