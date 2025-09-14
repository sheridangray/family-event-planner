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

async function testLLMEvaluation() {
  try {
    console.log('🧠 Testing LLM Age Evaluation...\n');
    
    // Check if Together.ai API key is available
    if (!process.env.TOGETHER_AI_API_KEY) {
      console.log('❌ TOGETHER_AI_API_KEY not found in environment variables');
      console.log('💡 Please add your Together.ai API key to .env file:');
      console.log('   TOGETHER_AI_API_KEY=your_api_key_here');
      return;
    }
    
    console.log('✅ Together.ai API key found');
    
    // Initialize components
    const database = new Database();
    await database.init();
    
    const llmEvaluator = new LLMAgeEvaluator(logger);
    
    // Get sample events from database
    const events = await database.getEventsByStatus('discovered');
    
    if (events.length === 0) {
      console.log('❌ No discovered events found. Run event discovery first.');
      return;
    }
    
    console.log(`📋 Found ${events.length} discovered events in database`);
    
    // Test with a small sample of diverse events
    const sampleEvents = events.slice(0, 3).map(event => ({
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
    }));
    
    console.log('\n🧪 Testing LLM evaluation on sample events:\n');
    
    const childAges = [4, 2]; // Apollo and Athena
    
    for (const event of sampleEvents) {
      console.log(`--- Evaluating: ${event.title} ---`);
      console.log(`📝 Description: ${event.description || 'No description'}`);
      console.log(`👶 Listed Age Range: ${event.ageRange.min}-${event.ageRange.max}`);
      console.log(`💰 Cost: $${event.cost}`);
      
      const evaluation = await llmEvaluator.evaluateEventForChildren(event, childAges);
      
      console.log(`🤖 LLM Decision: ${evaluation.suitable ? '✅ SUITABLE' : '❌ NOT SUITABLE'}`);
      console.log(`📊 Confidence: ${evaluation.confidence}`);
      console.log(`💭 Reason: ${evaluation.reason}`);
      console.log('');
    }
    
    await database.close();
    
    console.log('🎉 LLM age evaluation test completed successfully!');
    console.log('💡 To enable this in production, ensure TOGETHER_AI_API_KEY is set in your Render environment variables.');
    
  } catch (error) {
    logger.error('LLM evaluation test failed:', error.message);
    console.error('Error details:', error);
  }
}

testLLMEvaluation();