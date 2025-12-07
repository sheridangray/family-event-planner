import SwiftUI
import AVKit

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
    @State private var showingExerciseInfo = false
    
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
        switch exercise.exerciseType {
        case .barbellDumbbell, .machine, .weight:
            return ("Repetitions", "Lbs", "Rest")
        case .bodyweight:
            return ("Repetitions", "Lbs (+/-)", "Rest")
        case .assisted:
            return ("Repetitions", "Band", "Rest")
        case .isometric, .mobility, .skill:
            return ("Duration", "Lbs", "Rest")
        case .cardioDistance:
            return ("Distance (m)", "Duration", "HR")
        case .cardioTime:
            return ("Duration", "Calories", "HR")
        case .interval:
            return ("Work", "Rest", "Rounds")
        }
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
                            SetRowView(
                                set: $sets[index],
                                exerciseType: exercise.exerciseType,
                                restSeconds: $restSeconds,
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
                            sets.append(ExerciseSet())
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
                    }
                    .background(Color(.systemGray6))
                    .padding(.top, 8)
                    
                    Spacer(minLength: 100) // Space for bottom button
                }
            }
            
            // Bottom ADD button
            VStack {
                Spacer()
                Button {
                    saveExercise()
                } label: {
                    Text("ADD EXERCISE")
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
                .padding(.bottom, 8)
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
            ToolbarItem(placement: .keyboard) {
                HStack {
                    Spacer()
                    Button("Done") {
                        focusedField = nil
                    }
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
             case .cardioDistance:
                 focusedField = .distance(0)
             case .isometric, .cardioTime, .mobility, .skill:
                 focusedField = .duration(0)
             default:
                 focusedField = .reps(0)
             }
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

// MARK: - Video Thumbnail View

struct VideoThumbnailView: View {
    let url: URL
    let exerciseName: String
    @State private var showingVideo = false
    
    var body: some View {
        ZStack {
            // Placeholder background
            Color.black.opacity(0.8)
            
            // Play button overlay
            Button {
                showingVideo = true
            } label: {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.white.opacity(0.9))
            }
        }
        .sheet(isPresented: $showingVideo) {
            SafariView(url: url)
        }
    }
}

// MARK: - Safari View

import SafariServices

struct SafariView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }
    
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
    }
}

// MARK: - Set Row View

struct SetRowView: View {
    @Binding var set: ExerciseSet
    let exerciseType: ExerciseCategory
    @Binding var restSeconds: Int
    let index: Int
    var focusedField: FocusState<StartExerciseView.Field?>.Binding
    @State private var durationMinutes: Int?
    var onDelete: (() -> Void)?
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // COLUMN 1 (Primary Metric)
            VStack(spacing: 4) {
                switch exerciseType {
                case .cardioDistance:
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
                        
                case .isometric, .cardioTime, .mobility, .skill:
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
                case .barbellDumbbell, .machine, .weight, .isometric, .bodyweight, .mobility, .skill:
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
                        
                case .assisted:
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
                        
                case .cardioDistance, .cardioTime:
                    // Duration (for distance) or Calories/Intensity?
                    // Labels said: CardioDistance -> Duration (col 2)
                    // Labels said: CardioTime -> Calories (col 2)
                    
                    if exerciseType == .cardioDistance {
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
                case .cardioDistance, .cardioTime:
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
                    TextField("0", value: $restSeconds, format: .number)
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
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
        }
    }
}

#Preview {
    StartExerciseView(
        exercise: Exercise(
            id: 1,
            exerciseName: "Push-up - standing",
            instructions: "Stand facing the sling trainer, hold handles, lean forward, perform push-up motion",
            youtubeUrl: "https://youtube.com/watch?v=example",
            bodyParts: ["chest", "shoulders", "triceps"],
            exerciseType: .bodyweight,
            createdAt: nil,
            updatedAt: nil
        ),
        workoutId: nil
    )
    .environmentObject(ExerciseManager.shared)
}
