#!/usr/bin/env node
/**
 * Verify upload_search_rows schema + chunk insert (100 then 1000).
 *   node scripts/verify-upload-search-rows.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const {
  insertSearchRowChunk,
  deleteByBatch,
  countByBatch,
  toSearchRow,
} = require("../src/services/uploadSearchRows.service");

function makeRows(batchId, count, startIndex = 0) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      toSearchRow(
        {
          companyId: "aaaaaaaaaaaaaaaaaaaaaaaa",
          uploadBatchId: batchId,
          customerName: `Verify Customer ${startIndex + i}`,
          mobileNumber: `98765${String(startIndex + i).padStart(5, "0")}`,
          loanAccountNumber: `LAN${String(startIndex + i).padStart(8, "0")}`,
          vehicleNumber: `MH12AB${String(startIndex + i).padStart(4, "0")}`,
          chassisNumber: `CHS${String(startIndex + i).padStart(8, "0")}`,
          bankName: "Verify Bank",
          branchName: "Verify Branch",
          city: "Pune",
          state: "MH",
        },
        startIndex + i
      )
    );
  }
  return rows;
}

async function main() {
  await connectDB(process.env.DATABASE_URL);

  const ext = await query(
    `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`
  );
  const table = await query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'upload_search_rows'
     ORDER BY ordinal_position`
  );
  const indexes = await query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE tablename = 'upload_search_rows'
     ORDER BY indexname`
  );

  console.log(`pg_trgm: ${ext.rows.length ? "enabled" : "MISSING"}`);
  console.log(`columns (${table.rows.length}): ${table.rows.map((r) => r.column_name).join(", ")}`);
  console.log("indexes:");
  for (const idx of indexes.rows) {
    console.log(`  ${idx.indexname}`);
  }

  if (!ext.rows.length) throw new Error("pg_trgm is not enabled");
  if (!table.rows.length) throw new Error("upload_search_rows table missing");

  const batch100 = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const batch1000 = "cccccccccccccccccccccccc";
  await deleteByBatch([batch100, batch1000]);

  const t100 = Date.now();
  await insertSearchRowChunk(makeRows(batch100, 100));
  const count100 = await countByBatch(batch100);
  console.log(`insert 100: ${count100} rows in ${Date.now() - t100}ms`);

  const t1000 = Date.now();
  await insertSearchRowChunk(makeRows(batch1000, 1000));
  const count1000 = await countByBatch(batch1000);
  console.log(`insert 1000: ${count1000} rows in ${Date.now() - t1000}ms`);

  const again = await insertSearchRowChunk(makeRows(batch100, 100));
  const count100After = await countByBatch(batch100);
  console.log(`retry upsert 100: inserted=${again.inserted} stored=${count100After} (no duplicates)`);

  await deleteByBatch([batch100, batch1000]);
  const leftover =
    (await countByBatch(batch100)) + (await countByBatch(batch1000));
  console.log(`cleanup leftover: ${leftover}`);

  if (count100 !== 100 || count1000 !== 1000 || count100After !== 100 || leftover !== 0) {
    throw new Error("Verification counts did not match expected values");
  }

  console.log("✅ upload_search_rows verification passed");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌", err.message);
  try {
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
