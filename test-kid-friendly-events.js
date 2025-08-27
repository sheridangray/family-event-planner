require('dotenv').config();
const winston = require('winston');
const Database = require('./src/database');
const LLMAgeEvaluator = require('./src/services/llm-age-evaluator');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testKidFriendlyEvents() {
  try {
    console.log('👶 Testing LLM evaluation on potentially kid-friendly events...\n');
    
    const database = new Database();
    await database.init();
    
    const llmEvaluator = new LLMAgeEvaluator(logger);
    
    // Get events from database and find ones that might be suitable
    const events = await database.getEventsByStatus('discovered');
    
    // Look for events with keywords that suggest they're kid-friendly
    const kidFriendlyKeywords = [
      'storytime', 'children', 'family', 'toddler', 'baby', 'kid', 
      'playground', 'puppet', 'music', 'dance', 'zoo', 'park',
      'story', 'craft', 'sing', 'play'
    ];
    
    const potentiallyKidFriendly = events.filter(event => {
      const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
      return kidFriendlyKeywords.some(keyword => searchText.includes(keyword));
    });
    
    console.log(`🔍 Found ${potentiallyKidFriendly.length} potentially kid-friendly events out of ${events.length} total\n`);
    
    if (potentiallyKidFriendly.length === 0) {
      console.log('No obviously kid-friendly events found. Testing some general events...');
      const testEvents = events.slice(10, 13); // Different sample
      
      for (const event of testEvents) {
        await testEvent(llmEvaluator, event);
      }
    } else {
      // Test up to 3 potentially kid-friendly events
      const samplesToTest = potentiallyKidFriendly.slice(0, 3);
      
      for (const event of samplesToTest) {
        await testEvent(llmEvaluator, event);
      }
    }
    
    await database.close();
    
  } catch (error) {
    logger.error('Test failed:', error.message);
  }
}

async function testEvent(llmEvaluator, event) {
  console.log(`--- Evaluating: ${event.title} ---`);
  console.log(`📝 Description: ${(event.description || 'No description').substring(0, 100)}${event.description && event.description.length > 100 ? '...' : ''}`);
  console.log(`👶 Listed Age Range: ${event.age_range_min || 0}-${event.age_range_max || 18}`);
  console.log(`💰 Cost: $${event.cost || 0}`);
  console.log(`📍 Source: ${event.source}`);
  
  const testEvent = {
    id: event.id,
    title: event.title,
    description: event.description,
    ageRange: {
      min: event.age_range_min || 0,
      max: event.age_range_max || 18
    },
    cost: event.cost || 0,
    location: {
      address: event.location || 'Not specified'
    },
    source: event.source
  };
  
  const evaluation = await llmEvaluator.evaluateEventForChildren(testEvent, [4, 2]);
  
  console.log(`🤖 LLM Decision: ${evaluation.suitable ? '✅ SUITABLE' : '❌ NOT SUITABLE'}`);
  console.log(`📊 Confidence: ${evaluation.confidence}`);
  console.log(`💭 Reason: ${evaluation.reason}`);
  console.log('');
}

testKidFriendlyEvents();