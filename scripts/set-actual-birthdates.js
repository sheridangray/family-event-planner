#!/usr/bin/env node
require('dotenv').config();

const Database = require('../src/database');
const FamilyDemographicsService = require('../src/services/family-demographics');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function setActualBirthdates() {
  const database = new Database();
  const familyService = new FamilyDemographicsService(logger, database);
  
  try {
    await database.init();
    logger.info('Database initialized');
    
    // Get current family members
    const familyMembers = await database.getFamilyMembers();
    
    if (familyMembers.length === 0) {
      logger.info('No family members found. Running initialization...');
      await familyService.initializeFamilyFromEnvironment();
      const newMembers = await database.getFamilyMembers();
      logger.info(`Initialized ${newMembers.length} family members from environment`);
    }
    
    // Get updated family members
    const allMembers = await database.getFamilyMembers();
    
    // Define actual birthdates
    const actualBirthdates = {
      'Sheridan Gray': '1984-12-23',    // You - born 12/23/1984
      'Joyce Zhang': '1987-02-24',      // Joyce - born 2/24/1987
      'Apollo Gray': '2021-04-26',      // Apollo - born 4/26/2021
      'Athena Gray': '2023-03-10'       // Athena - born 3/10/2023
    };
    
    logger.info('Updating family member birthdates...\n');
    
    for (const member of allMembers) {
      const actualBirthdate = actualBirthdates[member.name];
      
      if (actualBirthdate) {
        const oldAge = familyService.calculateAge(member.birthdate);
        const newAge = familyService.calculateAge(actualBirthdate);
        
        await database.updateFamilyMember(member.id, { birthdate: actualBirthdate });
        
        logger.info(`✅ Updated ${member.name} (${member.role})`);
        logger.info(`   Old: ${member.birthdate} (age ${oldAge})`);
        logger.info(`   New: ${actualBirthdate} (age ${newAge})\n`);
      } else {
        logger.info(`⚠️  No birthdate update for ${member.name} - please add manually if needed\n`);
      }
    }
    
    // Show final family demographics
    logger.info('=== Final Family Demographics ===');
    const demographics = await familyService.getFamilyDemographics();
    
    logger.info('\nParents:');
    demographics.parents.forEach(parent => {
      logger.info(`  ${parent.name}: ${parent.birthdate} (age ${parent.currentAge})`);
    });
    
    logger.info('\nChildren:');
    demographics.children.forEach(child => {
      logger.info(`  ${child.name}: ${child.birthdate} (age ${child.currentAge})`);
    });
    
    logger.info(`\nAge range for event filtering: ${demographics.minChildAge}-${demographics.maxChildAge} years old`);
    logger.info('✅ All birthdates updated successfully!');
    
  } catch (error) {
    logger.error('Error updating birthdates:', error.message);
  } finally {
    await database.close();
  }
}

setActualBirthdates();