import SwiftUI

/// View for adding a new exercise with LLM-generated details
struct AddExerciseView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    @State private var exerciseName = ""
    @State private var isGenerating = false
    @State private var generatedExercise: Exercise?
    @State private var errorMessage: String?
    @State private var showingError = false
    
    // New state for editing generated details
    @State private var editedCategory: ExerciseCategory = .barbellDumbbell
    @State private var editedInstructions: String = ""
    @State private var editedYoutubeUrl: String = ""
    @State private var isSaving = false
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Exercise Name", text: $exerciseName)
                        .textInputAutocapitalization(.words)
                        .disabled(isGenerating)
                } header: {
                    Text("Exercise Name")
                } footer: {
                    Text("Enter the name of the exercise (e.g., 'Bench Press', 'Push-ups', 'Treadmill Run')")
                }
                
                if isGenerating {
                    Section {
                        HStack {
                            ProgressView()
                            Text("Generating exercise details...")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                if let exercise = generatedExercise {
                    Section {
                        // Editable Category Picker
                        Picker("Type", selection: $editedCategory) {
                            ForEach(ExerciseCategory.allCases, id: \.self) { category in
                                Text(category.displayName).tag(category)
                            }
                        }
                        
                        // Body Parts (Keep read-only or make editable if desired)
                        if !exercise.bodyParts.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Body Parts")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                FlowLayout(spacing: 8) {
                                    ForEach(exercise.bodyParts, id: \.self) { part in
                                        Text(part)
                                            .font(.caption)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color.blue.opacity(0.2))
                                            .foregroundColor(.blue)
                                            .cornerRadius(8)
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        
                        // Editable Instructions
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Instructions")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            TextEditor(text: $editedInstructions)
                                .frame(minHeight: 100)
                        }
                        
                        // Editable YouTube URL
                        VStack(alignment: .leading, spacing: 8) {
                            Text("YouTube URL")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            TextField("https://youtube.com/...", text: $editedYoutubeUrl)
                                .keyboardType(.URL)
                                .autocapitalization(.none)
                        }
                        
                        // Link preview
                        if let url = URL(string: editedYoutubeUrl), !editedYoutubeUrl.isEmpty {
                            Link(destination: url) {
                                HStack {
                                    Image(systemName: "play.circle.fill")
                                    Text("Test Video Link")
                                }
                            }
                        }
                    } header: {
                        Text("Review & Edit Details")
                    } footer: {
                        Text("The AI has filled these in. Review and adjust if necessary before saving.")
                    }
                }
            }
            .navigationTitle("Add Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Generate") {
                        generateExercise()
                    }
                    .disabled(exerciseName.isEmpty || isGenerating)
                }
                if generatedExercise != nil {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Save") {
                            saveExercise()
                        }
                        .disabled(isSaving)
                    }
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown error")
            }
        }
    }
    
    private func generateExercise() {
        guard !exerciseName.isEmpty else { return }
        
        isGenerating = true
        errorMessage = nil
        
        Task {
            do {
                try await exerciseManager.createExercise(name: exerciseName)
                await MainActor.run {
                    if let exercise = exerciseManager.exercises.first(where: { $0.exerciseName == exerciseName }) {
                        generatedExercise = exercise
                        // Pre-fill editable fields with generated data
                        editedCategory = exercise.exerciseType
                        editedInstructions = exercise.instructions
                        editedYoutubeUrl = exercise.youtubeUrl ?? ""
                    }
                    isGenerating = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isGenerating = false
                }
            }
        }
    }
    
    private func saveExercise() {
        guard let exercise = generatedExercise else { return }
        
        isSaving = true
        
        Task {
            do {
                // Update the exercise with any user edits
                _ = try await exerciseManager.updateExercise(
                    exerciseId: exercise.id,
                    instructions: editedInstructions,
                    youtubeUrl: editedYoutubeUrl.isEmpty ? nil : editedYoutubeUrl,
                    exerciseType: editedCategory
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

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.width ?? 0,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX, y: bounds.minY + result.frames[index].minY), proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var frames: [CGRect] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }
                
                frames.append(CGRect(x: currentX, y: currentY, width: size.width, height: size.height))
                lineHeight = max(lineHeight, size.height)
                currentX += size.width + spacing
            }
            
            self.size = CGSize(width: maxWidth, height: currentY + lineHeight)
        }
    }
}

#Preview {
    AddExerciseView()
        .environmentObject(ExerciseManager.shared)
}

