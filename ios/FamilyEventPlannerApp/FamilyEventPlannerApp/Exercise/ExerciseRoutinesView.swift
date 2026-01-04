import SwiftUI

/// View for managing exercise routines
struct ExerciseRoutinesView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var showingCreateRoutine = false
    @State private var routineToEdit: ExerciseRoutine?
    @State private var startingWorkout: WorkoutSession?
    @State private var isStarting = false
    @State private var showingDeleteConfirmation = false
    @State private var routineToDelete: ExerciseRoutine?
    
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
                        RoutineDetailCard(
                            routine: routine,
                            onStart: { startRoutine(routine) },
                            onEdit: { routineToEdit = routine },
                            onDelete: {
                                routineToDelete = routine
                                showingDeleteConfirmation = true
                            }
                        )
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Routines")
        .navigationBarTitleDisplayMode(.large)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showingCreateRoutine = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .refreshable {
            try? await exerciseManager.fetchRoutines()
        }
        .sheet(isPresented: $showingCreateRoutine) {
            AddRoutineView()
                .environmentObject(exerciseManager)
        }
        .sheet(item: $routineToEdit) { routine in
            AddRoutineView(routine: routine)
                .environmentObject(exerciseManager)
        }
        .navigationDestination(item: $startingWorkout) { workout in
            WorkoutDetailView(workout: workout)
                .environmentObject(exerciseManager)
        }
        .alert("Delete Routine?", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let routine = routineToDelete {
                    deleteRoutine(routine)
                }
            }
        } message: {
            Text("Are you sure you want to delete '\(routineToDelete?.routineName ?? "this routine")'?")
        }
        .overlay {
            if isStarting {
                ZStack {
                    Color.black.opacity(0.3).ignoresSafeArea()
                    VStack(spacing: 16) {
                        ProgressView()
                        Text("Starting workout...")
                            .fontWeight(.semibold)
                    }
                    .padding(30)
                    .background(Color(.systemBackground))
                    .cornerRadius(16)
                    .shadow(radius: 10)
                }
            }
        }
    }
    
    private func startRoutine(_ routine: ExerciseRoutine) {
        isStarting = true
        Task {
            do {
                let workout = try await exerciseManager.startWorkoutFromRoutine(id: routine.id)
                await MainActor.run {
                    isStarting = false
                    startingWorkout = workout
                }
            } catch {
                await MainActor.run {
                    isStarting = false
                }
                print("Error starting routine: \(error)")
            }
        }
    }
    
    private func deleteRoutine(_ routine: ExerciseRoutine) {
        Task {
            do {
                try await exerciseManager.deleteRoutine(id: routine.id)
            } catch {
                print("Error deleting routine: \(error)")
            }
        }
    }
}

// MARK: - Routine Detail Card

struct RoutineDetailCard: View {
    let routine: ExerciseRoutine
    let onStart: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var dayName: String {
        guard let day = routine.dayOfWeek else { return "Custom" }
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        // Check if day is within range 0-6
        if day >= 0 && day < days.count {
            return days[day]
        }
        return "Custom"
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
                
                HStack(spacing: 8) {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                            .font(.caption)
                            .padding(8)
                            .background(Color(.systemGray6))
                            .foregroundColor(.secondary)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: onStart) {
                        Text("Start")
                            .font(.subheadline)
                            .fontWeight(.bold)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(20)
                    }
                    .buttonStyle(.plain)
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
                    
                    Text(routine.exercises.prefix(3).map { $0.exerciseName }.joined(separator: ", "))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
        )
        .contextMenu {
            Button(action: onEdit) {
                Label("Edit Routine", systemImage: "pencil")
            }
            
            Button(role: .destructive, action: onDelete) {
                Label("Delete Routine", systemImage: "trash")
            }
        }
    }
}
