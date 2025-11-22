#!/usr/bin/env node

/**
 * Test Health Sync Endpoint
 * Tests that the health sync API endpoint works correctly after database setup
 */

require('dotenv').config();
const { Pool } = require('pg');

async function testHealthSync() {
  console.log('🧪 Testing Health Sync Setup...\n');
  
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  
  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // 1. Check if health tables exist
    console.log('\n1️⃣ Checking if health tables exist...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('health_profiles', 'health_physical_metrics', 'health_goals', 'health_sync_logs')
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 4) {
      console.log('✅ All health tables exist:');
      tablesResult.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    } else {
      console.log('❌ Missing health tables. Found:', tablesResult.rows.length, 'of 4');
      process.exit(1);
    }

    // 2. Check if users exist
    console.log('\n2️⃣ Checking for active users...');
    const usersResult = await pool.query('SELECT id, email, name, active FROM users WHERE active = true LIMIT 5');
    
    if (usersResult.rows.length === 0) {
      console.log('⚠️  No active users found. You may need to authenticate via the iOS app first.');
    } else {
      console.log(`✅ Found ${usersResult.rows.length} active user(s):`);
      usersResult.rows.forEach(user => {
        console.log(`   - ${user.email} (id: ${user.id})`);
      });
    }

    // 3. Check health profiles
    console.log('\n3️⃣ Checking health profiles...');
    const profilesResult = await pool.query(`
      SELECT hp.id, hp.user_id, u.email, hp.data_source, hp.active 
      FROM health_profiles hp
      JOIN users u ON hp.user_id = u.id
      WHERE hp.active = true
      LIMIT 5
    `);
    
    if (profilesResult.rows.length === 0) {
      console.log('⚠️  No health profiles found. They will be created automatically on first sync.');
    } else {
      console.log(`✅ Found ${profilesResult.rows.length} health profile(s):`);
      profilesResult.rows.forEach(profile => {
        console.log(`   - ${profile.email} (source: ${profile.data_source})`);
      });
    }

    // 4. Check health goals
    console.log('\n4️⃣ Checking health goals...');
    const goalsResult = await pool.query(`
      SELECT hg.id, hg.user_id, u.email, hg.goal_type, hg.target_value 
      FROM health_goals hg
      JOIN users u ON hg.user_id = u.id
      WHERE hg.active = true
      ORDER BY u.email, hg.goal_type
      LIMIT 15
    `);
    
    if (goalsResult.rows.length === 0) {
      console.log('⚠️  No health goals found. They will be created automatically on first sync.');
    } else {
      console.log(`✅ Found ${goalsResult.rows.length} health goal(s):`);
      let currentEmail = '';
      goalsResult.rows.forEach(goal => {
        if (goal.email !== currentEmail) {
          currentEmail = goal.email;
          console.log(`\n   ${goal.email}:`);
        }
        console.log(`     - ${goal.goal_type}: ${goal.target_value}`);
      });
    }

    // 5. Check recent syncs
    console.log('\n5️⃣ Checking recent sync logs...');
    const syncLogsResult = await pool.query(`
      SELECT sl.id, sl.user_id, u.email, sl.sync_date, sl.status, sl.source, sl.metrics_count
      FROM health_sync_logs sl
      JOIN users u ON sl.user_id = u.id
      ORDER BY sl.sync_date DESC
      LIMIT 5
    `);
    
    if (syncLogsResult.rows.length === 0) {
      console.log('ℹ️  No sync logs yet. Waiting for first health data sync.');
    } else {
      console.log(`✅ Found ${syncLogsResult.rows.length} recent sync(s):`);
      syncLogsResult.rows.forEach(log => {
        const status = log.status === 'success' ? '✓' : '✗';
        console.log(`   ${status} ${log.email} - ${log.source} - ${new Date(log.sync_date).toLocaleString()} (${log.metrics_count} metrics)`);
      });
    }

    // 6. Check health metrics data
    console.log('\n6️⃣ Checking health metrics data...');
    const metricsResult = await pool.query(`
      SELECT hm.id, hm.user_id, u.email, hm.metric_date, hm.steps, hm.exercise_minutes, hm.sleep_hours
      FROM health_physical_metrics hm
      JOIN users u ON hm.user_id = u.id
      ORDER BY hm.metric_date DESC
      LIMIT 5
    `);
    
    if (metricsResult.rows.length === 0) {
      console.log('ℹ️  No health metrics data yet. Sync from iOS app to populate.');
    } else {
      console.log(`✅ Found ${metricsResult.rows.length} metric record(s):`);
      metricsResult.rows.forEach(metric => {
        console.log(`   - ${metric.email} (${metric.metric_date}): ${metric.steps} steps, ${metric.exercise_minutes}min exercise, ${metric.sleep_hours}h sleep`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Health Sync Database Setup Complete!');
    console.log('='.repeat(60));
    console.log('\n📱 Next steps:');
    console.log('   1. Open the iOS app');
    console.log('   2. Navigate to Health Sync');
    console.log('   3. Tap "Sync Now"');
    console.log('   4. Check that sync completes successfully');
    console.log('\n📊 Then view your data at:');
    console.log('   - Web: https://your-frontend.com/dashboard/health');
    console.log('   - API: https://your-backend.com/api/health/today/:userId\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testHealthSync().catch(console.error);

