# iOS App Deployment Guide

This guide covers deploying the Family Event Planner iOS app beyond local development.

## Deployment Options

### Option 1: Development Builds (Free)
- **Cost**: Free
- **Duration**: 7 days per install
- **Limitations**: Must be reinstalled weekly, connected to Mac
- **Best for**: Initial testing and validation

### Option 2: TestFlight Beta (Recommended)
- **Cost**: $99/year (Apple Developer Program)
- **Duration**: 90 days per build
- **Limitations**: Up to 10,000 testers
- **Best for**: Family testing, iteration

### Option 3: App Store Release
- **Cost**: $99/year (Apple Developer Program)
- **Duration**: Permanent
- **Limitations**: Public app, review process
- **Best for**: Public distribution

## Apple Developer Program Enrollment

Required for TestFlight and App Store deployment.

### Steps

1. Go to [developer.apple.com](https://developer.apple.com/programs/)
2. Click **Enroll**
3. Sign in with your Apple ID
4. Choose **Individual** ($99/year)
5. Complete payment
6. Wait for approval (usually 24-48 hours)

### After Enrollment

1. Open Xcode
2. Preferences → Accounts → Add Apple ID
3. Sign in with your enrolled Apple ID
4. Your team will appear in the Signing & Capabilities section

## TestFlight Deployment

### 1. Prepare for Archive

**Update Info.plist:**
```xml
<key>CFBundleShortVersionString</key>
<string>1.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

**Update Bundle Identifier:**
- Ensure it's unique: `com.sheridangray.FamilyEventPlanner`

### 2. Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Configuration:
   - **Platform**: iOS
   - **Name**: Family Event Planner
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.sheridangray.FamilyEventPlanner
   - **SKU**: FamilyEventPlanner1
   - **User Access**: Full Access
4. Click **Create**

### 3. Archive the App

1. In Xcode, select **Any iOS Device (arm64)** as target
2. Select **Product → Archive**
3. Wait for the archive to complete
4. The Organizer window will open

### 4. Upload to App Store Connect

1. In the Organizer, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Click **Upload**
5. Select signing options:
   - **Automatically manage signing** (recommended)
   - Or **Manually manage signing** (advanced)
6. Click **Upload**
7. Wait for processing (5-10 minutes)

### 5. Enable TestFlight

1. Go to App Store Connect
2. Select your app
3. Go to **TestFlight** tab
4. Your build will appear under **Builds** (after processing)

### 6. Add Beta Testers

**Internal Testing (immediate):**
1. Click **Internal Testing** → **+**
2. Create a group (e.g., "Family")
3. Add testers by email
4. They'll receive an email invitation
5. They install TestFlight app on iPhone
6. They can install your app immediately

**External Testing (requires review):**
1. Click **External Testing** → **+**
2. Create a group (e.g., "Friends")
3. Add testers (up to 10,000)
4. Submit for Beta App Review (1-2 days)
5. After approval, testers receive invitations

### 7. Testers Install the App

1. Testers receive email invitation
2. They install **TestFlight** app from App Store
3. Open the invitation link
4. Install **Family Event Planner** in TestFlight
5. The app stays installed for 90 days

### 8. Updating TestFlight Builds

1. Make code changes
2. Increment `CFBundleVersion` in Info.plist (e.g., from 1 to 2)
3. Archive and upload again
4. Existing testers are automatically notified
5. They can update within TestFlight

## App Store Release

### 1. Prepare App Store Listing

In App Store Connect:

**App Information:**
- **Name**: Family Event Planner
- **Subtitle**: Sync Health & Family Events
- **Privacy Policy URL**: (create a simple page)

**Screenshots** (required):
- iPhone 6.7" Display (iPhone 15 Pro Max)
- Take screenshots in iOS Simulator or on device
- Minimum 3, maximum 10

**Description:**
```
Stay healthy and connected with Family Event Planner's iOS companion app.

FEATURES:
• Automatically sync your Apple Health data
• Track steps, exercise, sleep, and heart rate
• View your health metrics at a glance
• Secure Google Sign-In
• Data syncs with your family dashboard

Your health data is private and only shared with your family account. We never sell or share your data with third parties.

REQUIREMENTS:
• Apple Health app
• Family Event Planner account
• Authorized family member email
```

**Keywords:**
```
health, fitness, tracking, family, events, wellness
```

**Category:**
- Primary: Health & Fitness
- Secondary: Lifestyle

### 2. Age Rating

Complete the Age Rating questionnaire:
- Medical/Treatment Information: **No**
- Unrestricted Web Access: **No**  
- Result: **4+**

### 3. Pricing & Availability

- **Price**: Free
- **Availability**: All countries (or specific regions)

### 4. App Privacy

**Data Collection:**
- Email Address (for authentication)
- Name (for profile)
- Health & Fitness (steps, sleep, exercise, heart rate)

**Data Use:**
- Account creation
- App functionality
- Analytics (if you add it later)

**Data Sharing:**
- No data is shared with third parties

### 5. Submit for Review

1. Select your TestFlight build for release
2. Fill in **What's New in This Version**:
   ```
   Initial release of Family Event Planner Health Sync!
   
   • Sync Apple Health data with your family dashboard
   • Track steps, exercise, sleep, and heart rate
   • Secure authentication
   • Beautiful health metrics display
   ```
3. Add screenshots
4. Click **Submit for Review**
5. Review typically takes 24-48 hours

### 6. Review Process

**Possible Outcomes:**
- **Approved**: App goes live automatically (or on date you set)
- **Rejected**: You'll receive detailed feedback
  - Fix the issues
  - Resubmit

**Common Rejection Reasons:**
- Missing HealthKit explanation in description
- Incomplete app functionality
- Broken sign-in flow
- Missing privacy policy

### 7. App Goes Live

- Users can find it in the App Store
- Search: "Family Event Planner"
- Or share direct link
- Updates follow the same submission process

## Background Sync Implementation

To add automatic daily syncing (Phase 2):

### 1. Add Background Modes

**In Xcode:**
1. **Signing & Capabilities** → **+ Capability**
2. Add **Background Modes**
3. Enable:
   - ✅ Background fetch
   - ✅ Background processing

### 2. Register Background Task

**In Info.plist:**
```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.sheridangray.FamilyEventPlanner.healthsync</string>
</array>
```

### 3. Create Background Sync Manager

Create `BackgroundSyncManager.swift`:
```swift
import BackgroundTasks

class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()
    static let taskIdentifier = "com.sheridangray.FamilyEventPlanner.healthsync"
    
    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.taskIdentifier,
            using: nil
        ) { task in
            self.handleSync(task: task as! BGAppRefreshTask)
        }
    }
    
    func scheduleNextSync() {
        let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
        request.earliestBeginDate = Calendar.current.date(
            byAdding: .hour,
            value: 24,
            to: Date()
        )
        
        try? BGTaskScheduler.shared.submit(request)
    }
    
    func handleSync(task: BGAppRefreshTask) {
        scheduleNextSync()
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            // Sync health data
            // ...
            task.setTaskCompleted(success: true)
        }
    }
}
```

### 4. Update App Entry Point

```swift
@main
struct FamilyEventPlannerApp: App {
    init() {
        BackgroundSyncManager.shared.registerBackgroundTask()
        BackgroundSyncManager.shared.scheduleNextSync()
    }
    
    // ... rest of app
}
```

### 5. Testing Background Tasks

**In Xcode:**
1. Run the app
2. Pause execution (Debug → Pause)
3. In Console: `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.sheridangray.FamilyEventPlanner.healthsync"]`
4. Resume execution
5. Background task will run

**Note**: Background tasks are not guaranteed to run. iOS decides based on:
- Battery level
- Network conditions
- User behavior patterns
- App usage frequency

## Monitoring & Analytics

### TestFlight Feedback

- Testers can send feedback via TestFlight
- You receive it in App Store Connect
- Use it to improve before public release

### App Store Analytics

After release, monitor:
- Downloads
- Crashes
- Usage patterns
- Reviews & ratings

Access in App Store Connect → Analytics

## Maintenance

### Regular Updates

Recommended update schedule:
- **Bug fixes**: Within 1-2 weeks
- **Minor features**: Monthly
- **Major features**: Quarterly

Each update requires:
1. Increment version number
2. Archive and upload
3. Submit for review (if App Store)
4. Or push to TestFlight (immediate)

### Version Numbering

- **CFBundleShortVersionString**: User-facing (1.0, 1.1, 2.0)
- **CFBundleVersion**: Build number (1, 2, 3, ...) - must always increase

Example progression:
- v1.0 (build 1) - Initial release
- v1.0 (build 2) - Hot fix
- v1.1 (build 3) - Minor update
- v2.0 (build 4) - Major update

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Backend hosting (Render) | $0-7 | Monthly |
| Total Year 1 | $99-183 | - |

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Enroll in Apple Developer | 1-2 days |
| Create Xcode project | 2 hours |
| First TestFlight build | 1 day |
| Family testing & feedback | 1-2 weeks |
| Fix issues & iterate | 1 week |
| Prepare App Store materials | 1 day |
| Submit for App Store review | 24-48 hours |
| **Total to App Store** | **3-4 weeks** |

## Next Steps

1. **Week 1**: Get Apple Developer account, TestFlight setup
2. **Week 2-3**: Family testing, gather feedback
3. **Week 4**: Polish and submit to App Store
4. **Week 5+**: Add background sync, widgets, Apple Watch

## Resources

- [Apple Developer](https://developer.apple.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [TestFlight](https://developer.apple.com/testflight/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)


