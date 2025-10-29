#!/usr/bin/env node

/**
 * Test script to verify email migration from environment variables to database
 */

require('dotenv').config();
const Database = require('../src/database');
const FamilyEmailService = require('../src/services/family-email-service');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

async function testEmailMigration() {
  console.log('🧪 Testing Email Migration from Environment Variables to Database\n');
  
  // Logger is already defined above
  const database = new Database();
  
  try {
    // Initialize database
    console.log('📊 Initializing database...');
    await database.init();
    console.log('✅ Database initialized\n');
    
    // Initialize family email service
    console.log('📧 Initializing family email service...');
    const familyEmailService = new FamilyEmailService(database, logger);
    console.log('✅ Family email service initialized\n');
    
    // Test 1: Check if we have parent emails in database
    console.log('🔍 Test 1: Checking parent emails in database...');
    const parentEmails = await familyEmailService.getParentEmails();
    
    console.log(`   Parent 1 Email: ${parentEmails.parent1Email || 'Not found'}`);
    console.log(`   Parent 2 Email: ${parentEmails.parent2Email || 'Not found'}`);
    console.log(`   Total Parents: ${parentEmails.allParents.length}`);
    
    if (parentEmails.allParents.length > 0) {
      console.log('   Parent Details:');
      parentEmails.allParents.forEach((parent, index) => {
        console.log(`     ${index + 1}. ${parent.name} (${parent.email})`);
      });
    }
    console.log('✅ Database email check complete\n');
    
    // Test 2: Test fallback to environment variables
    console.log('🔄 Test 2: Testing fallback to environment variables...');
    const fallbackEmails = await familyEmailService.getParentEmailsWithFallback();
    
    console.log(`   Fallback Parent 1: ${fallbackEmails.parent1Email || 'Not found'}`);
    console.log(`   Fallback Parent 2: ${fallbackEmails.parent2Email || 'Not found'}`);
    console.log('✅ Fallback test complete\n');
    
    // Test 3: Test family member email detection
    console.log('👥 Test 3: Testing family member email detection...');
    
    if (parentEmails.parent1Email) {
      const isFamily1 = await familyEmailService.isFamilyMemberEmail(parentEmails.parent1Email);
      console.log(`   Is ${parentEmails.parent1Email} a family member? ${isFamily1 ? 'Yes' : 'No'}`);
    }
    
    if (parentEmails.parent2Email) {
      const isFamily2 = await familyEmailService.isFamilyMemberEmail(parentEmails.parent2Email);
      console.log(`   Is ${parentEmails.parent2Email} a family member? ${isFamily2 ? 'Yes' : 'No'}`);
    }
    
    // Test with non-family email
    const isNonFamily = await familyEmailService.isFamilyMemberEmail('test@example.com');
    console.log(`   Is test@example.com a family member? ${isNonFamily ? 'Yes' : 'No'}`);
    console.log('✅ Family member detection test complete\n');
    
    // Test 4: Test primary parent email
    console.log('👤 Test 4: Testing primary parent email...');
    const primaryEmail = await familyEmailService.getPrimaryParentEmail();
    console.log(`   Primary parent email: ${primaryEmail || 'Not found'}`);
    console.log('✅ Primary parent test complete\n');
    
    // Test 5: Test all parent emails
    console.log('📋 Test 5: Testing all parent emails...');
    const allEmails = await familyEmailService.getAllParentEmails();
    console.log(`   All parent emails: ${allEmails.join(', ') || 'None found'}`);
    console.log('✅ All parent emails test complete\n');
    
    // Summary
    console.log('📊 Migration Test Summary:');
    console.log('========================');
    
    if (parentEmails.parent1Email || parentEmails.parent2Email) {
      console.log('✅ SUCCESS: Parent emails found in database');
      console.log('   The migration is working correctly!');
      console.log('   You can safely remove PARENT1_EMAIL and PARENT2_EMAIL from environment variables.');
    } else if (fallbackEmails.parent1Email || fallbackEmails.parent2Email) {
      console.log('⚠️  WARNING: No parent emails in database, using environment variables');
      console.log('   You need to add parent emails to the database before removing environment variables.');
      console.log('   Add parent records to the family_members table with role="parent".');
    } else {
      console.log('❌ ERROR: No parent emails found in database or environment variables');
      console.log('   You need to either:');
      console.log('   1. Add parent emails to the database (family_members table), or');
      console.log('   2. Set PARENT1_EMAIL and PARENT2_EMAIL environment variables');
    }
    
    console.log('\n🎉 Email migration test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run the test
if (require.main === module) {
  testEmailMigration();
}

module.exports = { testEmailMigration };
