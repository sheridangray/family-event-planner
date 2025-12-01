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
    
    var body: some View {
        NavigationStack {
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
                            Text(exercise.exerciseName.uppercased())
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .textCase(.uppercase)
                            
                            Text(exercise.exerciseName)
                                .font(.title2)
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 24)
                        
                        // Sets section
                        VStack(spacing: 0) {
                            // Header labels
                            HStack {
                                Text("Target")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(exercise.exerciseType == .treadmill ? "Duration" : "Repetitions")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal, 20)
                            .padding(.bottom, 12)
                            
                            // Sets list
                            ForEach(Array(sets.enumerated()), id: \.element.id) { index, _ in
                                SetRowView(
                                    set: $sets[index],
                                    exerciseType: exercise.exerciseType,
                                    restSeconds: $restSeconds
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
                            
                            // Exercise information button
                            Button {
                                showingExerciseInfo = true
                            } label: {
                                HStack {
                                    Image(systemName: "info.circle")
                                        .font(.system(size: 16))
                                    Text("Exercise information")
                                        .font(.subheadline)
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color(.systemGray2))
                                .cornerRadius(10)
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 12)
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
                        Text("ADD")
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.white)
                            .cornerRadius(0)
                    }
                    .disabled(isSaving || sets.isEmpty)
                    .opacity(isSaving || sets.isEmpty ? 0.6 : 1.0)
                }
                .ignoresSafeArea(edges: .bottom)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .foregroundColor(.white)
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
    let exerciseType: ExerciseType
    @Binding var restSeconds: Int
    @State private var durationMinutes: Int?
    
    var body: some View {
        HStack(spacing: 12) {
            // Left box - Target/Reps/Weight/Incline/Speed
            VStack(spacing: 4) {
                if exerciseType == .weight {
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                        .font(.system(size: 24, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 50)
                        .background(Color.white)
                        .cornerRadius(8)
                    
                    Text("reps")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    // Weight input below reps
                    TextField("0", value: $set.weight, format: .number)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 20, weight: .medium))
                        .multilineTextAlignment(.center)
                        .frame(height: 40)
                        .background(Color.white)
                        .cornerRadius(8)
                        .padding(.top, 4)
                    
                    Text("lbs")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if exerciseType == .bodyweight {
                    TextField("0", value: $set.reps, format: .number)
                        .keyboardType(.numberPad)
                        .font(.system(size: 24, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 50)
                        .background(Color.white)
                        .cornerRadius(8)
                    
                    Text("reps")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if exerciseType == .treadmill {
                    // Incline
                    TextField("0", value: $set.incline, format: .number)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 20, weight: .medium))
                        .multilineTextAlignment(.center)
                        .frame(height: 40)
                        .background(Color.white)
                        .cornerRadius(8)
                    
                    Text("incline %")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    // Speed
                    TextField("0", value: $set.speed, format: .number)
                        .keyboardType(.decimalPad)
                        .font(.system(size: 20, weight: .medium))
                        .multilineTextAlignment(.center)
                        .frame(height: 40)
                        .background(Color.white)
                        .cornerRadius(8)
                        .padding(.top, 4)
                    
                    Text("speed mph")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            
            // Right box - Rest/Duration
            VStack(spacing: 4) {
                if exerciseType == .treadmill {
                    // Time in minutes
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
                        .font(.system(size: 24, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 50)
                        .background(Color.white)
                        .cornerRadius(8)
                        .onAppear {
                            if let duration = set.duration {
                                durationMinutes = duration / 60
                            }
                        }
                    
                    Text("min")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    // Rest time - editable for all sets (shared value)
                    TextField("0", value: $restSeconds, format: .number)
                        .keyboardType(.numberPad)
                        .font(.system(size: 24, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .frame(height: 50)
                        .background(Color.white)
                        .cornerRadius(8)
                    
                    Text("rest")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Exercise Info Sheet

struct ExerciseInfoSheet: View {
    let exercise: Exercise
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Body Parts
                    if !exercise.bodyParts.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Body Parts Targeted")
                                .font(.headline)
                            
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(exercise.bodyParts, id: \.self) { part in
                                        Text(part)
                                            .font(.subheadline)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(Color.blue.opacity(0.2))
                                            .foregroundColor(.blue)
                                            .cornerRadius(8)
                                    }
                                }
                            }
                        }
                    }
                    
                    // Instructions
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Instructions")
                            .font(.headline)
                        
                        Text(exercise.instructions)
                            .font(.body)
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                    }
                    
                    // YouTube Link
                    if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                        Link(destination: url) {
                            HStack {
                                Image(systemName: "play.circle.fill")
                                    .font(.title2)
                                Text("Watch on YouTube")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: "arrow.up.right.square")
                            }
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .foregroundColor(.red)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle(exercise.exerciseName)
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

