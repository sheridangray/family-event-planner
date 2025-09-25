#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runFamilySettingsMigration() {
  // Determine which database to use
  const args = process.argv.slice(2);
  const isProduction = args.includes('--prod') || args.includes('--production');
  
  let connectionString;
  if (isProduction) {
    connectionString = "postgresql://family_events_user:LR0LGTrqkWoBzVGyqTUL5E56ZVliFGjY@dpg-d2ghchv5r7bs73f3coa0-a.oregon-postgres.render.com:5432/famil_events";
    console.log('🚀 Running migration on PRODUCTION database...');
  } else {
    connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
    console.log('🚀 Running migration on LOCAL database...');
  }
  
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '006_family_settings_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running family settings migration...');

    // Execute the migration in a transaction
    await pool.query('BEGIN;');
    await pool.query(migrationSQL);
    await pool.query('COMMIT;');

    console.log('✅ Migration completed successfully!');

    // Verify the new tables exist
    console.log('\n🔍 Verifying new tables...');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('family_settings', 'children', 'family_contacts')
      AND table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ New tables created:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Check family_settings contents
    console.log('\n⚙️ Family settings configured:');
    const settingsResult = await pool.query(`
      SELECT setting_key, setting_value, setting_type 
      FROM family_settings 
      ORDER BY setting_key
      LIMIT 10;
    `);
    
    settingsResult.rows.forEach(row => {
      console.log(`   - ${row.setting_key}: ${row.setting_value} (${row.setting_type})`);
    });
    
    if (settingsResult.rows.length >= 10) {
      console.log(`   ... and ${settingsResult.rowCount - 10} more settings`);
    }

    // Check children profiles  
    console.log('\n👶 Children profiles:');
    const childrenResult = await pool.query(`
      SELECT name, birth_date, interests, special_needs 
      FROM children 
      WHERE active = true
      ORDER BY birth_date;
    `);
    
    childrenResult.rows.forEach(row => {
      const age = Math.floor((Date.now() - new Date(row.birth_date)) / (365.25 * 24 * 60 * 60 * 1000));
      console.log(`   - ${row.name} (age ${age}): ${row.interests?.join(', ') || 'No interests listed'}`);
      if (row.special_needs) {
        console.log(`     Special needs: ${row.special_needs}`);
      }
    });

    // Check family contacts
    console.log('\n📞 Family contacts:');
    const contactsResult = await pool.query(`
      SELECT fc.contact_type, fc.name, fc.email, fc.phone, fc.is_primary,
             u.id as user_id
      FROM family_contacts fc
      LEFT JOIN users u ON fc.user_id = u.id
      ORDER BY fc.contact_type, fc.is_primary DESC;
    `);
    
    contactsResult.rows.forEach(row => {
      const primaryIndicator = row.is_primary ? ' (Primary)' : '';
      const userLink = row.user_id ? ` [Linked to User ${row.user_id}]` : '';
      console.log(`   - ${row.contact_type}: ${row.name}${primaryIndicator}${userLink}`);
      if (row.email) console.log(`     Email: ${row.email}`);
      if (row.phone) console.log(`     Phone: ${row.phone}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.query('ROLLBACK;');
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Family settings migration completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Update backend services to use family_settings table');
  console.log('   2. Create API endpoints for settings management');
  console.log('   3. Update frontend settings components');
  console.log('   4. Migrate weather API to use database settings');
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Family Settings Migration Tool');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/run-family-settings-migration.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --prod, --production    Run migration on production database');
  console.log('  --help, -h              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/run-family-settings-migration.js           # Run on local database');
  console.log('  node scripts/run-family-settings-migration.js --prod    # Run on production database');
  process.exit(0);
}

runFamilySettingsMigration().catch(console.error);