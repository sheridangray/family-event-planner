require('dotenv').config();

const Database = require('./src/database/index');
const winston = require('winston');

// Set up logger
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

async function analyzeEventSources() {
  const database = new Database(logger);
  
  try {
    logger.info('Connecting to database...');
    await database.init();
    
    logger.info('Analyzing event sources for custom adapter prioritization...');
    
    // Get all events from the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const now = new Date();
    
    const events = await database.getEventsInDateRange(sixMonthsAgo, now);
    logger.info(`Found ${events.length} events in the last 6 months`);
    
    // Analyze by source
    const sourceStats = {};
    const domainStats = {};
    const statusStats = {};
    
    for (const event of events) {
      // Source analysis
      const source = event.source || 'unknown';
      if (!sourceStats[source]) {
        sourceStats[source] = {
          total: 0,
          approved: 0,
          registered: 0,
          avgCost: 0,
          totalCost: 0,
          hasRegistrationUrl: 0
        };
      }
      
      sourceStats[source].total++;
      sourceStats[source].totalCost += (event.cost || 0);
      
      if (event.status === 'approved') sourceStats[source].approved++;
      if (event.status === 'registered') sourceStats[source].registered++;
      if (event.registration_url) sourceStats[source].hasRegistrationUrl++;
      
      // Domain analysis (extract domain from registration URL)
      if (event.registration_url) {
        try {
          const url = new URL(event.registration_url);
          const domain = url.hostname.toLowerCase();
          
          if (!domainStats[domain]) {
            domainStats[domain] = {
              total: 0,
              approved: 0,
              registered: 0,
              sources: new Set(),
              avgCost: 0,
              totalCost: 0
            };
          }
          
          domainStats[domain].total++;
          domainStats[domain].totalCost += (event.cost || 0);
          domainStats[domain].sources.add(source);
          
          if (event.status === 'approved') domainStats[domain].approved++;
          if (event.status === 'registered') domainStats[domain].registered++;
          
        } catch (error) {
          // Invalid URL, skip domain analysis
        }
      }
      
      // Status analysis
      const status = event.status || 'unknown';
      statusStats[status] = (statusStats[status] || 0) + 1;
    }
    
    // Calculate averages
    for (const source in sourceStats) {
      const stats = sourceStats[source];
      stats.avgCost = stats.total > 0 ? stats.totalCost / stats.total : 0;
      stats.approvalRate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
      stats.registrationRate = stats.approved > 0 ? (stats.registered / stats.approved) * 100 : 0;
      stats.hasUrlRate = stats.total > 0 ? (stats.hasRegistrationUrl / stats.total) * 100 : 0;
    }
    
    for (const domain in domainStats) {
      const stats = domainStats[domain];
      stats.avgCost = stats.total > 0 ? stats.totalCost / stats.total : 0;
      stats.approvalRate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
      stats.registrationRate = stats.approved > 0 ? (stats.registered / stats.approved) * 100 : 0;
      stats.sources = Array.from(stats.sources);
    }
    
    // Sort and display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 EVENT SOURCE ANALYSIS FOR CUSTOM ADAPTER PRIORITIZATION');
    console.log('='.repeat(80));
    
    // Top sources by approval volume
    console.log('\n🎯 TOP EVENT SOURCES (by approved events):');
    console.log('-'.repeat(60));
    const topSources = Object.entries(sourceStats)
      .sort(([,a], [,b]) => b.approved - a.approved)
      .slice(0, 10);
      
    topSources.forEach(([source, stats], index) => {
      console.log(`${index + 1}. ${source}:`);
      console.log(`   • Total Events: ${stats.total}`);
      console.log(`   • Approved Events: ${stats.approved} (${stats.approvalRate.toFixed(1)}%)`);
      console.log(`   • Registered Events: ${stats.registered}`);
      console.log(`   • Avg Cost: $${stats.avgCost.toFixed(2)}`);
      console.log(`   • Has Registration URL: ${stats.hasRegistrationUrl}/${stats.total} (${stats.hasUrlRate.toFixed(1)}%)`);
      console.log('');
    });
    
    // Top domains by approval volume
    console.log('\n🌐 TOP REGISTRATION DOMAINS (by approved events):');
    console.log('-'.repeat(60));
    const topDomains = Object.entries(domainStats)
      .sort(([,a], [,b]) => b.approved - a.approved)
      .slice(0, 10);
      
    topDomains.forEach(([domain, stats], index) => {
      console.log(`${index + 1}. ${domain}:`);
      console.log(`   • Total Events: ${stats.total}`);
      console.log(`   • Approved Events: ${stats.approved} (${stats.approvalRate.toFixed(1)}%)`);
      console.log(`   • Registered Events: ${stats.registered}`);
      console.log(`   • Sources: ${stats.sources.join(', ')}`);
      console.log(`   • Avg Cost: $${stats.avgCost.toFixed(2)}`);
      console.log('');
    });
    
    // Overall status breakdown
    console.log('\n📈 EVENT STATUS BREAKDOWN:');
    console.log('-'.repeat(40));
    const sortedStatuses = Object.entries(statusStats)
      .sort(([,a], [,b]) => b - a);
      
    sortedStatuses.forEach(([status, count]) => {
      const percentage = ((count / events.length) * 100).toFixed(1);
      console.log(`• ${status}: ${count} (${percentage}%)`);
    });
    
    // Custom Adapter Recommendations
    console.log('\n🎯 CUSTOM ADAPTER PRIORITY RECOMMENDATIONS:');
    console.log('-'.repeat(60));
    
    const recommendations = [];
    
    // Analyze top domains for custom adapter potential
    topDomains.slice(0, 5).forEach(([domain, stats]) => {
      const priority = calculateAdapterPriority(stats);
      recommendations.push({
        domain,
        priority,
        reasoning: priority.reasoning,
        stats
      });
    });
    
    recommendations.sort((a, b) => b.priority.score - a.priority.score);
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.domain} (Score: ${rec.priority.score})`);
      console.log(`   Priority: ${rec.priority.level}`);
      console.log(`   Reasoning: ${rec.reasoning}`);
      console.log(`   • Approved Events: ${rec.stats.approved}`);
      console.log(`   • Success Rate: ${rec.priority.factors.approvalRate}%`);
      console.log(`   • Cost Level: ${rec.priority.factors.costLevel}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    logger.info('Event source analysis complete!');
    
  } catch (error) {
    console.error('Analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    // Clean up
    if (database.postgres && database.postgres.pool) {
      await database.postgres.pool.end();
    }
  }
}

function calculateAdapterPriority(stats) {
  let score = 0;
  let reasoning = [];
  
  const factors = {
    approvalRate: stats.approvalRate,
    approvedVolume: stats.approved,
    costLevel: stats.avgCost === 0 ? 'Free' : stats.avgCost < 20 ? 'Low' : stats.avgCost < 50 ? 'Medium' : 'High'
  };
  
  // Volume weight (0-40 points)
  if (stats.approved >= 20) {
    score += 40;
    reasoning.push('High approval volume (20+)');
  } else if (stats.approved >= 10) {
    score += 30;
    reasoning.push('Medium approval volume (10+)');
  } else if (stats.approved >= 5) {
    score += 20;
    reasoning.push('Moderate approval volume (5+)');
  } else {
    score += 10;
    reasoning.push('Low approval volume');
  }
  
  // Approval rate weight (0-25 points)
  if (stats.approvalRate >= 50) {
    score += 25;
    reasoning.push('High approval rate (50%+)');
  } else if (stats.approvalRate >= 25) {
    score += 20;
    reasoning.push('Good approval rate (25%+)');
  } else {
    score += 10;
    reasoning.push('Lower approval rate');
  }
  
  // Cost consideration (0-15 points) - Free events are easier to automate
  if (stats.avgCost === 0) {
    score += 15;
    reasoning.push('Free events (easier automation)');
  } else if (stats.avgCost < 20) {
    score += 10;
    reasoning.push('Low-cost events');
  } else {
    score += 5;
    reasoning.push('Higher-cost events (complex automation)');
  }
  
  // Multi-source bonus (0-10 points)
  if (stats.sources && stats.sources.length > 1) {
    score += 10;
    reasoning.push('Used by multiple scrapers');
  }
  
  // Registration rate consideration (0-10 points)
  if (stats.registrationRate >= 80) {
    score += 10;
    reasoning.push('High registration completion rate');
  } else if (stats.registrationRate >= 50) {
    score += 5;
    reasoning.push('Moderate registration completion rate');
  }
  
  let level;
  if (score >= 80) level = 'CRITICAL';
  else if (score >= 60) level = 'HIGH';
  else if (score >= 40) level = 'MEDIUM';
  else level = 'LOW';
  
  return {
    score,
    level,
    reasoning: reasoning.join(', '),
    factors
  };
}

analyzeEventSources().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});