#!/usr/bin/env node

/**
 * Test script to verify database-first configuration is working
 */

require('dotenv').config();
const Database = require('../src/database');
const FamilyConfigService = require('../src/services/family-config');

async function testConfig() {
  console.log('🧪 Testing Database-First Configuration');
  console.log('=' .repeat(50));

  const database = new Database();
  
  try {
    // Initialize database
    await database.init();
    console.log('✅ Database connection established');

    // Test family config service
    const familyConfig = new FamilyConfigService(database, console);
    
    // Test getting settings from database
    console.log('\n📋 Testing Family Settings from Database:');
    const settings = await familyConfig.getSettings();
    
    console.log('Database Settings:', {
      'weekday_earliest_time': settings.weekday_earliest_time,
      'weekend_nap_start': settings.weekend_nap_start,
      'max_cost_per_event': settings.max_cost_per_event,
      'min_advance_days': settings.min_advance_days,
      'max_distance_miles': settings.max_distance_miles
    });

    // Test getting full config
    console.log('\n⚙️  Testing Full Configuration:');
    const fullConfig = await familyConfig.getFamilyConfig();
    
    console.log('Full Config Structure:', {
      'schedule.weekdayEarliestTime': fullConfig.schedule.weekdayEarliestTime,
      'schedule.weekendNapStart': fullConfig.schedule.weekendNapStart,
      'preferences.maxCostPerEvent': fullConfig.preferences.maxCostPerEvent,
      'preferences.minAdvanceDays': fullConfig.preferences.minAdvanceDays,
      'location.maxDistanceMiles': fullConfig.location.maxDistanceMiles
    });

    // Test demographics
    console.log('\n👨‍👩‍👧‍👦 Testing Family Demographics:');
    const demographics = await familyConfig.getFamilyDemographics();
    
    console.log('Demographics:', {
      'children_count': demographics.children.length,
      'parents_count': demographics.parents.length,
      'child_ages': demographics.childAges,
      'age_range': `${demographics.minChildAge}-${demographics.maxChildAge}`
    });

    // Test individual setting
    console.log('\n🔍 Testing Individual Setting Lookup:');
    const maxCost = await familyConfig.getSetting('max_cost_per_event', 100);
    console.log(`Max Cost Per Event: $${maxCost}`);

    console.log('\n🎉 All tests passed! Database-first configuration is working.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await database.close();
  }
}

if (require.main === module) {
  testConfig().catch(console.error);
}