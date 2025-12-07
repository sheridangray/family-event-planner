import SwiftUI

/// Detail view for a workout showing all exercises and ability to add more
struct WorkoutDetailView: View {
    let workout: ExerciseLog
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var showingAddExercise = false
    @State private var workoutDetails: ExerciseLog?
    @State private var isLoading = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Workout")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text(formatDate(workout.exerciseDate))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    if let duration = workout.totalDurationMinutes {
                        Text("\(duration) minutes")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal)
                
                // Exercises
                if let details = workoutDetails {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Exercises")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        ForEach(details.entries) { entry in
                            ExerciseEntryCard(entry: entry)
                                .padding(.horizontal)
                        }
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                
                // Add Exercise Button
                Button {
                    showingAddExercise = true
                } label: {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Exercise")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(12)
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ProfileMenuButton()
                    .environmentObject(AuthenticationManager.shared)
            }
        }
        .sheet(isPresented: $showingAddExercise) {
            ExercisesSelectionView(workoutId: workout.id)
                .environmentObject(exerciseManager)
        }
        .task {
            loadWorkoutDetails()
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: dateString) {
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
        return dateString
    }
    
    private func loadWorkoutDetails() {
        isLoading = true
        Task {
            do {
                let details = try await exerciseManager.getWorkout(id: workout.id)
                await MainActor.run {
                    workoutDetails = details
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Error loading workout details: \(error)")
            }
        }
    }
}

// MARK: - Exercise Entry Card

struct ExerciseEntryCard: View {
    let entry: ExerciseLogEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(entry.exerciseName)
                .font(.headline)
            
            Text("\(entry.setsPerformed) sets")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if !entry.repsPerformed.isEmpty {
                Text("Reps: \(entry.repsPerformed.map { String($0) }.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            let weights = entry.weightUsed.compactMap { $0 }
            if !weights.isEmpty {
                Text("Weight: \(weights.map { String(format: "%.0f", $0) }.joined(separator: ", ")) lbs")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if !entry.durationSeconds.isEmpty {
                let durations = entry.durationSeconds.map { "\($0 / 60) min" }
                Text("Duration: \(durations.joined(separator: ", "))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if let notes = entry.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Exercises Selection View

struct ExercisesSelectionView: View {
    let workoutId: Int
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @State private var exercises: [Exercise] = []
    @State private var searchText = ""
    @State private var selectedExercise: Exercise?
    
    var filteredExercises: [Exercise] {
        if searchText.isEmpty {
            return exercises
        }
        return exercises.filter { $0.exerciseName.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SearchBar(text: $searchText, placeholder: "Search exercises...")
                    .padding()
                
                List(filteredExercises) { exercise in
                    ExerciseRow(
                        exercise: exercise,
                        action: { selectedExercise = exercise },
                        onStart: { selectedExercise = exercise }
                    )
                }
                .listStyle(.plain)
            }
            .navigationTitle("Add Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .navigationDestination(item: $selectedExercise) { exercise in
                StartExerciseView(exercise: exercise, workoutId: workoutId)
                    .environmentObject(exerciseManager)
            }
            .task {
                do {
                    try await exerciseManager.fetchExercises(query: nil)
                    exercises = exerciseManager.exercises
                } catch {
                    print("Error loading exercises: \(error)")
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        WorkoutDetailView(workout: ExerciseLog(
            id: 1,
            userId: 1,
            routineId: nil,
            exerciseDate: "2024-01-15",
            dayOfWeek: 1,
            totalDurationMinutes: 45,
            location: "Gym",
            notes: nil,
            entries: [],
            createdAt: nil,
            updatedAt: nil
        ))
        .environmentObject(ExerciseManager.shared)
    }
}

