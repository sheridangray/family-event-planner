import SwiftUI
import Charts

struct StandardizedMetricDetailView: View {
    let identifier: MetricIdentifier
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var selectedRange: TimeRange = .week
    @State private var dataPoints: [HealthKitManager.MetricDataPoint] = []
    @State private var isLoading = false
    
    enum TimeRange: String, CaseIterable {
        case day = "Day"
        case week = "Week"
        case month = "Month"
        case sixMonths = "6M"
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
    
    var info: MetricInfo {
        MetricInfo.get(for: identifier)
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Range Selector
                Picker("Range", selection: $selectedRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                
                // Summary Value
                VStack(alignment: .leading, spacing: 4) {
                    Text(info.name)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    HStack(alignment: .bottom, spacing: 4) {
                        Text(healthManager.getCategorySummary(for: info.category))
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                    }
                }
                .padding(.horizontal)
                
                // Chart
                ZStack {
                    if isLoading {
                        ProgressView()
                            .frame(height: 200)
                    } else if dataPoints.isEmpty {
                        Text("No data available for this range")
                            .foregroundColor(.secondary)
                            .frame(height: 200)
                            .frame(maxWidth: .infinity)
                    } else {
                        Chart(dataPoints) { point in
                            if identifier == .steps || identifier == .exercise || identifier == .calories {
                                BarMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(info.color.gradient)
                            } else {
                                LineMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(info.color.gradient)
                                .interpolationMethod(.catmullRom)
                                
                                AreaMark(
                                    x: .value("Date", point.date, unit: .day),
                                    y: .value("Value", point.value)
                                )
                                .foregroundStyle(info.color.opacity(0.1).gradient)
                                .interpolationMethod(.catmullRom)
                            }
                        }
                        .frame(height: 200)
                        .chartXAxis {
                            AxisMarks(values: .stride(by: .day)) { _ in
                                AxisGridLine()
                                AxisTick()
                                AxisValueLabel(format: .dateTime.day().month())
                            }
                        }
                    }
                }
                .padding(.horizontal)
                
                // About Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("About \(info.name)")
                        .font(.headline)
                    
                    Text(info.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                    
                    Divider()
                    
                    HStack {
                        Image(systemName: "info.circle")
                        Text("Data source: Apple Health")
                            .font(.caption)
                    }
                    .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.secondary.opacity(0.05))
                .cornerRadius(12)
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle(info.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: selectedRange) {
            await loadData()
        }
    }
    
    private func loadData() async {
        isLoading = true
        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -selectedRange.days, to: end)!
        dataPoints = await healthManager.fetchMetricData(for: identifier, from: start, to: end)
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        StandardizedMetricDetailView(identifier: .steps)
            .environmentObject(HealthKitManager.shared)
    }
}
