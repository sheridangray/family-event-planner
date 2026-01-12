import SwiftUI

struct ExerciseEntryCard: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    let entry: ExerciseLogEntry
    var onEdit: () -> Void
    var onDelete: () -> Void
    
    private var previousEntry: ExerciseLogEntry? {
        // Find all entries for this exercise in history
        let allEntries = exerciseManager.activeSessions
            .flatMap { $0.entries }
            .filter { $0.exerciseId == entry.exerciseId || $0.exerciseName == entry.exerciseName }
            .sorted { $0.performedAt > $1.performedAt }
        
        // Find the most recent one that is NOT the current entry
        // We compare by performedAt to be safe, assuming current entry is the most recent
        return allEntries.first { $0.performedAt < entry.performedAt }
    }
    
    var body: some View {
        Button(action: onEdit) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(entry.exerciseName)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    actionMenu
                }
                
                // Current session row
                HStack(spacing: 8) {
                    Text("Reps:")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                        .frame(width: 35, alignment: .leading)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(0..<entry.sets.count, id: \.self) { index in
                                        setTag(for: index, from: entry, color: .blue, isHistorical: false)
                                    }
                                }
                    }
                }
                
                // Previous session row
                HStack(alignment: .top, spacing: 8) {
                    Text("Last:")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                        .frame(width: 35, alignment: .leading)
                        .padding(.top, 4)
                    
                    if let previous = previousEntry {
                        VStack(alignment: .leading, spacing: 6) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(0..<previous.sets.count, id: \.self) { index in
                                        setTag(for: index, from: previous, color: .gray, isHistorical: true)
                                    }
                                }
                            }
                            
                            if let prevNotes = previous.notes, !prevNotes.isEmpty {
                                Text("Note: \(prevNotes)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                                    .italic()
                                    .lineLimit(2)
                            }
                        }
                    } else {
                        Text("Never performed")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .italic()
                            .padding(.top, 4)
                    }
                }
                
                if let notes = entry.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .italic()
                        .lineLimit(2)
                        .padding(.top, 2)
                }
            }
            .padding(12)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    @ViewBuilder
    private func setTag(for index: Int, from logEntry: ExerciseLogEntry, color: Color, isHistorical: Bool) -> some View {
        let set = logEntry.sets[index]
        
        HStack(spacing: 2) {
            // Priority 1: If weight is logged (> 0), show actual performance
            if let weight = set.weight, weight > 0 {
                let reps = set.reps ?? 0
                Text("\(reps)")
                    .fontWeight(.semibold)
                Text("×")
                    .font(.caption2)
                    .foregroundColor(color.opacity(0.6))
                Text(formatWeight(weight))
                    .fontWeight(.semibold)
            } 
            // Priority 2: If it's a target (not historical), show range
            else if !isHistorical, let min = set.repsMin, let max = set.repsMax, min != max {
                Text("\(min)-\(max)")
                    .fontWeight(.semibold)
            }
            // Priority 3: Show actual reps logged (or default)
            else if let reps = set.reps {
                Text("\(reps)")
                    .fontWeight(.semibold)
                
                // If it's historical, maybe show the 0 weight to be clear it was logged
                if isHistorical, let weight = set.weight {
                    Text("×")
                        .font(.caption2)
                        .foregroundColor(color.opacity(0.6))
                    Text(formatWeight(weight))
                        .fontWeight(.semibold)
                }
            }
            // Priority 4: Cardio/Time based
            else if let duration = set.duration {
                Text("\(duration / 60)m")
                    .fontWeight(.semibold)
            }
        }
        .font(.caption)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .foregroundColor(color)
        .cornerRadius(6)
    }
    
    private func formatWeight(_ weight: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: weight)) ?? "\(weight)"
    }
    
    private var actionMenu: some View {
        Menu {
            Button {
                onEdit()
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis")
                .foregroundColor(.secondary)
                .padding(8)
                .contentShape(Rectangle())
        }
    }
}

