#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function addAutomationTables() {
  console.log('🚀 Starting automation tables migration...');
  
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

    // Check if scrapers table exists and what columns it has
    console.log('📄 Checking scrapers table...');
    const scrapersTableCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'scrapers'
      ORDER BY ordinal_position;
    `);

    if (scrapersTableCheck.rows.length === 0) {
      // Create scrapers table if it doesn't exist
      console.log('📄 Creating scrapers table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scrapers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          display_name VARCHAR(200) NOT NULL,
          description TEXT,
          target_domain VARCHAR(200),
          scrape_url TEXT,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      console.log('📄 Scrapers table already exists with columns:', scrapersTableCheck.rows.map(r => r.column_name).join(', '));
      
      // Check if we need to add missing columns
      const existingColumns = scrapersTableCheck.rows.map(r => r.column_name);
      const requiredColumns = ['display_name', 'description', 'target_domain', 'enabled'];
      
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column)) {
          console.log(`📄 Adding missing column: ${column}`);
          if (column === 'display_name') {
            await pool.query(`ALTER TABLE scrapers ADD COLUMN IF NOT EXISTS display_name VARCHAR(200)`);
          } else if (column === 'description') {
            await pool.query(`ALTER TABLE scrapers ADD COLUMN IF NOT EXISTS description TEXT`);
          } else if (column === 'target_domain') {
            await pool.query(`ALTER TABLE scrapers ADD COLUMN IF NOT EXISTS target_domain VARCHAR(200)`);
          } else if (column === 'enabled') {
            await pool.query(`ALTER TABLE scrapers ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE`);
          }
        }
      }
    }

    // Create scraper_stats table if it doesn't exist
    console.log('📄 Creating scraper_stats table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraper_stats (
        id SERIAL PRIMARY KEY,
        scraper_id INTEGER NOT NULL,
        discovery_run_id INTEGER,
        events_found INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        execution_time_ms INTEGER DEFAULT 0,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        FOREIGN KEY (scraper_id) REFERENCES scrapers(id) ON DELETE CASCADE,
        FOREIGN KEY (discovery_run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE
      );
    `);

    // Create scraper_requests table if it doesn't exist (for user requests)
    console.log('📄 Creating scraper_requests table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraper_requests (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(200) NOT NULL,
        description TEXT,
        requester_info JSONB,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewer_notes TEXT
      );
    `);

    // Create indexes for performance
    console.log('📄 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scrapers_name ON scrapers(name);
      CREATE INDEX IF NOT EXISTS idx_scrapers_enabled ON scrapers(enabled);
      CREATE INDEX IF NOT EXISTS idx_scraper_stats_scraper_id ON scraper_stats(scraper_id);
      CREATE INDEX IF NOT EXISTS idx_scraper_stats_discovery_run_id ON scraper_stats(discovery_run_id);
      CREATE INDEX IF NOT EXISTS idx_scraper_stats_completed_at ON scraper_stats(completed_at);
      CREATE INDEX IF NOT EXISTS idx_scraper_requests_status ON scraper_requests(status);
    `);

    // Insert default scrapers based on the ScraperManager
    console.log('📄 Inserting default scrapers...');
    const defaultScrapers = [
      {
        name: 'SFRecParksScraper',
        display_name: 'SF Recreation & Parks',
        description: 'San Francisco Recreation and Parks Department events',
        target_domain: 'sfrecpark.org'
      },
      {
        name: 'SFLibraryScraper', 
        display_name: 'SF Public Library',
        description: 'San Francisco Public Library events and programs',
        target_domain: 'sfpl.org'
      },
      {
        name: 'CalAcademyScraper',
        display_name: 'California Academy of Sciences',
        description: 'California Academy of Sciences events and programs',
        target_domain: 'calacademy.org'
      },
      {
        name: 'ChaseCenterScraper',
        display_name: 'Chase Center',
        description: 'Chase Center events and activities',
        target_domain: 'chasecenter.com'
      },
      {
        name: 'FunCheapSFScraper',
        display_name: 'Fun Cheap SF',
        description: 'Fun and affordable San Francisco events',
        target_domain: 'sf.funcheap.com'
      },
      {
        name: 'BayAreaKidFunScraper',
        display_name: 'Bay Area Kid Fun',
        description: 'Family-friendly Bay Area events and activities',
        target_domain: 'bayareakidfun.com'
      },
      {
        name: 'SanFranKidsOutAndAboutScraper',
        display_name: 'San Francisco Kids Out and About',
        description: 'Kids and family events in San Francisco',
        target_domain: 'sanfrancisco.kidsoutandabout.com'
      },
      {
        name: 'YBGFestivalScraper',
        display_name: 'Yerba Buena Gardens Festival',
        description: 'Yerba Buena Gardens Festival events',
        target_domain: 'ybgfestival.org'
      },
      {
        name: 'ExploratoriumScraper',
        display_name: 'Exploratorium',
        description: 'Exploratorium events and programs',
        target_domain: 'exploratorium.edu'
      }
    ];

    // Check what columns exist in scrapers table for dynamic insertion
    const scrapersColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'scrapers'
      ORDER BY ordinal_position;
    `);
    
    const columnNames = scrapersColumns.rows.map(r => r.column_name);
    console.log('📄 Available scrapers table columns:', columnNames);

    for (const scraper of defaultScrapers) {
      try {
        // Build dynamic insert based on available columns
        const fields = ['name'];
        const values = [scraper.name];
        const placeholders = ['$1'];
        let paramCount = 1;

        if (columnNames.includes('display_name')) {
          fields.push('display_name');
          values.push(scraper.display_name);
          placeholders.push(`$${++paramCount}`);
        }
        if (columnNames.includes('description')) {
          fields.push('description');
          values.push(scraper.description);
          placeholders.push(`$${++paramCount}`);
        }
        if (columnNames.includes('target_domain')) {
          fields.push('target_domain');
          values.push(scraper.target_domain);
          placeholders.push(`$${++paramCount}`);
        }
        if (columnNames.includes('enabled')) {
          fields.push('enabled');
          values.push(true);
          placeholders.push(`$${++paramCount}`);
        }
        // Handle class_name if it exists and is required
        if (columnNames.includes('class_name')) {
          fields.push('class_name');
          values.push(scraper.name); // Use name as class_name
          placeholders.push(`$${++paramCount}`);
        }

        const insertSQL = `
          INSERT INTO scrapers (${fields.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON CONFLICT (name) DO UPDATE SET
            ${columnNames.includes('display_name') ? 'display_name = EXCLUDED.display_name,' : ''}
            ${columnNames.includes('description') ? 'description = EXCLUDED.description,' : ''}
            ${columnNames.includes('target_domain') ? 'target_domain = EXCLUDED.target_domain,' : ''}
            ${columnNames.includes('updated_at') ? 'updated_at = CURRENT_TIMESTAMP' : 'name = EXCLUDED.name'}
        `.replace(/,\s*$/, ''); // Remove trailing comma

        await pool.query(insertSQL, values);
        console.log(`   ✓ Added/updated scraper: ${scraper.display_name}`);
        
      } catch (scraperError) {
        console.error(`   ❌ Failed to add scraper ${scraper.name}:`, scraperError.message);
        // Continue with other scrapers
      }
    }

    await pool.query('COMMIT');
    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n🔍 Verifying new tables...');
    
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('scrapers', 'scraper_stats', 'scraper_requests')
      AND table_schema = 'public'
      ORDER BY table_name;
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✅ Tables created successfully:');
      tableCheck.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Check scrapers count
    const scrapersCount = await pool.query('SELECT COUNT(*) as count FROM scrapers');
    console.log(`✅ Scrapers in database: ${scrapersCount.rows[0].count}`);
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Automation tables migration completed!');
}

if (require.main === module) {
  addAutomationTables()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { addAutomationTables };