import SwiftUI

/// View showing history of past workouts with Repeat functionality
struct WorkoutHistoryView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var isLoading = false
    @State private var selectedWorkout: WorkoutSession?
    @State private var isRepeating = false
    @State private var repeatingWorkoutId: Int?
    @State private var workoutToDelete: WorkoutSession?
    @State private var showingDeleteConfirmation = false
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if exerciseManager.activeSessions.isEmpty {
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
                    
                    Button("Start New Workout") {
                        startNewWorkout()
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.top)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(exerciseManager.activeSessions) { workout in
                    WorkoutRow(workout: workout) {
                        selectedWorkout = workout
                    } onRepeat: {
                        repeatWorkout(workout.id)
                    } onFinish: {
                        finishWorkout(workout.id)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            workoutToDelete = workout
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .contextMenu {
                        Button(role: .destructive) {
                            workoutToDelete = workout
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete Workout", systemImage: "trash")
                        }
                        
                        if workout.status == .completed {
                            Button {
                                repeatWorkout(workout.id)
                            } label: {
                                Label("Repeat Workout", systemImage: "arrow.clockwise")
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Workout History")
        .navigationBarTitleDisplayMode(.large)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    startNewWorkout()
                } label: {
                    Text("Add")
                }
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
            if exerciseManager.activeSessions.isEmpty {
                await loadWorkouts()
            }
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
        .alert("Delete Workout?", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let workout = workoutToDelete {
                    deleteWorkout(workout.id)
                }
            }
        } message: {
            Text("This will permanently remove this workout session and all its exercises.")
        }
    }
    
    private func loadWorkouts() async {
        isLoading = true
        print("📊 WorkoutHistoryView: Loading workouts...")
        do {
            try await exerciseManager.fetchWorkoutHistory(days: 90)
            print("✅ WorkoutHistoryView: Successfully loaded \(exerciseManager.activeSessions.count) workouts")
            await MainActor.run {
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
            }
            print("❌ WorkoutHistoryView: Error loading workouts: \(error)")
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
    
    private func finishWorkout(_ workoutId: Int) {
        Task {
            do {
                _ = try await exerciseManager.updateWorkoutStatus(workoutId: workoutId, status: .completed)
                await loadWorkouts()
            } catch {
                print("Error finishing workout: \(error)")
            }
        }
    }
    
    private func deleteWorkout(_ workoutId: Int) {
        Task {
            do {
                try await exerciseManager.deleteWorkout(id: workoutId)
            } catch {
                print("Error deleting workout: \(error)")
            }
        }
    }
    
    private func startNewWorkout() {
        isLoading = true
        Task {
            do {
                // Check for existing in-progress workout first
                if let existingInProgress = exerciseManager.activeSessions.first(where: { $0.status == .inProgress }) {
                    await MainActor.run {
                        isLoading = false
                        selectedWorkout = existingInProgress
                    }
                    return
                }
                
                let newWorkout = try await exerciseManager.createWorkout()
                await MainActor.run {
                    isLoading = false
                    selectedWorkout = newWorkout
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Error starting new workout: \(error)")
            }
        }
    }
}

// MARK: - Workout Row

struct WorkoutRow: View {
    let workout: WorkoutSession
    let onTap: () -> Void
    let onRepeat: () -> Void
    let onFinish: () -> Void
    
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
                .background(workout.status == .inProgress ? Color.orange.opacity(0.1) : Color.blue.opacity(0.1))
                .cornerRadius(8)
                
                // Workout info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(workout.timeOfDay)")
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        if workout.status == .inProgress {
                            Text("IN PROGRESS")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2))
                                .foregroundColor(.orange)
                                .cornerRadius(4)
                        }
                    }
                    
                    HStack(spacing: 6) {
                        Text("\(workout.entries.count) exercise\(workout.entries.count == 1 ? "" : "s")")
                        
                        if let duration = workout.totalDurationMinutes {
                            Text("•")
                            Text("\(duration) min")
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    
                    if let location = workout.location {
                        Text(location.capitalized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Status specific buttons
                if workout.status == .inProgress {
                    Button {
                        onFinish()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Finish")
                        }
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var dayOfMonth: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let date: Date?
        if let d = isoFormatter.date(from: workout.exerciseDate) {
            date = d
        } else {
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            date = simpleFormatter.date(from: workout.exerciseDate)
        }
        
        if let date = date {
            let formatter = DateFormatter()
            formatter.dateFormat = "d"
            return formatter.string(from: date)
        }
        return ""
    }
    
    private var monthAbbrev: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let date: Date?
        if let d = isoFormatter.date(from: workout.exerciseDate) {
            date = d
        } else {
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            date = simpleFormatter.date(from: workout.exerciseDate)
        }
        
        if let date = date {
            let formatter = DateFormatter()
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

