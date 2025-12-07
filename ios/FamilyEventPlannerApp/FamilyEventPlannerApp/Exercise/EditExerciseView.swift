import SwiftUI

/// View for editing an exercise's details
struct EditExerciseView: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    @State private var exerciseName: String
    @State private var instructions: String
    @State private var youtubeUrl: String
    @State private var bodyParts: [String]
    @State private var exerciseType: ExerciseCategory
    @State private var newBodyPart: String = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingError = false
    
    init(exercise: Exercise) {
        self.exercise = exercise
        _exerciseName = State(initialValue: exercise.exerciseName)
        _instructions = State(initialValue: exercise.instructions)
        _youtubeUrl = State(initialValue: exercise.youtubeUrl ?? "")
        _bodyParts = State(initialValue: exercise.bodyParts)
        _exerciseType = State(initialValue: exercise.exerciseType)
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
                    // Body parts list
                    ForEach(bodyParts, id: \.self) { part in
                        HStack {
                            Text(part)
                            Spacer()
                            Button {
                                bodyParts.removeAll { $0 == part }
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                    }
                    
                    // Add body part
                    HStack {
                        TextField("Add body part", text: $newBodyPart)
                            .textInputAutocapitalization(.words)
                            .onSubmit {
                                addBodyPart()
                            }
                        Button {
                            addBodyPart()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.blue)
                        }
                        .disabled(newBodyPart.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } header: {
                    Text("Body Parts Targeted")
                } footer: {
                    Text("List the muscle groups or body parts targeted by this exercise.")
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
    
    private func addBodyPart() {
        let trimmed = newBodyPart.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty && !bodyParts.contains(trimmed) {
            bodyParts.append(trimmed)
            newBodyPart = ""
        }
    }
    
    private func saveExercise() {
        isSaving = true
        errorMessage = nil
        
        Task {
            do {
                let updatedExercise = try await exerciseManager.updateExercise(
                    exerciseId: exercise.id,
                    instructions: instructions.trimmingCharacters(in: .whitespaces),
                    youtubeUrl: youtubeUrl.trimmingCharacters(in: .whitespaces).isEmpty ? nil : youtubeUrl.trimmingCharacters(in: .whitespaces),
                    bodyParts: bodyParts,
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
    EditExerciseView(exercise: Exercise(
        id: 1,
        exerciseName: "Bench Press",
        instructions: "Lie on bench, lower bar to chest, press up",
        youtubeUrl: "https://youtube.com/watch?v=example",
        bodyParts: ["chest", "shoulders", "triceps"],
        exerciseType: .barbellDumbbell,
        createdAt: nil,
        updatedAt: nil
    ))
    .environmentObject(ExerciseManager.shared)
}

