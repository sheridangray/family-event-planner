#!/usr/bin/env node

/**
 * Deployment script for ChatGPT Event Discovery feature
 * This script helps verify the production deployment
 */

require("dotenv").config();
const { Pool } = require("pg");

const PRODUCTION_DATABASE_URL = process.env.DATABASE_URL;
const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY;

async function verifyProductionDeployment() {
  console.log("🚀 Verifying ChatGPT Event Discovery deployment...\n");

  // Check environment variables
  console.log("📋 Environment Check:");
  console.log(
    `  DATABASE_URL: ${PRODUCTION_DATABASE_URL ? "✓ Set" : "✗ Missing"}`
  );
  console.log(
    `  CHATGPT_API_KEY: ${CHATGPT_API_KEY ? "✓ Set" : "✗ Missing"}\n`
  );

  if (!PRODUCTION_DATABASE_URL) {
    console.error("❌ DATABASE_URL is required for production verification");
    process.exit(1);
  }

  if (!CHATGPT_API_KEY) {
    console.error("❌ CHATGPT_API_KEY is required for production verification");
    process.exit(1);
  }

  // Test database connection and table
  const pool = new Pool({
    connectionString: PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🔍 Testing production database connection...");

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chatgpt_event_discoveries'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log("✅ Table chatgpt_event_discoveries exists");

      // Check table structure
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chatgpt_event_discoveries'
        ORDER BY ordinal_position;
      `);

      console.log("📋 Table structure:");
      columns.rows.forEach((col) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Check indexes
      const indexes = await pool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'chatgpt_event_discoveries';
      `);

      console.log("\n📊 Indexes:");
      indexes.rows.forEach((idx) => {
        console.log(`  - ${idx.indexname}`);
      });
    } else {
      console.log("❌ Table chatgpt_event_discoveries does NOT exist");
      console.log("   The backend needs to be restarted to create tables");
    }

    // Test API endpoint
    console.log("\n🌐 Testing API endpoint...");
    const apiUrl =
      "https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries";

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ API endpoint is accessible");
        console.log(
          `   Found ${data.discoveries?.length || 0} existing discoveries`
        );
      } else {
        console.log(`⚠️  API endpoint returned status: ${response.status}`);
      }
    } catch (apiError) {
      console.log(`⚠️  API endpoint test failed: ${apiError.message}`);
    }

    console.log("\n🎉 Production deployment verification complete!");
    console.log("\n📝 Next steps:");
    console.log(
      "1. Update your ChatGPT scheduled action with the production URL"
    );
    console.log("2. Test the integration with a sample request");
    console.log("3. Monitor the logs for any issues");
  } catch (error) {
    console.error("❌ Database verification failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyProductionDeployment().catch(console.error);
