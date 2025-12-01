import SwiftUI
import Charts

/// Period options for metric viewing
enum MetricPeriod: String, CaseIterable {
    case day = "Day"
    case week = "Week"
    case month = "Month"
    case sixMonths = "6 Months"
    case year = "Year"
    
    var days: Int {
        switch self {
        case .day: return 1
        case .week: return 7
        case .month: return 30
        case .sixMonths: return 180
        case .year: return 365
        }
    }
}

/// Detail view for a single health metric with period toggles and charts
struct MetricDetailView: View {
    @EnvironmentObject var healthManager: HealthKitManager
    let metric: HealthMetric
    let category: HealthCategory
    
    @State private var selectedPeriod: MetricPeriod = .week
    @State private var dataPoints: [HealthKitManager.MetricDataPoint] = []
    @State private var isLoading = false
    @State private var averageValue: Double = 0
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date()
    @State private var selectedDate: Date?
    
    private var metricIdentifier: MetricIdentifier? {
        MetricIdentifier.allCases.first { $0.rawValue == metric.name }
    }
    
    private var metricInfo: MetricInfo? {
        guard let identifier = metricIdentifier else { return nil }
        return MetricInfo.info(for: identifier)
    }
    
    /// Filter out zero values so the chart doesn't drop to zero on days with no data
    private var filteredDataPoints: [HealthKitManager.MetricDataPoint] {
        dataPoints.filter { $0.value > 0 }
    }
    
    /// Check if a point is selected
    private func isPointSelected(_ date: Date) -> Bool {
        guard let selected = selectedDate else { return false }
        return Calendar.current.isDate(selected, inSameDayAs: date)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Metric Header
                VStack(spacing: 8) {
                    HStack {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [category.color, category.color.opacity(0.7)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 60, height: 60)
                            
                            Image(systemName: metric.icon)
                                .font(.title)
                                .foregroundColor(.white)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(metric.name)
                                .font(.title2)
                                .fontWeight(.bold)
                            
                            Text(formatAverageValue())
                                .font(.title)
                                .fontWeight(.semibold)
                                .foregroundColor(category.color)
                        }
                        
                        Spacer()
                    }
                    .padding(.horizontal)
                }
                
                // Period Selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(MetricPeriod.allCases, id: \.self) { period in
                            Button(action: {
                                selectedPeriod = period
                                loadData()
                            }) {
                                Text(period.rawValue)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(selectedPeriod == period ? .white : category.color)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 20)
                                            .fill(selectedPeriod == period ? category.color : Color.clear)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(category.color, lineWidth: selectedPeriod == period ? 0 : 1)
                                    )
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                
                // Date Range
                VStack(spacing: 4) {
                    Text("\(startDate, style: .date) - \(endDate, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal)
                
                // Chart
                if !dataPoints.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        // Header with Trend label and tooltip
                        HStack {
                            Text("Trend")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            // Always reserve space for tooltip to prevent chart jumping
                            VStack(alignment: .trailing, spacing: 2) {
                                if let selected = selectedDate,
                                   let selectedPoint = filteredDataPoints.first(where: { Calendar.current.isDate(selected, inSameDayAs: $0.date) }) {
                                    Text(formatValue(selectedPoint.value))
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(
                                            RoundedRectangle(cornerRadius: 6)
                                                .fill(category.color)
                                        )
                                    Text(selectedPoint.date, style: .date)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                } else {
                                    // Invisible placeholder to maintain space
                                    Text(" ")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .opacity(0)
                                    Text(" ")
                                        .font(.caption2)
                                        .opacity(0)
                                }
                            }
                        }
                        .padding(.horizontal)
                        
                        ZStack {
                            Chart(filteredDataPoints) { point in
                                LineMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(category.color)
                                .interpolationMethod(.catmullRom)
                                
                                AreaMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [category.color.opacity(0.3), category.color.opacity(0.0)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .interpolationMethod(.catmullRom)
                                
                                // Add visible points
                                PointMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(category.color)
                                .symbolSize(isPointSelected(point.date) ? 150 : 60)
                                .opacity(isPointSelected(point.date) ? 1.0 : 0.7)
                                
                                // Show vertical rule for selected point
                                if isPointSelected(point.date) {
                                    RuleMark(x: .value("Date", point.date, unit: .day))
                                        .foregroundStyle(category.color.opacity(0.3))
                                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                                }
                            }
                            .chartXSelection(value: $selectedDate)
                            .frame(height: 200)
                        }
                        .onTapGesture {
                            // Clear selection on tap outside
                            selectedDate = nil
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(.systemBackground))
                                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
                        )
                        .padding(.horizontal)
                    }
                } else if isLoading {
                    VStack {
                        ProgressView()
                            .padding()
                        Text("Loading data...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(height: 200)
                } else {
                    VStack {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No data available for this period")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(height: 200)
                }
                
                // Metric Information
                if let info = metricInfo {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("About \(metric.name)")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Description")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.secondary)
                                Text(info.description)
                                    .font(.body)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Why It Matters")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.secondary)
                                Text(info.importance)
                                    .font(.body)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Typical Range")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.secondary)
                                Text(info.typicalRange)
                                    .font(.body)
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(.systemBackground))
                                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
                        )
                        .padding(.horizontal)
                    }
                }
                
                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .navigationTitle(metric.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ProfileMenuButton()
                    .environmentObject(AuthenticationManager.shared)
            }
        }
        .background(Color(.systemGroupedBackground))
        .onAppear {
            loadData()
        }
        .onChange(of: selectedPeriod) { _ in
            loadData()
        }
        .onChange(of: healthManager.selectedDate) { _ in
            loadData()
        }
    }
    
    private func loadData() {
        guard let identifier = metricIdentifier else {
            print("❌ Could not find metric identifier for: \(metric.name)")
            return
        }
        
        print("📊 Loading data for metric: \(metric.name) -> \(identifier.rawValue)")
        
        isLoading = true
        let calendar = Calendar.current
        // Use the selected date from healthManager (defaults to yesterday) as the end date
        let referenceDate = healthManager.selectedDate
        endDate = calendar.startOfDay(for: referenceDate)
        // For "Day" period, we want just that one day, so startDate = endDate
        if selectedPeriod == .day {
            startDate = endDate
        } else {
            startDate = calendar.date(byAdding: .day, value: -(selectedPeriod.days - 1), to: endDate) ?? endDate
        }
        
        print("📅 Loading period: \(selectedPeriod.rawValue) (\(selectedPeriod.days) days)")
        print("📅 Start: \(startDate), End: \(endDate)")
        
        Task {
            let points = await healthManager.fetchMetricData(
                for: identifier,
                from: startDate,
                to: endDate
            )
            
            print("📊 Received \(points.count) data points")
            
            await MainActor.run {
                dataPoints = points
                
                // Calculate average (excluding zero values)
                let nonZeroPoints = points.filter { $0.value > 0 }
                if !nonZeroPoints.isEmpty {
                    let sum = nonZeroPoints.reduce(0) { $0 + $1.value }
                    averageValue = sum / Double(nonZeroPoints.count)
                    print("📊 Average value: \(averageValue) (from \(nonZeroPoints.count) non-zero points out of \(points.count) total)")
                } else {
                    averageValue = 0
                    print("⚠️ No data points found")
                }
                
                isLoading = false
            }
        }
    }
    
    /// Format a single value for display (used in tooltip)
    private func formatValue(_ value: Double) -> String {
        guard let identifier = metricIdentifier else { return "\(value)" }
        
        switch identifier {
        case .steps:
            return "\(Int(value).formatted())"
        case .exercise, .mindfulMinutes:
            return String(format: "%.0f min", value)
        case .distance:
            return String(format: "%.1f mi", value)
        case .activeCalories, .calories:
            return String(format: "%.0f cal", value)
        case .flightsClimbed:
            return String(format: "%.0f", value)
        case .standHours:
            return String(format: "%.1f hrs", value)
        case .walkingSpeed:
            return String(format: "%.1f mph", value)
        case .weight, .leanBodyMass:
            return String(format: "%.1f lbs", value)
        case .bmi:
            return String(format: "%.1f", value)
        case .bodyFat:
            return String(format: "%.1f%%", value)
        case .height:
            return String(format: "%.1f in", value)
        case .restingHeartRate:
            return String(format: "%.0f bpm", value)
        case .bloodOxygen:
            return String(format: "%.0f%%", value)
        case .vo2Max:
            return String(format: "%.1f", value)
        case .hrv:
            return String(format: "%.0f ms", value)
        case .respiratoryRate:
            return String(format: "%.0f/min", value)
        case .water:
            return String(format: "%.0f oz", value)
        case .protein, .carbs, .fat, .sugar, .fiber:
            return String(format: "%.0f g", value)
        case .caffeine:
            return String(format: "%.0f mg", value)
        case .sleep:
            return String(format: "%.1f hrs", value)
        }
    }
    
    private func formatAverageValue() -> String {
        guard let identifier = metricIdentifier else { return "No data" }
        
        if averageValue == 0 {
            return "No data"
        }
        
        switch identifier {
        case .steps:
            return "\(Int(averageValue).formatted()) steps/day"
        case .exercise, .mindfulMinutes:
            return String(format: "%.0f min/day", averageValue)
        case .distance:
            return String(format: "%.1f mi/day", averageValue)
        case .activeCalories, .calories:
            return String(format: "%.0f cal/day", averageValue)
        case .flightsClimbed:
            return String(format: "%.0f flights/day", averageValue)
        case .standHours:
            return String(format: "%.1f hrs/day", averageValue)
        case .walkingSpeed:
            return String(format: "%.1f mph", averageValue)
        case .weight, .leanBodyMass:
            return String(format: "%.1f lbs", averageValue)
        case .bmi:
            return String(format: "%.1f", averageValue)
        case .bodyFat:
            return String(format: "%.1f%%", averageValue)
        case .height:
            return String(format: "%.1f in", averageValue)
        case .restingHeartRate:
            return String(format: "%.0f bpm", averageValue)
        case .bloodOxygen:
            return String(format: "%.0f%%", averageValue)
        case .vo2Max:
            return String(format: "%.1f", averageValue)
        case .hrv:
            return String(format: "%.0f ms", averageValue)
        case .respiratoryRate:
            return String(format: "%.0f/min", averageValue)
        case .water:
            return String(format: "%.0f oz/day", averageValue)
        case .protein, .carbs, .fat, .sugar, .fiber:
            return String(format: "%.0f g/day", averageValue)
        case .caffeine:
            return String(format: "%.0f mg/day", averageValue)
        case .sleep:
            return String(format: "%.1f hrs/day", averageValue)
        }
    }
}

#Preview {
    NavigationStack {
        MetricDetailView(
            metric: HealthMetric(name: "Steps", value: "10,000", icon: "figure.walk", isPrimary: true),
            category: .activity
        )
        .environmentObject(HealthKitManager.shared)
    }
}

