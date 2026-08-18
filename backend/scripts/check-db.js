#!/usr/bin/env node
/**
 * PostgreSQL connectivity check — run: npm run check:db
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");

(async () => {
  try {
    await connectDB(process.env.DATABASE_URL);
    const result = await mongoose.connection.db.stats();
    console.log("✅ PostgreSQL connection OK");
    console.log(`   Database size: ${(result.dataSize / 1024 / 1024).toFixed(2)} MB`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:");
    console.error(err.message);
    process.exit(1);
  }
})();
