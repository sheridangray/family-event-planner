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
            _sets = State(initialValue: entry.sets)
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
        ZStack {
            // Background
            Color(.systemBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 0) {
                    // Video player (if available)
                    if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                        VideoThumbnailView(url: url, exerciseName: exercise.exerciseName)
                            .frame(height: 220)
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
                            
                            Text(labels.1)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                            
                            Text(labels.2)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                            
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
                                .background(Color.white)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color(.systemGray4), lineWidth: 1)
                                )
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 24)
                    }
                    .background(Color(.systemGray6))
                    .padding(.top, 8)
                    
                    Spacer(minLength: 120) // Increased space for bottom button
                }
            }
            
            // Bottom ADD button
            VStack {
                Spacer()
                Button {
                    saveExercise()
                } label: {
                    Text(entry == nil ? "ADD EXERCISE" : "UPDATE ENTRY")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.blue)
                        .cornerRadius(12)
                }
                .disabled(isSaving || sets.isEmpty)
                .opacity(isSaving || sets.isEmpty ? 0.6 : 1.0)
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
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
             default:
                 focusedField = .reps(0)
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
}

// MARK: - Set Row View

struct StartExerciseSetRowView: View {
    @Binding var set: ExerciseSet
    let exerciseType: ExerciseCategory
    let index: Int
    var focusedField: FocusState<StartExerciseView.Field?>.Binding
    @State private var durationMinutes: Int?
    var onDelete: (() -> Void)?
    
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
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
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
                       .font(.system(size: 20, weight: .semibold))
                       .multilineTextAlignment(.center)
                       .frame(height: 44)
                       .background(Color.white)
                       .cornerRadius(8)
                    Text("min")
                       .font(.caption)
                       .foregroundColor(.secondary)
                       
                default:
                    // Reps (Strength, etc)
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                        .focused(focusedField, equals: .reps(index))
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
                        .cornerRadius(8)
                    Text("reps")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)

            // COLUMN 2 (Secondary Metric)
            VStack(spacing: 4) {
                switch exerciseType {
                case .weighted, .time, .bodyweight, .mobility, .cableMachine:
                    // Weight (Optional for some)
                    TextField("0", value: $set.weight, format: .number)
                        .keyboardType(.decimalPad)
                        .focused(focusedField, equals: .weight(index))
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
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
                        .font(.system(size: 18, weight: .medium))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
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
                            .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color.white)
                            .cornerRadius(8)
                         Text("min")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        // Calories
                        TextField("0", value: $set.calories, format: .number)
                            .keyboardType(.numberPad)
                            .focused(focusedField, equals: .calories(index))
                            .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .frame(height: 44)
                            .background(Color.white)
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

            // COLUMN 3 (Tertiary/Rest)
            VStack(spacing: 4) {
                switch exerciseType {
                case .distanceTime, .machineCardio:
                    // Heart Rate
                    TextField("0", value: $set.heartRate, format: .number)
                        .keyboardType(.numberPad)
                        .focused(focusedField, equals: .heartRate(index))
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
                        .cornerRadius(8)
                    Text("bpm")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        
                default:
                    // Rest
                    TextField("0", value: $set.restSeconds, format: .number)
                        .keyboardType(.numberPad)
                        .focused(focusedField, equals: .rest(index))
                        .font(.system(size: 20, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 44)
                        .background(Color.white)
                        .cornerRadius(8)
                    Text("rest")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            
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
