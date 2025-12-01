import SwiftUI

struct BackfillView: View {
    @ObservedObject var healthManager: HealthKitManager
    @ObservedObject var authManager: AuthenticationManager
    @Environment(\.dismiss) var dismiss
    
    @State private var fromDate: Date = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
    @State private var toDate: Date = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
    @State private var isBackfilling = false
    @State private var backfillProgress: String = ""
    @State private var showSuccess = false
    @State private var showError = false
    @State private var errorMessage = ""
    
    private var dateRangeIsValid: Bool {
        fromDate <= toDate
    }
    
    private var daysInRange: Int {
        guard dateRangeIsValid else { return 0 }
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: fromDate), to: calendar.startOfDay(for: toDate)).day ?? 0
        return days + 1 // Include both start and end dates
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Date Range")) {
                    DatePicker("From Date", selection: $fromDate, displayedComponents: .date)
                        .disabled(isBackfilling)
                    
                    DatePicker("To Date", selection: $toDate, displayedComponents: .date)
                        .disabled(isBackfilling)
                    
                    if dateRangeIsValid {
                        Text("Will sync \(daysInRange) day\(daysInRange == 1 ? "" : "s") of data")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("From date must be before or equal to to date")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                
                Section(header: Text("Info")) {
                    Text("This will sync health data from Apple Health for each day in the selected range. The process may take a few minutes depending on the number of days.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if !backfillProgress.isEmpty {
                        Text(backfillProgress)
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                }
                
                Section {
                    Button(action: startBackfill) {
                        HStack {
                            if isBackfilling {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle())
                            }
                            Text(isBackfilling ? "Backfilling..." : "Start Backfill")
                        }
                    }
                    .disabled(isBackfilling || !dateRangeIsValid)
                }
            }
            .navigationTitle("Backfill Health Data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    ProfileMenuButton()
                        .environmentObject(authManager)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .disabled(isBackfilling)
                }
            }
            .alert("Backfill Complete", isPresented: $showSuccess) {
                Button("OK") { dismiss() }
            } message: {
                Text("Successfully synced health data for the selected date range.")
            }
            .alert("Backfill Failed", isPresented: $showError) {
                Button("OK") { }
            } message: {
                Text(errorMessage)
            }
        }
    }
    
    private func startBackfill() {
        guard dateRangeIsValid else { return }
        
        isBackfilling = true
        backfillProgress = "Starting backfill for \(daysInRange) days..."
        
        Task {
            do {
                try await healthManager.backfillHistoricalData(
                    fromDate: fromDate,
                    toDate: toDate,
                    authManager: authManager
                )
                
                await MainActor.run {
                    isBackfilling = false
                    backfillProgress = ""
                    showSuccess = true
                }
            } catch {
                await MainActor.run {
                    isBackfilling = false
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }
        }
    }
}

