import SwiftUI

/// View for starting an exercise with type-specific input fields
struct StartExerciseView: View {
    let exercise: Exercise
    let workoutId: Int?
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    @State private var sets: [ExerciseSet] = [ExerciseSet()]
    @State private var restSeconds: Int = 60
    @State private var equipmentUsed: String = ""
    @State private var notes: String = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var currentWorkoutId: Int?
    
    var body: some View {
        NavigationStack {
            Form {
                // Exercise info
                Section {
                    HStack {
                        Text(exercise.exerciseName)
                            .font(.headline)
                        Spacer()
                        Text(exercise.exerciseType.rawValue.capitalized)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(typeColor.opacity(0.2))
                            .foregroundColor(typeColor)
                            .cornerRadius(8)
                    }
                } header: {
                    Text("Exercise")
                }
                
                // Sets
                Section {
                    ForEach($sets) { $set in
                        SetInputView(set: $set, exerciseType: exercise.exerciseType)
                    }
                    .onDelete { indexSet in
                        sets.remove(atOffsets: indexSet)
                    }
                    
                    Button {
                        sets.append(ExerciseSet())
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Set")
                        }
                    }
                } header: {
                    Text("Sets")
                }
                
                // Rest time
                Section {
                    Stepper(value: $restSeconds, in: 0...300, step: 15) {
                        HStack {
                            Text("Rest Time")
                            Spacer()
                            Text("\(restSeconds) seconds")
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("Rest Between Sets")
                }
                
                // Equipment (for weight exercises)
                if exercise.exerciseType == .weight {
                    Section {
                        TextField("Equipment Used", text: $equipmentUsed)
                            .textInputAutocapitalization(.words)
                    } header: {
                        Text("Equipment")
                    } footer: {
                        Text("e.g., Dumbbells, Barbell, Machine, Bands")
                    }
                }
                
                // Notes
                Section {
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Notes")
                }
            }
            .navigationTitle("Log Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        saveExercise()
                    }
                    .disabled(isSaving || sets.isEmpty)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown error")
            }
            .task {
                if let workoutId = workoutId {
                    currentWorkoutId = workoutId
                } else {
                    // Create new workout if none provided
                    do {
                        let workout = try await exerciseManager.createWorkout()
                        currentWorkoutId = workout.id
                    } catch {
                        errorMessage = error.localizedDescription
                        showingError = true
                    }
                }
            }
        }
    }
    
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
    
    private func saveExercise() {
        guard let workoutId = currentWorkoutId else {
            errorMessage = "Workout not initialized"
            showingError = true
            return
        }
        
        isSaving = true
        
        Task {
            do {
                try await exerciseManager.addExerciseToWorkout(
                    workoutId: workoutId,
                    exerciseId: exercise.id,
                    sets: sets,
                    restSeconds: restSeconds,
                    equipmentUsed: equipmentUsed.isEmpty ? nil : equipmentUsed,
                    notes: notes.isEmpty ? nil : notes
                )
                
                await MainActor.run {
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

// MARK: - Set Input View

struct SetInputView: View {
    @Binding var set: ExerciseSet
    let exerciseType: ExerciseType
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch exerciseType {
            case .weight:
                HStack {
                    Text("Reps")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack {
                    Text("Weight")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.weight, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Text("lbs")
                        .foregroundColor(.secondary)
                }
                
            case .bodyweight:
                HStack {
                    Text("Reps")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }
                
            case .treadmill:
                HStack {
                    Text("Incline")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.incline, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Text("%")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Speed")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.speed, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Text("MPH")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Time")
                        .frame(width: 60, alignment: .leading)
                    TextField("0", value: $set.duration, format: .number)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Text("seconds")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    StartExerciseView(
        exercise: Exercise(
            id: 1,
            exerciseName: "Bench Press",
            instructions: "Lie on bench, lower bar to chest, press up",
            youtubeUrl: nil,
            bodyParts: ["chest", "shoulders"],
            exerciseType: .weight,
            createdAt: nil,
            updatedAt: nil
        ),
        workoutId: nil
    )
    .environmentObject(ExerciseManager.shared)
}

