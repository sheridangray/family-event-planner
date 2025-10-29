// Quick database connection test
require("dotenv").config();
const PostgresDatabase = require("./src/database/postgres");

async function testConnection() {
  console.log("🔍 Testing database connection...\n");
  console.log(
    "DATABASE_URL:",
    process.env.DATABASE_URL ? "Set ✓" : "Missing ✗"
  );
  console.log(
    "CHATGPT_API_KEY:",
    process.env.CHATGPT_API_KEY ? "Set ✓" : "Missing ✗"
  );
  console.log("");

  const db = new PostgresDatabase();

  try {
    await db.init();
    console.log("✅ Database connected successfully\n");

    // Check if the table exists
    const result = await db.pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chatgpt_event_discoveries'
      );
    `);

    const tableExists = result.rows[0].exists;

    if (tableExists) {
      console.log("✅ Table chatgpt_event_discoveries exists\n");

      // Check table structure
      const columns = await db.pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chatgpt_event_discoveries'
        ORDER BY ordinal_position;
      `);

      console.log("📋 Table columns:");
      columns.rows.forEach((col) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log("❌ Table chatgpt_event_discoveries does NOT exist");
      console.log("   The server needs to be restarted to create tables");
    }

    await db.close();
    console.log("\n✅ Test complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database error:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

testConnection();
