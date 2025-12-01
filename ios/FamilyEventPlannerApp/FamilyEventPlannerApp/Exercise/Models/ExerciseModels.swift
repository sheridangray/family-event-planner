import Foundation

// MARK: - Exercise Type

enum ExerciseType: String, Codable {
    case weight = "weight"
    case bodyweight = "bodyweight"
    case treadmill = "treadmill"
}

// MARK: - Exercise

struct Exercise: Codable, Identifiable {
    let id: Int
    let exerciseName: String
    let instructions: String
    let youtubeUrl: String?
    let bodyParts: [String]
    let exerciseType: ExerciseType
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case exerciseName = "exercise_name"
        case instructions
        case youtubeUrl = "youtube_url"
        case bodyParts = "body_parts"
        case exerciseType = "exercise_type"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Exercise Set

struct ExerciseSet: Codable, Identifiable {
    var id: UUID
    var reps: Int?
    var weight: Double? // For weight exercises
    var restSeconds: Int?
    var incline: Double? // For treadmill (%)
    var speed: Double? // For treadmill (MPH)
    var duration: Int? // For treadmill (seconds)
    
    init(id: UUID = UUID(), reps: Int? = nil, weight: Double? = nil, restSeconds: Int? = nil, incline: Double? = nil, speed: Double? = nil, duration: Int? = nil) {
        self.id = id
        self.reps = reps
        self.weight = weight
        self.restSeconds = restSeconds
        self.incline = incline
        self.speed = speed
        self.duration = duration
    }
    
    // Custom Codable implementation to exclude id from encoding/decoding
    enum CodingKeys: String, CodingKey {
        case reps, weight, restSeconds, incline, speed, duration
    }
}

// MARK: - Exercise Session

struct ExerciseSession: Codable {
    let exerciseId: Int
    let exerciseName: String
    let exerciseType: ExerciseType
    var sets: [ExerciseSet]
    let notes: String?
    let equipmentUsed: String?
    
    enum CodingKeys: String, CodingKey {
        case exerciseId = "exercise_id"
        case exerciseName = "exercise_name"
        case exerciseType = "exercise_type"
        case sets
        case notes
        case equipmentUsed = "equipment_used"
    }
}

// MARK: - Exercise Routine

struct ExerciseRoutine: Codable, Identifiable {
    let id: Int
    let userId: Int
    let routineName: String
    let dayOfWeek: Int?
    let description: String?
    let isActive: Bool
    let exercises: [RoutineExercise]
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case routineName = "routine_name"
        case dayOfWeek = "day_of_week"
        case description
        case isActive = "is_active"
        case exercises
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Routine Exercise

struct RoutineExercise: Codable, Identifiable {
    let id: Int
    let routineId: Int
    let exerciseName: String
    let exerciseOrder: Int
    let targetSets: Int
    let targetRepsMin: Int?
    let targetRepsMax: Int?
    let targetDurationSeconds: Int?
    let notes: String?
    let cues: String?
    let preferredEquipment: String?
    let equipmentNotes: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case routineId = "routine_id"
        case exerciseName = "exercise_name"
        case exerciseOrder = "exercise_order"
        case targetSets = "target_sets"
        case targetRepsMin = "target_reps_min"
        case targetRepsMax = "target_reps_max"
        case targetDurationSeconds = "target_duration_seconds"
        case notes
        case cues
        case preferredEquipment = "preferred_equipment"
        case equipmentNotes = "equipment_notes"
    }
}

// MARK: - Exercise Log

struct ExerciseLog: Codable, Identifiable {
    let id: Int
    let userId: Int
    let routineId: Int?
    let exerciseDate: String
    let dayOfWeek: Int
    let totalDurationMinutes: Int?
    let location: String?
    let notes: String?
    let entries: [ExerciseLogEntry]
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case routineId = "routine_id"
        case exerciseDate = "exercise_date"
        case dayOfWeek = "day_of_week"
        case totalDurationMinutes = "total_duration_minutes"
        case location
        case notes
        case entries
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Exercise Log Entry

struct ExerciseLogEntry: Codable, Identifiable {
    let id: Int
    let logId: Int
    let exerciseId: Int? // Reference to master exercise
    let exerciseName: String
    let exerciseOrder: Int
    let equipmentUsed: String?
    let setsPerformed: Int
    let repsPerformed: [Int]
    let weightUsed: [Double?]
    let durationSeconds: [Int]
    let restSeconds: Int?
    let notes: String?
    let difficultyRating: Int?
    
    enum CodingKeys: String, CodingKey {
        case id
        case logId = "log_id"
        case exerciseId = "exercise_id"
        case exerciseName = "exercise_name"
        case exerciseOrder = "exercise_order"
        case equipmentUsed = "equipment_used"
        case setsPerformed = "sets_performed"
        case repsPerformed = "reps_performed"
        case weightUsed = "weight_used"
        case durationSeconds = "duration_seconds"
        case restSeconds = "rest_seconds"
        case notes
        case difficultyRating = "difficulty_rating"
    }
    
    // Regular initializer for creating instances programmatically
    init(
        id: Int,
        logId: Int,
        exerciseId: Int? = nil,
        exerciseName: String,
        exerciseOrder: Int,
        equipmentUsed: String?,
        setsPerformed: Int,
        repsPerformed: [Int],
        weightUsed: [Double?],
        durationSeconds: [Int],
        restSeconds: Int?,
        notes: String?,
        difficultyRating: Int?
    ) {
        self.id = id
        self.logId = logId
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.exerciseOrder = exerciseOrder
        self.equipmentUsed = equipmentUsed
        self.setsPerformed = setsPerformed
        self.repsPerformed = repsPerformed
        self.weightUsed = weightUsed
        self.durationSeconds = durationSeconds
        self.restSeconds = restSeconds
        self.notes = notes
        self.difficultyRating = difficultyRating
    }
    
    // Custom decoder to handle JSONB arrays that might come as JSON strings
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        logId = try container.decode(Int.self, forKey: .logId)
        exerciseId = try container.decodeIfPresent(Int.self, forKey: .exerciseId)
        exerciseName = try container.decode(String.self, forKey: .exerciseName)
        exerciseOrder = try container.decode(Int.self, forKey: .exerciseOrder)
        equipmentUsed = try container.decodeIfPresent(String.self, forKey: .equipmentUsed)
        setsPerformed = try container.decode(Int.self, forKey: .setsPerformed)
        restSeconds = try container.decodeIfPresent(Int.self, forKey: .restSeconds)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        difficultyRating = try container.decodeIfPresent(Int.self, forKey: .difficultyRating)
        
        // Handle reps_performed - could be array or JSON string
        if let repsArray = try? container.decode([Int].self, forKey: .repsPerformed) {
            repsPerformed = repsArray
        } else if let repsString = try? container.decode(String.self, forKey: .repsPerformed),
                  let data = repsString.data(using: .utf8),
                  let repsArray = try? JSONDecoder().decode([Int].self, from: data) {
            repsPerformed = repsArray
        } else {
            repsPerformed = []
        }
        
        // Handle weight_used - could be array or JSON string, may contain nulls
        if let weightArray = try? container.decode([Double?].self, forKey: .weightUsed) {
            weightUsed = weightArray
        } else if let weightString = try? container.decode(String.self, forKey: .weightUsed),
                  let data = weightString.data(using: .utf8) {
            // Try decoding as array of doubles or nulls
            if let weightArray = try? JSONDecoder().decode([Double?].self, from: data) {
                weightUsed = weightArray
            } else if let weightArray = try? JSONDecoder().decode([Double].self, from: data) {
                weightUsed = weightArray.map { $0 }
            } else {
                weightUsed = []
            }
        } else {
            weightUsed = []
        }
        
        // Handle duration_seconds - could be array or JSON string
        if let durationArray = try? container.decode([Int].self, forKey: .durationSeconds) {
            durationSeconds = durationArray
        } else if let durationString = try? container.decode(String.self, forKey: .durationSeconds),
                  let data = durationString.data(using: .utf8),
                  let durationArray = try? JSONDecoder().decode([Int].self, from: data) {
            durationSeconds = durationArray
        } else {
            durationSeconds = []
        }
    }
}

// MARK: - Exercise Suggestion

struct ExerciseSuggestion: Codable, Identifiable {
    let id: Int
    let userId: Int
    let logEntryId: Int?
    let logId: Int?
    let exerciseName: String
    let suggestionType: String
    let suggestionText: String
    let reasoning: String?
    let priority: String
    let applied: Bool
    let appliedAt: String?
    let generatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case logEntryId = "log_entry_id"
        case logId = "log_id"
        case exerciseName = "exercise_name"
        case suggestionType = "suggestion_type"
        case suggestionText = "suggestion_text"
        case reasoning
        case priority
        case applied
        case appliedAt = "applied_at"
        case generatedAt = "generated_at"
    }
}

// MARK: - Exercise Conversation

struct ExerciseConversation: Decodable, Identifiable {
    let id: Int
    let userId: Int
    let conversationTitle: String?
    let startedAt: String
    let lastMessageAt: String
    let messageCount: Int
    let contextSnapshot: [String: Any]?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case conversationTitle = "conversation_title"
        case startedAt = "started_at"
        case lastMessageAt = "last_message_at"
        case messageCount = "message_count"
        case contextSnapshot = "context_snapshot"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        userId = try container.decode(Int.self, forKey: .userId)
        conversationTitle = try container.decodeIfPresent(String.self, forKey: .conversationTitle)
        startedAt = try container.decode(String.self, forKey: .startedAt)
        lastMessageAt = try container.decode(String.self, forKey: .lastMessageAt)
        messageCount = try container.decode(Int.self, forKey: .messageCount)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        
        // Handle contextSnapshot as JSON
        if let snapshotData = try? container.decodeIfPresent(Data.self, forKey: .contextSnapshot),
           let json = try? JSONSerialization.jsonObject(with: snapshotData) as? [String: Any] {
            contextSnapshot = json
        } else {
            contextSnapshot = nil
        }
    }
}

// MARK: - Chat Message

struct ChatMessage: Decodable, Identifiable {
    let id: Int
    let conversationId: Int
    let role: String // "user" or "assistant"
    let content: String
    let messageOrder: Int
    let metadata: [String: Any]?
    let tokensUsed: Int?
    let createdAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case conversationId = "conversation_id"
        case role
        case content
        case messageOrder = "message_order"
        case metadata
        case tokensUsed = "tokens_used"
        case createdAt = "created_at"
    }
    
    // Regular initializer for creating instances programmatically
    init(
        id: Int,
        conversationId: Int,
        role: String,
        content: String,
        messageOrder: Int,
        metadata: [String: Any]?,
        tokensUsed: Int?,
        createdAt: String
    ) {
        self.id = id
        self.conversationId = conversationId
        self.role = role
        self.content = content
        self.messageOrder = messageOrder
        self.metadata = metadata
        self.tokensUsed = tokensUsed
        self.createdAt = createdAt
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        conversationId = try container.decode(Int.self, forKey: .conversationId)
        role = try container.decode(String.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        messageOrder = try container.decode(Int.self, forKey: .messageOrder)
        tokensUsed = try container.decodeIfPresent(Int.self, forKey: .tokensUsed)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        
        // Handle metadata as JSON
        if let metadataData = try? container.decodeIfPresent(Data.self, forKey: .metadata),
           let json = try? JSONSerialization.jsonObject(with: metadataData) as? [String: Any] {
            metadata = json
        } else {
            metadata = nil
        }
    }
}

// MARK: - API Response Wrappers

struct ExerciseRoutinesResponse: Codable {
    let success: Bool
    let data: [ExerciseRoutine]
}

struct ExerciseRoutineResponse: Codable {
    let success: Bool
    let data: ExerciseRoutine
}

struct ExerciseLogsResponse: Codable {
    let success: Bool
    let data: [ExerciseLog]
}

struct ExerciseLogResponse: Codable {
    let success: Bool
    let data: ExerciseLog
}

struct ExerciseSuggestionsResponse: Codable {
    let success: Bool
    let data: [ExerciseSuggestion]
}

struct ExerciseConversationsResponse: Decodable {
    let success: Bool
    let data: [ExerciseConversation]
}

struct ExerciseConversationHistoryResponse: Decodable {
    let success: Bool
    let data: [ChatMessage]
}

struct ExerciseChatResponse: Codable {
    let success: Bool
    let data: ExerciseChatData
}

struct ExerciseChatData: Codable {
    let conversationId: Int
    let response: String
    let context: ExerciseChatContext
}

struct ExerciseChatContext: Codable {
    let workoutsReferenced: Int
    let conversationsReferenced: Int
}

struct HasLoggedResponse: Codable {
    let success: Bool
    let data: HasLoggedData
}

struct HasLoggedData: Codable {
    let hasLogged: Bool
}

// MARK: - Exercise API Responses

struct ExercisesResponse: Codable {
    let success: Bool
    let data: [Exercise]
}

struct ExerciseResponse: Codable {
    let success: Bool
    let data: Exercise
}

struct WorkoutsResponse: Codable {
    let success: Bool
    let data: [ExerciseLog] // Using ExerciseLog as Workout
}

struct WorkoutResponse: Codable {
    let success: Bool
    let data: ExerciseLog
}

struct StartExerciseResponse: Codable {
    let success: Bool
    let data: StartExerciseData
}

struct StartExerciseData: Codable {
    let exercise: Exercise
    let workoutId: Int?
}

