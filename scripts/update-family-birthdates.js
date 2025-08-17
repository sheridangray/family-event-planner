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

async function updateFamilyBirthdates() {
  const database = new Database();
  const familyService = new FamilyDemographicsService(logger, database);
  
  try {
    await database.init();
    logger.info('Database initialized');
    
    const familyMembers = await database.getFamilyMembers();
    
    if (familyMembers.length === 0) {
      logger.info('No family members found. Please run the main application first to initialize family data.');
      return;
    }
    
    logger.info(`Found ${familyMembers.length} family members:`);
    
    familyMembers.forEach(member => {
      const age = familyService.calculateAge(member.birthdate);
      logger.info(`  ${member.name} (${member.role}): ${member.birthdate} (age ${age})`);
    });
    
    logger.info('\nTo update birthdates, you can use the following examples:');
    logger.info('');
    
    const children = familyMembers.filter(m => m.role === 'child');
    if (children.length > 0) {
      logger.info('Example: Update child birthdate');
      logger.info(`await familyService.updateMemberBirthdate(${children[0].id}, '2020-03-15');`);
    }
    
    const parents = familyMembers.filter(m => m.role === 'parent');
    if (parents.length > 0) {
      logger.info('Example: Update parent birthdate');
      logger.info(`await familyService.updateMemberBirthdate(${parents[0].id}, '1985-07-22');`);
    }
    
    logger.info('\nNote: The system automatically migrated from environment variables using estimated birthdates.');
    logger.info('Please update with actual birthdates for accurate age calculations.');
    
  } catch (error) {
    logger.error('Error:', error.message);
  } finally {
    await database.close();
  }
}

updateFamilyBirthdates();