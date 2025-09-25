#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runOAuthMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('🚀 Starting OAuth multi-user migration...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '005_create_multi_user_oauth.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration from:', migrationPath);

    // Execute the migration
    await pool.query('BEGIN;');
    await pool.query(migrationSQL);
    await pool.query('COMMIT;');

    console.log('✅ Migration completed successfully!');

    // Verify the new tables exist
    console.log('\n🔍 Verifying new tables...');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('users', 'oauth_tokens', 'oauth_audit_log')
      AND table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ New tables created:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Check users table contents
    const usersResult = await pool.query('SELECT id, email, name, role FROM users ORDER BY id;');
    console.log('\n👥 Users in database:');
    if (usersResult.rows.length > 0) {
      usersResult.rows.forEach(row => {
        console.log(`   - ID: ${row.id}, Email: ${row.email}, Name: ${row.name}, Role: ${row.role}`);
      });
    } else {
      console.log('   No users found');
    }

    // Check oauth_tokens table structure
    const tokensColumnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'oauth_tokens'
      ORDER BY ordinal_position;
    `);

    console.log('\n🔐 oauth_tokens table structure:');
    if (tokensColumnsResult.rows.length > 0) {
      tokensColumnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.query('ROLLBACK;');
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 OAuth multi-user migration completed!');
}

runOAuthMigration().catch(console.error);