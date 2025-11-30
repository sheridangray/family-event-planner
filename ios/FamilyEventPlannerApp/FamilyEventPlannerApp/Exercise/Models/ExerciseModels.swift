import Foundation

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
    
    // Custom decoder to handle JSONB arrays that might come as JSON strings
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        logId = try container.decode(Int.self, forKey: .logId)
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

