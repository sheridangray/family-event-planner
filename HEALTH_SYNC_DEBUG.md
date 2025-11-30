# 🔧 Health Sync Debug & Fix - November 23, 2025

## 🐛 Issues Identified

### 1. **Background Sync Not Sending Data**
   - Background task fetched data successfully
   - BUT never called `syncToBackend()`
   - No sync logs appeared in console

### 2. **Manual Sync Failing**
   - "Sync Now" button shows: "Error Sync failed: Failed to sync health data."
   - No request payload logs appear
   - Suggests failure happens **before** the network request

### 3. **Dietary Data Not Appearing**
   - User logs nutrition in MyFitnessPal
   - Expected to see dietary metrics from HealthKit
   - Getting "No data available" errors

---

## ✅ Fixes Implemented

### **Fix 1: Enhanced Auth Logging in `HealthKitManager.swift`**

Added detailed authentication logging **before** the guard statement:

```swift
func syncToBackend(authManager: AuthenticationManager, isBackgroundSync: Bool = false) async throws {
    // Add logging BEFORE the guard
    let syncType = isBackgroundSync ? "Background" : "Manual"
    print("🔐 \(syncType) sync - Checking authentication...")
    print("   - Has token: \(authManager.sessionToken != nil)")
    print("   - Has user: \(authManager.currentUser != nil)")
    print("   - User ID: \(authManager.currentUser?.id ?? 0)")
    
    guard let token = authManager.sessionToken,
          let userId = authManager.currentUser?.id else {
        print("❌ Authentication failed - cannot sync")
        throw HealthKitError.notAuthenticated
    }
    
    print("✅ Authenticated as user \(userId)")
    print("🔄 \(syncType) sync starting...")
```

**What this tells us:**
- Whether the session token exists
- Whether the current user is loaded
- The exact user ID
- If the sync fails auth, we'll see it immediately

---

### **Fix 2: Enhanced Background Task Auth Logging in `BackgroundTaskManager.swift`**

Added comprehensive auth validation logging:

```swift
// Detailed auth check logging
print("🔐 Background sync auth check:")
print("   - isAuthenticated: \(authManager.isAuthenticated)")
print("   - sessionToken exists: \(authManager.sessionToken != nil)")
print("   - currentUser exists: \(authManager.currentUser != nil)")
print("   - currentUser.id: \(authManager.currentUser?.id ?? 0)")
print("   - HealthKit isAuthorized: \(healthManager.isAuthorized)")

// Validate session is still active (token not expired)
let sessionValid = await authManager.validateSession()
guard sessionValid else {
    print("⚠️ Session expired - skipping background sync")
    task.setTaskCompleted(success: true)
    return
}

print("✅ Background sync auth passed")
```

**What this does:**
- Checks all auth preconditions
- **Validates the session token** with the backend
- Skips sync gracefully if token expired
- Provides clear success/failure indicators

---

### **Fix 3: Session Validation in `AuthenticationManager.swift`**

Added `validateSession()` method to check if token is still valid:

```swift
/// Validate that the current session token is still valid
func validateSession() async -> Bool {
    guard let token = sessionToken else {
        print("⚠️ No session token to validate")
        return false
    }
    
    guard currentUser != nil else {
        print("⚠️ No current user")
        return false
    }
    
    // Try a simple authenticated endpoint to validate token
    let url = URL(string: "\(backendURL)/api/user/profile")!
    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 10
    
    do {
        let (_, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse {
            let isValid = httpResponse.statusCode == 200
            print(isValid ? "✅ Session valid" : "❌ Session expired (HTTP \(httpResponse.statusCode))")
            return isValid
        }
    } catch {
        print("❌ Session validation error: \(error.localizedDescription)")
    }
    
    return false
}
```

**What this does:**
- Makes a lightweight API call to verify the token
- Returns `true` if token is valid (HTTP 200)
- Returns `false` if token expired (HTTP 401/403) or network error
- Prevents unnecessary sync attempts with expired tokens

---

## 🧪 Testing Instructions

### **Step 1: Manual Sync Test**

1. Open the app in Xcode
2. Go to Health page
3. Tap **"Sync Now"**
4. Check the Xcode console for logs

**Expected Logs:**

```
🔐 Manual sync - Checking authentication...
   - Has token: true
   - Has user: true
   - User ID: <your_user_id>
✅ Authenticated as user <your_user_id>
🔄 Manual sync starting...
📊 Fetching yesterday's health data...
...
🔄 Syncing to backend...
📤 Request payload: {...}
🌐 Sending request to: https://...
📥 Response status: 200
✅ Manual sync successful
```

**If Auth Fails:**

```
🔐 Manual sync - Checking authentication...
   - Has token: false
   - Has user: false
   - User ID: 0
❌ Authentication failed - cannot sync
```

**Action:** Sign out and back in to get a fresh token.

---

### **Step 2: Background Sync Test**

Background tasks are hard to test in real-time. To simulate:

1. Build and run the app
2. Close the app completely
3. Wait several hours (iOS decides when to run it)
4. Reopen app and go to: Settings → Developer → Background Tasks → Simulate Background Fetch for your app

**Expected Logs:**

```
🌙 Background health sync starting...
📅 Current time: <timestamp>
🔐 Background sync auth check:
   - isAuthenticated: true
   - sessionToken exists: true
   - currentUser exists: true
   - currentUser.id: <your_user_id>
   - HealthKit isAuthorized: true
✅ Session valid
✅ Background sync auth passed
🔄 Starting health data sync in background...
🔐 Background sync - Checking authentication...
   - Has token: true
   - Has user: true
   - User ID: <your_user_id>
✅ Authenticated as user <your_user_id>
🔄 Background sync starting...
...
✅ Background sync successful
```

**If Session Expired:**

```
🔐 Background sync auth check:
   - isAuthenticated: true
   - sessionToken exists: true
   - currentUser exists: true
   - currentUser.id: <your_user_id>
   - HealthKit isAuthorized: true
❌ Session expired (HTTP 401)
⚠️ Session expired - skipping background sync
```

---

## 🍎 MyFitnessPal Dietary Data Issue

### **Why It Might Not Work:**

1. **MyFitnessPal → Apple Health Sync Disabled**
   - Go to MyFitnessPal app → Settings → Health App
   - Make sure "Write Data" is enabled for nutrition categories

2. **Apple Health Doesn't Show Third-Party Nutrition**
   - Apple Health has limited support for third-party nutrition data
   - MyFitnessPal might only sync select metrics

3. **Data Source Priority**
   - Check Apple Health → Browse → Nutrition → (Specific Metric)
   - See if MyFitnessPal appears as a data source
   - If another app is prioritized, MFP data won't be read

4. **HealthKit Permissions**
   - Go to Settings → Health → Data Access & Devices → FamilyEventPlanner
   - Ensure all Nutrition metrics are enabled for READ access

### **How to Debug:**

1. Open Apple Health app
2. Go to Browse → Nutrition → Dietary Energy (Calories)
3. Scroll down to "Data Sources & Access"
4. Check if MyFitnessPal appears
5. Check if any data points show up

**If NO data appears in Apple Health:**
- The issue is MyFitnessPal → Apple Health sync
- Our app can't read data that isn't in HealthKit

**If data DOES appear in Apple Health but NOT in our app:**
- We have a permissions or query issue
- Check the HealthKit authorization logs

### **Alternative Solutions:**

1. **Direct MyFitnessPal API Integration** (requires API key)
2. **Manual CSV Import** from MyFitnessPal
3. **Use a different nutrition app** that syncs better with HealthKit (e.g., Lose It!, Cronometer)

---

## 📊 What Changed in Code

### Files Modified:

1. ✅ `ios/FamilyEventPlannerApp/FamilyEventPlannerApp/Health/HealthKitManager.swift`
   - Added detailed auth logging before sync
   - Shows token/user status clearly

2. ✅ `ios/FamilyEventPlannerApp/FamilyEventPlannerApp/Services/BackgroundTaskManager.swift`
   - Added comprehensive auth check logging
   - Added session validation before sync
   - Graceful handling of expired tokens

3. ✅ `ios/FamilyEventPlannerApp/FamilyEventPlannerApp/Authentication/AuthenticationManager.swift`
   - Added `validateSession()` method
   - Checks token validity with backend
   - Returns clear success/failure status

---

## 🚀 Next Steps

1. **Rebuild the app** in Xcode
2. **Run manual sync** and check console logs
3. **Identify the failure point:**
   - No token? → Sign out/in
   - Token expired? → Sign out/in
   - Network error? → Check backend logs on Render
4. **Check backend Render logs** for any incoming requests
5. **Investigate MyFitnessPal sync** separately after fixing main issue

---

## 🔍 Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Token Expired** | `❌ Session expired (HTTP 401)` | Sign out and back in |
| **No Current User** | `currentUser: nil` | Sign out and back in |
| **Backend Down** | Network timeout/500 errors | Check Render.com dashboard |
| **HealthKit Not Authorized** | `HealthKit isAuthorized: false` | Go to Settings → Integrations → Toggle HealthKit |
| **Background Task Not Running** | No logs after hours | iOS decides when to run; hard to force |

---

## 📝 Notes

- Background tasks are **opportunistic** - iOS decides when to run them (usually overnight when device is charging and idle)
- Session tokens have a **7-day expiration** (check your JWT configuration)
- Dietary data errors are **expected** if no nutrition is logged in HealthKit
- MyFitnessPal sync to HealthKit can be unreliable - consider alternatives

---

**Last Updated:** November 23, 2025  
**Status:** ✅ Fixes implemented, ready for testing

