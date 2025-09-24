const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRecentEmails() {
  try {
    console.log('🔍 Checking recent email notifications and event statuses...\n');
    
    // Check for any email notifications sent in the last 7 days
    const emailsQuery = `
      SELECT 
        n.*,
        e.title as event_title,
        e.date as event_date,
        e.status as event_status
      FROM notifications n
      LEFT JOIN events e ON n.event_id = e.id
      WHERE n.method = 'email' 
        AND n.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    
    console.log('📧 Recent Email Notifications (last 7 days):');
    const emailResults = await pool.query(emailsQuery);
    
    if (emailResults.rows.length === 0) {
      console.log('❌ No email notifications found in the last 7 days!\n');
    } else {
      emailResults.rows.forEach((row, index) => {
        console.log(`${index + 1}. Event: "${row.event_title || 'Unknown'}"`);
        console.log(`   To: ${row.recipient}`);
        console.log(`   Sent: ${new Date(row.created_at).toLocaleString()}`);
        console.log(`   Event Status: ${row.event_status}`);
        console.log(`   Event Date: ${row.event_date ? new Date(row.event_date).toLocaleDateString() : 'Unknown'}\n`);
      });
    }

    // Check events from the latest discovery run that passed filters
    const latestRunQuery = `
      SELECT id FROM discovery_runs 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    
    const latestRunResult = await pool.query(latestRunQuery);
    
    if (latestRunResult.rows.length > 0) {
      const runId = latestRunResult.rows[0].id;
      
      console.log(`🔍 Events from latest discovery run (#${runId}) that passed filters:`);
      
      const passedFilterQuery = `
        SELECT 
          de.event_title,
          de.event_date,
          de.event_cost,
          de.scraper_name,
          de.filter_results,
          e.status as current_status,
          e.id as event_id
        FROM discovered_events de
        LEFT JOIN events e ON e.discovery_run_id = de.discovery_run_id 
          AND e.title = de.event_title 
          AND e.date = de.event_date
        WHERE de.discovery_run_id = $1
          AND (de.filter_results ->> 'passed')::boolean = true
        ORDER BY de.discovered_at DESC
        LIMIT 10
      `;
      
      const passedEvents = await pool.query(passedFilterQuery, [runId]);
      
      if (passedEvents.rows.length === 0) {
        console.log('❌ No events passed filters in the latest run\n');
      } else {
        passedEvents.rows.forEach((row, index) => {
          console.log(`${index + 1}. "${row.event_title}"`);
          console.log(`   Date: ${row.event_date ? new Date(row.event_date).toLocaleDateString() : 'Unknown'}`);
          console.log(`   Cost: $${row.event_cost || 0}`);
          console.log(`   Source: ${row.scraper_name}`);
          console.log(`   Current Status: ${row.current_status || 'Not in events table'}`);
          console.log(`   Event ID: ${row.event_id || 'None'}\n`);
        });
      }
    }

    // Check for any events in 'proposed' or 'sent' status  
    const proposedQuery = `
      SELECT 
        id, title, date, status, created_at, updated_at
      FROM events 
      WHERE status IN ('proposed', 'sent', 'pending')
        OR status LIKE '%approval%'
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    console.log('📋 Events awaiting approval (proposed/sent status):');
    const proposedResults = await pool.query(proposedQuery);
    
    if (proposedResults.rows.length === 0) {
      console.log('❌ No events found in proposed/sent status\n');
    } else {
      proposedResults.rows.forEach((row, index) => {
        console.log(`${index + 1}. "${row.title}"`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Date: ${new Date(row.date).toLocaleDateString()}`);
        console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
        console.log(`   Updated: ${new Date(row.updated_at).toLocaleString()}\n`);
      });
    }

    await pool.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    await pool.end();
  }
}

checkRecentEmails();