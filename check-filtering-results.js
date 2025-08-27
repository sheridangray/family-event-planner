require('dotenv').config();
const winston = require('winston');
const Database = require('./src/database');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function checkFilteringResults() {
  try {
    console.log('🔍 Checking current filtering results...\n');
    
    const database = new Database();
    await database.init();
    
    // Get recent events by status
    const discovered = await database.getEventsByStatus('discovered');
    const proposed = await database.getEventsByStatus('proposed');
    
    console.log(`📊 Current Event Status:`);
    console.log(`   📋 Discovered: ${discovered.length} events`);
    console.log(`   📤 Proposed (sent for approval): ${proposed.length} events`);
    
    if (proposed.length > 0) {
      console.log(`\n✅ SUCCESS! Events sent for approval:`);
      proposed.forEach((event, i) => {
        console.log(`   ${i + 1}. ${event.title}`);
        console.log(`      📅 ${new Date(event.date).toLocaleDateString()}`);
        console.log(`      💰 $${event.cost || 0}`);
      });
    } else {
      console.log(`\n❌ No events sent for approval yet.`);
      
      // Check if we have recent LLM evaluations
      const recentEvents = discovered
        .filter(e => e.created_at && new Date(e.created_at) > new Date(Date.now() - 10 * 60 * 1000))
        .slice(0, 3);
        
      if (recentEvents.length > 0) {
        console.log(`\n🕐 Recent events (last 10 minutes):`);
        recentEvents.forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.title}`);
          console.log(`      👶 Age Range: ${event.age_range_min || 0}-${event.age_range_max || 18}`);
          console.log(`      📅 ${new Date(event.date).toDateString()}`);
        });
        console.log(`\nℹ️  These events were discovered but may still be in the filtering pipeline.`);
      }
    }
    
    await database.close();
    
  } catch (error) {
    console.error('Error checking results:', error.message);
  }
}

checkFilteringResults();