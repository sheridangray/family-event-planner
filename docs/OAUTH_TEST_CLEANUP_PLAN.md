# OAuth Test Cleanup Plan

## Overview

With the new unified OAuth architecture, several legacy tests need to be updated or removed. This document outlines the necessary changes to maintain our enterprise testing framework.

## Tests Requiring Updates/Removal

### 🚨 **HIGH PRIORITY - Tests That Will Fail** 

#### 1. **`test/integration/calendar-conflicts.test.js`**
- **Issue**: Imports `CalendarConflictChecker` from old `gmail.js` - **REMOVED**
- **Status**: ❌ **BREAKING** - Will fail immediately  
- **Action**: Update to use unified `GmailClient.checkCalendarConflicts()`

#### 2. **`test/integration/external-services/mcp-services.test.js`**
- **Issue**: Imports old `GmailMCPClient` and tests old API methods
- **Status**: ❌ **BREAKING** - Tests deprecated methods
- **Action**: Update to use new unified client API

### ⚠️ **MEDIUM PRIORITY - Tests Using Deprecated Patterns**

#### 3. **`test/oauth-token-validation.test.js`**
- **Issue**: Manual OAuth2 client creation instead of using unified client
- **Status**: ⚠️ **DEPRECATED** - Works but uses old patterns
- **Action**: Rewrite to use unified OAuth system

#### 4. **`test/debug-gmail-watch.test.js`**
- **Issue**: Manual OAuth setup instead of using database-first approach
- **Status**: ⚠️ **DEPRECATED** - Functional but inconsistent
- **Action**: Update to use unified client

### 📋 **LOW PRIORITY - Manual Tests to Update**

#### 5. **`test/manual/auth-google.js`**
- **Issue**: Uses old environment variable patterns (`MCP_GMAIL_CREDENTIALS`)
- **Status**: ⚠️ **WORKS** - But uses deprecated env vars
- **Action**: Update to use new env var structure

#### 6. **`test/manual/generate-auth-url.js`**
- **Issue**: Manual OAuth setup instead of unified client
- **Status**: ⚠️ **WORKS** - But inconsistent with new architecture
- **Action**: Replace with unified client example

#### 7. **`test/manual/process-auth-code.js`**
- **Issue**: Manual token processing instead of using database-first approach
- **Status**: ⚠️ **WORKS** - But bypasses unified system
- **Action**: Update to use new OAuth flow

### 🔧 **Calendar Integration Tests**

#### 8. **`test/integration/calendar/test-calendar-manager-oauth.js`**
- **Issue**: May use old OAuth patterns in calendar manager
- **Status**: ⚠️ **UNKNOWN** - Needs investigation
- **Action**: Update calendar manager integration

#### 9. **`test/integration/calendar/test-oauth-calendar-creation.js`**
- **Issue**: Direct OAuth usage instead of unified client
- **Status**: ⚠️ **DEPRECATED** - Should use unified calendar methods
- **Action**: Replace with unified client calendar operations

#### 10. **`test/integration/calendar/test-read-calendar.js`**
- **Issue**: Manual calendar access instead of unified client
- **Status**: ⚠️ **DEPRECATED** - Should use unified approach
- **Action**: Update to use unified client

## Implementation Priority

### **Phase 1: Critical Fixes (Immediate)**
1. ✅ Fix `calendar-conflicts.test.js` - Update CalendarConflictChecker import
2. ✅ Fix `mcp-services.test.js` - Update GmailMCPClient usage

### **Phase 2: Modernization (This Week)**
3. ✅ Update `oauth-token-validation.test.js` to use unified client
4. ✅ Update `debug-gmail-watch.test.js` to use unified client
5. ✅ Update calendar integration tests

### **Phase 3: Documentation Updates (Next Week)**
6. ✅ Update manual test scripts with new patterns
7. ✅ Create migration guide for developers
8. ✅ Update test documentation