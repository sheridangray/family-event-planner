import SwiftUI

/// List view for all exercises with search/autocomplete
struct ExercisesListView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var searchText = ""
    @State private var exercises: [Exercise] = []
    @State private var isLoading = false
    @State private var showingAddExercise = false
    @State private var selectedExercise: Exercise?
    
    var filteredExercises: [Exercise] {
        if searchText.isEmpty {
            return exercises
        }
        return exercises.filter { exercise in
            exercise.exerciseName.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            SearchBar(text: $searchText, placeholder: "Search exercises...")
                .padding()
                .onChange(of: searchText) { newValue in
                    if !newValue.isEmpty {
                        searchExercises(query: newValue)
                    } else {
                        loadExercises()
                    }
                }
            
            // Exercise list
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredExercises.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 50))
                        .foregroundColor(.secondary)
                    Text(searchText.isEmpty ? "No exercises found" : "No exercises match '\(searchText)'")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    if searchText.isEmpty {
                        Button("Add Exercise") {
                            showingAddExercise = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredExercises) { exercise in
                    ExerciseRow(exercise: exercise) {
                        selectedExercise = exercise
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Exercises")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showingAddExercise = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddExercise) {
            NavigationStack {
                AddExerciseView()
                    .environmentObject(exerciseManager)
            }
        }
        .task {
            loadExercises()
        }
        .navigationDestination(item: $selectedExercise) { exercise in
            ExerciseDetailView(exercise: exercise)
                .environmentObject(exerciseManager)
        }
    }
    
    private func loadExercises() {
        isLoading = true
        Task {
            do {
                try await exerciseManager.fetchExercises(query: nil)
                await MainActor.run {
                    exercises = exerciseManager.exercises
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Error loading exercises: \(error)")
            }
        }
    }
    
    private func searchExercises(query: String) {
        Task {
            do {
                try await exerciseManager.fetchExercises(query: query)
                await MainActor.run {
                    exercises = exerciseManager.exercises
                }
            } catch {
                print("Error searching exercises: \(error)")
            }
        }
    }
}

// MARK: - Exercise Row

struct ExerciseRow: View {
    let exercise: Exercise
    let action: () -> Void
    
    var typeColor: Color {
        switch exercise.exerciseType {
        case .weight:
            return .blue
        case .bodyweight:
            return .green
        case .treadmill:
            return .orange
        }
    }
    
    var typeIcon: String {
        switch exercise.exerciseType {
        case .weight:
            return "dumbbell.fill"
        case .bodyweight:
            return "figure.walk"
        case .treadmill:
            return "figure.run"
        }
    }
    
    var body: some View {
        HStack(spacing: 0) {
            // Tappable area for detail view
            Button(action: action) {
                HStack(spacing: 16) {
                    // Type icon
                    ZStack {
                        Circle()
                            .fill(typeColor.opacity(0.2))
                            .frame(width: 44, height: 44)
                        
                        Image(systemName: typeIcon)
                            .foregroundColor(typeColor)
                            .font(.title3)
                    }
                    
                    // Exercise info
                    VStack(alignment: .leading, spacing: 4) {
                        Text(exercise.exerciseName)
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        if !exercise.bodyParts.isEmpty {
                            Text(exercise.bodyParts.prefix(3).joined(separator: ", "))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                    
                    Spacer()
                }
                .padding(.vertical, 8)
                .padding(.leading, 0)
                .padding(.trailing, 8)
            }
            .buttonStyle(PlainButtonStyle())
            
            // Start button - separate from tappable area
            NavigationLink {
                StartExerciseView(exercise: exercise, workoutId: nil)
            } label: {
                Text("Start")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxHeight: .infinity)
                    .padding(.horizontal, 20)
                    .background(typeColor)
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

// MARK: - Search Bar

struct SearchBar: View {
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
            
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

#Preview {
    ExercisesListView()
        .environmentObject(ExerciseManager.shared)
}

