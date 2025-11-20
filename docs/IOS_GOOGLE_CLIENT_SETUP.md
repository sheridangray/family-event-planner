# iOS Google Client ID Setup

## Backend Changes Complete ✅

The backend has been updated to accept Google Sign-In tokens from **both** web and iOS clients.

### What Changed

**File: `src/api/auth-mobile.js`**
- Token verification now accepts an array of client IDs
- Supports both `GOOGLE_CLIENT_ID` (web) and `GOOGLE_IOS_CLIENT_ID` (iOS)
- Backwards compatible - works even if iOS client ID is not set

## Next Steps

### 1. Create iOS OAuth Client ID in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **APIs & Services → Credentials**
4. Click **+ CREATE CREDENTIALS → OAuth client ID**
5. Select **Application type: iOS**
6. Fill in:
   - **Name**: `Family Event Planner iOS`
   - **Bundle ID**: `com.sheridangray.FamilyEventPlannerApp`
     - (Get this from Xcode: Target → General → Bundle Identifier)
7. Click **Create**
8. **Copy the iOS Client ID** (it will look like: `XXXXXX-YYYYYY.apps.googleusercontent.com`)

### 2. Add iOS Client ID to Backend

Add this line to your `.env` file (both local and production):

```bash
# Existing web client ID
GOOGLE_CLIENT_ID=584799141962-3mfn2p032ihqfkjhbu8v8jl8pcmp45ie.apps.googleusercontent.com

# NEW: iOS client ID
GOOGLE_IOS_CLIENT_ID=584799141962-cbnd0u748aup2m0da500o7d2hig4cqth.apps.googleusercontent.com
```

**For Production (Render.com):**
1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add new environment variable:
   - Key: `GOOGLE_IOS_CLIENT_ID`
   - Value: Your iOS client ID from Google Cloud Console
5. Save changes (this will redeploy your backend)

### 3. Update iOS App

In **Xcode**, update `AuthenticationManager.swift`:

```swift
// Around line 42, change:
let clientID = "584799141962-3mfn2p032ihqfkjhbu8v8jl8pcmp45ie.apps.googleusercontent.com"

// To your iOS client ID:
let clientID = "584799141962-cbnd0u748aup2m0da500o7d2hig4cqth.apps.googleusercontent.com"
```

### 4. Update Info.plist URL Scheme

In **Xcode**, update the URL scheme in Info.plist:

1. Open Info.plist as **Source Code**
2. Find the `CFBundleURLSchemes` section
3. Replace the URL scheme with the **reversed iOS client ID**

Your iOS client ID is:
```
584799141962-cbnd0u748aup2m0da500o7d2hig4cqth.apps.googleusercontent.com
```

The reversed scheme should be:
```
com.googleusercontent.apps.584799141962-cbnd0u748aup2m0da500o7d2hig4cqth
```

**Full Info.plist section:**
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.584799141962-cbnd0u748aup2m0da500o7d2hig4cqth</string>
        </array>
    </dict>
</array>
```

### 5. Test the Complete Flow

1. **Deploy backend** with new environment variable
2. **Clean build** in Xcode (Shift+Cmd+K)
3. **Delete app** from iPhone
4. **Build and run** from Xcode
5. **Tap "Sign in with Google"**
6. **Authenticate** with your Google account
7. **Success!** 🎉

## Troubleshooting

### "Invalid Google token" error
- Make sure `GOOGLE_IOS_CLIENT_ID` is set in production `.env`
- Verify the iOS client ID is correct (no extra spaces)
- Restart your backend after adding the environment variable

### "Custom scheme URIs are not allowed"
- You're still using the web client ID in `AuthenticationManager.swift`
- Update it to the iOS client ID

### "Couldn't sign in"
- Check that the URL scheme in Info.plist matches the reversed iOS client ID
- Make sure the bundle ID in Xcode matches what you used in Google Cloud Console

## Current Status

- ✅ Backend code updated to accept both client IDs
- ⏳ Need iOS client ID from Google Cloud Console
- ⏳ Need to add `GOOGLE_IOS_CLIENT_ID` to `.env` files
- ⏳ Need to update iOS app with new client ID
- ⏳ Need to update Info.plist URL scheme

Once you complete steps 1-4, you'll be able to sign in from your iPhone! 📱✨

