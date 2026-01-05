import SwiftUI

struct ExerciseEntryCard: View {
    let entry: ExerciseLogEntry
    var isCompact: Bool = false
    var onEdit: () -> Void
    var onDelete: () -> Void
    
    var body: some View {
        if isCompact {
            compactBody
        } else {
            standardBody
        }
    }
    
    // MARK: - Standard View
    private var standardBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header: Exercise Name and Set Count
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.exerciseName)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("\(entry.setsPerformed) set\(entry.setsPerformed == 1 ? "" : "s")")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                actionMenu
            }
            
            if let notes = entry.notes, !notes.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "note.text")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .italic()
                }
                .padding(.horizontal, 4)
            }
            
            // Sets Table/Grid
            VStack(spacing: 8) {
                // Header for sets
                HStack {
                    Text("SET")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                        .frame(width: 35, alignment: .leading)
                    
                    if !entry.repsPerformed.isEmpty {
                        Text("REPS")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    
                    if !entry.weightUsed.isEmpty {
                        Text("LBS")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    
                    if !entry.durationSeconds.isEmpty {
                        Text("TIME")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(.horizontal, 4)
                
                Divider()
                
                // Set rows
                ForEach(0..<entry.setsPerformed, id: \.self) { index in
                    HStack {
                        Text("\(index + 1)")
                            .font(.system(.subheadline, design: .monospaced))
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                            .frame(width: 35, alignment: .leading)
                        
                        if entry.repsPerformed.indices.contains(index) {
                            Text("\(entry.repsPerformed[index])")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        
                        if entry.weightUsed.indices.contains(index), let weight = entry.weightUsed[index] {
                            Text("\(String(format: "%.0f", weight))")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        
                        if entry.durationSeconds.indices.contains(index) {
                            let duration = entry.durationSeconds[index]
                            Text("\(duration / 60)m")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                    }
                    .padding(.vertical, 4)
                    .padding(.horizontal, 4)
                    .background(index % 2 == 0 ? Color.clear : Color.primary.opacity(0.03))
                }
            }
            .padding(12)
            .background(Color(.systemBackground))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.primary.opacity(0.05), lineWidth: 1)
            )
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.03), radius: 5, x: 0, y: 2)
    }
    
    // MARK: - Compact View
    private var compactBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.exerciseName)
                    .font(.subheadline)
                    .fontWeight(.bold)
                
                if let notes = entry.notes, !notes.isEmpty {
                    Image(systemName: "note.text")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
                
                Spacer()
                
                Text("\(entry.setsPerformed) sets")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                actionMenu
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(0..<entry.setsPerformed, id: \.self) { index in
                        setTag(for: index)
                    }
                }
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

