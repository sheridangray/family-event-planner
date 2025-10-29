require('dotenv').config();

// Static config for infrastructure and secrets (keep in environment)
const staticConfig = {
  gmail: {
    parent1Email: process.env.PARENT1_EMAIL,
    parent2Email: process.env.PARENT2_EMAIL,
    mcpCredentials: process.env.MCP_GMAIL_CREDENTIALS_JSON ? 
      JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON) : 
      null,
  },
  
  twilio: {
    phoneTo: process.env.TWILIO_PHONE_TO,
    mcpCredentials: process.env.MCP_TWILIO_CREDENTIALS,
  },
  
  app: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

// Deprecated: Legacy config object - USE createDatabaseConfig() instead
// This is kept only for backward compatibility during migration period
const config = {
  gmail: staticConfig.gmail,
  twilio: staticConfig.twilio,
  app: staticConfig.app,
  
  // These settings are now loaded from database via createDatabaseConfig()
  location: {
    homeAddress: 'San Francisco',
    maxDistanceMiles: 30,
  },
  
  schedule: {
    weekdayEarliestTime: '16:30',
    weekendEarliestTime: '08:00',
    weekendNapStart: '12:00',
    weekendNapEnd: '14:00',
  },
  
  preferences: {
    minChildAge: 2,
    maxChildAge: 4,
    maxCostPerEvent: 200,
    minAdvanceDays: 2,
    maxAdvanceMonths: 6,
  },
  
  family: {
    parent1Name: 'Unknown',
    parent2Name: 'Unknown',
    child1Name: 'Unknown',
    child1Age: 4,
    child2Name: 'Unknown',
    child2Age: 2,
    emergencyContact: 'Unknown',
  },
  
  discovery: {
    eventsPerWeekMin: 8,
    eventsPerWeekMax: 20,
    eventsPerDayMax: 3,
    scanFrequencyHours: 6,
    urgentScanFrequencyHours: 1,
  },
};

/**
 * Create database-first config loader
 * @param {Database} database - Database instance
 * @param {Logger} logger - Logger instance
 * @returns {Promise<Object>} Complete configuration object
 */
async function createDatabaseConfig(database, logger = null) {
  const FamilyConfigService = require('../services/family-config');
  const familyConfig = new FamilyConfigService(database, logger);
  
  try {
    const dbConfig = await familyConfig.getFamilyConfig();
    
    if (logger) {
      logger.info('Configuration loaded from database with environment variable fallbacks');
    }
    
    return dbConfig;
  } catch (error) {
    if (logger) {
      logger.warn('Failed to load database config, using environment variables:', error.message);
    }
    return config;
  }
}

function validateConfig() {
  const required = [
    'TWILIO_PHONE_TO'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}

module.exports = { config, validateConfig, createDatabaseConfig };