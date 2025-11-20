# Family Event Planner - iOS Health Sync App

A native iOS companion app that syncs Apple Health data to the Family Event Planner backend.

## Features

- ✅ Google Sign-In authentication
- ✅ HealthKit data reading (steps, exercise, sleep, heart rate)
- ✅ Manual sync to backend
- ✅ Secure session storage in Keychain
- ✅ Real-time health metrics display

## Requirements

- macOS with Xcode 15.0 or later
- iOS 16.0+ target device or simulator
- Physical iPhone (required for HealthKit - simulator doesn't support it)
- Apple Developer account (optional, for TestFlight/App Store)

## Project Setup

### 1. Create Xcode Project

1. Open Xcode
2. Select **File → New → Project**
3. Choose **iOS → App**
4. Configuration:
   - **Product Name**: FamilyEventPlanner
   - **Team**: Your team (or None for development)
   - **Organization Identifier**: com.sheridangray
   - **Bundle Identifier**: com.sheridangray.FamilyEventPlanner
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None
5. Save in the `ios/` directory

### 2. Add Swift Files

Add all the Swift files from the `FamilyEventPlanner/` directory to your Xcode project:

```
FamilyEventPlanner/
├── App/
│   └── FamilyEventPlannerApp.swift      # App entry point
├── Authentication/
│   ├── AuthenticationManager.swift      # Google auth + backend validation
│   ├── SignInView.swift                 # Sign-in screen
│   └── KeychainHelper.swift             # Secure storage
├── Health/
│   ├── HealthKitManager.swift           # HealthKit integration
│   └── HealthSyncView.swift             # Main health screen
└── Models/
    └── User.swift                       # Data models
```

**In Xcode:**
- Right-click on the project in the navigator
- Select **Add Files to "FamilyEventPlanner"...**
- Select all the Swift files
- Make sure **Copy items if needed** is checked
- Make sure your target is selected

### 3. Configure Info.plist

Replace your `Info.plist` with the one provided in `ios/Info.plist`, or add these keys manually:

```xml
<!-- Google Sign-In -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.584799141962-3mfn2p032ihqfkjhbu8v8jl8pcmp45ie</string>
        </array>
    </dict>
</array>
<key>GIDClientID</key>
<string>584799141962-3mfn2p032ihqfkjhbu8v8jl8pcmp45ie.apps.googleusercontent.com</string>

<!-- HealthKit -->
<key>NSHealthShareUsageDescription</key>
<string>We need access to your health data to sync it with your Family Event Planner dashboard.</string>
```

### 4. Add Swift Package Dependencies

1. In Xcode, select **File → Add Package Dependencies**
2. Enter the URL: `https://github.com/google/GoogleSignIn-iOS`
3. Select **Up to Next Major Version** (version 7.0.0 or later)
4. Click **Add Package**
5. Select **GoogleSignIn** and **GoogleSignInSwift** libraries
6. Click **Add Package**

### 5. Enable HealthKit Capability

1. Select your project in the Project Navigator
2. Select your target
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **HealthKit**
6. The capability will be added automatically

### 6. Configure Signing

1. In **Signing & Capabilities**:
   - Select your Team (or create a free Personal Team)
   - Ensure **Automatically manage signing** is checked
   - Xcode will provision your app automatically

## Running on Your iPhone

### Development Build (Free - No Apple Developer Account)

1. Connect your iPhone via USB
2. Select your iPhone as the target device in Xcode
3. Click the Play button (▶️) or press Cmd+R
4. **First time only**: On your iPhone, go to **Settings → General → VPN & Device Management**
5. Trust your developer certificate
6. Launch the app!

**Note**: Development builds expire after 7 days and need to be re-installed.

## Testing

### First Launch Flow

1. App opens to Sign-In screen
2. Tap "Sign in with Google"
3. Authenticate with your Google account (joyce.yan.zhang@gmail.com or sheridan.gray@gmail.com)
4. After sign-in, tap "Grant Access" for HealthKit
5. Select the health data types you want to share
6. You'll see your health metrics
7. Tap "Sync Now" to send data to backend
8. Check the web dashboard at `sheridangray.com/dashboard/health`

### Testing Offline Sync

1. Close the app
2. Reopen it - you should automatically be signed in (session restored from Keychain)
3. Your health data should still be visible

### Sign Out

1. Tap the logout icon (→) in the top right
2. You'll return to the sign-in screen
3. Session is cleared from Keychain

## Switching Between Dev and Production

The app is configured for production by default (`https://sheridangray.com`).

To test with local backend:

**In `AuthenticationManager.swift` and `HealthKitManager.swift`**, change:
```swift
private let backendURL = "https://sheridangray.com"
```
to:
```swift
private let backendURL = "http://localhost:3000"
```

**Important**: iOS Simulator cannot access `localhost` from Mac. Use your Mac's local IP:
```swift
private let backendURL = "http://192.168.1.XXX:3000"  // Replace with your Mac's IP
```

Find your Mac's IP: **System Settings → Network → Wi-Fi → Details → TCP/IP**

## Troubleshooting

### Google Sign-In Not Working

- Verify `GIDClientID` in Info.plist matches your Google OAuth client
- Check the URL scheme is correct
- Make sure you're using an allowed email address

### HealthKit Permission Denied

- Go to **Settings → Health → Data Access & Devices → FamilyEventPlanner**
- Enable the health categories you want to share

### "Cannot connect to server"

- If using localhost, make sure your Mac and iPhone are on the same Wi-Fi network
- Use your Mac's IP address instead of `localhost`
- Verify the backend is running (`npm run dev`)

### Session Not Persisting

- Check Keychain entitlements are enabled
- Try signing out and back in
- Delete and reinstall the app

### HealthKit Data is Zero

- Make sure you have health data for today in the Apple Health app
- Grant all requested permissions
- Try syncing after taking some steps

## Architecture

```
┌─────────────────┐
│   iOS App       │
│  (SwiftUI)      │
└────────┬────────┘
         │
    ┌────▼────────────────────┐
    │  Google Sign-In SDK     │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │  Backend API            │
    │  /api/auth/mobile-signin│
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │  JWT Token (30 days)    │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │  Keychain Storage       │
    └─────────────────────────┘
         │
    ┌────▼────────────────────┐
    │  HealthKit Data Read    │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │  /api/health/sync       │
    │  (with Bearer token)    │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │  PostgreSQL Database    │
    └─────────────────────────┘
```

## Next Steps

See [IOS_APP_DEPLOYMENT.md](../docs/IOS_APP_DEPLOYMENT.md) for:
- TestFlight beta deployment
- App Store submission
- Background sync implementation
- Additional features

## Support

For issues or questions:
1. Check the backend logs for API errors
2. Check Xcode console for iOS errors
3. Verify your email is in the `ALLOWED_EMAILS` environment variable
4. Test the backend endpoints with curl first


