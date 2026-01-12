import SwiftUI

/// Detail view for a workout showing all exercises and ability to add more
struct WorkoutDetailView: View {
    let workout: WorkoutSession
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @State private var showingAddExercise = false
    @State private var workoutDetails: WorkoutSession?
    @State private var isLoading = false
    @State private var showingDeleteConfirmation = false
    @State private var editingEntry: ExerciseLogEntry?
    @State private var entryToDelete: Int?
    @State private var showingDeleteEntryConfirmation = false
    @State private var isPollingAnalysis = false
    @State private var showingDatePicker = false
    @State private var tempDate = Date()
    @State private var isUpdatingDate = false
    
    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                        // Header
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(workoutDetails?.routineName ?? "Workout")
                                    .font(.title)
                                    .fontWeight(.bold)
                                
                                Spacer()
                                
                                if let details = workoutDetails, details.status == .inProgress {
                                    Text("IN PROGRESS")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.orange.opacity(0.2))
                                        .foregroundColor(.orange)
                                        .cornerRadius(6)
                                }
                            }
                        
                        Text(formatDate(workoutDetails?.exerciseDate ?? workout.exerciseDate))
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        if let duration = workout.totalDurationMinutes {
                            Text("\(duration) minutes")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal)
                    
                    // Exercises
                    if let details = workoutDetails {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(details.entries) { entry in
                                ExerciseEntryCard(
                                    entry: entry,
                                    onEdit: {
                                        editingEntry = entry
                                    },
                                    onDelete: {
                                        if let entryId = entry.backendId {
                                            entryToDelete = entryId
                                            showingDeleteEntryConfirmation = true
                                        }
                                    }
                                )
                                .padding(.horizontal)
                            }
                        }
                        
                        // AI Analysis Section
                        if details.status == .completed {
                            analysisSection(for: details)
                        }
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    
                    // Spacer for fixed footer
                    Spacer(minLength: 160)
                }
                .padding(.vertical)
            }
            .background(Color(.systemGroupedBackground))
            
            // Fixed Bottom Footer
            VStack(spacing: 12) {
                Divider()
                
                VStack(spacing: 12) {
                    // Add Exercise Button
                    Button {
                        showingAddExercise = true
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Exercise")
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(12)
                    }
                    
                    // Finish Workout Button
                    if let details = workoutDetails, details.status == .inProgress {
                        Button {
                            finishWorkout()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Finish Workout")
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background(Color(.systemBackground))
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: -5)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        if let startedAt = workoutDetails?.startedAt {
                            tempDate = startedAt
                        } else {
                            // Try to parse exerciseDate if startedAt is missing
                            let formatter = DateFormatter()
                            formatter.dateFormat = "yyyy-MM-dd"
                            if let date = formatter.date(from: workout.exerciseDate) {
                                tempDate = date
                            } else {
                                tempDate = Date()
                            }
                        }
                        showingDatePicker = true
                    } label: {
                        Label("Change Date/Time", systemImage: "calendar")
                    }
                    
                    Button(role: .destructive) {
                        showingDeleteConfirmation = true
                    } label: {
                        Label("Delete Workout", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingDatePicker) {
            NavigationStack {
                VStack(spacing: 20) {
                    DatePicker("Workout Date & Time", selection: $tempDate)
                        .datePickerStyle(.graphical)
                        .padding()
                    
                    Spacer()
                }
                .navigationTitle("Workout Time")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingDatePicker = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            updateWorkoutDate()
                        }
                        .fontWeight(.bold)
                        .disabled(isUpdatingDate)
                    }
                }
                .overlay {
                    if isUpdatingDate {
                        Color.black.opacity(0.1).ignoresSafeArea()
                        ProgressView()
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $showingAddExercise) {
            ExercisesSelectionView(workoutId: workout.id, onSave: {
                loadWorkoutDetails()
            })
            .environmentObject(exerciseManager)
        }
        .alert("Delete Workout?", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteWorkout()
            }
        } message: {
            Text("This will permanently remove this workout session and all its exercises.")
        }
        .alert("Delete Exercise?", isPresented: $showingDeleteEntryConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let entryId = entryToDelete {
                    deleteEntry(id: entryId)
                }
            }
        } message: {
            Text("Are you sure you want to remove this exercise from the workout?")
        }
        .sheet(item: $editingEntry) { entry in
            if let exercise = exerciseManager.exercises.first(where: { $0.id == entry.exerciseId }) {
                NavigationStack {
                    StartExerciseView(exercise: exercise, workoutId: workout.id, entry: entry, onSave: {
                        loadWorkoutDetails()
                    })
                    .environmentObject(exerciseManager)
                }
            } else {
                Text("Exercise definition not found")
                    .task {
                        // Attempt to fetch definitions if missing
                        try? await exerciseManager.fetchDefinitions(query: nil)
                    }
            }
        }
        .task {
            loadWorkoutDetails()
        }
    }
    
    private func finishWorkout() {
        guard let details = workoutDetails else { return }
        Task {
            do {
                let updated = try await exerciseManager.updateWorkoutStatus(workoutId: details.id, status: .completed)
                await MainActor.run {
                    workoutDetails = updated
                    // Start polling for analysis immediately
                    startAnalysis()
                }
            } catch {
                print("Error finishing workout: \(error)")
            }
        }
    }
    
    private func deleteWorkout() {
        Task {
            do {
                try await exerciseManager.deleteWorkout(id: workout.id)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                print("Error deleting workout: \(error)")
            }
        }
    }

    private func deleteEntry(id: Int) {
        Task {
            do {
                try await exerciseManager.deleteWorkoutEntry(entryId: id)
                loadWorkoutDetails()
            } catch {
                print("Error deleting entry: \(error)")
            }
        }
    }
    
    private func updateWorkoutDate() {
        isUpdatingDate = true
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateStr = dateFormatter.string(from: tempDate)
        
        Task {
            do {
                let updated = try await exerciseManager.updateWorkout(
                    id: workout.id,
                    exerciseDate: dateStr,
                    startedAt: tempDate
                )
                
                await MainActor.run {
                    workoutDetails = updated
                    isUpdatingDate = false
                    showingDatePicker = false
                }
            } catch {
                print("Error updating workout date: \(error)")
                await MainActor.run {
                    isUpdatingDate = false
                }
            }
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let date: Date?
        if let d = isoFormatter.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString) {
            date = d
        } else {
            let simpleFormatter = DateFormatter()
            simpleFormatter.dateFormat = "yyyy-MM-dd"
            date = simpleFormatter.date(from: dateString)
        }
        
        if let date = date {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "EEEE, MMMM d, yyyy" // e.g. "Friday, January 2, 2026"
            return displayFormatter.string(from: date)
        }
        
        return dateString
    }
    
    private func loadWorkoutDetails() {
        isLoading = true
        Task {
            do {
                if exerciseManager.definitions.isEmpty {
                    try? await exerciseManager.fetchDefinitions()
                }
                
                // Fetch history to populate "Last:" data in cards
                if exerciseManager.activeSessions.count <= 1 {
                    try? await exerciseManager.fetchWorkoutHistory(days: 30)
                }
                
                let details = try await exerciseManager.getWorkout(id: workout.id)
                await MainActor.run {
                    workoutDetails = details
                    isLoading = false
                    
                    // If workout is completed but has no analysis, start polling
                    if details.status == .completed && details.analysis == nil {
                        startAnalysis()
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Error loading workout details: \(error)")
            }
        }
    }
    
    // MARK: - Analysis Views
    
    @ViewBuilder
    private func analysisSection(for details: WorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.blue)
                Text("AI COACH ANALYSIS")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            .padding(.top, 8)
            
            if let analysis = details.analysis {
                VStack(alignment: .leading, spacing: 16) {
                    // Stats Grid
                    if let stats = analysis.stats {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            StatCard(title: "CALORIES", value: formatNumber(stats.calories ?? 0), icon: "flame.fill", color: .orange)
                            StatCard(title: "VOLUME", value: "\(formatNumber(Int(stats.volumeLbs ?? 0))) lbs", icon: "dumbbell.fill", color: .blue)
                            StatCard(title: "TOTAL REPS", value: formatNumber(stats.totalReps ?? 0), icon: "repeat", color: .green)
                            StatCard(title: "TOTAL SETS", value: formatNumber(stats.totalSets ?? 0), icon: "list.bullet", color: .purple)
                        }
                    }
                    
                    // Coach Feedback
                    VStack(alignment: .leading, spacing: 8) {
                        Text("COACH FEEDBACK")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                        
                        Text(analysis.analysisText)
                            .font(.subheadline)
                            .lineSpacing(4)
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                    }
                    
                    // Routine Tweaks
                    if let tweaks = analysis.routineTweaks, !tweaks.isEmpty, details.routineId != nil {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("SUGGESTED ROUTINE TWEAKS")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.secondary)
                            
                            ForEach(tweaks) { tweak in
                                RoutineTweakCard(tweak: tweak) {
                                    // Handle apply tweak
                                    if let routineId = details.routineId {
                                        Task {
                                            try? await exerciseManager.applyRoutineTweaks(routineId: routineId, tweaks: [tweak])
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal)
            } else if isPollingAnalysis {
                HStack {
                    ProgressView()
                    Text("Coach is analyzing your workout...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
                .padding(.horizontal)
            }
        }
    }
    
    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
    
    private func startAnalysis() {
        print("🕒 [WorkoutDetailView] Starting analysis polling for workout \(workout.id)")
        isPollingAnalysis = true
        pollAnalysis()
    }
    
    private func pollAnalysis() {
        guard isPollingAnalysis else {
            print("🛑 [WorkoutDetailView] Polling stopped for workout \(workout.id)")
            return
        }
        
        Task {
            do {
                if let analysis = try await exerciseManager.fetchWorkoutAnalysis(workoutId: workout.id) {
                    print("✅ [WorkoutDetailView] Analysis received for workout \(workout.id)")
                    await MainActor.run {
                        if var details = workoutDetails {
                            details.analysis = analysis
                            workoutDetails = details
                        }
                        isPollingAnalysis = false
                    }
                } else {
                    // Try again in 3 seconds if still polling
                    if isPollingAnalysis {
                        print("⏳ [WorkoutDetailView] No analysis yet for workout \(workout.id), retrying in 3s...")
                        try await Task.sleep(nanoseconds: 3_000_000_000)
                        pollAnalysis()
                    }
                }
            } catch {
                print("❌ [WorkoutDetailView] Error polling analysis for workout \(workout.id): \(error)")
                await MainActor.run { isPollingAnalysis = false }
            }
        }
    }
}

// MARK: - Subviews

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)
            }
            
            Text(value)
                .font(.headline)
                .fontWeight(.bold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct RoutineTweakCard: View {
    let tweak: RoutineTweak
    var onApply: () -> Void
    
    @State private var isApplied = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tweak.exercise)
                        .font(.subheadline)
                        .fontWeight(.bold)
                    
                    HStack(spacing: 8) {
                        Text("\(tweak.current.sets)x\(tweak.current.reps ?? 0)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .strikethrough()
                        
                        Image(systemName: "arrow.right")
                            .font(.caption2)
                            .foregroundColor(.blue)
                        
                        Text("\(tweak.suggested.sets)x\(tweak.suggested.reps ?? 0)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.blue)
                    }
                }
                
                Spacer()
                
                Button {
                    onApply()
                    withAnimation { isApplied = true }
                } label: {
                    if isApplied {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.title3)
                    } else {
                        Text("Apply")
                            .font(.caption)
                            .fontWeight(.bold)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(16)
                    }
                }
                .disabled(isApplied)
            }
            
            Text(tweak.reason)
                .font(.caption)
                .foregroundColor(.secondary)
                .italic()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

// MARK: - Exercises Selection View

struct ExercisesSelectionView: View {
    let workoutId: Int
    var onSave: (() -> Void)? = nil
    @EnvironmentObject var exerciseManager: ExerciseManager
    @Environment(\.dismiss) var dismiss
    @State private var exercises: [Exercise] = []
    @State private var searchText = ""
    @State private var selectedExercise: Exercise?
    
    var filteredExercises: [Exercise] {
        if searchText.isEmpty {
            return exercises
        }
        return exercises.filter { $0.exerciseName.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SearchBar(text: $searchText, placeholder: "Search exercises...")
                    .padding()
                
                List(filteredExercises) { exercise in
                    ExerciseRow(
                        exercise: exercise,
                        action: { selectedExercise = exercise },
                        onStart: { selectedExercise = exercise }
                    )
                }
                .listStyle(.plain)
            }
            .navigationTitle("Add Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .navigationDestination(item: $selectedExercise) { exercise in
                StartExerciseView(exercise: exercise, workoutId: workoutId, onSave: {
                    // When an exercise is saved, call the callback and dismiss the selection sheet
                    onSave?()
                    dismiss()
                })
                .environmentObject(exerciseManager)
            }
            .task {
                do {
                    try await exerciseManager.fetchDefinitions(query: nil)
                    exercises = exerciseManager.exercises
                } catch {
                    print("Error loading exercises: \(error)")
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        WorkoutDetailView(workout: try! JSONDecoder().decode(WorkoutSession.self, from: """
        {
            "id": 1,
            "uuid": "00000000-0000-0000-0000-000000000000",
            "user_id": 1,
            "exercise_date": "2024-01-15",
            "day_of_week": 1,
            "total_duration_minutes": 45,
            "location": "Gym",
            "status": "COMPLETED",
            "entries": []
        }
        """.data(using: .utf8)!))
        .environmentObject(ExerciseManager.shared)
    }
}

