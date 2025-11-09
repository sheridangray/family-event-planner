# iOS Shortcut Health Sync Guide

This guide will help you set up an iOS Shortcut to automatically sync your Apple Health data to the Family Event Planner app.

## Prerequisites

- iPhone with iOS 14 or later
- Apple Health app with some health data
- Your Family Event Planner account credentials
- Your User ID and API Key (available in Settings)

## Step-by-Step Setup

### 1. Get Your Credentials

1. Log into the Family Event Planner web app
2. Go to **Settings** → **Account**
3. Note down your:
   - **User ID** (e.g., `1`)
   - **API Key** (long string starting with `fep_`)

### 2. Create the Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap the **+** button in the top right to create a new shortcut
3. Tap **Add Action**

### 3. Add Health Data Actions

#### Get Steps
1. Search for "**Find Health Samples**"
2. Add the action
3. Configure:
   - Type: **Step Count**
   - Sort By: **Start Date**
   - Order: **Latest First**
   - Limit: **1**
   - Period: **Last 1 Day**

4. Tap **Show More** and select:
   - ✅ **Get Sum**

5. Below this action, add "**Set Variable**"
   - Name it: `Steps`

#### Get Exercise Minutes
1. Add another "**Find Health Samples**" action
2. Configure:
   - Type: **Exercise Time**
   - Period: **Last 1 Day**
   - Get Sum

3. Add "**Calculate**" action
   - Operation: **÷**
   - Value: `60` (converts seconds to minutes)

4. Add "**Round Number**" action
   - Rounding: **Normal**

5. Add "**Set Variable**"
   - Name: `ExerciseMinutes`

#### Get Sleep Hours
1. Add another "**Find Health Samples**" action
2. Configure:
   - Type: **Sleep Analysis**
   - Period: **Last 1 Day**
   - Get Sum

3. Add "**Calculate**" action
   - Operation: **÷**
   - Value: `3600` (converts seconds to hours)

4. Add "**Round Number**" action
   - Rounding: **Normal**
   - Decimal Places: **1**

5. Add "**Set Variable**"
   - Name: `SleepHours`

#### Get Resting Heart Rate
1. Add another "**Find Health Samples**" action
2. Configure:
   - Type: **Resting Heart Rate**
   - Sort By: **Start Date**
   - Order: **Latest First**
   - Limit: **1**

3. Add "**Set Variable**"
   - Name: `HeartRate`

### 4. Create JSON Body

1. Add "**Dictionary**" action
2. Configure the dictionary with these key-value pairs:
   ```
   userId: [YOUR_USER_ID]  (type manually, e.g., 1)
   date: [Current Date formatted as YYYY-MM-DD]
   metrics: [Dictionary with health data]
   source: ios_shortcut
   ```

3. For the `metrics` dictionary, add another **Dictionary** action with:
   ```
   steps: [Steps variable]
   exercise_minutes: [ExerciseMinutes variable]
   sleep_hours: [SleepHours variable]
   resting_heart_rate: [HeartRate variable]
   ```

### 5. Send Data to API

1. Add "**Get Contents of URL**" action
2. Configure:
   - **URL**: `https://your-domain.com/api/health/sync`
   - **Method**: **POST**
   - **Headers**: 
     - Key: `X-API-Key`
     - Value: `[YOUR_API_KEY]`
     - Key: `Content-Type`
     - Value: `application/json`
   - **Request Body**: **JSON**
   - **JSON**: Select the dictionary from step 4

### 6. Add Success Notification

1. Add "**Show Notification**" action
2. Configure:
   - Title: `Health Data Synced`
   - Body: `Successfully synced [Steps] steps, [ExerciseMinutes] min exercise, [SleepHours]h sleep`

### 7. Name and Save

1. Tap **Done**
2. Name your shortcut: `Sync Health Data`
3. Choose an icon (💪 or ❤️ recommended)

## Simplified JSON Example

Here's what your shortcut should send:

```json
{
  "userId": 1,
  "date": "2025-01-15",
  "metrics": {
    "steps": 8543,
    "exercise_minutes": 32,
    "sleep_hours": 7.5,
    "resting_heart_rate": 62
  },
  "source": "ios_shortcut"
}
```

## Setting Up Automation (Optional)

To run this automatically every day:

1. Open the **Shortcuts** app
2. Go to the **Automation** tab
3. Tap **+** to create new automation
4. Choose **Time of Day**
5. Set time (e.g., 9:00 AM)
6. Choose **Daily**
7. Tap **Next**
8. Search for your "Sync Health Data" shortcut
9. Add it to the automation
10. Toggle **Ask Before Running** OFF (for automatic sync)
11. Tap **Done**

## Testing Your Shortcut

1. Run the shortcut manually first
2. Grant any Health permissions when prompted
3. Check for the success notification
4. Verify data appears in the Family Event Planner Health dashboard

## Troubleshooting

### "Permission Denied" Error
- Open **Settings** → **Privacy & Security** → **Health**
- Find **Shortcuts** app
- Enable all the health metrics you want to sync

### "Invalid API Key" Error
- Double-check your API key in Settings
- Make sure there are no extra spaces or line breaks
- API key should start with `fep_`

### "User Not Found" Error
- Verify your User ID is correct (should be a number like `1`)
- Check that your account is active

### No Data Showing
- Make sure you have health data for today in the Apple Health app
- Run the shortcut manually to test
- Check the sync logs in Settings → Health Sync Status

### Shortcut Fails Silently
- Add a "**Show Notification**" action before the API call to see the data being sent
- Check if health permissions are granted
- Verify your internet connection

## Advanced: Adding More Metrics

You can add any Apple Health metric:

**Weight:**
- Type: **Body Mass**
- Latest value only

**Active Calories:**
- Type: **Active Energy Burned**
- Get Sum, divide by 1 (already in calories)

**Distance:**
- Type: **Distance Walking Running**
- Get Sum, divide by 1609 (converts meters to miles)

**Flights Climbed:**
- Type: **Flights Climbed**
- Get Sum

**Heart Rate Variability:**
- Type: **Heart Rate Variability SDNN**
- Latest value

## Privacy & Security

- Your health data is sent directly from your iPhone to your Family Event Planner backend
- Data is encrypted in transit (HTTPS)
- No third parties have access to your data
- You can delete your health data anytime from the Settings page

## Support

If you need help:
1. Check the troubleshooting section above
2. View sync logs in Settings → Health Sync Status
3. Contact support with your User ID (not your API key!)

## Next Steps

Once you're comfortable with the iOS Shortcut, consider:
- Setting up automation for daily sync
- Adding more health metrics
- Upgrading to a third-party service (Terra, Vital) for automatic background sync

---

**Last Updated:** January 2025  
**Compatible With:** iOS 14+, Family Event Planner v1.0+

