import SwiftUI

/// View for adding or editing a workout routine
struct AddRoutineView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    // Edit mode
    let routineToEdit: ExerciseRoutine?
    
    @State private var routineName = ""
    @State private var description = ""
    @State private var selectedDays: Set<Int> = []
    @State private var routineExercises: [RoutineExerciseData] = []
    
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var showingExercisePicker = false
    
    let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    
    init(routine: ExerciseRoutine? = nil) {
        self.routineToEdit = routine
        _routineName = State(initialValue: routine?.routineName ?? "")
        _description = State(initialValue: routine?.description ?? "")
        
        if let day = routine?.dayOfWeek {
            _selectedDays = State(initialValue: [day])
        } else {
            _selectedDays = State(initialValue: [])
        }
        
        if let exercises = routine?.exercises {
            let data = exercises.map { ex in
                RoutineExerciseData(
                    exerciseName: ex.exerciseName,
                    targetSets: ex.targetSets,
                    targetRepsMin: ex.targetRepsMin,
                    targetRepsMax: ex.targetRepsMax,
                    targetDurationSeconds: ex.targetDurationSeconds,
                    notes: ex.notes,
                    cues: ex.cues,
                    preferredEquipment: ex.preferredEquipment,
                    equipmentNotes: ex.equipmentNotes
                )
            }
            _routineExercises = State(initialValue: data)
        } else {
            _routineExercises = State(initialValue: [])
        }
    }
    
    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Form {
                    routineDetailsSection
                    scheduleSection
                    exercisesSection
                    footerSpacer
                }
                
                fixedFooter
            }
            .navigationTitle(routineToEdit == nil ? "New Routine" : "Edit Routine")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: $showingExercisePicker) {
                NavigationStack {
                    RoutineExercisePicker { exercise in
                        let newData = RoutineExerciseData(
                            exerciseName: exercise.exerciseName,
                            targetSets: 3,
                            targetRepsMin: 10,
                            targetRepsMax: 12,
                            preferredEquipment: exercise.category.rawValue
                        )
                        routineExercises.append(newData)
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
    
    private var routineDetailsSection: some View {
        Section("Routine Details") {
            TextField("Routine Name", text: $routineName)
            TextField("Description", text: $description)
        }
    }
    
    private var scheduleSection: some View {
        Section("Schedule") {
            HStack {
                ForEach(0..<7) { index in
                    Button {
                        if selectedDays.contains(index) {
                            selectedDays.remove(index)
                        } else {
                            selectedDays.removeAll()
                            selectedDays.insert(index)
                        }
                    } label: {
                        Text(days[index])
                            .font(.caption)
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(selectedDays.contains(index) ? Color.blue : Color(.systemGray6))
                            .foregroundColor(selectedDays.contains(index) ? .white : .primary)
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
    }
    
    private var exercisesSection: some View {
        Section("Exercises") {
            if routineExercises.isEmpty {
                Text("No exercises added yet")
                    .foregroundColor(.secondary)
            } else {
                exerciseList
            }
            
            addExerciseButton
        }
    }
    
    private var exerciseList: some View {
        ForEach($routineExercises) { $ex in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(ex.exerciseName)
                        .font(.headline)
                    Spacer()
                    Button(role: .destructive) {
                        if let index = routineExercises.firstIndex(where: { $0.id == ex.id }) {
                            routineExercises.remove(at: index)
                        }
                    } label: {
                        Image(systemName: "trash")
                            .foregroundColor(.red)
                    }
                    .buttonStyle(.plain)
                }
                
                exerciseControls(for: $ex)
            }
            .padding(.vertical, 8)
        }
        .onMove { from, to in
            routineExercises.move(fromOffsets: from, toOffset: to)
        }
    }
    
    private func exerciseControls(for ex: Binding<RoutineExerciseData>) -> some View {
        HStack(spacing: 16) {
            // Sets Control
            VStack(alignment: .leading, spacing: 4) {
                Text("Sets")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                
                HStack(spacing: 12) {
                    Text("\(ex.wrappedValue.targetSets)")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .frame(width: 24)
                    
                    Stepper("", value: ex.targetSets, in: 1...10)
                        .labelsHidden()
                        .scaleEffect(0.9)
                }
                .padding(.trailing, 4)
            }
            
            Divider().frame(height: 35)
            
            // Reps Control
            VStack(alignment: .leading, spacing: 4) {
                Text("Reps (Min - Max)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                
                HStack(spacing: 8) {
                    TextField("Min", value: ex.targetRepsMin, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .frame(width: 55)
                        .multilineTextAlignment(.center)
                        .font(.body)
                    
                    Text("-")
                        .foregroundColor(.secondary)
                        .fontWeight(.bold)
                    
                    TextField("Max", value: ex.targetRepsMax, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .frame(width: 55)
                        .multilineTextAlignment(.center)
                        .font(.body)
                }
            }
        }
        .padding(.top, 4)
    }
    
    private var addExerciseButton: some View {
        Button {
            showingExercisePicker = true
        } label: {
            HStack {
                Image(systemName: "plus.circle.fill")
                Text("Add Exercise")
            }
            .fontWeight(.semibold)
        }
        .padding(.vertical, 4)
    }
    
    private var footerSpacer: some View {
        Section {
            Spacer(minLength: 80)
        }
        .listRowBackground(Color.clear)
    }
    
    private var fixedFooter: some View {
        VStack(spacing: 0) {
            Divider()
            Button(action: saveRoutine) {
                if isSaving {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text(routineToEdit == nil ? "Create Routine" : "Save Changes")
                        .font(.headline)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(routineName.isEmpty || isSaving ? Color.gray : Color.blue)
            .foregroundColor(.white)
            .cornerRadius(12)
            .disabled(routineName.isEmpty || isSaving)
            .padding()
            .background(Color(.systemBackground))
        }
    }
    
    private func saveRoutine() {
        isSaving = true
        
        Task {
            do {
                // Prepare exercises
                let exercises = routineExercises.enumerated().map { index, data in
                    RoutineExercise(
                        id: 0,
                        routineId: routineToEdit?.id ?? 0,
                        exerciseName: data.exerciseName,
                        exerciseOrder: index + 1,
                        targetSets: data.targetSets,
                        targetRepsMin: data.targetRepsMin,
                        targetRepsMax: data.targetRepsMax,
                        targetDurationSeconds: data.targetDurationSeconds,
                        notes: data.notes,
                        cues: data.cues,
                        preferredEquipment: data.preferredEquipment,
                        equipmentNotes: data.equipmentNotes
                    )
                }
                
                // For now we only support one day or custom. 
                let firstDay = selectedDays.sorted().first
                
                if let routine = routineToEdit {
                    _ = try await exerciseManager.updateRoutine(
                        id: routine.id,
                        name: routineName,
                        description: description,
                        dayOfWeek: firstDay,
                        exercises: exercises
                    )
                } else {
                    _ = try await exerciseManager.createRoutine(
                        name: routineName,
                        description: description,
                        dayOfWeek: firstDay,
                        exercises: exercises
                    )
                }
                
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

// MARK: - Helper Models

struct RoutineExerciseData: Identifiable {
    let id = UUID()
    var exerciseName: String
    var targetSets: Int
    var targetRepsMin: Int?
    var targetRepsMax: Int?
    var targetDurationSeconds: Int?
    var notes: String?
    var cues: String?
    var preferredEquipment: String?
    var equipmentNotes: String?
}

// MARK: - Exercise Picker Subview

struct RoutineExercisePicker: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @State private var searchText = ""
    let onSelect: (ExerciseDefinition) -> Void
    
    var filteredExercises: [ExerciseDefinition] {
        if searchText.isEmpty { return exerciseManager.definitions }
        return exerciseManager.definitions.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        List(filteredExercises) { exercise in
            Button {
                onSelect(exercise)
                dismiss()
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        Text(exercise.name).font(.headline)
                        Text(exercise.category.displayName).font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "plus.circle")
                }
            }
            .foregroundColor(.primary)
        }
        .navigationTitle("Add Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: "Search exercises")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done") { dismiss() }
            }
        }
        .task {
            if exerciseManager.definitions.isEmpty {
                try? await exerciseManager.fetchDefinitions()
            }
        }
    }
}
