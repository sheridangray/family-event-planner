import Foundation
import Combine

/// Manages exercise data, routines, and workout logging
class ExerciseManager: ObservableObject {
    static let shared = ExerciseManager()
    
    @Published var routines: [ExerciseRoutine] = []
    @Published var todayRoutine: ExerciseRoutine?
    @Published var recentLogs: [ExerciseLog] = []
    @Published var exercises: [Exercise] = []
    @Published var currentWorkout: ExerciseLog?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let backendURL = "https://family-event-planner-backend.onrender.com"
    // For local development, change to:
    // private let backendURL = "http://localhost:3000"
    
    private var sessionToken: String? {
        AuthenticationManager.shared.sessionToken
    }
    
    // MARK: - Initialization
    
    init() {
        print("💪 ExerciseManager singleton initialized")
    }
    
    // MARK: - Routines
    
    /// Fetch all routines for the current user
    func fetchRoutines() async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        defer {
            Task { @MainActor in
                isLoading = false
            }
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to fetch routines"
            throw ExerciseError.serverError(errorMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseRoutinesResponse.self, from: data)
        
        await MainActor.run {
            routines = result.data
            // Update today's routine
            updateTodayRoutine()
        }
    }
    
    /// Get today's routine based on day of week
    func getTodayRoutine() -> ExerciseRoutine? {
        return todayRoutine
    }
    
    /// Update today's routine from routines list
    private func updateTodayRoutine() {
        let calendar = Calendar.current
        let today = Date()
        let dayOfWeek = calendar.component(.weekday, from: today)
        // Convert to 0=Sunday, 1=Monday format
        let dayIndex = dayOfWeek == 1 ? 0 : dayOfWeek - 1
        
        todayRoutine = routines.first { routine in
            routine.isActive && routine.dayOfWeek == dayIndex
        }
    }
    
    /// Fetch today's routine from backend
    func fetchTodayRoutine() async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/routines/today")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            // No routine for today is not an error
            if httpResponse.statusCode == 404 {
                await MainActor.run {
                    todayRoutine = nil
                }
                return
            }
            throw ExerciseError.serverError("Failed to fetch today's routine")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseRoutineResponse.self, from: data)
        
        await MainActor.run {
            todayRoutine = result.data
        }
    }
    
    // MARK: - Workout Logging
    
    /// Log a workout
    func logWorkout(_ log: ExerciseLog) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        defer {
            Task { @MainActor in
                isLoading = false
            }
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(log)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to log workout"
            throw ExerciseError.serverError(errorMsg)
        }
        
        // Refresh recent logs
        try await fetchWorkoutHistory(days: 7)
    }
    
    /// Check if user has logged today
    func hasLoggedToday(routineId: Int? = nil) async throws -> Bool {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        var urlString = "\(backendURL)/api/exercise/logs/today"
        if let routineId = routineId {
            urlString += "?routineId=\(routineId)"
        }
        
        let url = URL(string: urlString)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to check log status")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(HasLoggedResponse.self, from: data)
        
        return result.data.hasLogged
    }
    
    // MARK: - Workout History
    
    /// Fetch workout history
    func fetchWorkoutHistory(days: Int = 30) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let calendar = Calendar.current
        let endDate = Date()
        let startDate = calendar.date(byAdding: .day, value: -days, to: endDate)!
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]
        
        let startDateString = dateFormatter.string(from: startDate)
        let endDateString = dateFormatter.string(from: endDate)
        
        let url = URL(string: "\(backendURL)/api/exercise/logs?startDate=\(startDateString)&endDate=\(endDateString)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch workout history")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseLogsResponse.self, from: data)
        
        await MainActor.run {
            recentLogs = result.data
        }
    }
    
    // MARK: - Conversation History
    
    /// Fetch conversation history
    func fetchConversationHistory(conversationId: Int) async throws -> [ChatMessage] {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/conversations/\(conversationId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
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
    
    // MARK: - Exercises
    
    /// Fetch exercises (with optional search query)
    func fetchExercises(query: String?) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url: URL
        if let query = query, !query.isEmpty {
            url = URL(string: "\(backendURL)/api/exercise/exercises/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!
        } else {
            url = URL(string: "\(backendURL)/api/exercise/exercises")!
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to fetch exercises"
            let statusMsg = "Status \(httpResponse.statusCode): \(errorMsg)"
            print("❌ Error fetching exercises: \(statusMsg)")
            if let responseString = String(data: data, encoding: .utf8) {
                print("Response body: \(responseString)")
            }
            throw ExerciseError.serverError(statusMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExercisesResponse.self, from: data)
        
        await MainActor.run {
            exercises = result.data
        }
    }
    
    /// Create a new exercise (triggers LLM generation)
    func createExercise(name: String) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["exerciseName": name]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to create exercise"
            let statusMsg = "Status \(httpResponse.statusCode): \(errorMsg)"
            print("❌ Error creating exercise: \(statusMsg)")
            if let responseString = String(data: data, encoding: .utf8) {
                print("Response body: \(responseString)")
            }
            throw ExerciseError.serverError(statusMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseResponse.self, from: data)
        
        await MainActor.run {
            exercises.insert(result.data, at: 0)
        }
    }
    
    /// Get exercise by ID
    func getExercise(id: Int) async throws -> Exercise {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch exercise")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseResponse.self, from: data)
        
        return result.data
    }
    
    /// Update an exercise
    func updateExercise(
        exerciseId: Int,
        instructions: String? = nil,
        youtubeUrl: String? = nil,
        bodyParts: [String]? = nil,
        exerciseType: ExerciseType? = nil
    ) async throws -> Exercise {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/exercises/\(exerciseId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [:]
        if let instructions = instructions {
            body["instructions"] = instructions
        }
        if let youtubeUrl = youtubeUrl {
            body["youtubeUrl"] = youtubeUrl
        }
        if let bodyParts = bodyParts {
            body["bodyParts"] = bodyParts
        }
        if let exerciseType = exerciseType {
            body["exerciseType"] = exerciseType.rawValue
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to update exercise"
            throw ExerciseError.serverError(errorMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(ExerciseResponse.self, from: data)
        
        // Update the exercise in the exercises array
        await MainActor.run {
            if let index = exercises.firstIndex(where: { $0.id == exerciseId }) {
                exercises[index] = result.data
            }
        }
        
        return result.data
    }
    
    // MARK: - Workouts
    
    /// Create a new workout
    func createWorkout() async throws -> ExerciseLog {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        request.httpBody = try JSONSerialization.data(withJSONObject: [:])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to create workout"
            throw ExerciseError.serverError(errorMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(WorkoutResponse.self, from: data)
        
        await MainActor.run {
            currentWorkout = result.data
        }
        
        return result.data
    }
    
    /// Add exercise to workout
    func addExerciseToWorkout(workoutId: Int, exerciseId: Int, sets: [ExerciseSet], restSeconds: Int?, equipmentUsed: String?, notes: String?) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(workoutId)/exercises")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Convert ExerciseSet array to dictionary array
        let setsData = sets.map { set in
            var dict: [String: Any] = [:]
            if let reps = set.reps { dict["reps"] = reps }
            if let weight = set.weight { dict["weight"] = weight }
            if let rest = set.restSeconds { dict["restSeconds"] = rest }
            if let incline = set.incline { dict["incline"] = incline }
            if let speed = set.speed { dict["speed"] = speed }
            if let duration = set.duration { dict["duration"] = duration }
            return dict
        }
        
        var body: [String: Any] = [
            "exerciseId": exerciseId,
            "sets": setsData
        ]
        if let rest = restSeconds { body["restSeconds"] = rest }
        if let equipment = equipmentUsed { body["equipmentUsed"] = equipment }
        if let notes = notes { body["notes"] = notes }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to add exercise to workout"
            throw ExerciseError.serverError(errorMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(WorkoutResponse.self, from: data)
        
        await MainActor.run {
            currentWorkout = result.data
        }
    }
    
    /// Repeat a workout (copy previous sets/weights)
    func repeatWorkout(workoutId: Int) async throws -> ExerciseLog {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(workoutId)/repeat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorData?["error"] as? String ?? "Failed to repeat workout"
            throw ExerciseError.serverError(errorMsg)
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(WorkoutResponse.self, from: data)
        
        await MainActor.run {
            currentWorkout = result.data
            recentLogs.insert(result.data, at: 0)
        }
        
        return result.data
    }
    
    /// Get workout by ID
    func getWorkout(id: Int) async throws -> ExerciseLog {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/workouts/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ExerciseError.serverError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch workout")
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(WorkoutResponse.self, from: data)
        
        return result.data
    }
    
    // MARK: - Computed Properties
    
    /// Get today's logged exercise minutes from workout logs
    var todayLoggedMinutes: Int {
        let calendar = Calendar.current
        let today = Date()
        let todayString = ISO8601DateFormatter().string(from: today)
        
        return recentLogs
            .filter { $0.exerciseDate == todayString }
            .compactMap { $0.totalDurationMinutes }
            .reduce(0, +)
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

