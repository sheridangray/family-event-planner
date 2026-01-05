import SwiftUI

struct ExerciseEntryCard: View {
    let entry: ExerciseLogEntry
    var onEdit: () -> Void
    var onDelete: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.exerciseName)
                    .font(.subheadline)
                    .fontWeight(.bold)
                
                Spacer()
                
                actionMenu
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(0..<entry.setsPerformed, id: \.self) { index in
                        setTag(for: index)
                    }
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
    
    @ViewBuilder
    private func setTag(for index: Int) -> some View {
        HStack(spacing: 2) {
            if entry.repsPerformed.indices.contains(index) {
                Text("\(entry.repsPerformed[index])")
                    .fontWeight(.semibold)
                
                if entry.weightUsed.indices.contains(index), let weight = entry.weightUsed[index], weight > 0 {
                    Text("×")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text("\(String(format: "%.0f", weight))")
                        .fontWeight(.semibold)
                }
            } else if entry.durationSeconds.indices.contains(index) {
                let duration = entry.durationSeconds[index]
                Text("\(duration / 60)m")
                    .fontWeight(.semibold)
            }
        }
        .font(.caption)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.blue.opacity(0.1))
        .foregroundColor(.blue)
        .cornerRadius(6)
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

