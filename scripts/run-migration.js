#!/usr/bin/env node

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  // Get migration file from command line argument
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error("❌ Error: Migration file path required");
    console.error(
      "Usage: node scripts/run-migration.js migrations/012_create_exercises_table.sql"
    );
    process.exit(1);
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/family_event_planner";

  console.log("🚀 Starting database migration...");
  console.log("📍 Database:", connectionString.replace(/:[^:]*@/, ":***@"));

  const pool = new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Read the migration file
    const migrationPath = path.isAbsolute(migrationFile)
      ? migrationFile
      : path.join(__dirname, "..", migrationFile);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("📄 Running migration from:", migrationPath);

    // Execute the migration
    await pool.query("BEGIN;");
    await pool.query(migrationSQL);
    await pool.query("COMMIT;");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    await pool.query("ROLLBACK;");
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log("\n🎉 Database migration completed!");
}

runMigration().catch(console.error);
