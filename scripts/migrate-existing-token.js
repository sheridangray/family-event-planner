#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrateExistingToken() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('🚀 Migrating existing OAuth token to database...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check which admin user to use (first admin user)
    const adminResult = await pool.query(
      "SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
      throw new Error('No admin user found. Please ensure users table has admin user.');
    }
    
    const adminUser = adminResult.rows[0];
    console.log(`👤 Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);

    let tokens = null;

    // Strategy 1: Try local token file first
    const localTokenPath = path.join(__dirname, '../credentials/google-oauth-token.json');
    if (fs.existsSync(localTokenPath)) {
      try {
        const tokenData = fs.readFileSync(localTokenPath, 'utf8');
        tokens = JSON.parse(tokenData);
        console.log('📁 Found local token file');
      } catch (error) {
        console.warn('⚠️ Error reading local token file:', error.message);
      }
    }

    // Strategy 2: Try environment variable if no local file
    if (!tokens && process.env.GOOGLE_OAUTH_TOKEN) {
      try {
        tokens = JSON.parse(process.env.GOOGLE_OAUTH_TOKEN);
        console.log('🌍 Found environment variable token');
      } catch (error) {
        console.warn('⚠️ Error parsing environment variable token:', error.message);
      }
    }

    if (!tokens) {
      console.log('❌ No existing OAuth tokens found to migrate');
      console.log('💡 Locations checked:');
      console.log(`   - Local file: ${localTokenPath} (exists: ${fs.existsSync(localTokenPath)})`);
      console.log(`   - Environment variable: GOOGLE_OAUTH_TOKEN (exists: ${!!process.env.GOOGLE_OAUTH_TOKEN})`);
      console.log('');
      console.log('🔧 To complete migration, you can either:');
      console.log('   1. Run OAuth flow through the admin panel');
      console.log('   2. Set GOOGLE_OAUTH_TOKEN environment variable');
      console.log('   3. Create local credentials/google-oauth-token.json file');
      return;
    }

    // Validate token structure
    if (!tokens.access_token || !tokens.refresh_token || !tokens.scope) {
      throw new Error('Invalid token structure. Missing required fields: access_token, refresh_token, or scope');
    }

    console.log('🔍 Token validation:');
    console.log(`   - Access token: ${tokens.access_token ? 'Present' : 'Missing'}`);
    console.log(`   - Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`);
    console.log(`   - Token type: ${tokens.token_type || 'Bearer'}`);
    console.log(`   - Scope: ${tokens.scope}`);
    console.log(`   - Expiry: ${tokens.expiry_date ? new Date(tokens.expiry_date) : 'No expiry set'}`);

    // Check if token already exists for this user
    const existingResult = await pool.query(
      'SELECT id FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
      [adminUser.id, 'google']
    );

    if (existingResult.rows.length > 0) {
      console.log('⚠️ OAuth token already exists for this user. Updating...');
    }

    // Insert or update token in database
    await pool.query(`
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_type, scope, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = NOW()
    `, [
      adminUser.id, 
      'google', 
      tokens.access_token, 
      tokens.refresh_token, 
      tokens.token_type || 'Bearer', 
      tokens.scope, 
      tokens.expiry_date || null
    ]);

    // Log audit trail
    await pool.query(`
      INSERT INTO oauth_audit_log (user_id, action, provider, success)
      VALUES ($1, $2, $3, $4)
    `, [adminUser.id, 'token_migrated', 'google', true]);

    console.log('✅ OAuth token successfully migrated to database!');

    // Verify the migration
    const verifyResult = await pool.query(
      'SELECT created_at, updated_at FROM oauth_tokens WHERE user_id = $1 AND provider = $2',
      [adminUser.id, 'google']
    );

    if (verifyResult.rows.length > 0) {
      const tokenRecord = verifyResult.rows[0];
      console.log('🔍 Migration verified:');
      console.log(`   - Database record created: ${tokenRecord.created_at}`);
      console.log(`   - Last updated: ${tokenRecord.updated_at}`);
    }

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('💡 Next steps:');
    console.log('   1. Test the multi-user OAuth system');
    console.log('   2. Update services to use getGmailClientForUser()');
    console.log('   3. Verify token refresh works correctly');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateExistingToken().catch(console.error);