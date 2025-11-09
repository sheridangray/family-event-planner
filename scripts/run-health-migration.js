#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runHealthMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('🏃 Starting health tables migration...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '008_create_health_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration from:', migrationPath);

    // Execute the migration
    await pool.query('BEGIN;');
    await pool.query(migrationSQL);
    await pool.query('COMMIT;');

    console.log('✅ Migration completed successfully!');

    // Verify the new tables exist
    console.log('\n🔍 Verifying health tables...');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('health_profiles', 'health_physical_metrics', 'health_goals', 'health_sync_logs')
      ORDER BY table_name;
    `);

    if (result.rows.length > 0) {
      console.log('✅ Health tables created:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Check how many health profiles were created
    const profilesCount = await pool.query('SELECT COUNT(*) FROM health_profiles');
    console.log(`✅ Created ${profilesCount.rows[0].count} health profile(s)`);

    // Check how many goals were created
    const goalsCount = await pool.query('SELECT COUNT(*) FROM health_goals');
    console.log(`✅ Created ${goalsCount.rows[0].count} default goal(s)`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    try {
      await pool.query('ROLLBACK;');
    } catch (rollbackError) {
      console.error('Failed to rollback:', rollbackError.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Health tables migration completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Restart your backend server');
  console.log('   2. Test the health sync API with curl');
  console.log('   3. Set up your iOS Shortcut');
}

runHealthMigration().catch(console.error);

