require("dotenv").config();
const Database = require("./src/database");

async function fixConfig() {
  const db = new Database();
  await db.init();
  try {
    await db.query(
      "UPDATE app_config SET value = '1.0' WHERE key = 'min_supported_version'"
    );
    console.log("Updated min_supported_version to 1.0");
  } catch (err) {
    console.error("Error updating config:", err);
  } finally {
    await db.close();
  }
}

fixConfig();
