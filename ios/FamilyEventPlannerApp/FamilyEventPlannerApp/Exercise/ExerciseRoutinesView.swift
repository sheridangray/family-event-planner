import SwiftUI

/// View for managing exercise routines
struct ExerciseRoutinesView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var showingCreateRoutine = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if exerciseManager.routines.isEmpty {
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
                        
                        Text("No Routines Yet")
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        Text("Create your first workout routine to get started")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button(action: { showingCreateRoutine = true }) {
                            Text("Create Routine")
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
                        }
                        .padding(.horizontal)
                    }
                    .padding()
                } else {
                    ForEach(exerciseManager.routines) { routine in
                        RoutineDetailCard(routine: routine)
                            .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .refreshable {
            do {
                try await exerciseManager.fetchRoutines()
            } catch {
                print("Error refreshing routines: \(error)")
            }
        }
        .sheet(isPresented: $showingCreateRoutine) {
            // TODO: Create routine view
            Text("Create Routine (Coming Soon)")
        }
    }
}

// MARK: - Routine Detail Card

struct RoutineDetailCard: View {
    let routine: ExerciseRoutine
    
    var dayName: String {
        guard let day = routine.dayOfWeek else { return "Custom" }
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return days[day]
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(routine.routineName)
                        .font(.headline)
                    Text(dayName)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if routine.isActive {
                    Text("Active")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.2))
                        .foregroundColor(.green)
                        .cornerRadius(8)
                }
            }
            
            if let description = routine.description {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if !routine.exercises.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(routine.exercises.count) exercises")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
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
    ExerciseRoutinesView()
        .environmentObject(ExerciseManager.shared)
}

