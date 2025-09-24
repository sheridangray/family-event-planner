#!/usr/bin/env node

/**
 * Test script for multi-user OAuth system
 * This script verifies that the multi-user OAuth architecture works correctly
 */

const { Pool } = require('pg');

async function testMultiUserOAuth() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('🚀 Testing Multi-User OAuth System...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test 1: Verify users table and data
    console.log('\n🔍 Test 1: Checking users table...');
    const usersResult = await pool.query('SELECT id, email, name, role, active FROM users ORDER BY id');
    console.log('👥 Users in database:');
    if (usersResult.rows.length > 0) {
      usersResult.rows.forEach(row => {
        console.log(`   - ID: ${row.id}, Email: ${row.email}, Name: ${row.name}, Role: ${row.role}, Active: ${row.active}`);
      });
    } else {
      console.log('   No users found');
    }

    // Test 2: Verify oauth_tokens table structure and data
    console.log('\n🔍 Test 2: Checking oauth_tokens table...');
    const tokensResult = await pool.query(`
      SELECT ot.user_id, u.email, ot.provider, 
             LENGTH(ot.access_token) as access_token_length,
             LENGTH(ot.refresh_token) as refresh_token_length,
             ot.token_type, ot.expiry_date, ot.created_at, ot.updated_at
      FROM oauth_tokens ot
      JOIN users u ON ot.user_id = u.id
      ORDER BY ot.user_id
    `);

    console.log('🔐 OAuth tokens in database:');
    if (tokensResult.rows.length > 0) {
      tokensResult.rows.forEach(row => {
        const expiryDate = new Date(row.expiry_date);
        const isExpired = Date.now() >= row.expiry_date;
        console.log(`   - User: ${row.user_id} (${row.email})`);
        console.log(`     Provider: ${row.provider}`);
        console.log(`     Access Token: ${row.access_token_length} chars`);
        console.log(`     Refresh Token: ${row.refresh_token_length} chars`);
        console.log(`     Token Type: ${row.token_type}`);
        console.log(`     Expires: ${expiryDate.toLocaleString()} (${isExpired ? 'EXPIRED' : 'Valid'})`);
        console.log(`     Created: ${row.created_at}`);
        console.log(`     Updated: ${row.updated_at}`);
        console.log('');
      });
    } else {
      console.log('   No OAuth tokens found');
    }

    // Test 3: Test multi-user singleton functionality
    console.log('\n🔍 Test 3: Testing multi-user singleton...');
    
    const logger = {
      info: (msg) => console.log(`   📝 ${msg}`),
      error: (msg) => console.log(`   ❌ ${msg}`),
      warn: (msg) => console.log(`   ⚠️ ${msg}`),
      debug: () => {} // Silent debug
    };

    try {
      const { getAllUserAuthStatus, getUserIdByEmail, isUserAuthenticated } = require('./src/mcp/gmail-multi-user-singleton');
      
      // Test getting all user auth status
      console.log('   Testing getAllUserAuthStatus...');
      const authStatuses = await getAllUserAuthStatus();
      console.log(`   📊 Found ${authStatuses.length} users:`);
      authStatuses.forEach(status => {
        console.log(`      - ${status.email} (ID: ${status.userId}): ${status.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
        if (status.tokenExpiryDate) {
          console.log(`        Token expires: ${status.tokenExpiryDate.toLocaleString()}`);
        }
      });

      // Test getUserIdByEmail
      console.log('\n   Testing getUserIdByEmail...');
      const testEmails = ['sheridan.gray@gmail.com', 'joyce.yan.zhang@gmail.com', 'nonexistent@example.com'];
      for (const email of testEmails) {
        const userId = await getUserIdByEmail(email);
        console.log(`      - ${email}: ${userId ? `User ID ${userId}` : 'Not found'}`);
      }

      // Test isUserAuthenticated
      console.log('\n   Testing isUserAuthenticated...');
      for (const status of authStatuses) {
        const isAuth = await isUserAuthenticated(status.userId);
        console.log(`      - User ${status.userId}: ${isAuth ? '✅ Authenticated' : '❌ Not Authenticated'}`);
      }

      console.log('\n✅ Multi-user singleton tests completed successfully!');

    } catch (singletonError) {
      console.error('❌ Multi-user singleton test failed:', singletonError.message);
    }

    // Test 4: Test backwards compatibility
    console.log('\n🔍 Test 4: Testing backwards compatibility...');
    try {
      const { getGmailClient } = require('./src/mcp/gmail-multi-user-singleton');
      
      // Test single-user mode (backwards compatible)
      console.log('   Testing single-user mode...');
      const singleUserClient = await getGmailClient(logger);
      console.log(`   ✅ Single-user client initialized: ${!!singleUserClient}`);
      
      // Test multi-user mode
      console.log('   Testing multi-user mode...');
      if (usersResult.rows.length > 0) {
        const firstUserId = usersResult.rows[0].id;
        const multiUserClient = await getGmailClient(firstUserId, logger);
        console.log(`   ✅ Multi-user client initialized for user ${firstUserId}: ${!!multiUserClient}`);
      }

      console.log('\n✅ Backwards compatibility tests completed successfully!');

    } catch (compatError) {
      console.error('❌ Backwards compatibility test failed:', compatError.message);
    }

    // Test 5: Test audit log
    console.log('\n🔍 Test 5: Checking audit log...');
    const auditResult = await pool.query(`
      SELECT oa.user_id, u.email, oa.action, oa.provider, oa.success, 
             oa.error_message, oa.created_at
      FROM oauth_audit_log oa
      JOIN users u ON oa.user_id = u.id
      ORDER BY oa.created_at DESC
      LIMIT 10
    `);

    console.log('📋 Recent OAuth audit log entries:');
    if (auditResult.rows.length > 0) {
      auditResult.rows.forEach(row => {
        const status = row.success ? '✅' : '❌';
        console.log(`   ${status} ${row.created_at.toLocaleString()}: ${row.action} for ${row.email} (${row.provider})`);
        if (row.error_message) {
          console.log(`       Error: ${row.error_message}`);
        }
      });
    } else {
      console.log('   No audit log entries found');
    }

    console.log('\n🎉 Multi-User OAuth System Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   • Users: ${usersResult.rows.length}`);
    console.log(`   • OAuth tokens: ${tokensResult.rows.length}`);
    console.log(`   • Audit entries: ${auditResult.rows.length}`);
    
    const authenticatedUsers = tokensResult.rows.filter(row => Date.now() < row.expiry_date);
    console.log(`   • Authenticated users: ${authenticatedUsers.length}/${tokensResult.rows.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testMultiUserOAuth().catch(console.error);