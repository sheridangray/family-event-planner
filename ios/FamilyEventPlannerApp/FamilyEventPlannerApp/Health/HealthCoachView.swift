import SwiftUI

/// View to display health coach recommendations
struct HealthCoachView: View {
    @EnvironmentObject var healthManager: HealthKitManager
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var timeRange = "week"
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let recommendations = healthManager.healthCoachRecommendations {
                    // Focus Areas
                    if !recommendations.focusAreas.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Priority Areas")
                                .font(.title2)
                                .fontWeight(.bold)
                                .padding(.horizontal)
                            
                            ForEach(Array(recommendations.focusAreas.enumerated()), id: \.offset) { index, area in
                                FocusAreaCard(area: area, index: index + 1)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.top)
                    }
                    
                    // Quick Wins
                    if !recommendations.quickWins.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Quick Wins")
                                .font(.title2)
                                .fontWeight(.bold)
                                .padding(.horizontal)
                            
                            ForEach(recommendations.quickWins, id: \.self) { win in
                                QuickWinCard(text: win)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.top)
                    }
                    
                    // Encouragement
                    if !recommendations.encouragement.isEmpty {
                        EncouragementCard(text: recommendations.encouragement)
                            .padding(.horizontal)
                            .padding(.top)
                    }
                    
                    // Next review date
                    Text("Next review: \(recommendations.nextReviewDate)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top)
                } else {
                    // Empty state - show button to get recommendations
                    VStack(spacing: 20) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 50))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.sunsetPeach, .sunsetCoral],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        
                        Text("Get Personalized Health Recommendations")
                            .font(.headline)
                            .multilineTextAlignment(.center)
                        
                        Text("Analyze your health data and get actionable insights")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        // Time range picker
                        Picker("Time Range", selection: $timeRange) {
                            Text("This Week").tag("week")
                            Text("This Month").tag("month")
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal)
                        
                        Button(action: getRecommendations) {
                            HStack {
                                if healthManager.isLoadingRecommendations {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "sparkles")
                                    Text("Get Recommendations")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [.sunsetPeach, .sunsetCoral],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .shadow(color: .sunsetPeach.opacity(0.3), radius: 10, y: 5)
                        }
                        .disabled(healthManager.isLoadingRecommendations)
                        .padding(.horizontal)
                    }
                    .padding()
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Health Coach")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
    }
    
    func getRecommendations() {
        Task {
            do {
                try await healthManager.getHealthCoachRecommendations(
                    authManager: authManager,
                    timeRange: timeRange
                )
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
}

// MARK: - Focus Area Card

struct FocusAreaCard: View {
    let area: FocusArea
    let index: Int
    
    var priorityColor: Color {
        switch area.priority.lowercased() {
        case "high":
            return .red
        case "medium":
            return .orange
        case "low":
            return .blue
        default:
            return .gray
        }
    }
    
    var trendIcon: String {
        switch area.trend.lowercased() {
        case "improving":
            return "arrow.up.right"
        case "declining":
            return "arrow.down.right"
        case "stable":
            return "arrow.right"
        default:
            return "minus"
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("\(index). \(formatMetricName(area.metric))")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                // Priority badge
                Text(area.priority.capitalized)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(priorityColor.opacity(0.2))
                    .foregroundColor(priorityColor)
                    .cornerRadius(8)
            }
            
            // Current state
            HStack {
                Image(systemName: "info.circle")
                    .foregroundColor(.secondary)
                Text(area.currentState)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            // Trend
            HStack {
                Image(systemName: trendIcon)
                    .foregroundColor(trendColor)
                Text("Trend: \(area.trend.capitalized)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Divider()
            
            // Recommendation
            Text(area.recommendation)
                .font(.body)
                .padding(.vertical, 4)
            
            // Action items
            if !area.actionItems.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Action Items:")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                    
                    ForEach(area.actionItems, id: \.self) { item in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.sunsetDustyBlue)
                                .font(.caption)
                            Text(item)
                                .font(.subheadline)
                        }
                    }
                }
            }
            
            // Timeline
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(.secondary)
                Text("Target: \(area.targetTimeline)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 10, y: 5)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(priorityColor.opacity(0.3), lineWidth: 2)
        )
    }
    
    var trendColor: Color {
        switch area.trend.lowercased() {
        case "improving":
            return .green
        case "declining":
            return .red
        case "stable":
            return .gray
        default:
            return .gray
        }
    }
    
    func formatMetricName(_ metric: String) -> String {
        let names: [String: String] = [
            "steps": "Daily Steps",
            "exercise_minutes": "Exercise Minutes",
            "sleep_hours": "Sleep Hours",
            "resting_heart_rate": "Resting Heart Rate",
            "weight_lbs": "Weight",
            "active_calories": "Active Calories",
            "distance_miles": "Distance",
            "overall": "Overall Health"
        ]
        return names[metric] ?? metric.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

// MARK: - Quick Win Card

struct QuickWinCard: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bolt.fill")
                .foregroundColor(.yellow)
                .font(.title3)
            
            Text(text)
                .font(.body)
            
            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.yellow.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Encouragement Card

struct EncouragementCard: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "heart.fill")
                .foregroundColor(.green)
                .font(.title3)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Keep it up! 💪")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(text)
                    .font(.body)
            }
            
            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.green.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.green.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

#Preview {
    NavigationView {
        HealthCoachView()
            .environmentObject(AuthenticationManager())
            .environmentObject(HealthKitManager())
    }
}

