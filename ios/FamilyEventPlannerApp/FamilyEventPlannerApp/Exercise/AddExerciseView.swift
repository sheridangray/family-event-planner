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
    @State private var editedCategory: ExerciseCategory = .weighted
    @State private var editedInstructions: String = ""
    @State private var editedYoutubeUrl: String = ""
    @State private var editedBodyParts: Set<BodyPart> = []
    @State private var isSaving = false
    
    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
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
                            
                            // Multiselect Dropdown for Body Parts
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Body Parts Targeted")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                Menu {
                                    ForEach(BodyPart.allCases) { part in
                                        Button {
                                            if editedBodyParts.contains(part) {
                                                editedBodyParts.remove(part)
                                            } else {
                                                editedBodyParts.insert(part)
                                            }
                                        } label: {
                                            HStack {
                                                Text(part.displayName)
                                                if editedBodyParts.contains(part) {
                                                    Image(systemName: "checkmark")
                                                }
                                            }
                                        }
                                    }
                                } label: {
                                    HStack {
                                        if editedBodyParts.isEmpty {
                                            Text("Select Body Parts")
                                                .foregroundColor(.secondary)
                                        } else {
                                            Text(editedBodyParts.map { $0.displayName }.sorted().joined(separator: ", "))
                                                .foregroundColor(.primary)
                                                .lineLimit(1)
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 12)
                                    .background(Color(.secondarySystemBackground))
                                    .cornerRadius(8)
                                }
                            }
                            .padding(.vertical, 4)
                            
                            // Formatted Instructions (Read-only with better formatting)
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Instructions")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                Text(formatInstructions(editedInstructions))
                                    .font(.body)
                                    .padding()
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color(.secondarySystemBackground))
                                    .cornerRadius(8)
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
                        
                        // Add spacing for the bottom button
                        Section {
                            Color.clear
                                .frame(height: 100)
                                .listRowBackground(Color.clear)
                        }
                    }
                }
                
                // Fixed Save Button at Bottom
                if generatedExercise != nil {
                    VStack(spacing: 0) {
                        Divider()
                        
                        Button {
                            saveExercise()
                        } label: {
                            HStack {
                                if isSaving {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    Text("Saving...")
                                } else {
                                    Text("Save Exercise")
                                }
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(isSaving ? Color.gray : Color.blue)
                            )
                        }
                        .disabled(isSaving)
                        .padding(.horizontal)
                        .padding(.vertical, 16)
                    }
                    .background(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: -5)
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
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown error")
            }
        }
    }
    
    /// Format instructions with proper line breaks and spacing
    private func formatInstructions(_ text: String) -> String {
        var formatted = text
        
        // Add spacing between numbered steps (but keep number and text together)
        for i in 2...9 {
            formatted = formatted.replacingOccurrences(of: " \(i). ", with: "\n\n\(i). ")
        }
        
        return formatted.trimmingCharacters(in: .whitespacesAndNewlines)
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
                        editedInstructions = exercise.instructions ?? ""
                        editedYoutubeUrl = exercise.youtubeUrl ?? ""
                        editedBodyParts = Set(exercise.primaryMuscles)
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
                    bodyParts: Array(editedBodyParts).map { $0.rawValue },
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

