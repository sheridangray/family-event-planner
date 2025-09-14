#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function fixScraperNames() {
  console.log('🚀 Fixing scraper names in database...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('📍 Database:', connectionString.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query('BEGIN');

    // Map of incorrect class names to correct scraper names
    const nameMapping = {
      'SFRecParksScraper': 'sf-rec-parks',
      'SFLibraryScraper': 'sf-library',
      'CalAcademyScraper': 'cal-academy',
      'ChaseCenterScraper': 'chase-center',
      'FunCheapSFScraper': 'funcheapsf',
      'BayAreaKidFunScraper': 'bayareakidfun',
      'SanFranKidsOutAndAboutScraper': 'sanfran-kidsoutandabout',
      'YBGFestivalScraper': 'ybgfestival',
      'ExploratoriumScraper': 'exploratorium'
    };

    console.log('📄 Updating scraper names...');
    
    for (const [oldName, newName] of Object.entries(nameMapping)) {
      const result = await pool.query(`
        UPDATE scrapers 
        SET name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE name = $1
        RETURNING id, display_name
      `, [oldName, newName]);

      if (result.rows.length > 0) {
        console.log(`   ✓ Updated ${oldName} → ${newName} (${result.rows[0].display_name})`);
      } else {
        console.log(`   - No scraper found with name ${oldName}`);
      }
    }

    await pool.query('COMMIT');
    console.log('✅ Scraper names updated successfully!');

    // Verify the current scrapers
    console.log('\n🔍 Current scrapers in database:');
    const scrapersResult = await pool.query(`
      SELECT id, name, display_name, enabled 
      FROM scrapers 
      ORDER BY id
    `);

    scrapersResult.rows.forEach(row => {
      const status = row.enabled ? '✅' : '❌';
      console.log(`   ${status} ID:${row.id} - ${row.name} (${row.display_name})`);
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Name fix failed:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Scraper name fix completed!');
  console.log('The automation dashboard should now work without "Scraper not found" errors.');
}

if (require.main === module) {
  fixScraperNames()
    .then(() => {
      console.log('Name fix script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Name fix script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixScraperNames };