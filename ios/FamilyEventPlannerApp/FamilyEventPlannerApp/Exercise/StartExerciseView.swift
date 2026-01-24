import SwiftUI
import AVKit

/// View for starting an exercise with type-specific input fields
struct StartExerciseView: View {
    let exercise: Exercise
    let workoutId: Int?
    let entry: ExerciseLogEntry?
    var onSave: (() -> Void)? = nil
    
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    
    @State private var sets: [ExerciseSet]
    @State private var equipmentUsed: String
    @State private var notes: String
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var currentWorkoutId: Int?
    @State private var showingExerciseInfo = false
    
    init(exercise: Exercise, workoutId: Int?, entry: ExerciseLogEntry? = nil, onSave: (() -> Void)? = nil) {
        self.exercise = exercise
        self.workoutId = workoutId
        self.entry = entry
        self.onSave = onSave
        
        if let entry = entry {
            // Update sets to default to repsMax if they are currently at repsMin
            let updatedSets = entry.sets.map { set -> ExerciseSet in
                var newSet = set
                // Default reps to repsMax if available
                if let max = set.repsMax, (set.reps == nil || set.reps == set.repsMin) {
                    newSet.reps = max
                }
                // Default rest to 60 if not set
                if newSet.restSeconds == nil || newSet.restSeconds == 0 {
                    newSet.restSeconds = 60
                }
                return newSet
            }
            _sets = State(initialValue: updatedSets)
            _notes = State(initialValue: entry.notes ?? "")
            _equipmentUsed = State(initialValue: "")
        } else {
            var initialSet = ExerciseSet()
            initialSet.restSeconds = 60
            _sets = State(initialValue: [initialSet])
            _notes = State(initialValue: "")
            _equipmentUsed = State(initialValue: "")
        }
    }
    
    private var previousEntry: ExerciseLogEntry? {
        // Find all entries for this exercise in history
        let allEntries = exerciseManager.activeSessions
            .flatMap { $0.entries }
            .filter { $0.exerciseId == exercise.id || $0.exerciseName == exercise.exerciseName }
            .sorted { $0.performedAt > $1.performedAt }
        
        // Find the most recent one that is NOT the current entry (if we are editing)
        if let currentEntry = entry {
            return allEntries.first { $0.performedAt < currentEntry.performedAt }
        } else {
            return allEntries.first
        }
    }
    
    // Focus state for navigating between fields
    @FocusState private var focusedField: Field?
    
    enum Field: Hashable {
        case reps(Int)
        case weight(Int)
        case rest(Int)
        case duration(Int)
        case speed(Int)
        case incline(Int)
        case distance(Int)
        case heartRate(Int)
        case calories(Int)
        case bandLevel(Int)
    }
    
    // Helper for dynamic labels
    var labels: (String, String, String) {
        exercise.exerciseType.metricLabels
    }
    
    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 0) {
                        // Video player (if available)
                        if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                            VideoThumbnailView(url: url, exerciseName: exercise.exerciseName)
                                .frame(height: 220)
                                .id("video")
                        } else {
                            // Placeholder for video
                            ZStack {
                                Color.black.opacity(0.8)
                                VStack(spacing: 12) {
                                    Image(systemName: "play.circle.fill")
                                        .font(.system(size: 60))
                                        .foregroundColor(.white.opacity(0.7))
                                    Text(exercise.exerciseName)
                                        .font(.headline)
                                        .foregroundColor(.white)
                                }
                            }
                            .frame(height: 220)
                            .id("video")
                        }
                        
                        // Exercise name
                        VStack(alignment: .leading, spacing: 8) {
                            Text(exercise.bodyParts.joined(separator: ", ").uppercased())
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .textCase(.uppercase)
                            
                            Text(exercise.exerciseName)
                                .font(.title2)
                                .fontWeight(.bold)
                                .id("exerciseName")

                            Button {
                                showingExerciseInfo = true
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: "info.circle")
                                    Text("Exercise information")
                                }
                                .font(.subheadline)
                                .foregroundColor(.blue)
                            }
                            .padding(.top, 4)
                            
                            // Previous session data (Last:)
                            if let previous = previousEntry {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack(spacing: 8) {
                                        Text("Last:")
                                            .font(.caption)
                                            .fontWeight(.medium)
                                            .foregroundColor(.secondary)
                                        
                                        ScrollView(.horizontal, showsIndicators: false) {
                                            HStack(spacing: 6) {
                                                ForEach(0..<previous.setsPerformed, id: \.self) { index in
                                                    setTag(for: index, from: previous)
                                                }
                                            }
                                        }
                                    }
                                    
                                    if let prevNotes = previous.notes, !prevNotes.isEmpty {
                                        Text("Last Note: \(prevNotes)")
                                            .font(.system(size: 11))
                                            .foregroundColor(.secondary)
                                            .italic()
                                            .lineLimit(3)
                                            .padding(.leading, 35) // Align with the start of the pills
                                    }
                                }
                                .padding(.top, 8)
                            }

                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 24)
                        
                        // Sets section
                        VStack(spacing: 0) {
                            // Header labels
                            HStack(spacing: 8) {
                                Text(labels.0)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .frame(maxWidth: .infinity)
                                
                                if !labels.1.isEmpty {
                                    Text(labels.1)
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                        .frame(maxWidth: .infinity)
                                }
                                
                                if !labels.2.isEmpty {
                                    Text(labels.2)
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                        .frame(maxWidth: .infinity)
                                }
                                
                                // Spacer to align with the delete button column
                                Spacer().frame(width: 44)
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                            .padding(.bottom, 12)
                            
                            // Sets list
                            ForEach(Array(sets.enumerated()), id: \.element.id) { index, _ in
                                StartExerciseSetRowView(
                                    set: $sets[index],
                                    exerciseType: exercise.exerciseType,
                                    index: index,
                                    focusedField: $focusedField,
                                    onDelete: sets.count > 1 ? {
                                        sets.remove(at: index)
                                    } : nil
                                )
                                .padding(.horizontal, 20)
                                .padding(.bottom, 12)
                            }
                            
                            // Add Set button
                            Button {
                                var newSet = ExerciseSet()
                                if let lastSet = sets.last {
                                    // Copy forward values from previous set
                                    newSet.reps = lastSet.reps
                                    newSet.weight = lastSet.weight
                                    newSet.restSeconds = lastSet.restSeconds
                                    newSet.duration = lastSet.duration
                                    newSet.distance = lastSet.distance
                                    newSet.bandLevel = lastSet.bandLevel
                                    newSet.resistanceLevel = lastSet.resistanceLevel
                                    newSet.incline = lastSet.incline
                                    newSet.speed = lastSet.speed
                                } else {
                                    newSet.restSeconds = 60
                                }
                                sets.append(newSet)
                            } label: {
                                HStack {
                                    Image(systemName: "plus")
                                        .font(.system(size: 16, weight: .semibold))
                                    Text("ADD SET")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color(.systemGray2))
                                .cornerRadius(10)
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                            .padding(.bottom, 24)

                            // Notes section
                            VStack(alignment: .leading, spacing: 8) {
                                Text("NOTES")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .fontWeight(.semibold)
                                
                                TextEditor(text: $notes)
                                    .frame(height: 100)
                                    .padding(8)
                                    .background(Color(.systemBackground))
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color(.systemGray4), lineWidth: 1)
                                    )
                            }
                            .padding(.horizontal, 20)
                            .padding(.bottom, 24)
                        }
                        .background(Color(.secondarySystemBackground))
                        .padding(.top, 8)
                        
                        Spacer(minLength: 120) // Space for fixed footer
                    }
                }
                .onAppear {
                    // Scroll to exercise name to partially hide video
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        withAnimation {
                            proxy.scrollTo("exerciseName", anchor: .top)
                        }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            
            // Fixed Bottom Button
            VStack(spacing: 0) {
                Divider()
                Button {
                    saveExercise()
                } label: {
                    if isSaving {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text(entry == nil ? "ADD EXERCISE" : "UPDATE ENTRY")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                }
                .disabled(isSaving || sets.isEmpty)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(isSaving || sets.isEmpty ? Color.gray : Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
                .padding()
                .background(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: -5)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true) // Hide default back button
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .foregroundColor(.white) // Assuming dark header or overlay
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 32, height: 32)
                        .background(Color.black.opacity(0.3))
                        .clipShape(Circle())
                }
            }
        }
        .sheet(isPresented: $showingExerciseInfo) {
            ExerciseInfoSheet(exercise: exercise)
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        .onAppear {
             // Set initial focus based on type
             switch exercise.exerciseType {
             case .distanceTime:
                 focusedField = .distance(0)
             case .time, .machineCardio, .mobility:
                 focusedField = .duration(0)
             case .bodyweight:
                 focusedField = .reps(0)
             default:
                 // Default to weight for strength exercises (Weighted, Cable Machine, Band Assisted)
                 focusedField = .weight(0)
             }
        }
        .task {
            if let workoutId = workoutId {
                currentWorkoutId = workoutId
            } else {
                // Ensure activeSessions is populated
                if exerciseManager.activeSessions.isEmpty {
                    try? await exerciseManager.fetchWorkoutHistory()
                }
                
                // Check if there is already an in-progress session in the manager
                if let existingInProgress = exerciseManager.activeSessions.first(where: { $0.status == .inProgress }) {
                    print("📎 Using existing in-progress workout: \(existingInProgress.id)")
                    currentWorkoutId = existingInProgress.id
                } else {
                    // Create new workout if none provided and none in progress
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
    
    private func saveExercise() {
        print("💾 saveExercise() called")
        
        isSaving = true
        
        Task {
            do {
                if let entry = entry, let entryId = entry.backendId {
                    // Update existing entry
                    try await exerciseManager.updateWorkoutEntry(
                        entryId: entryId,
                        sets: sets,
                        notes: notes.isEmpty ? nil : notes
                    )
                } else {
                    // Add new entry
                    guard let workoutId = currentWorkoutId else {
                        print("❌ saveExercise() failed: currentWorkoutId is nil")
                        await MainActor.run {
                            errorMessage = "Workout not initialized"
                            showingError = true
                            isSaving = false
                        }
                        return
                    }
                    
                    try await exerciseManager.addExerciseToWorkout(
                        workoutId: workoutId,
                        exerciseId: exercise.id,
                        sets: sets,
                        restSeconds: nil,
                        equipmentUsed: equipmentUsed.isEmpty ? nil : equipmentUsed,
                        notes: notes.isEmpty ? nil : notes
                    )
                }
                
                print("✅ saveExercise() success, dismissing view")
                await MainActor.run {
                    if let onSave = onSave {
                        onSave()
                    }
                    dismiss()
                }
            } catch {
                print("❌ saveExercise() failed with error: \(error)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isSaving = false
                }
            }
        }
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
    
    private func formatWeight(_ weight: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: weight)) ?? "\(weight)"
    }
    
    @ViewBuilder
    private func setTag(for index: Int, from logEntry: ExerciseLogEntry) -> some View {
        let set = logEntry.sets[index]
        let color = Color.gray
        
        HStack(spacing: 2) {
            // Always show reps x weight for historical display in this view
            if let reps = set.reps {
                Text("\(reps)")
                    .fontWeight(.semibold)
                
                if let weight = set.weight, weight > 0 || (exercise.exerciseType != .bodyweight && weight == 0) {
                    Text("×")
                        .font(.caption2)
                        .foregroundColor(color.opacity(0.6))
                    Text(formatWeight(weight))
                        .fontWeight(.semibold)
                }
            } else if let duration = set.duration {
                Text("\(duration / 60)m")
                    .fontWeight(.semibold)
            }
        }
        .font(.caption)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .foregroundColor(color)
        .cornerRadius(6)
    }
}

// MARK: - Set Row View

struct StartExerciseSetRowView: View {
    @Binding var set: ExerciseSet
    let exerciseType: ExerciseCategory
    let index: Int
    var focusedField: FocusState<StartExerciseView.Field?>.Binding
    @State private var durationMinutes: Int?
    var onDelete: (() -> Void)?
    
    var labels: (String, String, String) {
        exerciseType.metricLabels
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // COLUMN 1 (Primary Metric)
            VStack(spacing: 4) {
                switch exerciseType {
                case .distanceTime:
                    // Distance
                    TextField("0", value: $set.distance, format: .number)
                        .keyboardType(.decimalPad)
                        .focused(focusedField, equals: .distance(index))
                        .submitLabel(.next)
                        .onSubmit { focusedField.wrappedValue = .duration(index) }
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color(.systemBackground))
                        .cornerRadius(8)
                    Text("m")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        
                case .time, .machineCardio, .mobility:
                    // Duration (minutes for now, but stored as seconds or int)
                    // For simplicity, treating duration as minutes input -> seconds
                    TextField("0", value: Binding(
                       get: { durationMinutes },
                       set: { 
                           durationMinutes = $0
                           if let minutes = $0 {
                               set.duration = minutes * 60
                           } else {
                               set.duration = nil
                           }
                       }
                   ), format: .number)
                       .keyboardType(.numberPad)
                       .focused(focusedField, equals: .duration(index))
                       .submitLabel(.next)
                       .onSubmit { 
                           if exerciseType == .machineCardio {
                               focusedField.wrappedValue = .calories(index)
                           } else {
                               focusedField.wrappedValue = .weight(index)
                           }
                       }
                       .font(.system(size: 20, weight: .semibold))
                       .multilineTextAlignment(.center)
                       .frame(height: 44)
                       .background(Color(.systemBackground))
                       .cornerRadius(8)
                    Text("min")
                       .font(.caption)
                       .foregroundColor(.secondary)
                       
                default:
                    // Reps (Strength, etc)
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                    .focused(focusedField, equals: .reps(index))
                    .submitLabel(.next)
                    .onSubmit { 
                        if exerciseType == .bandAssisted {
                            focusedField.wrappedValue = .bandLevel(index)
                        } else {
                            focusedField.wrappedValue = .weight(index)
                        }
                    }
                    .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color(.systemBackground))
                        .cornerRadius(8)
                    Text("reps")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)

            // COLUMN 2 (Secondary Metric)
            if !labels.1.isEmpty {
                VStack(spacing: 4) {
                    switch exerciseType {
                    case .weighted, .time, .bodyweight, .mobility, .cableMachine:
                        // Weight (Optional for some)
                        TextField("0", value: $set.weight, format: .number)
                            .keyboardType(.decimalPad)
                        .focused(focusedField, equals: .weight(index))
                        .submitLabel(.next)
                        .onSubmit { focusedField.wrappedValue = .rest(index) }
                        .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color(.systemBackground))
                            .cornerRadius(8)
                        Text("lbs")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            
                    case .bandAssisted:
                        // Band Level (could be Picker, using Text for now or just string input)
                        TextField("-", text: Binding(
                            get: { set.bandLevel ?? "" },
                            set: { set.bandLevel = $0 }
                        ))
                        .focused(focusedField, equals: .bandLevel(index))
                        .submitLabel(.next)
                        .onSubmit { focusedField.wrappedValue = .rest(index) }
                        .font(.system(size: 18, weight: .medium))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color(.systemBackground))
                            .cornerRadius(8)
                        Text("band")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            
                    case .distanceTime, .machineCardio:
                        // Duration (for distance) or Calories/Intensity?
                        // Labels said: DistanceTime -> Duration (col 2)
                        // Labels said: MachineCardio -> Calories (col 2)
                        
                        if exerciseType == .distanceTime {
                            // Duration input
                            TextField("0", value: Binding(
                                get: { durationMinutes },
                                set: { 
                                    durationMinutes = $0
                                    if let minutes = $0 {
                                        set.duration = minutes * 60
                                    } else {
                                        set.duration = nil
                                    }
                                }
                            ), format: .number)
                                .keyboardType(.numberPad)
                            .focused(focusedField, equals: .duration(index))
                            .submitLabel(.next)
                            .onSubmit { focusedField.wrappedValue = .heartRate(index) }
                            .font(.system(size: 20, weight: .semibold))
                                .multilineTextAlignment(.center)
                                .frame(height: 44)
                                .background(Color(.systemBackground))
                                .cornerRadius(8)
                             Text("min")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            // Calories
                            TextField("0", value: $set.calories, format: .number)
                                .keyboardType(.numberPad)
                            .focused(focusedField, equals: .calories(index))
                            .submitLabel(.next)
                            .onSubmit { focusedField.wrappedValue = .heartRate(index) }
                            .font(.system(size: 20, weight: .semibold))
                                .multilineTextAlignment(.center)
                                .frame(height: 44)
                                .background(Color(.systemBackground))
                                .cornerRadius(8)
                            Text("cals")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                    default:
                        Spacer()
                    }
                }
                .frame(maxWidth: .infinity)
            }

            // COLUMN 3 (Tertiary/Rest)
            if !labels.2.isEmpty {
                VStack(spacing: 4) {
                    switch exerciseType {
                    case .distanceTime, .machineCardio:
                        // Heart Rate
                        TextField("0", value: $set.heartRate, format: .number)
                            .keyboardType(.numberPad)
                            .focused(focusedField, equals: .heartRate(index))
                            .submitLabel(.done)
                            .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color(.systemBackground))
                            .cornerRadius(8)
                        Text("bpm")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            
                    default:
                        // Rest
                        TextField("0", value: $set.restSeconds, format: .number)
                            .keyboardType(.numberPad)
                            .focused(focusedField, equals: .rest(index))
                            .submitLabel(.done)
                            .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color(.systemBackground))
                            .cornerRadius(8)
                        Text("rest")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            
            // Delete button
            if let onDelete = onDelete {
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                        .frame(width: 44, height: 44)
                }
            } else {
                Spacer().frame(width: 44)
            }
        }
    }
}

// MARK: - Exercise Info Sheet

struct ExerciseInfoSheet: View {
    let exercise: Exercise
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var exerciseManager: ExerciseManager
    
    var body: some View {
        NavigationStack {
            ExerciseDetailContent(exercise: exercise)
                .environmentObject(exerciseManager)
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    StartExerciseView(
        exercise: try! JSONDecoder().decode(Exercise.self, from: """
        {
            "id": 1,
            "uuid": "00000000-0000-0000-0000-000000000000",
            "exercise_name": "Push-up - standing",
            "instructions": "Stand facing the sling trainer, hold handles, lean forward, perform push-up motion",
            "youtube_url": "https://youtube.com/watch?v=example",
            "primary_muscles": ["chest", "shoulders", "triceps"],
            "category": "bodyweight",
            "is_archived": false
        }
        """.data(using: .utf8)!),
        workoutId: nil
    )
    .environmentObject(ExerciseManager.shared)
}
