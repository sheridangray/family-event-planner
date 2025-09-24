# Google OAuth Token Management Architecture

## Overview

This document describes the comprehensive Google OAuth integration architecture for the Family Event Planner, focusing on the singleton pattern implementation that solves token sharing and persistence challenges in production.

## Problem Statement

### Original Issues
1. **Multiple GmailMCPClient Instances**: Different parts of the application created separate instances, leading to token isolation
2. **Token Persistence Failures**: Render's read-only filesystem prevented traditional file-based token storage
3. **Webhook Handler Authentication**: Gmail webhook handlers couldn't access tokens from other instances
4. **Production Constraints**: Environment variables are immutable at runtime on Render platform

### Root Cause Analysis
- **Instance Isolation**: Admin panel, webhook handlers, health checks, and application services all created separate GmailMCPClient instances
- **Token Storage Limitations**: Production environment (Render) has read-only filesystem, making file-based token persistence impossible
- **State Management Gap**: No centralized token management system across distributed service components

## Solution: Singleton Pattern + Multi-Strategy Token Persistence

### Architecture Components

#### 1. Gmail Singleton Manager (`src/mcp/gmail-singleton.js`)

**Purpose**: Ensures exactly ONE GmailMCPClient instance exists across the entire application.

**Key Features**:
- Thread-safe initialization with promise-based locking
- Automatic instance refresh after token updates
- Authentication status monitoring
- Memory-efficient single instance management

**API Methods**:
```javascript
// Primary interface
const gmailClient = await getGmailClient(logger);

// Token management
await updateGmailTokens(tokens, logger);
await refreshGmailClient(logger);

// Status checking
const isAuth = isGmailAuthenticated();
const status = getGmailAuthStatus();
```

#### 2. Multi-Strategy Token Persistence

**Strategy 1: Local Development Files**
```javascript
// Path: /src/credentials/google-oauth-token.json
// Used: Development environment only
// Benefit: Traditional file-based storage for local dev
```

**Strategy 2: Runtime Environment Variable**
```javascript
process.env.GOOGLE_OAUTH_TOKEN = JSON.stringify(tokens);
// Used: Both development and production
// Benefit: Immediate availability across all processes
// Limitation: Lost on service restart
```

**Strategy 3: Render Secret Files**
```javascript
// Path: /etc/secrets/google-oauth-token.json
// Used: Production only (if writable)
// Benefit: Persistent storage on Render
// Limitation: Render filesystem constraints
```

**Strategy 4: Manual Environment Variable Update**
```javascript
// Logs complete token JSON for manual Render env var update
// Used: Production fallback
// Benefit: Permanent persistence across deployments
// Process: Copy logged token to Render dashboard env vars
```

## Implementation Guide

### 1. Singleton Integration

**Replace all direct GmailMCPClient instantiations with singleton calls:**

```javascript
// OLD (Multiple Instances)
const gmailClient = new GmailMCPClient(logger);
await gmailClient.init();

// NEW (Singleton Pattern)
const { getGmailClient } = require('../mcp/gmail-singleton');
const gmailClient = await getGmailClient(logger);
```

### 2. OAuth Flow Integration

**Admin Panel Authentication:**
```javascript
// Complete OAuth flow
const gmailClient = await getGmailClient(logger);
const result = await gmailClient.completeAuth(email, authCode);

// Refresh singleton to distribute new tokens
await refreshGmailClient(logger);
```

### 3. Token Persistence Workflow

**Development Environment:**
1. Tokens saved to local file: `/src/credentials/google-oauth-token.json`
2. Runtime environment variable updated: `process.env.GOOGLE_OAUTH_TOKEN`
3. All singleton instances automatically use updated tokens

**Production Environment:**
1. Runtime environment variable updated: `process.env.GOOGLE_OAUTH_TOKEN`
2. Attempt to save to Render secrets (usually fails due to read-only filesystem)
3. **Critical**: Complete token JSON logged for manual environment variable update
4. Admin must copy logged token to Render dashboard environment variables

## Configuration Requirements

### Environment Variables

```bash
# Required for OAuth flow
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Token storage (will be updated automatically after authentication)
GOOGLE_OAUTH_TOKEN={"access_token":"...","refresh_token":"...","scope":"...","token_type":"Bearer","expiry_date":1234567890}
```

### Google Cloud Console Setup

1. **OAuth 2.0 Client ID Configuration**:
   - Authorized redirect URIs: `http://localhost` (for CLI-style auth)
   - Application type: Web application

2. **API Scopes Required**:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly` 
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

3. **Webhook Setup** (for Gmail notifications):
   - Pub/Sub topic configured
   - Push subscription to your webhook endpoint
   - Domain verification completed

## Production Deployment Process

### Initial Setup
1. Deploy application with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Application starts without `GOOGLE_OAUTH_TOKEN` (shows warnings)
3. Use admin panel to complete OAuth flow
4. Monitor logs for token JSON output
5. Copy complete token JSON to Render environment variable `GOOGLE_OAUTH_TOKEN`
6. Restart application (or wait for automatic token pickup)

### Token Refresh Process
1. Refresh tokens are automatically used when access tokens expire
2. Updated tokens are saved using multi-strategy approach
3. For permanent persistence, monitor logs and update Render env vars with new tokens

## Monitoring and Troubleshooting

### Health Check Integration

```javascript
const { isGmailAuthenticated, getGmailAuthStatus } = require('./mcp/gmail-singleton');

// Simple authentication check
if (!isGmailAuthenticated()) {
  console.log('Gmail authentication required');
}

// Detailed status
const status = getGmailAuthStatus();
console.log('Auth Status:', {
  authenticated: status.authenticated,
  hasAccessToken: status.hasAccessToken,
  hasRefreshToken: status.hasRefreshToken,
  accessTokenExpired: status.accessTokenExpired,
  expiryDate: status.expiryDate,
  scopes: status.scopes
});
```

### Common Issues and Solutions

**Issue**: "No access, refresh token, API key or refresh handler callback is set"
**Solution**: Indicates singleton instance is not authenticated. Check:
1. `GOOGLE_OAUTH_TOKEN` environment variable exists and is valid JSON
2. Complete OAuth flow through admin panel
3. Ensure token refresh after authentication

**Issue**: "Could not save to production path (expected if not writable)"
**Solution**: This warning is expected on Render. The important part is:
1. Runtime environment variable should be updated successfully
2. Token JSON should be logged for manual env var update

**Issue**: Multiple authentication errors across services
**Solution**: All services should use singleton pattern. Check that:
1. No direct `new GmailMCPClient()` instantiations remain
2. All services use `getGmailClient(logger)` instead
3. Singleton is refreshed after token updates

## Best Practices

### 1. Consistent Singleton Usage
- Always use `getGmailClient(logger)` instead of direct instantiation
- Pass logger instance for consistent logging
- Use `refreshGmailClient(logger)` after token updates

### 2. Error Handling
- Handle authentication failures gracefully
- Implement retry logic for token refresh failures
- Monitor authentication status in health checks

### 3. Token Security
- Never log complete tokens in production (except for manual env var updates)
- Store tokens as environment variables only
- Rotate tokens regularly through OAuth flow

### 4. Development Workflow
- Use local file storage for development convenience
- Test OAuth flow regularly to ensure it works
- Verify singleton behavior with health checks

## Migration Checklist

### Phase 1: Singleton Implementation
- [ ] Create `src/mcp/gmail-singleton.js`
- [ ] Update `saveTokens` method with multi-strategy persistence
- [ ] Update admin OAuth completion to use singleton

### Phase 2: Service Integration
- [ ] Replace all `new GmailMCPClient()` with `getGmailClient()`
- [ ] Update webhook handlers to use singleton
- [ ] Update health checks to use singleton authentication status
- [ ] Update notification services to use singleton

### Phase 3: Production Deployment
- [ ] Deploy singleton changes
- [ ] Complete OAuth flow through admin panel
- [ ] Copy token JSON from logs to Render environment variables
- [ ] Verify all services are authenticated
- [ ] Test email notifications and webhook handling

### Phase 4: Validation
- [ ] Confirm single Gmail client instance across all services
- [ ] Verify token persistence across service restarts
- [ ] Test token refresh functionality
- [ ] Validate webhook handler authentication
- [ ] Monitor health check authentication status

## Environment Variable Management

### GOOGLE_OAUTH_TOKEN Consistency

**Recommendation**: Always maintain the `GOOGLE_OAUTH_TOKEN` environment variable.

**When to delete**: Only during initial setup or when forcing complete re-authentication.

**When to update**: After every OAuth completion to ensure persistence across deployments.

**Format**:
```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0G...",
  "scope": "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
  "token_type": "Bearer",
  "expiry_date": 1234567890123
}
```

This architecture ensures reliable, scalable Google OAuth integration that works consistently across development and production environments while handling the unique constraints of the Render platform.