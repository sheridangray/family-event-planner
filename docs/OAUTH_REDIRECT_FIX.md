# OAuth Redirect URI Fix

## Problem
OAuth callback was redirecting to backend (`family-event-planner-backend.onrender.com`) instead of frontend (`sheridangray.com`), preventing the authorization code from reaching the frontend.

## Solution Applied

### 1. Added FRONTEND_URL Environment Variable
**File**: `render.yaml`
```yaml
- key: FRONTEND_URL
  value: https://sheridangray.com
```

This ensures the `GmailClient` uses the correct redirect URI when generating OAuth URLs.

### 2. Required: Update Google Cloud Console

You **MUST** also add the frontend redirect URI to your Google OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID: `584799141962-3mfn2p032ihqfkjhbu8v8jl8pcmp45ie.apps.googleusercontent.com`
4. Under **Authorized redirect URIs**, add:
   ```
   https://sheridangray.com/auth/oauth-callback
   ```
5. Click **Save**

### Current Redirect URIs (Check These)
Your OAuth client should have these redirect URIs:
- ✅ `https://sheridangray.com/auth/oauth-callback` (FRONTEND - for OAuth flow)
- ⚠️ `https://family-event-planner-backend.onrender.com/api/admin/oauth-callback` (BACKEND - legacy, can keep for fallback)

## How It Works Now

### Before (Broken)
```
1. User clicks "Authenticate"
2. Backend generates OAuth URL with redirect: backend.onrender.com/api/admin/oauth-callback
3. User authenticates with Google
4. Google redirects to backend
5. Backend sends postMessage to parent window
6. ❌ Message blocked (cross-origin: backend → frontend)
7. Frontend never receives code
8. OAuth completion never called
```

### After (Fixed)
```
1. User clicks "Authenticate"
2. Backend generates OAuth URL with redirect: sheridangray.com/auth/oauth-callback
3. User authenticates with Google  
4. Google redirects to frontend
5. Frontend page sends postMessage to parent window
6. ✅ Message received (same origin)
7. Frontend calls completeMcpAuth with code
8. Backend saves tokens to database
9. Status updates to "Authenticated" ✅
```

## Testing After Fix

1. **Deploy the updated render.yaml** (commit and push)
2. **Manually set FRONTEND_URL in Render Dashboard**:
   - Go to Render Dashboard → Backend Service → Environment
   - Add: `FRONTEND_URL=https://sheridangray.com`
   - This takes effect immediately without redeployment

3. **Update Google Cloud Console** (see instructions above)

4. **Test the OAuth flow**:
   - Navigate to https://sheridangray.com/dashboard/settings
   - Open browser console (F12)
   - Click "Authenticate"
   - You should see:
     ```
     [OAuth] Starting authentication flow for: sheridan.gray@gmail.com
     [OAuth] Requesting auth URL from backend...
     [OAuth] Opening authentication popup...
     [OAuth] ✅ Received OAuth code from popup
     [OAuth Complete] Sending completion request to backend...
     [OAuth Complete] ✅ Backend response: {success: true, ...}
     [OAuth Status] Fetching authentication status...
     [OAuth Complete] ✅ Status refresh complete
     ```

5. **Verify the redirect**:
   - When popup opens, check the URL shown after Google authentication
   - Should redirect to: `https://sheridangray.com/auth/oauth-callback?code=...`
   - NOT: `https://family-event-planner-backend.onrender.com/api/admin/oauth-callback?code=...`

## Immediate Action Required

Since `render.yaml` changes only apply on next deployment, you need to:

**Option A: Manual Environment Variable (Fastest)**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your backend service: `family-event-planner-backend`
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add: `FRONTEND_URL` = `https://sheridangray.com`
6. Changes take effect in ~30 seconds (no redeploy needed)

**Option B: Redeploy (Slower)**
1. Commit and push the render.yaml changes
2. Trigger manual deploy in Render Dashboard
3. Wait ~5 minutes for deployment

**Recommended**: Do Option A now for immediate fix, then commit changes for future deployments.

## Verification

After setting the environment variable, you can verify it's working by checking the backend logs when you click "Authenticate". You should see:

```
info: 🔗 Using OAuth redirect URI: https://sheridangray.com/auth/oauth-callback
```

Instead of the backend URL.
