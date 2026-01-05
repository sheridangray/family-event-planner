import SwiftUI

/// Detail view for a workout showing all exercises and ability to add more
struct WorkoutDetailView: View {
    let workout: WorkoutSession
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @State private var showingAddExercise = false
    @State private var workoutDetails: WorkoutSession?
    @State private var isLoading = false
    @State private var showingDeleteConfirmation = false
    @State private var editingEntry: ExerciseLogEntry?
    @State private var entryToDelete: Int?
    @State private var showingDeleteEntryConfirmation = false
    @State private var isCompactView = true // Default to compact for "at-a-glance"
    
    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: isCompactView ? 12 : 24) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Workout")
                                .font(isCompactView ? .title : .largeTitle)
                                .fontWeight(.bold)
                            
                            Spacer()
                            
                            if let details = workoutDetails, details.status == .inProgress {
                                Text("IN PROGRESS")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.orange.opacity(0.2))
                                    .foregroundColor(.orange)
                                    .cornerRadius(6)
                            }
                        }
                        
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
                        VStack(alignment: .leading, spacing: isCompactView ? 8 : 16) {
                            if !isCompactView {
                                Text("Exercises")
                                    .font(.headline)
                                    .padding(.horizontal)
                            }
                            
                            ForEach(details.entries) { entry in
                                ExerciseEntryCard(
                                    entry: entry,
                                    isCompact: isCompactView,
                                    onEdit: {
                                        editingEntry = entry
                                    },
                                    onDelete: {
                                        if let entryId = entry.backendId {
                                            entryToDelete = entryId
                                            showingDeleteEntryConfirmation = true
                                        }
                                    }
                                )
                                .padding(.horizontal)
                            }
                        }
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    
                    // Spacer for fixed footer
                    Spacer(minLength: 160)
                }
                .padding(.vertical)
            }
            .background(Color(.systemGroupedBackground))
            
            // Fixed Bottom Footer
            VStack(spacing: 12) {
                Divider()
                
                VStack(spacing: 12) {
                    // Add Exercise Button
                    Button {
                        showingAddExercise = true
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Exercise")
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(12)
                    }
                    
                    // Finish Workout Button
                    if let details = workoutDetails, details.status == .inProgress {
                        Button {
                            finishWorkout()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Finish Workout")
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background(Color(.systemBackground))
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: -5)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button {
                        withAnimation {
                            isCompactView.toggle()
                        }
                    } label: {
                        Image(systemName: isCompactView ? "list.bullet.below.rectangle" : "rectangle.grid.1x2")
                            .font(.system(size: 14))
                    }
                    
                    Menu {
                        Button(role: .destructive) {
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete Workout", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $showingAddExercise) {
            ExercisesSelectionView(workoutId: workout.id, onSave: {
                loadWorkoutDetails()
            })
            .environmentObject(exerciseManager)
        }
        .alert("Delete Workout?", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteWorkout()
            }
        } message: {
            Text("This will permanently remove this workout session and all its exercises.")
        }
        .alert("Delete Exercise?", isPresented: $showingDeleteEntryConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let entryId = entryToDelete {
                    deleteEntry(id: entryId)
                }
            }
        } message: {
            Text("Are you sure you want to remove this exercise from the workout?")
        }
        .sheet(item: $editingEntry) { entry in
            if let exercise = exerciseManager.exercises.first(where: { $0.id == entry.exerciseId }) {
                NavigationStack {
                    StartExerciseView(exercise: exercise, workoutId: workout.id, entry: entry, onSave: {
                        loadWorkoutDetails()
                    })
                    .environmentObject(exerciseManager)
                }
            } else {
                Text("Exercise definition not found")
                    .task {
                        // Attempt to fetch definitions if missing
                        try? await exerciseManager.fetchDefinitions(query: nil)
                    }
            }
        }
        .task {
            loadWorkoutDetails()
        }
    }
    
    private func finishWorkout() {
        guard let details = workoutDetails else { return }
        Task {
            do {
                let updated = try await exerciseManager.updateWorkoutStatus(workoutId: details.id, status: .completed)
                await MainActor.run {
                    workoutDetails = updated
                }
            } catch {
                print("Error finishing workout: \(error)")
            }
        }
    }
    
    private func deleteWorkout() {
        Task {
            do {
                try await exerciseManager.deleteWorkout(id: workout.id)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                print("Error deleting workout: \(error)")
            }
        }
    }

    private func deleteEntry(id: Int) {
        Task {
            do {
                try await exerciseManager.deleteWorkoutEntry(entryId: id)
                loadWorkoutDetails()
            } catch {
                print("Error deleting entry: \(error)")
            }
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let date: Date?
        if let d = isoFormatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString) {
            date = d
        } else {
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            date = simpleFormatter.date(from: dateString)
        }
        
        if let date = date {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "EEEE, MMMM d, yyyy" // e.g. "Friday, January 2, 2026"
            return displayFormatter.string(from: date)
        }
        
        return dateString
    }
    
    private func loadWorkoutDetails() {
        isLoading = true
        Task {
            do {
                if exerciseManager.definitions.isEmpty {
                    try? await exerciseManager.fetchDefinitions()
                }
                
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

// MARK: - Exercises Selection View

struct ExercisesSelectionView: View {
    let workoutId: Int
    var onSave: (() -> Void)? = nil
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
                StartExerciseView(exercise: exercise, workoutId: workoutId, onSave: {
                    // When an exercise is saved, call the callback and dismiss the selection sheet
                    onSave?()
                    dismiss()
                })
                .environmentObject(exerciseManager)
            }
            .task {
                do {
                    try await exerciseManager.fetchDefinitions(query: nil)
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
        WorkoutDetailView(workout: try! JSONDecoder().decode(WorkoutSession.self, from: """
        {
            "id": 1,
            "uuid": "00000000-0000-0000-0000-000000000000",
            "user_id": 1,
            "exercise_date": "2024-01-15",
            "day_of_week": 1,
            "total_duration_minutes": 45,
            "location": "Gym",
            "status": "COMPLETED",
            "entries": []
        }
        """.data(using: .utf8)!))
        .environmentObject(ExerciseManager.shared)
    }
}

