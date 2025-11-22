import SwiftUI

/// Category card view for health metrics
struct CategoryCardView: View {
    let category: HealthCategory
    let summary: String
    
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(category.gradient)
                    .frame(width: 50, height: 50)
                
                Image(systemName: category.icon)
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(category.rawValue)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            // Chevron
            Image(systemName: "chevron.right")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: category.color.opacity(0.1), radius: 8, y: 4)
        )
    }
}

#Preview {
    VStack(spacing: 16) {
        CategoryCardView(
            category: .activity,
            summary: "10,234 steps • 45 min"
        )
        
        CategoryCardView(
            category: .heart,
            summary: "65 bpm • 98% SpO2"
        )
        
        CategoryCardView(
            category: .nutrition,
            summary: "1,850 cal • 64 oz"
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}

