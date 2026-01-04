import SwiftUI

/// View for editing an exercise's details
struct EditExerciseView: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    @State private var exerciseName: String
    @State private var instructions: String
    @State private var youtubeUrl: String
    @State private var bodyParts: Set<BodyPart>
    @State private var exerciseType: ExerciseCategory
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingError = false
    
    init(exercise: Exercise) {
        self.exercise = exercise
        _exerciseName = State(initialValue: exercise.name)
        _instructions = State(initialValue: exercise.instructions ?? "")
        _youtubeUrl = State(initialValue: exercise.youtubeUrl ?? "")
        _bodyParts = State(initialValue: Set(exercise.primaryMuscles))
        _exerciseType = State(initialValue: exercise.category)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(exerciseName)
                        .foregroundColor(.secondary)
                } header: {
                    Text("Exercise Name")
                } footer: {
                    Text("The exercise name cannot be changed after creation.")
                }
                
                Section {
                    Picker("Exercise Type", selection: $exerciseType) {
                        ForEach(ExerciseCategory.allCases, id: \.self) { category in
                            Text(category.displayName).tag(category)
                        }
                    }
                } header: {
                    Text("Exercise Type")
                }
                
                Section {
                    TextEditor(text: $instructions)
                        .frame(minHeight: 150)
                } header: {
                    Text("Instructions")
                } footer: {
                    Text("Provide step-by-step instructions for performing this exercise.")
                }
                
                Section {
                    TextField("YouTube URL", text: $youtubeUrl)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                } header: {
                    Text("YouTube Video URL")
                } footer: {
                    Text("Optional: Link to a YouTube video demonstrating this exercise.")
                }
                
                Section {
                    // Multiselect Dropdown for Body Parts
                    VStack(alignment: .leading, spacing: 8) {
                        Menu {
                            ForEach(BodyPart.allCases) { part in
                                Button {
                                    if bodyParts.contains(part) {
                                        bodyParts.remove(part)
                                    } else {
                                        bodyParts.insert(part)
                                    }
                                } label: {
                                    HStack {
                                        Text(part.displayName)
                                        if bodyParts.contains(part) {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            HStack {
                                if bodyParts.isEmpty {
                                    Text("Select Body Parts")
                                        .foregroundColor(.secondary)
                                } else {
                                    Text(bodyParts.map { $0.displayName }.sorted().joined(separator: ", "))
                                        .foregroundColor(.primary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 8)
                        }
                    }
                } header: {
                    Text("Body Parts Targeted")
                } footer: {
                    Text("Select the muscle groups or body parts targeted by this exercise.")
                }
            }
            .navigationTitle("Edit Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveExercise()
                    }
                    .disabled(isSaving || exerciseName.isEmpty || instructions.isEmpty)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown error")
            }
        }
    }
    
    private func saveExercise() {
        isSaving = true
        errorMessage = nil
        
        Task {
            do {
                _ = try await exerciseManager.updateExercise(
                    exerciseId: exercise.id,
                    instructions: instructions.trimmingCharacters(in: .whitespaces),
                    youtubeUrl: youtubeUrl.trimmingCharacters(in: .whitespaces).isEmpty ? nil : youtubeUrl.trimmingCharacters(in: .whitespaces),
                    bodyParts: Array(bodyParts).map { $0.rawValue },
                    exerciseType: exerciseType
                )
                
                await MainActor.run {
                    isSaving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isSaving = false
                }
            }
        }
    }
}

#Preview {
    EditExerciseView(exercise: try! JSONDecoder().decode(Exercise.self, from: """
    {
        "id": 1,
        "uuid": "00000000-0000-0000-0000-000000000000",
        "exercise_name": "Bench Press",
        "instructions": "Lie on bench, lower bar to chest, press up",
        "youtube_url": "https://youtube.com/watch?v=example",
        "primary_muscles": ["Chest", "Shoulders", "Triceps"],
        "category": "WEIGHTED",
        "is_archived": false
    }
    """.data(using: .utf8)!))
    .environmentObject(ExerciseManager.shared)
}

