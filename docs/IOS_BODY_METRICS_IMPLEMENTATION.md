# iOS Body Metrics Implementation (Weight, Body Fat, BMI)

## Overview

Added support for tracking **Weight**, **Body Fat Percentage**, and **BMI** from Apple Health.

## What Was Added

### 1. HealthKit Permissions

**Added three new HealthKit types to permission requests:**
- ✅ `HKQuantityType(.bodyMass)` - Weight in pounds
- ✅ `HKQuantityType(.bodyFatPercentage)` - Body fat percentage
- ✅ `HKQuantityType(.bodyMassIndex)` - BMI calculation

These are requested in both:
- `checkAuthorizationStatus()` - For checking existing permissions
- `requestAuthorization()` - For requesting new permissions

### 2. Published Properties

**Added to HealthKitManager:**
```swift
@Published var weight: Double = 0
@Published var bodyFatPercentage: Double = 0
@Published var bmi: Double = 0
```

These are observable properties that the UI can bind to.

### 3. Fetch Functions

**Added three new async functions:**

#### `fetchLatestWeight() -> Double`
- Searches last 7 days for most recent weight measurement
- Returns value in pounds (lbs)
- Returns 0 if no data found

#### `fetchLatestBodyFat() -> Double`
- Searches last 30 days for most recent body fat percentage
- Returns percentage as decimal (e.g., 15.5 for 15.5%)
- Returns 0 if no data found

#### `fetchLatestBMI() -> Double`
- Searches last 30 days for most recent BMI calculation
- Returns BMI value (e.g., 22.5)
- Returns 0 if no data found

### 4. Data Fetching

**Updated `fetchTodayData()` to include:**
- Fetches weight, body fat, and BMI alongside other metrics
- Updates published properties on main thread
- Includes values in debug print statement

### 5. Backend Sync

**Updated `syncToBackend()` payload:**
```json
{
  "date": "2024-11-22",
  "metrics": {
    "steps": 10000,
    "exercise_minutes": 30,
    "sleep_hours": 7.5,
    "resting_heart_rate": 65,
    "weight_lbs": 175.5,           // NEW
    "body_fat_percentage": 15.2,   // NEW
    "bmi": 23.4                    // NEW
  },
  "source": "ios_app"
}
```

### 6. UI Display

**Added three new metric cards in HealthSyncView:**

```swift
HealthMetricRow - Weight
├─ Icon: "scalemass.fill" (scale icon)
├─ Color: Blue
└─ Format: "175.5 lbs" or "No data"

HealthMetricRow - Body Fat
├─ Icon: "percent" (% symbol)
├─ Color: Orange
└─ Format: "15.2%" or "No data"

HealthMetricRow - BMI
├─ Icon: "figure.stand" (person standing)
├─ Color: Green
└─ Format: "23.4" or "No data"
```

## How It Works

### Data Collection Timeline

These metrics are **NOT daily** like steps. They're periodic measurements:

```
Weight:      Last 7 days   → Most recent measurement
Body Fat:    Last 30 days  → Most recent measurement
BMI:         Last 30 days  → Most recent measurement
```

### Where Data Comes From

Users need to **manually log** these metrics in the Health app, or use:
- 📱 Smart scales (that sync to Apple Health)
- 🏋️ Fitness apps (like MyFitnessPal, Lose It)
- 💪 Body composition analyzers
- ⚖️ Manual entry in Health app

### Backend Storage

The backend's `health_physical_metrics` table already supports these fields:
- `weight_lbs` DECIMAL(10,2)
- `body_fat_percentage` DECIMAL(5,2)
- `bmi` DECIMAL(5,2)

## User Experience

### When Permissions are Granted

After updating the app and granting HealthKit permissions again:

1. **iOS will show new permission dialog** with additional items:
   - ✅ Active Energy (already granted)
   - ✅ Exercise Minutes (already granted)
   - ... existing permissions ...
   - ✅ **Body Mass** (NEW)
   - ✅ **Body Fat Percentage** (NEW)
   - ✅ **Body Mass Index** (NEW)

2. **User must re-grant** or "Turn On All" for new permissions

3. **App fetches latest data** automatically

4. **Health page displays** three new cards

### Display Behavior

- Shows "No data" if no measurements exist
- Shows most recent value within timeframe
- Updates when user syncs from Health page
- Sends to backend even if 0 (allows backend to track absence of data)

## Testing

### Test Scenario 1: User with Body Metrics

**Setup:**
1. Open **Health app**
2. Go to **Browse** → **Body Measurements** → **Weight**
3. Tap **Add Data**
4. Enter weight (e.g., 175.5 lbs) for today
5. Go to **Body Fat Percentage** → Add Data (e.g., 15.2%)
6. Go to **Body Mass Index** → Add Data (e.g., 23.4)

**Test:**
1. Open Family Event Planner app
2. Go to **Settings** → **Integrations**
3. Toggle **Apple Health** OFF then ON (to request new permissions)
4. Grant all permissions including new body metrics
5. Go to **Health** page
6. Tap **Sync Now**
7. ✅ Should see weight, body fat, and BMI displayed

### Test Scenario 2: User without Body Metrics

**Test:**
1. Fresh install or revoke permissions
2. Grant HealthKit permissions
3. Go to Health page
4. ✅ Weight, Body Fat, BMI cards show "No data"
5. ✅ Other metrics (steps, exercise, etc.) still work

### Test Scenario 3: Backend Sync

**Verify:**
1. Sync health data with metrics
2. Check backend logs or database
3. ✅ Verify `weight_lbs`, `body_fat_percentage`, `bmi` fields populated
4. ✅ Zero values sent if no data (not NULL)

## iOS Permissions Dialog

After this update, when users grant permissions, they'll see:

```
Allow "FamilyEventPlannerApp" to read:
  ✓ Active Energy
  ✓ Exercise Minutes
  ✓ Flights Climbed
  ✓ Resting Heart Rate
  ✓ Sleep Analysis
  ✓ Steps
  ✓ Walking + Running Distance
  ✓ Body Mass              ← NEW
  ✓ Body Fat Percentage    ← NEW
  ✓ Body Mass Index        ← NEW
```

## Files Modified

```
ios/FamilyEventPlannerApp/FamilyEventPlannerApp/Health/
├── HealthKitManager.swift          (Core logic + permissions)
└── HealthSyncView.swift            (UI display)
```

## Important Notes

### Measurement Frequency
- ⚠️ Weight is typically measured weekly or monthly
- ⚠️ Body fat requires special equipment (not everyone has)
- ⚠️ BMI is often auto-calculated from height/weight
- ✅ Most users won't have daily data for these

### Data Privacy
- Apple Health data stays on device until synced
- User controls which permissions to grant
- Can grant steps but deny weight (granular control)
- Backend only receives data user explicitly syncs

### BMI Calculation
- If user logs weight and height, Health app auto-calculates BMI
- Some fitness apps also write BMI values
- BMI = weight (kg) / height (m)²

### Smart Scale Integration
Popular smart scales that sync to Apple Health:
- Withings Body+
- Fitbit Aria
- Eufy Smart Scale
- QardioBase

## Future Enhancements

Potential improvements:
- [ ] Add height tracking
- [ ] Add muscle mass percentage
- [ ] Add bone density
- [ ] Add water percentage
- [ ] Show trends (weight change over time)
- [ ] Add goal setting for weight
- [ ] Add body measurements (waist, chest, etc.)
- [ ] Add photos for progress tracking

