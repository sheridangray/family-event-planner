require('dotenv').config();

const config = {
  gmail: {
    parent1Email: process.env.PARENT1_EMAIL,
    parent2Email: process.env.PARENT2_EMAIL,
    mcpCredentials: process.env.MCP_GMAIL_CREDENTIALS_JSON ? 
      JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON) : 
      process.env.MCP_GMAIL_CREDENTIALS,
  },
  
  twilio: {
    phoneTo: process.env.TWILIO_PHONE_TO,
    mcpCredentials: process.env.MCP_TWILIO_CREDENTIALS,
  },
  
  location: {
    homeAddress: process.env.HOME_ADDRESS,
    maxDistanceMiles: parseInt(process.env.MAX_DISTANCE_MILES) || 30,
  },
  
  schedule: {
    weekdayEarliestTime: process.env.WEEKDAY_EARLIEST_TIME || '16:30',
    weekendEarliestTime: process.env.WEEKEND_EARLIEST_TIME || '08:00',
    weekendNapStart: process.env.WEEKEND_NAP_START || '12:00',
    weekendNapEnd: process.env.WEEKEND_NAP_END || '14:00',
  },
  
  preferences: {
    minChildAge: parseInt(process.env.MIN_CHILD_AGE) || 2,
    maxChildAge: parseInt(process.env.MAX_CHILD_AGE) || 4,
    maxCostPerEvent: parseInt(process.env.MAX_COST_PER_EVENT) || 200,
    minAdvanceWeeks: parseInt(process.env.MIN_ADVANCE_WEEKS) || 2,
    maxAdvanceMonths: parseInt(process.env.MAX_ADVANCE_MONTHS) || 6,
  },
  
  family: {
    parent1Name: process.env.PARENT1_NAME,
    parent2Name: process.env.PARENT2_NAME,
    child1Name: process.env.CHILD1_NAME,
    child1Age: parseInt(process.env.CHILD1_AGE) || 4,
    child2Name: process.env.CHILD2_NAME,
    child2Age: parseInt(process.env.CHILD2_AGE) || 2,
    emergencyContact: process.env.EMERGENCY_CONTACT,
  },
  
  app: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  discovery: {
    eventsPerWeekMin: parseInt(process.env.EVENTS_PER_WEEK_MIN) || 8,
    eventsPerWeekMax: parseInt(process.env.EVENTS_PER_WEEK_MAX) || 20,
    eventsPerDayMax: parseInt(process.env.EVENTS_PER_DAY_MAX) || 3,
    scanFrequencyHours: parseInt(process.env.SCAN_FREQUENCY_HOURS) || 6,
    urgentScanFrequencyHours: parseInt(process.env.URGENT_SCAN_FREQUENCY_HOURS) || 1,
  },
};

function validateConfig() {
  const required = [
    'PARENT1_EMAIL',
    'PARENT2_EMAIL', 
    'TWILIO_PHONE_TO',
    'HOME_ADDRESS',
    'PARENT1_NAME',
    'PARENT2_NAME',
    'CHILD1_NAME',
    'CHILD2_NAME'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

module.exports = { config, validateConfig };