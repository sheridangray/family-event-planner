# iOS Health Shortcut Setup Guide

This guide will help you set up an iOS Shortcut to automatically sync your Apple Health data to the Family Event Planner app.

## Prerequisites

- iPhone with iOS 14 or later
- Apple Health app with data
- Family Event Planner account
- Your API key (available in your settings)
- Your User ID (available in your settings)

## Quick Setup Instructions

### Step 1: Get Your Credentials

1. Log in to Family Event Planner web app
2. Navigate to **Settings** > **API Access**
3. Note down your:
   - **User ID** (e.g., `1`)
   - **API Key** (long string of characters)

### Step 2: Create the Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap the **"+"** button in the top right
3. Tap **"Add Action"**
4. Follow the configuration steps below

## Detailed Shortcut Configuration

### Action 1: Get Today's Date

1. Search for **"Get Current Date"**
2. Add it to your shortcut
3. Set format to **"YYYY-MM-DD"** (custom format)

### Action 2: Get Steps

1. Search for **"Find Health Samples"**
2. Select **"Steps"**
3. Configure:
   - **Sort by**: Start Date
   - **Order**: Latest First
   - **Limit**: 1
   - **Get samples from**: Last 1 Day

### Action 3: Calculate Total Steps

1. Search for **"Calculate Statistics"**
2. Select **"Sum"** of Health Samples
3. This will sum all step counts from the last day

### Action 4: Get Exercise Minutes

1. Add another **"Find Health Samples"**
2. Select **"Exercise Minutes"** or **"Apple Exercise Time"**
3. Configure same as steps (Last 1 Day)
4. Add **"Calculate Statistics"** with Sum

### Action 5: Get Sleep Hours

1. Add **"Find Health Samples"**
2. Select **"Sleep Analysis"**
3. Configure for Last 1 Day
4. Add **"Calculate Statistics"** > **"Average"**

### Action 6: Get Resting Heart Rate

1. Add **"Find Health Samples"**
2. Select **"Resting Heart Rate"**
3. Configure for Last 1 Day
4. Add **"Calculate Statistics"** > **"Average"**

### Action 7: Build JSON Request

1. Search for **"Dictionary"**
2. Add a new dictionary with this structure:

```
userId: [Your User ID Number]
date: [Current Date from Step 1]
metrics: {
  steps: [Steps Result]
  exercise_minutes: [Exercise Minutes Result]
  sleep_hours: [Sleep Hours Result]
  resting_heart_rate: [Resting Heart Rate Result]
}
```

### Action 8: Send to API

1. Search for **"Get Contents of URL"**
2. Configure:
   - **URL**: `https://your-domain.com/api/health/sync`
   - **Method**: POST
   - **Headers**:
     - Add header: `X-API-Key` = `[Your API Key]`
     - Add header: `Content-Type` = `application/json`
   - **Request Body**: Select the Dictionary from previous step

### Action 9: Show Result (Optional)

1. Add **"Show Notification"**
2. Set body to **"Contents of URL"**
3. This will show you if the sync succeeded

### Action 10: Name Your Shortcut

1. Tap the shortcut name at the top
2. Rename it to **"Sync Health Data"**
3. Choose an icon (heart icon recommended)

## Sample Shortcut JSON Structure

Here's what your final request should look like:

```json
{
  "userId": 1,
  "date": "2025-11-08",
  "metrics": {
    "steps": 8543,
    "exercise_minutes": 45,
    "sleep_hours": 7.5,
    "resting_heart_rate": 62
  }
}
```

## Testing Your Shortcut

1. Tap **"Run"** button at the bottom
2. Grant Health permissions when prompted (first time only)
3. Wait for the notification showing success
4. Check your web dashboard to see the synced data

## Setting Up Automatic Daily Sync

### Option 1: Time-Based Automation (Recommended)

1. Open **Shortcuts** app
2. Go to **"Automation"** tab at the bottom
3. Tap **"+"** in top right
4. Select **"Create Personal Automation"**
5. Choose **"Time of Day"**
6. Set time to **9:00 PM** (or when you prefer)
7. Set repeat to **Daily**
8. Tap **"Next"**
9. Search for your **"Sync Health Data"** shortcut
10. Add it
11. **Important**: Turn OFF "Ask Before Running"
12. Tap **"Done"**

### Option 2: Location-Based

1. Create automation
2. Choose **"Arrive"** or **"Leave"**
3. Select **"Home"** location
4. Add your sync shortcut

## Troubleshooting

### "Permission Denied" Error

- Go to **Settings** > **Privacy & Security** > **Health**
- Find **Shortcuts** app
- Enable all relevant categories (Steps, Exercise, Sleep, Heart Rate)

### "API Key Invalid" Error

- Double-check your API key in the web app settings
- Make sure there are no extra spaces
- Regenerate the API key if needed

### No Data Syncing

- Run shortcut manually first to grant permissions
- Check that Health app has data for today
- Verify your User ID is correct
- Check that automation is enabled and "Ask Before Running" is OFF

### Shortcut Fails Silently

- Add the "Show Notification" action to see error messages
- Check your internet connection
- Verify the API endpoint URL is correct

## Advanced Configuration

### Syncing Additional Metrics

You can add more health metrics by following the same pattern:

**Available Metrics:**
- Distance (miles/km)
- Flights Climbed
- Active Calories
- Resting Calories
- Standing Hours
- Heart Rate Variability
- Weight
- Body Fat Percentage
- Water Intake

For each metric:
1. Add "Find Health Samples" for that metric type
2. Calculate Statistics (Sum or Average)
3. Add to the Dictionary under `metrics`

### Multiple Syncs Per Day

If you want to sync multiple times:
1. Create multiple automations with different times
2. Or use a single automation that runs more frequently

## Privacy & Security

- Your health data is encrypted in transit (HTTPS)
- Only you have access to your synced data
- API key is required for all requests
- Data is stored securely in our database
- You can delete all health data anytime from settings

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify all credentials are correct
3. Test the shortcut manually before setting up automation
4. Contact support with error messages from notifications

## Example: Complete Shortcut Flow

```
1. Get Current Date → "2025-11-08"
2. Find Health Samples (Steps, Last 1 Day)
3. Calculate Statistics (Sum) → 8543
4. Find Health Samples (Exercise, Last 1 Day)
5. Calculate Statistics (Sum) → 45
6. Find Health Samples (Sleep, Last 1 Day)
7. Calculate Statistics (Average) → 7.5
8. Find Health Samples (Heart Rate, Last 1 Day)
9. Calculate Statistics (Average) → 62
10. Dictionary:
    {
      userId: 1,
      date: Current Date,
      metrics: {
        steps: Calculated Steps,
        exercise_minutes: Calculated Exercise,
        sleep_hours: Calculated Sleep,
        resting_heart_rate: Calculated HR
      }
    }
11. Get Contents of URL
    - URL: https://your-app.com/api/health/sync
    - Method: POST
    - Headers: X-API-Key, Content-Type
    - Body: Dictionary
12. Show Notification: "Health data synced successfully!"
```

## What's Next?

Once your shortcut is working:
- Set up daily automation
- Check your web dashboard to see trends
- Adjust goals in the app settings
- Consider adding more metrics to track

## Future: Third-Party Integration

In the future, we plan to integrate with services like:
- Terra API
- Vital
- Apple Health Cloud Sync

This will provide automatic background syncing without requiring shortcuts.

---

**Last Updated**: November 2025  
**Compatible With**: iOS 14+, Family Event Planner v1.0+

