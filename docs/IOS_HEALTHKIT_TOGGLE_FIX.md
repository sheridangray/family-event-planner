# HealthKit Toggle Real-Time Status Fix

## Problem Identified

The HealthKit toggle in Settings → Integrations was showing **cached state** instead of the **actual HealthKit permissions**.

### Symptoms:
- ✅ User grants HealthKit permissions → Toggle ON
- ❌ User revokes permissions in iOS Settings → Health → Data Access & Devices
- 🐛 Returns to app → **Toggle still shows ON** (incorrect)
- 🐛 Toggle doesn't reflect actual permission state

### Root Cause:

The `isAuthorized` property in `HealthKitManager` was only updated:
1. On app launch (in `init()`)
2. After calling `requestAuthorization()`

It **never checked** the actual HealthKit authorization status when:
- Viewing the Integrations page
- Returning from iOS Settings
- User manually revoked permissions

## Solution Implemented

### 1. Added Real-Time Status Check Function

**File: `HealthKitManager.swift`**

```swift
/// Check current authorization status for HealthKit
func checkCurrentAuthorizationStatus() {
    guard HKHealthStore.isHealthDataAvailable() else {
        Task { @MainActor in
            self.isAuthorized = false
        }
        return
    }
    
    let stepType = HKQuantityType(.stepCount)
    let status = healthStore.authorizationStatus(for: stepType)
    
    Task { @MainActor in
        let wasAuthorized = self.isAuthorized
        self.isAuthorized = (status == .sharingAuthorized)
        
        if wasAuthorized != self.isAuthorized {
            print("⚠️ HealthKit authorization status changed: \(self.isAuthorized)")
        }
    }
}
```

**What it does:**
- Queries HealthKit for **current** authorization status
- Updates `isAuthorized` based on **actual** permissions
- Logs when status changes
- Updates on main thread (safe for UI binding)

### 2. Added Auto-Check Triggers

**File: `IntegrationsView.swift`**

```swift
.onAppear {
    // Check actual HealthKit status when view appears
    healthManager.checkCurrentAuthorizationStatus()
}
.onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
    // Re-check when returning from iOS Settings
    healthManager.checkCurrentAuthorizationStatus()
}
```

**Triggers status check:**
1. **`.onAppear`** - When user navigates to Integrations page
2. **`.onReceive(willEnterForeground)`** - When app returns from background (e.g., after visiting iOS Settings)

## How It Works Now

### Scenario 1: User Revokes Permissions

```
User Flow:
1. Integrations page → Toggle is ON
2. Tap toggle OFF → Opens iOS Settings
3. Go to Health → Data Access & Devices → FamilyEventPlanner
4. Tap "Turn Off All"
5. Return to app
   ↓
   App enters foreground
   ↓
   .onReceive fires
   ↓
   checkCurrentAuthorizationStatus() runs
   ↓
   Checks actual HealthKit permissions
   ↓
   Sees permissions revoked
   ↓
   Updates isAuthorized = false
   ↓
   ✅ Toggle automatically shows OFF
```

### Scenario 2: User Grants Permissions Elsewhere

```
User Flow:
1. Permissions revoked, toggle OFF
2. User opens iOS Settings directly
3. Goes to Health → FamilyEventPlanner
4. Turns permissions back ON
5. Returns to app
   ↓
   App enters foreground
   ↓
   .onReceive fires
   ↓
   checkCurrentAuthorizationStatus() runs
   ↓
   Sees permissions granted
   ↓
   Updates isAuthorized = true
   ↓
   ✅ Toggle automatically shows ON
```

### Scenario 3: Navigating to Integrations

```
User Flow:
1. User opens Settings → Integrations
   ↓
   .onAppear fires
   ↓
   checkCurrentAuthorizationStatus() runs
   ↓
   Checks current permissions
   ↓
   ✅ Toggle shows accurate state
```

## Technical Details

### Thread Safety

All UI updates happen on the main thread:
```swift
Task { @MainActor in
    self.isAuthorized = (status == .sharingAuthorized)
}
```

### Change Detection

Logs when authorization status changes:
```swift
if wasAuthorized != self.isAuthorized {
    print("⚠️ HealthKit authorization status changed: \(self.isAuthorized)")
}
```

This helps with debugging and understanding when permissions change.

### Authorization Status Values

HealthKit returns three possible values:
- `.notDetermined` - User hasn't been asked yet
- `.sharingDenied` - User explicitly denied access
- `.sharingAuthorized` - User granted access ✅

We only set `isAuthorized = true` for `.sharingAuthorized`.

## Testing

### Test 1: Revoke Permissions
1. Open app → Settings → Integrations
2. Verify toggle is ON
3. Open iOS Settings → Health → Data Access & Devices → FamilyEventPlanner
4. Tap "Turn Off All"
5. Return to app
6. ✅ **Toggle should now be OFF**

### Test 2: Grant Permissions
1. Open app → Settings → Integrations
2. Verify toggle is OFF
3. Open iOS Settings → Health → Data Access & Devices → FamilyEventPlanner
4. Tap "Turn On All"
5. Return to app
6. ✅ **Toggle should now be ON**

### Test 3: Page Navigation
1. Revoke all HealthKit permissions in iOS Settings
2. Open app (toggle will be cached as ON)
3. Navigate to Settings → Integrations
4. ✅ **Toggle should immediately show OFF** (onAppear checks)

### Test 4: Console Logging
Look for these logs in Xcode console:
```
⚠️ HealthKit authorization status changed: false  // Permissions revoked
⚠️ HealthKit authorization status changed: true   // Permissions granted
```

## Benefits

### Before Fix:
- ❌ Toggle showed cached state
- ❌ Could be ON when permissions revoked
- ❌ Confusing UX - toggle didn't match reality
- ❌ User had to restart app to see accurate state

### After Fix:
- ✅ Toggle shows real-time authorization status
- ✅ Automatically updates when returning from Settings
- ✅ Accurate state when navigating to page
- ✅ No app restart needed
- ✅ Better UX - toggle always matches reality

## Edge Cases Handled

### App in Background
When app is in background and user changes permissions, the state updates when app returns to foreground via `.willEnterForegroundNotification`.

### HealthKit Unavailable
If HealthKit is not available (rare edge case), sets `isAuthorized = false` safely.

### Partial Permissions
If user grants some permissions but not others, HealthKit returns the status for the checked type (Steps). This is the standard "any permission granted" check.

## Files Modified

```
ios/FamilyEventPlannerApp/FamilyEventPlannerApp/
├── Health/
│   └── HealthKitManager.swift           (Added checkCurrentAuthorizationStatus)
└── Views/
    └── IntegrationsView.swift           (Added .onAppear and .onReceive)
```

## Implementation Notes

### Why Check Steps Permission?

```swift
let stepType = HKQuantityType(.stepCount)
let status = healthStore.authorizationStatus(for: stepType)
```

We check Steps because:
- It's the most fundamental health metric we request
- If user grants any permissions, they'll grant Steps
- Single check is sufficient (all permissions requested together)
- Efficient - no need to check all 10 types

### Why Main Actor?

```swift
Task { @MainActor in
    self.isAuthorized = (status == .sharingAuthorized)
}
```

Because:
- `isAuthorized` is `@Published` and bound to UI
- SwiftUI requires UI updates on main thread
- Prevents race conditions
- Ensures smooth toggle animation

## Future Enhancements

Possible improvements:
- [ ] Check individual permission status for each metric
- [ ] Show granular permission state (e.g., "5 of 10 granted")
- [ ] Add refresh button to manually check status
- [ ] Cache check results to prevent excessive queries
- [ ] Add haptic feedback when status changes

## Related Issues Fixed

This fix also resolves:
- Toggle not updating after fresh permissions grant
- Toggle not reflecting manual iOS Settings changes
- Inconsistent state between app and iOS
- Need to restart app to see permission changes

