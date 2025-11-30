import SwiftUI

/// Structured workout logging view
struct ExerciseLogView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    let routine: ExerciseRoutine
    @Environment(\.dismiss) var dismiss
    
    @State private var logEntries: [ExerciseLogEntryData] = []
    @State private var location: String = "home"
    @State private var notes: String = ""
    @State private var totalDurationMinutes: Int = 0
    @State private var isSaving = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        Form {
            // Location picker
            Section(header: Text("Location")) {
                Picker("Where are you?", selection: $location) {
                    Text("Home (Bands)").tag("home")
                    Text("Gym (Machines/Weights)").tag("gym")
                    Text("Other").tag("other")
                }
            }
            
            // Exercise list with quick input
            Section(header: Text("Exercises")) {
                ForEach(Array(logEntries.enumerated()), id: \.element.id) { index, _ in
                    ExerciseLogRow(
                        exercise: routine.exercises[index],
                        location: location,
                        entry: Binding(
                            get: { logEntries[index] },
                            set: { logEntries[index] = $0 }
                        )
                    )
                }
            }
            
            // Duration
            Section(header: Text("Workout Duration")) {
                HStack {
                    Text("Total Minutes")
                    Spacer()
                    TextField("Minutes", value: $totalDurationMinutes, format: .number)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 100)
                }
            }
            
            // Notes section
            Section(header: Text("Notes")) {
                TextEditor(text: $notes)
                    .frame(height: 100)
            }
            
            // Save button
            Section {
                Button(action: saveLog) {
                    HStack {
                        if isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Save Workout")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(isSaving)
            }
        }
        .navigationTitle("Log Workout")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Initialize log entries from routine
            logEntries = routine.exercises.map { exercise in
                ExerciseLogEntryData(
                    exerciseName: exercise.exerciseName,
                    setsPerformed: exercise.targetSets,
                    repsPerformed: Array(repeating: exercise.targetRepsMin ?? 0, count: exercise.targetSets),
                    weightUsed: Array(repeating: nil, count: exercise.targetSets),
                    durationSeconds: Array(repeating: exercise.targetDurationSeconds ?? 0, count: exercise.targetSets)
                )
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
    }
    
    func saveLog() {
        isSaving = true
        
        Task {
            do {
                let today = Date()
                let dateFormatter = ISO8601DateFormatter()
                dateFormatter.formatOptions = [.withFullDate]
                
                let entries = logEntries.map { entry in
                    ExerciseLogEntry(
                        id: 0,
                        logId: 0,
                        exerciseName: entry.exerciseName,
                        exerciseOrder: 0,
                        equipmentUsed: location,
                        setsPerformed: entry.setsPerformed,
                        repsPerformed: entry.repsPerformed,
                        weightUsed: entry.weightUsed,
                        durationSeconds: entry.durationSeconds,
                        restSeconds: nil,
                        notes: nil,
                        difficultyRating: nil
                    )
                }
                
                let log = ExerciseLog(
                    id: 0,
                    userId: 0,
                    routineId: routine.id,
                    exerciseDate: dateFormatter.string(from: today),
                    dayOfWeek: Calendar.current.component(.weekday, from: today),
                    totalDurationMinutes: totalDurationMinutes > 0 ? totalDurationMinutes : nil,
                    location: location,
                    notes: notes.isEmpty ? nil : notes,
                    entries: entries,
                    createdAt: nil,
                    updatedAt: nil
                )
                
                try await exerciseManager.logWorkout(log)
                
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

// MARK: - Exercise Log Entry Data

struct ExerciseLogEntryData: Identifiable {
    let id = UUID()
    var exerciseName: String
    var setsPerformed: Int
    var repsPerformed: [Int]
    var weightUsed: [Double?]
    var durationSeconds: [Int]
}

// MARK: - Exercise Log Row

struct ExerciseLogRow: View {
    let exercise: RoutineExercise
    let location: String
    @Binding var entry: ExerciseLogEntryData
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Exercise name with equipment indicator
            HStack {
                Text(exercise.exerciseName)
                    .font(.headline)
                Spacer()
                EquipmentBadge(equipment: getEquipmentForLocation())
            }
            
            // Sets input
            HStack {
                Text("Sets: \(entry.setsPerformed)")
                Stepper("", value: $entry.setsPerformed, in: 1...10)
                    .onChange(of: entry.setsPerformed) { newValue in
                        // Adjust arrays to match new set count
                        while entry.repsPerformed.count < newValue {
                            entry.repsPerformed.append(exercise.targetRepsMin ?? 0)
                        }
                        while entry.weightUsed.count < newValue {
                            entry.weightUsed.append(nil)
                        }
                        while entry.durationSeconds.count < newValue {
                            entry.durationSeconds.append(exercise.targetDurationSeconds ?? 0)
                        }
                        // Trim if decreased
                        entry.repsPerformed = Array(entry.repsPerformed.prefix(newValue))
                        entry.weightUsed = Array(entry.weightUsed.prefix(newValue))
                        entry.durationSeconds = Array(entry.durationSeconds.prefix(newValue))
                    }
            }
            
            // Reps per set (expandable)
            if exercise.targetRepsMin != nil {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Reps per set:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    ForEach(0..<entry.setsPerformed, id: \.self) { setIndex in
                        HStack {
                            Text("Set \(setIndex + 1):")
                                .frame(width: 60, alignment: .leading)
                            TextField("Reps", value: Binding(
                                get: { entry.repsPerformed.indices.contains(setIndex) ? entry.repsPerformed[setIndex] : 0 },
                                set: { newValue in
                                    if entry.repsPerformed.indices.contains(setIndex) {
                                        entry.repsPerformed[setIndex] = newValue
                                    }
                                }
                            ), format: .number)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                            
                            // Weight input (if using weights)
                            if location == "gym" && exercise.preferredEquipment != "bodyweight" {
                                TextField("lbs", value: Binding(
                                    get: { entry.weightUsed.indices.contains(setIndex) ? entry.weightUsed[setIndex] : nil },
                                    set: { newValue in
                                        if entry.weightUsed.indices.contains(setIndex) {
                                            entry.weightUsed[setIndex] = newValue
                                        }
                                    }
                                ), format: .number)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 70)
                            }
                        }
                    }
                }
            }
            
            // Duration input (for holds)
            if exercise.targetDurationSeconds != nil {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Duration (seconds) per set:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    ForEach(0..<entry.setsPerformed, id: \.self) { setIndex in
                        HStack {
                            Text("Set \(setIndex + 1):")
                                .frame(width: 60, alignment: .leading)
                            TextField("Seconds", value: Binding(
                                get: { entry.durationSeconds.indices.contains(setIndex) ? entry.durationSeconds[setIndex] : 0 },
                                set: { newValue in
                                    if entry.durationSeconds.indices.contains(setIndex) {
                                        entry.durationSeconds[setIndex] = newValue
                                    }
                                }
                            ), format: .number)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    func getEquipmentForLocation() -> String {
        if location == "gym" {
            return exercise.preferredEquipment == "bands" ? "machine" : (exercise.preferredEquipment ?? "machine")
        }
        return exercise.preferredEquipment ?? "bands"
    }
}

// MARK: - Equipment Badge

struct EquipmentBadge: View {
    let equipment: String
    
    var body: some View {
        Text(equipment.capitalized)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.sunsetDustyBlue.opacity(0.2))
            .foregroundColor(.sunsetDustyBlue)
            .cornerRadius(8)
    }
}

#Preview {
    NavigationStack {
        ExerciseLogView(routine: ExerciseRoutine(
            id: 1,
            userId: 1,
            routineName: "Upper Push",
            dayOfWeek: 1,
            description: "Test",
            isActive: true,
            exercises: [
                RoutineExercise(
                    id: 1,
                    routineId: 1,
                    exerciseName: "Push-ups",
                    exerciseOrder: 1,
                    targetSets: 4,
                    targetRepsMin: 10,
                    targetRepsMax: 12,
                    targetDurationSeconds: nil,
                    notes: nil,
                    cues: nil,
                    preferredEquipment: "bodyweight",
                    equipmentNotes: nil
                )
            ],
            createdAt: nil,
            updatedAt: nil
        ))
        .environmentObject(ExerciseManager.shared)
    }
}

