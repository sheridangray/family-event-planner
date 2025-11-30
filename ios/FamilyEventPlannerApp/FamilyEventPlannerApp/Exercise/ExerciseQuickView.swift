import SwiftUI

/// Quick preview of exercise section shown in Health view
struct ExerciseQuickView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @EnvironmentObject var healthManager: HealthKitManager
    @State private var showingExerciseView = false
    
    var body: some View {
        VStack(spacing: 12) {
            // Section header
            HStack {
                Text("Exercise & Workouts")
                    .font(.headline)
                    .foregroundColor(.secondary)
                Spacer()
                NavigationLink(destination: ExerciseView()
                    .environmentObject(exerciseManager)) {
                    Text("View All")
                        .font(.subheadline)
                        .foregroundColor(.sunsetDustyBlue)
                }
            }
            
            // Today's routine card
            if let todayRoutine = exerciseManager.todayRoutine {
                TodayRoutinePreviewCard(routine: todayRoutine) {
                    showingExerciseView = true
                }
            } else {
                EmptyRoutineCard {
                    showingExerciseView = true
                }
            }
            
            // Quick stats linking to health metrics
            ExerciseHealthConnectionView()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 8, y: 4)
        )
        .sheet(isPresented: $showingExerciseView) {
            NavigationStack {
                ExerciseView()
                    .environmentObject(exerciseManager)
            }
        }
    }
}

// MARK: - Today Routine Preview Card

struct TodayRoutinePreviewCard: View {
    let routine: ExerciseRoutine
    let action: () -> Void
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var hasLogged = false
    @State private var checkingLogged = true
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [.sunsetCoral, .sunsetRose],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: "dumbbell.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }
                
                // Content
                VStack(alignment: .leading, spacing: 4) {
                    Text(routine.routineName)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("\(routine.exercises.count) exercises")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    // Check if logged today
                    if checkingLogged {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else if hasLogged {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.caption)
                            Text("Logged today")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                    } else {
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .foregroundColor(.orange)
                                .font(.caption)
                            Text("Not logged yet")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
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
        .task {
            do {
                hasLogged = try await exerciseManager.hasLoggedToday(routineId: routine.id)
                checkingLogged = false
            } catch {
                checkingLogged = false
            }
        }
    }
}

// MARK: - Empty Routine Card

struct EmptyRoutineCard: View {
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [.sunsetCoral, .sunsetRose],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: "dumbbell.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("No routine for today")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("Tap to view all routines")
                        .font(.subheadline)
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
    }
}

// MARK: - Exercise Health Connection View

struct ExerciseHealthConnectionView: View {
    @EnvironmentObject var healthManager: HealthKitManager
    @EnvironmentObject var exerciseManager: ExerciseManager
    
    var body: some View {
        HStack(spacing: 16) {
            // Exercise minutes from logged workouts
            VStack(alignment: .leading, spacing: 4) {
                Text("Logged Exercise")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("\(exerciseManager.todayLoggedMinutes) min")
                    .font(.headline)
                    .foregroundColor(.primary)
            }
            
            Divider()
                .frame(height: 30)
            
            // Exercise minutes from HealthKit
            VStack(alignment: .leading, spacing: 4) {
                Text("HealthKit Exercise")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("\(healthManager.todayExercise) min")
                    .font(.headline)
                    .foregroundColor(.primary)
            }
            
            Spacer()
            
            // Link to Activity category
            NavigationLink(destination: CategoryDetailView(category: .activity)
                .environmentObject(healthManager)) {
                Image(systemName: "arrow.right.circle.fill")
                    .foregroundColor(.sunsetDustyBlue)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.tertiarySystemBackground))
        )
    }
}

#Preview {
    ExerciseQuickView()
        .environmentObject(ExerciseManager.shared)
        .environmentObject(HealthKitManager.shared)
}

