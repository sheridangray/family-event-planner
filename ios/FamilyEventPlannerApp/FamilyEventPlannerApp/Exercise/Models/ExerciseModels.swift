import Foundation
import SwiftUI

// MARK: - Exercise Category (PRD 1.4)

enum ExerciseCategory: String, Codable, CaseIterable {
    case weighted = "WEIGHTED"
    case bodyweight = "BODYWEIGHT"
    case time = "TIME"
    case distanceTime = "DISTANCE_TIME"
    case machineCardio = "MACHINE_CARDIO"
    case bandAssisted = "BAND_ASSISTED"
    case mobility = "MOBILITY"
    
    // Backward compatibility for old categories
    case barbellDumbbell = "barbell_dumbbell"
    case assisted = "assisted"
    case machine = "machine"
    case isometric = "isometric"
    case cardioDistance = "cardio_distance"
    case cardioTime = "cardio_time"
    case interval = "interval"
    case skill = "skill"
    
    /// Primary categories to show in UI (excludes backward compatibility cases)
    static let primaryCases: [ExerciseCategory] = [
        .weighted,
        .bodyweight,
        .time,
        .distanceTime,
        .machineCardio,
        .bandAssisted,
        .mobility
    ]
    
    var displayName: String {
        switch self {
        case .weighted, .barbellDumbbell, .machine: return "Weighted"
        case .bodyweight: return "Bodyweight"
        case .time, .isometric, .cardioTime, .interval: return "Time"
        case .distanceTime, .cardioDistance: return "Distance & Time"
        case .machineCardio: return "Machine Cardio"
        case .bandAssisted, .assisted: return "Band Assisted"
        case .mobility: return "Mobility"
        case .skill: return "Skill"
        }
    }
    
    var requiredFields: [String] {
        switch self {
        case .weighted, .barbellDumbbell, .machine: return ["weight", "reps"]
        case .bodyweight: return ["reps"]
        case .time, .isometric, .cardioTime, .interval: return ["duration"]
        case .distanceTime, .cardioDistance: return ["distance", "duration"]
        case .machineCardio: return ["duration"]
        case .bandAssisted, .assisted: return ["reps", "bandLevel"]
        case .mobility: return ["duration"]
        case .skill: return ["reps"]
        }
    }
    
    var color: Color {
        switch self {
        case .weighted, .barbellDumbbell, .machine:
            return .blue
        case .bodyweight, .assisted, .bandAssisted:
            return .green
        case .time, .cardioDistance, .cardioTime, .interval:
            return .orange
        case .distanceTime:
            return .red
        case .machineCardio:
            return .cyan
        case .isometric, .mobility:
            return .purple
        case .skill:
            return .indigo
        }
    }
}

// MARK: - Exercise Definition (PRD 1.3)
typealias Exercise = ExerciseDefinition

struct ExerciseDefinition: Codable, Identifiable, Hashable {
    let id: Int // Backend ID
    let uuid: UUID // Client sync ID (PRD requirement)
    let name: String
    let category: ExerciseCategory
    let primaryMuscles: [String]
    let secondaryMuscles: [String]
    let equipment: [String]
    let inputSchema: [String: InputFieldDefinition]?
    let instructions: String?
    let youtubeUrl: String?
    let isArchived: Bool
    
    var exerciseName: String { name }
    var exerciseType: ExerciseCategory { category }
    var bodyParts: [String] { primaryMuscles }
    
    struct InputFieldDefinition: Codable, Hashable {
        let key: String
        let type: String
        let unit: String?
        let required: Bool
        let validation: String?
        let displayMetadata: [String: String]?
    }
    
    enum CodingKeys: String, CodingKey {
        case id, uuid, category, name = "exercise_name"
        case primaryMuscles = "primary_muscles", secondaryMuscles = "secondary_muscles", equipment
        case inputSchema = "input_schema", instructions, youtubeUrl = "youtube_url", isArchived = "is_archived"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        uuid = (try? container.decode(UUID.self, forKey: .uuid)) ?? UUID()
        name = try container.decode(String.self, forKey: .name)
        instructions = try? container.decodeIfPresent(String.self, forKey: .instructions)
        youtubeUrl = try? container.decodeIfPresent(String.self, forKey: .youtubeUrl)
        
        if let catString = try? container.decode(String.self, forKey: .category) {
            category = ExerciseCategory(rawValue: catString) ?? .weighted
        } else {
            category = .weighted
        }
        
        primaryMuscles = (try? container.decode([String].self, forKey: .primaryMuscles)) ?? []
        secondaryMuscles = (try? container.decode([String].self, forKey: .secondaryMuscles)) ?? []
        equipment = (try? container.decode([String].self, forKey: .equipment)) ?? []
        inputSchema = try? container.decodeIfPresent([String: InputFieldDefinition].self, forKey: .inputSchema)
        isArchived = (try? container.decode(Bool.self, forKey: .isArchived)) ?? false
    }
    
    // Manual Hashable conformance (required due to custom init(from:))
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(uuid)
    }
    
    // Manual Equatable conformance (required due to custom init(from:))
    static func == (lhs: ExerciseDefinition, rhs: ExerciseDefinition) -> Bool {
        lhs.id == rhs.id && lhs.uuid == rhs.uuid
    }
}

// MARK: - Exercise Log (PRD 1.3)
typealias ExerciseLogEntry = ExerciseLog

struct ExerciseLog: Codable, Identifiable, Hashable {
    var id: UUID // Use UUID as primary ID for Identifiable
    var backendId: Int? // Optional backend-assigned ID
    let exerciseId: Int
    let performedAt: Date
    var sets: [ExerciseSet]
    var notes: String?
    let source: String
    var syncState: String
    let logId: Int?
    
    // Compatibility
    var exerciseName: String { "" }
    var setsPerformed: Int { sets.count }
    var repsPerformed: [Int] { sets.compactMap { $0.reps } }
    var weightUsed: [Double?] { sets.map { $0.weight } }
    var durationSeconds: [Int] { sets.compactMap { $0.duration } }
    var distanceMeters: [Double] { sets.compactMap { $0.distance } }
    
    enum CodingKeys: String, CodingKey {
        case id = "uuid", backendId = "id", exerciseId = "exercise_id", performedAt = "performed_at", sets, notes, source, syncState = "sync_state", logId = "log_id"
    }
    
    init(id: UUID = UUID(), backendId: Int? = nil, exerciseId: Int, performedAt: Date = Date(), sets: [ExerciseSet] = [], notes: String? = nil, source: String = "manual", syncState: String = "local", logId: Int? = nil) {
        self.id = id
        self.backendId = backendId
        self.exerciseId = exerciseId
        self.performedAt = performedAt
        self.sets = sets
        self.notes = notes
        self.source = source
        self.syncState = syncState
        self.logId = logId
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? container.decode(UUID.self, forKey: .id)) ?? UUID()
        backendId = try? container.decodeIfPresent(Int.self, forKey: .backendId)
        exerciseId = try container.decode(Int.self, forKey: .exerciseId)
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let dateString = (try? container.decode(String.self, forKey: .performedAt)) ?? ""
        performedAt = formatter.date(from: dateString) ?? Date()
        
        sets = (try? container.decode([ExerciseSet].self, forKey: .sets)) ?? []
        notes = try? container.decodeIfPresent(String.self, forKey: .notes)
        source = (try? container.decode(String.self, forKey: .source)) ?? "manual"
        syncState = (try? container.decode(String.self, forKey: .syncState)) ?? "synced"
        logId = try? container.decodeIfPresent(Int.self, forKey: .logId)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(backendId, forKey: .backendId)
        try container.encode(exerciseId, forKey: .exerciseId)
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        try container.encode(formatter.string(from: performedAt), forKey: .performedAt)
        
        try container.encode(sets, forKey: .sets)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encode(source, forKey: .source)
        try container.encode(syncState, forKey: .syncState)
        try container.encodeIfPresent(logId, forKey: .logId)
    }
}

// MARK: - Workout Session (PRD 1.3)
typealias Workout = WorkoutSession

struct WorkoutSession: Codable, Identifiable, Hashable {
    let id: Int
    let uuid: UUID
    let userId: Int
    let exerciseDate: String
    let dayOfWeek: Int
    let totalDurationMinutes: Int?
    let location: String?
    let notes: String?
    let status: SessionStatus
    let startedAt: Date?
    let endedAt: Date?
    let entries: [ExerciseLog]
    
    enum SessionStatus: String, Codable {
        case inProgress = "IN_PROGRESS"
        case completed = "COMPLETED"
        case discarded = "DISCARDED"
    }
    
    enum CodingKeys: String, CodingKey {
        case id, uuid, userId = "user_id", exerciseDate = "exercise_date", dayOfWeek = "day_of_week"
        case totalDurationMinutes = "total_duration_minutes", location, notes, status, startedAt = "started_at", endedAt = "ended_at", entries
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        uuid = (try? container.decode(UUID.self, forKey: .uuid)) ?? UUID()
        userId = (try? container.decode(Int.self, forKey: .userId)) ?? 0
        exerciseDate = (try? container.decode(String.self, forKey: .exerciseDate)) ?? ""
        dayOfWeek = (try? container.decode(Int.self, forKey: .dayOfWeek)) ?? 0
        totalDurationMinutes = try? container.decodeIfPresent(Int.self, forKey: .totalDurationMinutes)
        location = try? container.decodeIfPresent(String.self, forKey: .location)
        notes = try? container.decodeIfPresent(String.self, forKey: .notes)
        status = (try? container.decode(SessionStatus.self, forKey: .status)) ?? .completed
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let startString = try? container.decode(String.self, forKey: .startedAt) {
            startedAt = formatter.date(from: startString)
        } else {
            startedAt = nil
        }
        
        if let endString = try? container.decode(String.self, forKey: .endedAt) {
            endedAt = formatter.date(from: endString)
        } else {
            endedAt = nil
        }
        
        entries = (try? container.decode([ExerciseLog].self, forKey: .entries)) ?? []
    }
    
    init(id: Int, uuid: UUID = UUID(), userId: Int, exerciseDate: String, dayOfWeek: Int, totalDurationMinutes: Int? = nil, location: String? = nil, notes: String? = nil, status: SessionStatus = .completed, startedAt: Date? = nil, endedAt: Date? = nil, entries: [ExerciseLog] = []) {
        self.id = id
        self.uuid = uuid
        self.userId = userId
        self.exerciseDate = exerciseDate
        self.dayOfWeek = dayOfWeek
        self.totalDurationMinutes = totalDurationMinutes
        self.location = location
        self.notes = notes
        self.status = status
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.entries = entries
    }
}

// MARK: - Exercise Set
struct ExerciseSet: Codable, Identifiable, Hashable {
    var id: UUID
    var weight: Double?
    var reps: Int?
    var duration: Int?
    var distance: Double?
    var restSeconds: Int?
    var rpe: Int?
    var bandLevel: String?
    var resistanceLevel: String?
    var tempo: String?
    var heartRate: Int?
    var calories: Int?
    var incline: Double?
    var speed: Double?
    
    init(id: UUID = UUID()) {
        self.id = id
    }
    
    enum CodingKeys: String, CodingKey {
        case weight, reps, duration, distance, restSeconds = "rest_seconds"
        case rpe, bandLevel = "band_level", resistanceLevel = "resistance_level"
        case tempo, heartRate = "heart_rate", calories, incline, speed
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = UUID()
        weight = try? container.decodeIfPresent(Double.self, forKey: .weight)
        reps = try? container.decodeIfPresent(Int.self, forKey: .reps)
        duration = try? container.decodeIfPresent(Int.self, forKey: .duration)
        distance = try? container.decodeIfPresent(Double.self, forKey: .distance)
        restSeconds = try? container.decodeIfPresent(Int.self, forKey: .restSeconds)
        rpe = try? container.decodeIfPresent(Int.self, forKey: .rpe)
        bandLevel = try? container.decodeIfPresent(String.self, forKey: .bandLevel)
        resistanceLevel = try? container.decodeIfPresent(String.self, forKey: .resistanceLevel)
        tempo = try? container.decodeIfPresent(String.self, forKey: .tempo)
        heartRate = try? container.decodeIfPresent(Int.self, forKey: .heartRate)
        calories = try? container.decodeIfPresent(Int.self, forKey: .calories)
        incline = try? container.decodeIfPresent(Double.self, forKey: .incline)
        speed = try? container.decodeIfPresent(Double.self, forKey: .speed)
    }
}

// MARK: - Routine Models
struct ExerciseRoutine: Codable, Identifiable {
    let id: Int
    let userId: Int
    let routineName: String
    let dayOfWeek: Int?
    let description: String?
    let isActive: Bool
    let exercises: [RoutineExercise]
    
    enum CodingKeys: String, CodingKey {
        case id, userId = "user_id", routineName = "routine_name", dayOfWeek = "day_of_week", description, isActive = "is_active", exercises
    }
}

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
        case id, routineId = "routine_id", exerciseName = "exercise_name", exerciseOrder = "exercise_order", targetSets = "target_sets", targetRepsMin = "target_reps_min", targetRepsMax = "target_reps_max", targetDurationSeconds = "target_duration_seconds", notes, cues, preferredEquipment = "preferred_equipment", equipmentNotes = "equipment_notes"
    }
}

struct ExerciseRoutinesResponse: Codable {
    let success: Bool
    let data: [ExerciseRoutine]
}

struct ExerciseRoutineResponse: Codable {
    let success: Bool
    let data: ExerciseRoutine
}
