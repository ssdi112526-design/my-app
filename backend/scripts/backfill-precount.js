#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");

(async () => {
  await connectDB(process.env.DATABASE_URL);
  const total = await query(`SELECT COUNT(*)::int AS total FROM upload_search_rows`);
  const byBatch = await query(`
    SELECT "uploadBatchId", COUNT(*)::int AS rows
    FROM upload_search_rows
    GROUP BY "uploadBatchId"
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);
  console.log("total", total.rows[0].total);
  console.log("by_batch", byBatch.rows);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
