import Foundation
import Combine

/// Manages exercise data, routines, and workout logging
class ExerciseManager: ObservableObject {
    static let shared = ExerciseManager()
    
    @Published var definitions: [ExerciseDefinition] = []
    @Published var recentLogs: [ExerciseLog] = []
    @Published var activeSessions: [WorkoutSession] = []
    @Published var routines: [ExerciseRoutine] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Backward compatibility aliases
    var exercises: [ExerciseDefinition] { definitions }
    var currentWorkout: WorkoutSession? { activeSessions.first { $0.status == .inProgress } }
    
    private let backendURL = "http://127.0.0.1:3000"
    
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

    // MARK: - Atomic Logging (PRD 1.5)
    
    /// Create an independent exercise log (Quick Log)
    func logExercise(_ log: ExerciseLog) async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs/atomic")!
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
            throw ExerciseError.serverError("Failed to log exercise")
        }
        
        // Refresh local state
        try await fetchIndependentLogs()
    }
    
    /// Fetch independent exercise logs
    func fetchIndependentLogs() async throws {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs/independent")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch independent logs")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(ExerciseLogsResponse.self, from: data)
        
        await MainActor.run {
            recentLogs = result.data
        }
    }
    
    // MARK: - Workouts & Sessions
    
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
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to fetch workout history")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionsResponse.self, from: data)
        
        await MainActor.run {
            activeSessions = result.data
        }
    }
    
    /// Get workout by ID
    func getWorkout(id: Int) async throws -> WorkoutSession {
        guard let token = sessionToken else {
            throw ExerciseError.notAuthenticated
        }
        
        let url = URL(string: "\(backendURL)/api/exercise/logs/\(id)")!
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
    
    /// Create a new workout session
    func createWorkout() async throws -> WorkoutSession {
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
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to create workout")
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let result = try decoder.decode(WorkoutSessionResponse.self, from: data)
        
        return result.data
    }
    
    /// Add exercise performance to workout
    func addExerciseToWorkout(workoutId: Int, exerciseId: Int, sets: [ExerciseSet], restSeconds: Int?, equipmentUsed: String?, notes: String?) async throws {
        guard let token = sessionToken else {
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
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw ExerciseError.serverError("Failed to add exercise to workout")
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

    // MARK: - Routines (Legacy)
    
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
    
    /// Get today's routine (for notifications)
    func getTodayRoutine() -> ExerciseRoutine? {
        let today = Calendar.current.component(.weekday, from: Date())
        return routines.first { $0.dayOfWeek == today && $0.isActive }
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
    
    /// Get today's logged exercise minutes
    var todayLoggedMinutes: Int {
        let calendar = Calendar.current
        return recentLogs
            .filter { calendar.isDateInToday($0.performedAt) }
            .flatMap { $0.sets }
            .compactMap { $0.duration }
            .reduce(0, +) / 60
    }
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
