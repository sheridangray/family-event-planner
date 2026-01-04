require("dotenv").config();
const Database = require("./src/database");

async function fixProfileTable() {
  const db = new Database();
  await db.init();
  try {
    // Add column if it doesn't exist
    await db.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS enabled_pillars TEXT[] 
      DEFAULT '{time,food,health,relationships,sleep,money}'
    `);
    console.log("Added enabled_pillars column to profiles table");
  } catch (err) {
    console.error("Error updating profiles table:", err);
  } finally {
    await db.close();
  }
}

fixProfileTable();

