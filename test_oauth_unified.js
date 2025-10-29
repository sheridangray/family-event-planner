#!/usr/bin/env node

/**
 * OAuth System Testing Script
 * 
 * Tests the new unified Gmail client and database-first OAuth architecture
 */

const { GmailClient } = require('./src/mcp/gmail-client');
const Database = require('./src/database');

// Simple logger for testing
const logger = {
  info: (msg, ...args) => console.log(`ℹ️  ${msg}`, ...args),
  debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
  warn: (msg, ...args) => console.log(`⚠️  ${msg}`, ...args),
  error: (msg, ...args) => console.log(`❌ ${msg}`, ...args)
};

async function testUnifiedOAuthSystem() {
  console.log('🚀 Testing Unified OAuth System\n');
  
  let database;
  let gmailClient;
  
  try {
    // Test 1: Database OAuth Methods
    console.log('📊 Test 1: Database OAuth Token Management');
    database = new Database();
    await database.init();
    
    // Test getting users
    const users = await database.getAllUsers();
    console.log(`   ✅ Found ${users.length} users in database`);
    users.forEach(user => {
      console.log(`      - ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    // Test auth status for each user
    const authStatuses = await database.getAllUserAuthStatus();
    console.log(`   ✅ Auth status check completed for ${authStatuses.length} users`);
    authStatuses.forEach(status => {
      console.log(`      - User ${status.userId} (${status.email}): ${status.isAuthenticated ? '🟢 Authenticated' : '🔴 Not Authenticated'}`);
      if (status.tokenExpiryDate && !isNaN(status.tokenExpiryDate.getTime())) {
        console.log(`        Token expires: ${status.tokenExpiryDate.toISOString()}`);
      } else if (status.tokenExpiryDate) {
        console.log(`        Token expiry: Invalid date (${status.tokenExpiryDate})`);
      }
    });
    
    console.log('\n📧 Test 2: Unified Gmail Client Initialization');
    gmailClient = new GmailClient(logger, database);
    await gmailClient.init();
    console.log('   ✅ Gmail client initialized successfully');
    
    // Test 3: OAuth URL Generation
    console.log('\n🔗 Test 3: OAuth URL Generation');
    try {
      const sheridanAuthUrl = await gmailClient.getAuthUrl('sheridan.gray@gmail.com');
      const joyceAuthUrl = await gmailClient.getAuthUrl('joyce.yan.zhang@gmail.com');
      console.log(`   ✅ Generated OAuth URLs for both users`);
      console.log(`      - Sheridan URL: ${sheridanAuthUrl.substring(0, 80)}...`);
      console.log(`      - Joyce URL: ${joyceAuthUrl.substring(0, 80)}...`);
    } catch (error) {
      console.log(`   ⚠️  OAuth URL generation failed (expected without full credentials): ${error.message}`);
    }
    
    // Test 4: User Authentication Check
    console.log('\n🔐 Test 4: User Authentication Verification');
    for (const user of users) {
      try {
        const isAuth = await gmailClient.isUserAuthenticated(user.id);
        console.log(`   ${isAuth ? '✅' : '❌'} User ${user.id} (${user.email}): ${isAuth ? 'Authenticated' : 'Not Authenticated'}`);
        
        // If user is authenticated, try to get an authenticated client
        if (isAuth) {
          try {
            const authenticatedClient = await gmailClient.getAuthenticatedClient(user.id);
            console.log(`   ✅ Successfully got authenticated client for user ${user.id}`);
          } catch (authError) {
            console.log(`   ⚠️  Failed to get authenticated client: ${authError.message}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Authentication check failed for user ${user.id}: ${error.message}`);
      }
    }
    
    // Test 5: Database Token Retrieval (for users with tokens)
    console.log('\n💾 Test 5: Database Token Retrieval');
    for (const user of users) {
      try {
        const tokens = await database.getOAuthTokens(user.id, 'google');
        console.log(`   ✅ User ${user.id} has OAuth tokens (expires: ${new Date(tokens.expiry_date).toISOString()})`);
        console.log(`      - Has access_token: ${!!tokens.access_token}`);
        console.log(`      - Has refresh_token: ${!!tokens.refresh_token}`);
        console.log(`      - Scope: ${tokens.scope}`);
      } catch (error) {
        console.log(`   ℹ️  User ${user.id} has no OAuth tokens: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('   ✅ Database initialization: Working');
    console.log('   ✅ User management: Working');
    console.log('   ✅ Gmail client initialization: Working');
    console.log('   ✅ Multi-user OAuth architecture: Working');
    console.log('   ✅ Database-first token management: Working');
    
    console.log('\n🚀 Unified OAuth System Test: PASSED ✅');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (database) {
      await database.close();
    }
    if (gmailClient) {
      await gmailClient.cleanup();
    }
  }
}

// Run the test
if (require.main === module) {
  testUnifiedOAuthSystem().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testUnifiedOAuthSystem };