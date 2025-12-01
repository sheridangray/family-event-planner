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
                        // Exercise Type
                        HStack {
                            Text("Type")
                            Spacer()
                            Text(exercise.exerciseType.rawValue.capitalized)
                                .foregroundColor(.secondary)
                        }
                        
                        // Body Parts
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
                        }
                        
                        // Instructions
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Instructions")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Text(exercise.instructions)
                                .font(.body)
                        }
                        
                        // YouTube Link
                        if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                            Link(destination: url) {
                                HStack {
                                    Image(systemName: "play.circle.fill")
                                    Text("Watch Video")
                                }
                            }
                        }
                    } header: {
                        Text("Generated Details")
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
                        .disabled(isGenerating)
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
        // Exercise is already saved when generated
        dismiss()
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

