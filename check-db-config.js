require("dotenv").config();
const Database = require("./src/database");

async function checkConfig() {
  const db = new Database();
  await db.init();
  try {
    const result = await db.query("SELECT * FROM app_config");
    console.log("App Config Rows:", result.rows);
  } catch (err) {
    console.error("Error checking config:", err);
  } finally {
    await db.close();
  }
}

checkConfig();
