# Health Sync: Updated to Fetch Yesterday's Data

## Changes Made

Updated the iOS app to fetch **yesterday's health data** instead of today's data, since users typically don't have complete data for the current day.

### Modified Files

#### 1. `HealthKitManager.swift`

**Changed `fetchTodayData()` function (lines 96-137):**
- ✅ Now fetches yesterday's complete data instead of today's incomplete data
- ✅ Uses `startOfYesterday` and `endOfYesterday` for date range
- ✅ Queries steps, exercise, sleep, and heart rate from yesterday
- ✅ Added debug logging: "Fetching yesterday's health data..." with date range

**Updated `fetchLatestHeartRate()` function (line 235):**
- ✅ Now accepts optional `start` and `end` date parameters
- ✅ Allows querying heart rate for specific date ranges
- ✅ Maintains backward compatibility with default parameters

**Updated `syncToBackend()` function (lines 298-308):**
- ✅ Sends yesterday's date in "yyyy-MM-dd" format to backend
- ✅ Added debug logging: "Syncing data for date: YYYY-MM-DD"
- ✅ Backend will now correctly record data for yesterday's date

#### 2. `HealthSyncView.swift`

**Added date header (lines 15-27):**
- ✅ Shows "Yesterday's Health Data" heading
- ✅ Displays the actual date being shown
- ✅ Makes it clear to users they're viewing previous day's metrics

## Why This Change?

### Problem
Users typically don't have complete health data for "today" because:
- They haven't finished their daily activities yet
- Steps, exercise, and other metrics accumulate throughout the day
- Sleep data from "last night" is technically from yesterday

### Solution
By fetching **yesterday's data**, users see:
- ✅ **Complete metrics** - Full day of activity
- ✅ **Accurate sleep** - Complete sleep cycle from the previous night
- ✅ **Consistent experience** - Same data regardless of time of day
- ✅ **Better insights** - Full picture of their health for that day

## Date Logic Explained

### What Gets Fetched

```
Today = Friday, Nov 22, 2024 at 2:00 PM

Yesterday (data being fetched):
├─ Start: Thursday, Nov 21, 2024 at 12:00 AM
├─ End:   Friday, Nov 22, 2024 at 12:00 AM
│
├─ Steps: All steps from Thursday
├─ Exercise: All exercise minutes from Thursday
├─ Heart Rate: Latest resting HR from Thursday
│
└─ Sleep: Night before Thursday (Wed night → Thu morning)
```

### Backend Date Format

The data is sent to the backend with the date: `"2024-11-21"` (yesterday's date), so:
- ✅ Database correctly associates data with the right day
- ✅ Web dashboard shows metrics for the correct date
- ✅ Historical data is accurate and makes sense

## Testing

After these changes:

1. **Open the iOS app**
2. **Go to Health Sync**
3. **You should see:**
   - "Yesterday's Health Data" header
   - The actual date (e.g., "November 21, 2024")
   - Your steps, exercise, sleep, and heart rate from yesterday

4. **Tap "Sync Now"**
5. **Check logs for:**
   ```
   📊 Fetching yesterday's health data...
   📅 Date range: 2024-11-21 00:00:00 to 2024-11-22 00:00:00
   ✅ Fetched: 12,543 steps, 45 min exercise, 7.5h sleep, 62 bpm
   📅 Syncing data for date: 2024-11-21
   ✅ Sync successful
   ```

## Future Enhancements

Potential improvements for later:
- [ ] Add a date picker to view any historical day
- [ ] Add "today so far" view alongside yesterday's complete data
- [ ] Show weekly trends and averages
- [ ] Add notifications to remind users to sync yesterday's data each morning

## Technical Notes

- **Function name kept as `fetchTodayData()`** for compatibility with existing code
- **Variable names unchanged** (`todaySteps`, etc.) to avoid breaking other references
- **Backend API unchanged** - still uses the same `/api/health/sync` endpoint
- **Date format** changed from ISO8601 timestamp to simple "yyyy-MM-dd" date string

