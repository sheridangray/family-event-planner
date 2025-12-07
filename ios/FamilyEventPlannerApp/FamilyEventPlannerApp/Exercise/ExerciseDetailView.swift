import SwiftUI

/// Reusable content view for exercise details
struct ExerciseDetailContent: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var history: [ExerciseLogEntry] = []
    @State private var isLoadingHistory = false
    
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
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(exercise.exerciseName)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    // Type badge
                    Text(exercise.exerciseType.rawValue.capitalized)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(typeColor.opacity(0.2))
                        .foregroundColor(typeColor)
                        .cornerRadius(8)
                }
                .padding(.horizontal)
                
                // Body Parts
                if !exercise.bodyParts.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Body Parts Targeted")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(exercise.bodyParts, id: \.self) { part in
                                    Text(part)
                                        .font(.subheadline)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(Color.blue.opacity(0.2))
                                        .foregroundColor(.blue)
                                        .cornerRadius(8)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                
                // YouTube Link (moved above Instructions)
                if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Video Instructions")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        Link(destination: url) {
                            HStack {
                                Image(systemName: "play.circle.fill")
                                    .font(.title2)
                                    Text("Watch on YouTube")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: "arrow.up.right.square")
                            }
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .foregroundColor(.red)
                            .cornerRadius(12)
                            .padding(.horizontal)
                        }
                    }
                }
                
                // Instructions
                VStack(alignment: .leading, spacing: 12) {
                    Text("Instructions")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    Text(exercise.instructions)
                        .font(.body)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .padding(.horizontal)
                }
                
                // History
                if !history.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Previous Performances")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        ForEach(history.prefix(5)) { entry in
                            HistoryRow(entry: entry, exerciseType: exercise.exerciseType)
                                .padding(.horizontal)
                        }
                    }
                }
                
                // Spacer to prevent content from being hidden behind fixed button
                Spacer()
                    .frame(height: 100)
            }
            .padding(.vertical)
        }
        .task {
            loadHistory()
        }
    }
    
    private func loadHistory() {
        isLoadingHistory = true
        Task {
            // Load history from recent logs
            await MainActor.run {
                history = exerciseManager.recentLogs
                    .flatMap { $0.entries }
                    .filter { $0.exerciseName == exercise.exerciseName || $0.exerciseId == exercise.id }
                    .sorted { entry1, entry2 in
                        // Sort by date (most recent first)
                        // This is a simplified version - in production, you'd want to sort by workout date
                        return true
                    }
                isLoadingHistory = false
            }
        }
    }
}

/// Detail view for an exercise showing instructions, YouTube link, body parts, and history
struct ExerciseDetailView: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var showingStartExercise = false
    @State private var showingEditExercise = false
    @State private var currentExercise: Exercise
    
    init(exercise: Exercise) {
        self.exercise = exercise
        _currentExercise = State(initialValue: exercise)
    }
    
    var typeColor: Color {
        switch currentExercise.exerciseType {
        case .weight:
            return .blue
        case .bodyweight:
            return .green
        case .treadmill:
            return .orange
        }
    }
    
    var body: some View {
        ZStack {
            // Reusable Content
            ExerciseDetailContent(exercise: currentExercise)
                .environmentObject(exerciseManager)
            
            // Fixed Start Exercise Button at bottom
            VStack {
                Spacer()
                Button {
                    showingStartExercise = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Start Exercise")
                            .font(.headline)
                            .foregroundColor(.white)
                        Spacer()
                    }
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [typeColor, typeColor.opacity(0.8)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
                .background(
                    // Add subtle shadow and background to make button stand out
                    Color(.systemBackground)
                        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: -2)
                )
            }
        }
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button {
                        showingEditExercise = true
                    } label: {
                        Text("Edit")
                    }
                    
                    ProfileMenuButton()
                        .environmentObject(AuthenticationManager.shared)
                }
            }
        }
        .sheet(isPresented: $showingStartExercise) {
            StartExerciseView(exercise: currentExercise, workoutId: nil)
                .environmentObject(exerciseManager)
        }
        .sheet(isPresented: $showingEditExercise) {
            EditExerciseView(exercise: currentExercise)
                .environmentObject(exerciseManager)
                .onDisappear {
                    // Refresh exercise data after editing
                    Task {
                        do {
                            let updated = try await exerciseManager.getExercise(id: currentExercise.id)
                            await MainActor.run {
                                currentExercise = updated
                            }
                        } catch {
                            print("Error refreshing exercise: \(error)")
                        }
                    }
                }
        }
    }
}

// MARK: - History Row

struct HistoryRow: View {
    let entry: ExerciseLogEntry
    let exerciseType: ExerciseType
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(entry.setsPerformed) sets")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            if exerciseType == .weight {
                let weights = entry.weightUsed.compactMap { $0 }
                if !weights.isEmpty {
                    Text("Weights: \(weights.map { String(format: "%.0f", $0) }.joined(separator: ", ")) lbs")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                if !entry.repsPerformed.isEmpty {
                    Text("Reps: \(entry.repsPerformed.map { String($0) }.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if exerciseType == .bodyweight {
                if !entry.repsPerformed.isEmpty {
                    Text("Reps: \(entry.repsPerformed.map { String($0) }.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if exerciseType == .treadmill {
                if !entry.durationSeconds.isEmpty {
                    let durations = entry.durationSeconds.map { "\($0 / 60) min" }
                    Text("Duration: \(durations.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

#Preview {
    NavigationStack {
        ExerciseDetailView(exercise: Exercise(
            id: 1,
            exerciseName: "Bench Press",
            instructions: "Lie on bench, lower bar to chest, press up",
            youtubeUrl: "https://youtube.com/watch?v=example",
            bodyParts: ["chest", "shoulders", "triceps"],
            exerciseType: .weight,
            createdAt: nil,
            updatedAt: nil
        ))
        .environmentObject(ExerciseManager.shared)
    }
}
