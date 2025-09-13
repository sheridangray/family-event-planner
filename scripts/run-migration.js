#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('🚀 Starting database migration...');
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_frontend_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration from:', migrationPath);

    // Execute the migration
    await pool.query('BEGIN;');
    await pool.query(migrationSQL);
    await pool.query('COMMIT;');

    console.log('✅ Migration completed successfully!');

    // Verify the new columns exist
    console.log('\n🔍 Verifying new columns...');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name IN ('time', 'location_name', 'location_distance')
      ORDER BY column_name;
    `);

    if (result.rows.length > 0) {
      console.log('✅ New columns added to events table:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }

    // Check if social proof table was created
    const socialProofCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'event_social_proof'
    `);

    if (socialProofCheck.rows.length > 0) {
      console.log('✅ event_social_proof table created successfully');
    }

    // Check family_members new columns
    const familyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'family_members' 
      AND column_name IN ('interests', 'special_needs', 'preferences')
      ORDER BY column_name;
    `);

    if (familyResult.rows.length > 0) {
      console.log('✅ New columns added to family_members table:');
      familyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.query('ROLLBACK;');
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Database migration completed!');
}

runMigration().catch(console.error);