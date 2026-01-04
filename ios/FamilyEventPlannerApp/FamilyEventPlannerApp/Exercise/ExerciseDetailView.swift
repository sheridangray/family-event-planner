import SwiftUI
import SafariServices

/// Reusable content view for exercise details
struct ExerciseDetailContent: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var history: [ExerciseLogEntry] = []
    @State private var isLoadingHistory = false
    
    var typeColor: Color {
        exercise.exerciseType.color
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Video thumbnail at the very top (if available)
                if let youtubeUrl = exercise.youtubeUrl, let url = URL(string: youtubeUrl) {
                    VideoThumbnailView(url: url, exerciseName: exercise.exerciseName)
                        .frame(height: 220)
                        .clipped()
                }
                
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        Text(exercise.exerciseName)
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        // Type badge
                        Text(exercise.exerciseType.displayName)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(typeColor.opacity(0.2))
                            .foregroundColor(typeColor)
                            .cornerRadius(8)
                    }
                    .padding(.horizontal)
                    .padding(.top, 16) // Spacing from video or top
                    
                    // Body Parts
                    if !exercise.bodyParts.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Body Parts Targeted")
                                .font(.headline)
                                .padding(.horizontal)
                            
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
                                .padding(.horizontal)
                            }
                        }
                    }
                    
                    // Instructions
                    if let instructions = exercise.instructions {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Instructions")
                                .font(.headline)
                                .padding(.horizontal)
                            
                            Text(instructions)
                                .font(.body)
                                .padding()
                                .background(Color(.systemGray6))
                                .cornerRadius(12)
                                .padding(.horizontal)
                        }
                    }
                    
                    // History
                    if !history.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Previous Performances")
                                .font(.headline)
                                .padding(.horizontal)
                            
                            ForEach(history.prefix(5)) { entry in
                                HistoryRow(entry: entry, exerciseType: exercise.exerciseType)
                                    .padding(.horizontal)
                            }
                        }
                    }
                    
                    // Spacer to prevent content from being hidden behind fixed button
                    Spacer()
                        .frame(height: 100)
                }
            }
        }
        .task {
            loadHistory()
        }
    }
    
    private func loadHistory() {
        isLoadingHistory = true
        Task {
            // Load history from all workout sessions
            await MainActor.run {
                let allEntries = exerciseManager.activeSessions
                    .flatMap { $0.entries }
                    .filter { $0.exerciseId == exercise.id }
                    .sorted { $0.performedAt > $1.performedAt }
                
                history = Array(allEntries.prefix(10))
                isLoadingHistory = false
            }
        }
    }
}

/// Detail view for an exercise showing instructions, YouTube link, body parts, and history
struct ExerciseDetailView: View {
    let exercise: Exercise
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @Binding var selectedTab: Int
    @State private var showingStartExercise = false
    @State private var showingEditExercise = false
    @State private var showingDeleteConfirmation = false
    @State private var isDeleting = false
    @State private var currentExercise: Exercise
    
    init(exercise: Exercise, selectedTab: Binding<Int>) {
        self.exercise = exercise
        self._selectedTab = selectedTab
        _currentExercise = State(initialValue: exercise)
    }
    
    var typeColor: Color {
        currentExercise.exerciseType.color
    }
    
    var body: some View {
        ZStack {
            // Reusable Content
            ExerciseDetailContent(exercise: currentExercise)
                .environmentObject(exerciseManager)
            
            // Fixed Start Exercise Button at bottom
            VStack(spacing: 0) {
                Spacer()
                
                VStack {
                    Button {
                        showingStartExercise = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Start Exercise")
                                .font(.headline)
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [typeColor, typeColor.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(16)
                        .shadow(color: typeColor.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 34) // Ensure padding for safe area / home indicator
                .background(.ultraThinMaterial)
                .overlay(
                    VStack {
                        Divider()
                            .opacity(0.5)
                        Spacer()
                    }
                )
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color(.systemBackground), for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button {
                        showingEditExercise = true
                    } label: {
                        Text("Edit")
                    }
                    
                    Menu {
                        Button(role: .destructive) {
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete Exercise", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .alert("Delete Exercise?", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteExercise()
            }
        } message: {
            Text("This will archive '\(currentExercise.exerciseName)'. It won't appear in the list anymore but will still be referenced in your historical workout logs.")
        }
        .sheet(isPresented: $showingStartExercise) {
            StartExerciseView(exercise: currentExercise, workoutId: nil, onSave: {
                // After saving an exercise started from detail, switch to the Workout Log tab
                selectedTab = 2
                // Also dismiss this detail view to go back to the list (which is now on tab 2)
                dismiss()
            })
            .environmentObject(exerciseManager)
        }
        .sheet(isPresented: $showingEditExercise) {
            EditExerciseView(exercise: currentExercise)
                .environmentObject(exerciseManager)
                .onDisappear {
                    // Refresh exercise data after editing
                    Task {
                        do {
                            let updated = try await exerciseManager.getExercise(id: currentExercise.id)
                            await MainActor.run {
                                currentExercise = updated
                            }
                        } catch {
                            print("Error refreshing exercise: \(error)")
                        }
                    }
                }
        }
    }
    
    private func deleteExercise() {
        isDeleting = true
        Task {
            do {
                try await exerciseManager.deleteExercise(exerciseId: currentExercise.id)
                await MainActor.run {
                    isDeleting = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isDeleting = false
                }
                print("Error deleting exercise: \(error)")
            }
        }
    }
}

// MARK: - History Row

struct HistoryRow: View {
    let entry: ExerciseLogEntry
    let exerciseType: ExerciseCategory
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(entry.setsPerformed) sets")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            Group {
                // Weight
                if entry.weightUsed.contains(where: { $0 != nil }) {
                    let weights = entry.weightUsed.compactMap { $0 }
                    Text("Weights: \(weights.map { String(format: "%.0f", $0) }.joined(separator: ", ")) lbs")
                }
                
                // Reps
                if entry.repsPerformed.contains(where: { $0 != nil }) {
                    let reps = entry.repsPerformed.compactMap { $0 }
                    Text("Reps: \(reps.map { String($0) }.joined(separator: ", "))")
                }
                
                // Distance
                if !entry.distanceMeters.isEmpty {
                    Text("Distance: \(entry.distanceMeters.map { String(format: "%.0f m", $0) }.joined(separator: ", "))")
                }
                
                // Duration
                if entry.durationSeconds.contains(where: { $0 != nil }) {
                    let durations = entry.durationSeconds.compactMap { $0 }
                    Text("Duration: \(durations.map { formatDuration($0) }.joined(separator: ", "))")
                }
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    private func formatDuration(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        return String(format: "%d:%02d", minutes, remainingSeconds)
    }
}

// MARK: - Video Thumbnail View

struct VideoThumbnailView: View {
    let url: URL
    let exerciseName: String
    @State private var showingVideo = false
    
    private var videoId: String? {
        let pattern = "((?<=(v|V)/)|(?<=be/)|(?<=(\\?|\\&)v=)|(?<=embed/))([\\w-]++)"
        let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive)
        let range = NSRange(url.absoluteString.startIndex..., in: url.absoluteString)
        
        if let match = regex?.firstMatch(in: url.absoluteString, options: [], range: range) {
            return String(url.absoluteString[Range(match.range, in: url.absoluteString)!])
        }
        return nil
    }
    
    private var thumbnailUrl: URL? {
        guard let id = videoId else { return nil }
        return URL(string: "https://img.youtube.com/vi/\(id)/hqdefault.jpg")
    }
    
    var body: some View {
        Button {
            showingVideo = true
        } label: {
            ZStack {
                // Video Thumbnail
                if let thumbnailUrl = thumbnailUrl {
                    AsyncImage(url: thumbnailUrl) { phase in
                        switch phase {
                        case .empty:
                            Rectangle()
                                .fill(Color.black.opacity(0.8))
                                .overlay(ProgressView().tint(.white))
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(maxWidth: .infinity)
                                .frame(height: 220) // Internal height constraint
                                .clipped()
                        case .failure:
                            Rectangle()
                                .fill(Color.black.opacity(0.8))
                                .overlay(
                                    VStack(spacing: 8) {
                                        Image(systemName: "video.slash")
                                            .font(.title)
                                            .foregroundColor(.white.opacity(0.6))
                                        Text("Thumbnail unavailable")
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.6))
                                    }
                                )
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    Rectangle()
                        .fill(Color.black.opacity(0.8))
                        .frame(height: 220)
                }
                
                // Dark overlay to make play button pop
                Color.black.opacity(0.2)
                
                // Play button overlay
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.white.opacity(0.9))
                    .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
            }
            .frame(height: 220) // Constrain the entire ZStack
            .clipped() // Ensure everything is clipped
        }
        .sheet(isPresented: $showingVideo) {
            SafariView(url: url)
        }
    }
}

// MARK: - Safari View

struct SafariView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> SFSafariViewController {
        return SFSafariViewController(url: url)
    }
    
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
    }
}

#Preview {
    NavigationStack {
        ExerciseDetailView(exercise: try! JSONDecoder().decode(Exercise.self, from: """
        {
            "id": 1,
            "uuid": "00000000-0000-0000-0000-000000000000",
            "exercise_name": "Bench Press",
            "instructions": "Lie on bench, lower bar to chest, press up",
            "youtube_url": "https://youtube.com/watch?v=example",
            "primary_muscles": ["Chest", "Shoulders", "Triceps"],
            "category": "WEIGHTED",
            "is_archived": false
        }
        """.data(using: .utf8)!), selectedTab: .constant(0))
        .environmentObject(ExerciseManager.shared)
    }
}
