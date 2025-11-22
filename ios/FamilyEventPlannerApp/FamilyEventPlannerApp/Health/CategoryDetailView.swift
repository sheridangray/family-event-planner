import SwiftUI

/// Detail view for a health category showing all metrics
struct CategoryDetailView: View {
    @EnvironmentObject var healthManager: HealthKitManager
    let category: HealthCategory
    
    var metrics: [HealthMetric] {
        healthManager.getMetrics(for: category)
    }
    
    var primaryMetrics: [HealthMetric] {
        metrics.filter { $0.isPrimary }
    }
    
    var secondaryMetrics: [HealthMetric] {
        metrics.filter { !$0.isPrimary }
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header with date
                VStack(spacing: 4) {
                    Text("Yesterday's Data")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                    Text(yesterday, style: .date)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 8)
                
                // Primary Metrics
                if !primaryMetrics.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Primary Metrics")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            ForEach(primaryMetrics) { metric in
                                MetricDetailRow(metric: metric, color: category.color)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Secondary Metrics
                if !secondaryMetrics.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Additional Metrics")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            ForEach(secondaryMetrics) { metric in
                                MetricDetailRow(metric: metric, color: category.color)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .navigationTitle(category.rawValue)
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Metric Detail Row

struct MetricDetailRow: View {
    let metric: HealthMetric
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [color, color.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                
                Image(systemName: metric.icon)
                    .font(.title3)
                    .foregroundColor(.white)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(metric.name)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(metric.value)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
            }
            
            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
        )
    }
}

#Preview {
    NavigationStack {
        CategoryDetailView(category: .activity)
            .environmentObject(HealthKitManager())
    }
}

