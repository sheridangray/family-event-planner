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
                // Header with date and navigation
                VStack(spacing: 12) {
                    // Date display
                    VStack(spacing: 4) {
                        Text("Health Data")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        Text(healthManager.selectedDate, style: .date)
                            .font(.title3)
                            .fontWeight(.semibold)
                    }
                    
                    // Navigation buttons
                    HStack(spacing: 20) {
                        Button(action: {
                            healthManager.goToPreviousDay()
                        }) {
                            Image(systemName: "chevron.left.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(healthManager.isOnOldestDate ? .gray.opacity(0.3) : .sunsetDustyBlue)
                        }
                        .disabled(healthManager.isOnOldestDate)
                        
                        Button(action: {
                            healthManager.goToNextDay()
                        }) {
                            Image(systemName: "chevron.right.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(healthManager.isOnMostRecentDate ? .gray.opacity(0.3) : .sunsetDustyBlue)
                        }
                        .disabled(healthManager.isOnMostRecentDate)
                    }
                }
                .padding(.top, 8)
                .onAppear {
                    // Fetch data for selected date when view appears
                    Task {
                        await healthManager.fetchDataForDate(date: healthManager.selectedDate)
                    }
                }
                .onChange(of: healthManager.selectedDate) { newDate in
                    // Fetch data when date changes
                    Task {
                        await healthManager.fetchDataForDate(date: newDate)
                    }
                }
                
                // Primary Metrics
                if !primaryMetrics.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Primary Metrics")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            ForEach(primaryMetrics) { metric in
                                NavigationLink(destination: MetricDetailView(metric: metric, category: category)
                                    .environmentObject(healthManager)) {
                                    MetricDetailRow(metric: metric, color: category.color)
                                }
                                .buttonStyle(PlainButtonStyle())
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
                                NavigationLink(destination: MetricDetailView(metric: metric, category: category)
                                    .environmentObject(healthManager)) {
                                    MetricDetailRow(metric: metric, color: category.color)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Exercise connection (for Activity category)
                if category == .activity {
                    VStack(alignment: .leading, spacing: 12) {
                        Divider()
                            .padding(.horizontal)
                        
                        Text("Related Exercise Data")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        NavigationLink(destination: ExerciseView()
                            .environmentObject(ExerciseManager.shared)) {
                            HStack {
                                Image(systemName: "dumbbell.fill")
                                    .foregroundColor(.sunsetCoral)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("View Workout Logs")
                                        .font(.subheadline)
                                        .foregroundColor(.primary)
                                    Text("See your structured exercise routines")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(.secondarySystemBackground))
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
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

