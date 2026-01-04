import Foundation
import Combine

/// Manages exercise data, routines, and workout logging
class ExerciseManager: ObservableObject {
    static let shared = ExerciseManager()
    
    @Published var definitions: [ExerciseDefinition] = []
    @Published var activeSessions: [WorkoutSession] = []
    @Published var routines: [ExerciseRoutine] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Backward compatibility aliases
    var exercises: [ExerciseDefinition] { definitions }
    var currentWorkout: WorkoutSession? { activeSessions.first { $0.status == .inProgress } }
    
    private var backendURL: String { AppConfig.baseURL }
    
    private var sessionToken: String? {
        AuthenticationManager.shared.sessionToken
    }
    
    // MARK: - Initialization
    
    init() {
        print("💪 ExerciseManager singleton initialized")
    }
    
    // MARK: - Exercise Definitions
    
    /// Fetch exercise definitions from backend
    func fetchDefinitions(query: String? = nil) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url: URL
        if let query = query, !query.isEmpty {
            let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            url = URL(string: "\(backendURL)/api/exercise/exercises/search?q=\(encodedQuery)")!
        } else {
            url = URL(string: "\(backendURL)/api/exercise/exercises")!
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch exercises")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseDefinitionsResponse.self, from: data)
        
        await MainActor.run {
            definitions = result.data
        }
    }
    
    /// Get exercise by ID
    func getExercise(id: Int) async throws -> ExerciseDefinition {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch exercise")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseDefinitionResponse.self, from: data)
        
        return result.data
    }
    
    /// Update an exercise
    func updateExercise(
        exerciseId: Int,
        instructions: String? = nil,
        youtubeUrl: String? = nil,
        bodyParts: [String]? = nil,
        exerciseType: ExerciseCategory? = nil
    ) async throws -> ExerciseDefinition {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises/\(exerciseId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [:]
        if let instructions = instructions { body["instructions"] = instructions }
        if let youtubeUrl = youtubeUrl { body["youtubeUrl"] = youtubeUrl }
        if let bodyParts = bodyParts { body["bodyParts"] = bodyParts }
        if let exerciseType = exerciseType { body["category"] = exerciseType.rawValue }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to update exercise")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseDefinitionResponse.self, from: data)
        
        // Update local state
        await MainActor.run {
            if let index = definitions.firstIndex(where: { $0.id == exerciseId }) {
                definitions[index] = result.data
            }
        }
        
        return result.data
    }
    
    /// Delete an exercise (soft delete - archives it)
    func deleteExercise(exerciseId: Int) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises/\(exerciseId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to delete exercise")
        }
        
        // Remove from local state
        await MainActor.run {
            definitions.removeAll { $0.id == exerciseId }
        }
    }
    
    /// Create a new exercise (triggers LLM generation)
    func createExercise(name: String, category: ExerciseCategory? = nil) async throws -> ExerciseDefinition {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = ["exerciseName": name]
        if let category = category {
            body["category"] = category.rawValue
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            throw ExerciseError.serverError("Failed to create exercise")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseDefinitionResponse.self, from: data)
        
        // Update local state
        await MainActor.run {
            definitions.append(result.data)
        }
        
        return result.data
    }

    // MARK: - Workouts & Sessions
    
    /// Fetch workout history
    func fetchWorkoutHistory(days: Int = 30) async throws {
        print("🕒 Fetching workout history for last \(days) days...")
        guard let token = sessionToken else {
            print("❌ Fetch history failed: Not authenticated")
            throw ExerciseError.notAuthenticated
        }
        
        let calendar = Calendar.current
        let endDate = Date()
        let startDate = calendar.date(byAdding: .day, value: -days, to: endDate)!
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]
        
        let startDateString = dateFormatter.string(from: startDate)
        let endDateString = dateFormatter.string(from: endDate)
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts?startDate=\(startDateString)&endDate=\(endDateString)")!
        print("🌐 Request URL: \(url)")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ Fetch history failed: Invalid response type")
            throw ExerciseError.serverError("Invalid response")
        }
        
        print("📥 Response status code: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No body"
            print("❌ Fetch history failed with status \(httpResponse.statusCode): \(errorBody)")
            throw ExerciseError.serverError("Failed to fetch workout history")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let result = try decoder.decode(WorkoutSessionsResponse.self, from: data)
            print("✅ Successfully fetched \(result.data.count) workouts")
            
            await MainActor.run {
                activeSessions = result.data
            }
        } catch {
            print("❌ Failed to decode workout history: \(error)")
            if let jsonString = String(data: data, encoding: .utf8) {
                print("📄 Raw JSON response: \(jsonString)")
            }
            throw error
        }
    }
    
    /// Get workout by ID
    func getWorkout(id: Int) async throws -> WorkoutSession {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch workout")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
        
        return result.data
    }
    
    /// Update workout status
    func updateWorkoutStatus(workoutId: Int, status: WorkoutSession.SessionStatus) async throws -> WorkoutSession {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(workoutId)/status")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["status": status.rawValue]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to update workout status")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
        
        // Update local state
        await MainActor.run {
            if let index = activeSessions.firstIndex(where: { $0.id == workoutId }) {
                activeSessions[index] = result.data
            }
        }
        
        return result.data
    }
    
    /// Delete a workout
    func deleteWorkout(id: Int) async throws {
        print("🗑️ Deleting workout \(id)...")
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ Delete workout failed: Invalid response type")
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No body"
            print("❌ Delete workout failed with status \(httpResponse.statusCode): \(errorBody)")
            throw ExerciseError.serverError("Failed to delete workout")
        }
        
        print("✅ Workout \(id) deleted successfully")
        
        // Update local state
        await MainActor.run {
            activeSessions.removeAll { $0.id == id }
        }
    }
    
    /// Repeat a workout (copy previous sets/weights)
    func repeatWorkout(workoutId: Int) async throws -> WorkoutSession {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(workoutId)/repeat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to repeat workout")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
        
        return result.data
    }
    
    /// Update a specific exercise entry in a workout
    func updateWorkoutEntry(entryId: Int, sets: [ExerciseSet], notes: String?) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/entries/\(entryId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "sets": sets.map { set -> [String: Any] in
                var dict: [String: Any] = [:]
                if let reps = set.reps { dict["reps"] = reps }
                if let weight = set.weight { dict["weight"] = weight }
                if let duration = set.duration { dict["duration"] = duration }
                if let distance = set.distance { dict["distance"] = distance }
                if let rest = set.restSeconds { dict["rest_seconds"] = rest }
                return dict
            }
        ]
        if let notes = notes { body["notes"] = notes }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No error details"
            print("❌ Update workout entry failed: \(errorBody)")
            throw ExerciseError.serverError("Failed to update workout entry: \(errorBody)")
        }
    }
    
    /// Delete a specific exercise entry from a workout
    func deleteWorkoutEntry(entryId: Int) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/entries/\(entryId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No error details"
            print("❌ Delete workout entry failed: \(errorBody)")
            throw ExerciseError.serverError("Failed to delete workout entry: \(errorBody)")
        }
    }
    
    /// Create a new workout session
    func createWorkout() async throws -> WorkoutSession {
        print("🚀 Creating new workout session...")
        guard let token = sessionToken else {
            print("❌ Create workout failed: Not authenticated")
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Send the current date in local timezone to avoid UTC shift issues
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let localDate = dateFormatter.string(from: Date())
        
        let body: [String: Any] = ["exerciseDate": localDate]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ Create workout failed: Invalid response type")
            throw ExerciseError.serverError("Invalid response")
        }
        
        print("📥 Create workout response status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No body"
            print("❌ Create workout failed with status \(httpResponse.statusCode): \(errorBody)")
            throw ExerciseError.serverError("Failed to create workout")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
            let workout = result.data
            print("✅ Workout created successfully with ID: \(workout.id)")
            
            // Add to local state, avoiding duplicates if backend returned an existing one
            await MainActor.run {
                if let index = activeSessions.firstIndex(where: { $0.id == workout.id }) {
                    activeSessions[index] = workout
                } else {
                    activeSessions.insert(workout, at: 0)
                }
            }
            
            return workout
        } catch {
            print("❌ Failed to decode created workout: \(error)")
            throw error
        }
    }
    
    /// Add exercise performance to workout
    func addExerciseToWorkout(workoutId: Int, exerciseId: Int, sets: [ExerciseSet], restSeconds: Int?, equipmentUsed: String?, notes: String?) async throws {
        print("📝 Adding exercise \(exerciseId) to workout \(workoutId)...")
        guard let token = sessionToken else {
            print("❌ Add exercise failed: Not authenticated")
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(workoutId)/exercises")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let setsData = sets.map { set -> [String: Any] in
            var dict: [String: Any] = [:]
            if let reps = set.reps { dict["reps"] = reps }
            if let weight = set.weight { dict["weight"] = weight }
            if let duration = set.duration { dict["duration"] = duration }
            if let distance = set.distance { dict["distance"] = distance }
            if let rest = set.restSeconds { dict["rest_seconds"] = rest }
            if let rpe = set.rpe { dict["rpe"] = rpe }
            if let bandLevel = set.bandLevel { dict["bandLevel"] = bandLevel }
            if let calories = set.calories { dict["calories"] = calories }
            if let heartRate = set.heartRate { dict["heartRate"] = heartRate }
            return dict
        }
        
        var body: [String: Any] = [
            "exerciseId": exerciseId,
            "sets": setsData
        ]
        if let rest = restSeconds { body["restSeconds"] = rest }
        if let equipment = equipmentUsed { body["equipmentUsed"] = equipment }
        if let n = notes { body["notes"] = n }
        
        print("📦 Request Body: \(body)")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ Add exercise failed: Invalid response type")
            throw ExerciseError.serverError("Invalid response")
        }
        
        print("📥 Add exercise response status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "No body"
            print("❌ Add exercise failed with status \(httpResponse.statusCode): \(errorBody)")
            throw ExerciseError.serverError("Failed to add exercise to workout")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
            let updatedWorkout = result.data
            print("✅ Exercise added successfully to workout, now has \(updatedWorkout.entries.count) entries")
            
            // Update local state
            await MainActor.run {
                if let index = activeSessions.firstIndex(where: { $0.id == workoutId }) {
                    activeSessions[index] = updatedWorkout
                } else {
                    activeSessions.insert(updatedWorkout, at: 0)
                }
            }
        } catch {
            print("❌ Failed to decode updated workout after adding exercise: \(error)")
        }
    }
    
    /// Log a full workout (Legacy Support)
    func logWorkout(_ log: WorkoutSession) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(log)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (httpResponse.statusCode == 200 || httpResponse.statusCode == 201) else {
            throw ExerciseError.serverError("Failed to log workout")
        }
        
        // Refresh local history
        try await fetchWorkoutHistory()
    }

    // MARK: - Routines
    
    /// Fetch all routines for the current user
    func fetchRoutines() async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch routines")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseRoutinesResponse.self, from: data)
        
        await MainActor.run {
            routines = result.data
        }
    }
    
    /// Create a new routine
    func createRoutine(name: String, description: String?, dayOfWeek: Int?, exercises: [RoutineExercise]) async throws -> ExerciseRoutine {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let exercisesData = exercises.enumerated().map { index, exercise in
            [
                "exerciseName": exercise.exerciseName,
                "exerciseOrder": index + 1,
                "targetSets": exercise.targetSets,
                "targetRepsMin": exercise.targetRepsMin,
                "targetRepsMax": exercise.targetRepsMax,
                "targetDurationSeconds": exercise.targetDurationSeconds,
                "notes": exercise.notes,
                "cues": exercise.cues,
                "preferredEquipment": exercise.preferredEquipment,
                "equipmentNotes": exercise.equipmentNotes
            ]
        }
        
        var body: [String: Any] = [
            "routineName": name,
            "exercises": exercisesData
        ]
        if let description = description { body["description"] = description }
        if let dayOfWeek = dayOfWeek { body["dayOfWeek"] = dayOfWeek }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to create routine")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseRoutineResponse.self, from: data)
        
        try await fetchRoutines() // Refresh local list
        return result.data
    }
    
    /// Update an existing routine
    func updateRoutine(id: Int, name: String?, description: String?, dayOfWeek: Int?, exercises: [RoutineExercise]?) async throws -> ExerciseRoutine {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [:]
        if let name = name { body["routineName"] = name }
        if let description = description { body["description"] = description }
        if let dayOfWeek = dayOfWeek { body["dayOfWeek"] = dayOfWeek }
        
        if let exercises = exercises {
            body["exercises"] = exercises.enumerated().map { index, exercise in
                [
                    "exerciseName": exercise.exerciseName,
                    "exerciseOrder": index + 1,
                    "targetSets": exercise.targetSets,
                    "targetRepsMin": exercise.targetRepsMin,
                    "targetRepsMax": exercise.targetRepsMax,
                    "targetDurationSeconds": exercise.targetDurationSeconds,
                    "notes": exercise.notes,
                    "cues": exercise.cues,
                    "preferredEquipment": exercise.preferredEquipment,
                    "equipmentNotes": exercise.equipmentNotes
                ]
            }
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to update routine")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseRoutineResponse.self, from: data)
        
        try await fetchRoutines() // Refresh local list
        return result.data
    }
    
    /// Delete a routine
    func deleteRoutine(id: Int) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to delete routine")
        }
        
        await MainActor.run {
            routines.removeAll { $0.id == id }
        }
    }
    
    /// Start a workout session from a routine
    func startWorkoutFromRoutine(id: Int) async throws -> WorkoutSession {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines/\(id)/start")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to start workout from routine")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
        
        // Refresh workout history to show the new session
        try await fetchWorkoutHistory()
        
        return result.data
    }
    
    /// Get today's routine (for notifications)
    func getTodayRoutine() -> ExerciseRoutine? {
        let today = Calendar.current.component(.weekday, from: Date())
        // Adjust for 1-indexed weekday (1=Sunday in Calendar, 0=Sunday in backend maybe? 
        // Let's check ExerciseModels.swift if it says anything about day_of_week mapping)
        // 0=Sunday, 1=Monday, etc. (NULL = custom/one-time) - based on migration
        // Calendar.current.component(.weekday, from: Date()) returns 1 for Sunday, 2 for Monday...
        let adjustedToday = today - 1
        return routines.first { $0.dayOfWeek == adjustedToday && $0.isActive }
    }
    
    /// Computed property wrapper for cleaner SwiftUI syntax
    var todayRoutine: ExerciseRoutine? {
        getTodayRoutine()
    }
    
    /// Check if user has logged today
    func hasLoggedToday() async throws -> Bool {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs/today")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to check log status")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(HasLoggedResponse.self, from: data)
        
        return result.data.hasLogged
    }

    // MARK: - Conversation History (Legacy Support)
    
    /// Fetch conversation history
    func fetchConversationHistory(conversationId: Int) async throws -> [ChatMessage] {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/conversations/\(conversationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch conversation history")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseConversationHistoryResponse.self, from: data)
        
        return result.data
    }
    
    // MARK: - Computed Properties
}

// MARK: - Exercise API Responses

typealias ExercisesResponse = ExerciseDefinitionsResponse
typealias ExerciseResponse = ExerciseDefinitionResponse
typealias WorkoutResponse = WorkoutSessionResponse

struct ExerciseDefinitionsResponse: Codable {
    let success: Bool
    let data: [ExerciseDefinition]
}

struct ExerciseDefinitionResponse: Codable {
    let success: Bool
    let data: ExerciseDefinition
}

struct ExerciseLogsResponse: Codable {
    let success: Bool
    let data: [ExerciseLog]
}

struct WorkoutSessionsResponse: Codable {
    let success: Bool
    let data: [WorkoutSession]
}

struct WorkoutSessionResponse: Codable {
    let success: Bool
    let data: WorkoutSession
}

struct HasLoggedResponse: Codable {
    let success: Bool
    let data: HasLoggedData
}

struct HasLoggedData: Codable {
    let hasLogged: Bool
}

struct ExerciseConversationHistoryResponse: Codable {
    let success: Bool
    let data: [ChatMessage]
}

struct ChatMessage: Codable, Identifiable {
    let id: Int
    let role: String
    let content: String
    let createdAt: String
    
    enum CodingKeys: String, CodingKey {
        case id, role, content
        case createdAt = "created_at"
    }
}

struct ExerciseChatResponse: Codable {
    let success: Bool
    let data: ExerciseChatData
}

struct ExerciseChatData: Codable {
    let conversationId: Int
    let response: String
    let context: ExerciseChatContext?
    
    enum CodingKeys: String, CodingKey {
        case conversationId, response, context
    }
}

struct ExerciseChatContext: Codable {
    let workoutsReferenced: Int
    let conversationsReferenced: Int
    
    enum CodingKeys: String, CodingKey {
        case workoutsReferenced, conversationsReferenced
    }
}

// MARK: - Exercise Errors

enum ExerciseError: LocalizedError {
    case notAuthenticated
    case serverError(String)
    case invalidData
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not authenticated. Please sign in."
        case .serverError(let message):
            return "Server error: \(message)"
        case .invalidData:
            return "Invalid data received from server"
        }
    }
}
