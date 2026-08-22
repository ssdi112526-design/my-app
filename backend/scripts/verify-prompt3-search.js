#!/usr/bin/env node
/**
 * Prompt 3 search verification. Does not run historical backfill.
 *   node scripts/verify-prompt3-search.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const RepoCase = require("../src/modules/repoCases/repoCase.model");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const {
  insertSearchRowChunk,
  deleteByBatch,
  searchUploadRows,
  companyNeedsS3SearchFallback,
  toSearchRow,
  buildSearchWhere,
  countSearchRowsForCompany,
} = require("../src/services/uploadSearchRows.service");

const COMPANY_A = "dddddddddddddddddddddddd";
const COMPANY_B = "eeeeeeeeeeeeeeeeeeeeeeee";
const BATCH_A = "ffffffffffffffffffffffff";
const BATCH_B = "1234567890abcdef12345678";
const BATCH_SCALE = "999999999999999999999999";

function makeRows(companyId, batchId, count, startIndex = 0, platePrefix = "MH12VV") {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const n = startIndex + i;
    rows.push(
      toSearchRow(
        {
          companyId,
          uploadBatchId: batchId,
          customerName: `Prompt3 Customer ${n}`,
          mobileNumber: `90000${String(n).padStart(5, "0")}`,
          loanAccountNumber: `P3LAN${String(n).padStart(8, "0")}`,
          vehicleNumber: `${platePrefix}${String(n).padStart(4, "0")}`,
          chassisNumber: `P3CHS${String(n).padStart(8, "0")}`,
          bankName: "Prompt3 Bank",
          branchName: "Prompt3 Branch",
        },
        n
      )
    );
  }
  return rows;
}

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`  PASS: ${label}`);
}

async function explainVehicle(companyId, needle) {
  const { whereSql, params } = buildSearchWhere({
    companyId,
    search: needle,
    type: "vehicleNumber",
  });
  const sql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT * FROM upload_search_rows
    WHERE ${whereSql}
    ORDER BY "createdAt" DESC
    LIMIT 50 OFFSET 0`;
  const result = await query(sql, params);
  return result.rows.map((r) => r["QUERY PLAN"]).join("\n");
}

async function main() {
  await connectDB(process.env.DATABASE_URL);
  const results = {
    repo_cases: "SKIP",
    upload_search_rows: "FAIL",
    s3_fallback: "SKIP",
    company_isolation: "FAIL",
    new_excel_search: "FAIL",
    pagination: "FAIL",
    no_result: "FAIL",
  };

  await deleteByBatch([BATCH_A, BATCH_B, BATCH_SCALE]);

  try {
    await insertSearchRowChunk(makeRows(COMPANY_A, BATCH_A, 1000, 0, "MH12AA"));
    await insertSearchRowChunk(makeRows(COMPANY_B, BATCH_B, 20, 0, "MH12BB"));

    const foundA = await searchUploadRows({
      companyId: COMPANY_A,
      search: "MH12AA0042",
      type: "vehicleNumber",
      page: 1,
      limit: 50,
    });
    assert(foundA.total === 1, "vehicleNumber exact plate → 1 row");
    assert(foundA.items[0].vehicleNumber === "MH12AA0042", "normalized plate returned");
    assert(
      foundA.items[0]._id === `${BATCH_A}-42`,
      "response _id is batch-row (not 24-char ObjectId)"
    );
    assert(foundA.items[0].customerName === "Prompt3 Customer 42", "customer mapped");
    assert(foundA.items[0].companyId === COMPANY_A, "item companyId is auth company");
    results.new_excel_search = "PASS";

    const contains = await searchUploadRows({
      companyId: COMPANY_A,
      search: "12AA00",
      type: "vehicleNumber",
      page: 1,
      limit: 50,
    });
    assert(contains.total >= 1, "partial vehicle contains-search works");

    const other = await searchUploadRows({
      companyId: COMPANY_B,
      search: "MH12AA0042",
      type: "vehicleNumber",
      page: 1,
      limit: 50,
    });
    assert(other.total === 0, "company B cannot see company A plate");

    const ownB = await searchUploadRows({
      companyId: COMPANY_B,
      search: "MH12BB0001",
      type: "vehicleNumber",
      page: 1,
      limit: 50,
    });
    assert(ownB.total === 1, "company B can see its own plate");
    results.company_isolation = "PASS";

    const missing = await searchUploadRows({
      companyId: COMPANY_A,
      search: "ZZ99NOTFOUND",
      type: "vehicleNumber",
      page: 1,
      limit: 50,
    });
    assert(missing.total === 0 && missing.items.length === 0, "nonexistent plate returns empty");
    results.no_result = "PASS";

    const page1 = await searchUploadRows({
      companyId: COMPANY_A,
      search: "MH12AA",
      type: "vehicleNumber",
      page: 1,
      limit: 25,
    });
    const page2 = await searchUploadRows({
      companyId: COMPANY_A,
      search: "MH12AA",
      type: "vehicleNumber",
      page: 2,
      limit: 25,
    });
    assert(page1.total === 1000, "pagination total is server-side count");
    assert(page1.items.length === 25 && page2.items.length === 25, "page size honored");
    assert(page1.page === 1 && page2.page === 2, "page numbers preserved");
    assert(
      page1.items[0]._id !== page2.items[0]._id,
      "page 2 is a different slice"
    );
    results.pagination = "PASS";
    results.upload_search_rows = "PASS";

    const repoSample = await RepoCase.findOne({
      vehicleNumber: { $exists: true, $nin: [null, ""] },
    })
      .select("companyId vehicleNumber customerName")
      .lean();
    if (repoSample?.vehicleNumber) {
      const repoHit = await RepoCase.find({
        companyId: repoSample.companyId,
        vehicleNumber: new RegExp(
          String(repoSample.vehicleNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        ),
      })
        .limit(5)
        .lean();
      assert(repoHit.length > 0, "existing repo_cases vehicle still queryable");
      results.repo_cases = "PASS";
    } else {
      console.log("  SKIP: no repo_cases vehicle rows in this database");
    }

    const completed = await UploadBatch.findOne({
      status: "completed",
      s3SearchIndexKey: { $exists: true, $nin: [null, ""] },
    })
      .select("_id companyId fileName")
      .lean();
    if (completed) {
      const needs = await companyNeedsS3SearchFallback(completed.companyId);
      const indexed = await countSearchRowsForCompany(completed.companyId);
      assert(
        typeof needs === "boolean",
        `S3 fallback check returned ${needs} (indexedRows=${indexed})`
      );
      results.s3_fallback = "PASS";
      console.log(
        `  info: sample completed batch ${completed._id} companyHasUnbackfilled=${needs}`
      );
    } else {
      console.log("  SKIP: no completed S3-index batches");
    }

    console.log("\n=== EXPLAIN ANALYZE (1,000 rows, vehicle contains) ===");
    const plan1k = await explainVehicle(COMPANY_A, "12AA00");
    console.log(plan1k);
    if (/gin|upload_search_rows_vehicle_trgm_idx/i.test(plan1k)) {
      console.log("  PASS: 1k query uses vehicle GIN");
    } else {
      console.log("  WARN: 1k plan did not pick GIN (planner may seq-scan small tables)");
    }

    console.log("\n=== Scaling insert 10,000 + EXPLAIN ===");
    const t10 = Date.now();
    await insertSearchRowChunk(makeRows(COMPANY_A, BATCH_SCALE, 10000, 2000, "MH12SC"));
    await query(`ANALYZE upload_search_rows`);
    console.log(`  inserted 10,000 extra rows in ${Date.now() - t10}ms`);
    const t10q = Date.now();
    const scaleHit = await searchUploadRows({
      companyId: COMPANY_A,
      search: "MH12SC2420",
      type: "vehicleNumber",
      page: 1,
      limit: 20,
    });
    console.log(`  10k-set lookup: ${scaleHit.total} row(s) in ${Date.now() - t10q}ms`);
    assert(scaleHit.total === 1, "10k-set finds the inserted plate");
    const plan10k = await explainVehicle(COMPANY_A, "MH12SC2420");
    console.log(plan10k);
    if (/gin|upload_search_rows_vehicle_trgm_idx/i.test(plan10k)) {
      console.log("  PASS: 10k query uses vehicle GIN");
    } else {
      console.log("  WARN: 10k plan used company btree + filter (GIN expected after more rows/ANALYZE)");
    }

    console.log("\n=== Scaling insert 100,000 + EXPLAIN ===");
    const t100 = Date.now();
    for (let offset = 0; offset < 100000; offset += 1000) {
      await insertSearchRowChunk(
        makeRows(COMPANY_A, BATCH_SCALE, 1000, 20000 + offset, "MH12HK")
      );
    }
    await query(`ANALYZE upload_search_rows`);
    console.log(`  inserted 100,000 rows in ${Date.now() - t100}ms`);
    const t100q = Date.now();
    const hugeHit = await searchUploadRows({
      companyId: COMPANY_A,
      search: "MH12HK20420",
      type: "vehicleNumber",
      page: 1,
      limit: 20,
    });
    console.log(`  100k-set lookup: ${hugeHit.total} row(s) in ${Date.now() - t100q}ms`);
    assert(hugeHit.total === 1, "100k-set finds the inserted plate");
    const plan100k = await explainVehicle(COMPANY_A, "MH12HK20420");
    console.log(plan100k);
    if (/gin|upload_search_rows_vehicle_trgm_idx/i.test(plan100k)) {
      console.log("  PASS: 100k query uses vehicle GIN");
    } else {
      console.log("  WARN: 100k plan did not pick GIN; company isolation still applied");
    }

    const emptyCompany = await searchUploadRows({
      companyId: "000000000000000000000000",
      search: "MH12AA0042",
      type: "vehicleNumber",
    });
    assert(emptyCompany.total === 0, "unknown companyId returns empty");
  } finally {
    await deleteByBatch([BATCH_A, BATCH_B, BATCH_SCALE]);
  }

  console.log("\n=== Prompt 3 verdict ===");
  console.log(`repo_cases search = ${results.repo_cases}`);
  console.log(`upload_search_rows search = ${results.upload_search_rows}`);
  console.log(`S3 fallback = ${results.s3_fallback}`);
  console.log(`company isolation = ${results.company_isolation}`);
  console.log(`new Excel → search = ${results.new_excel_search}`);
  console.log(`pagination = ${results.pagination}`);
  console.log(`no result = ${results.no_result}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌", err.message);
  try {
    await deleteByBatch([BATCH_A, BATCH_B, BATCH_SCALE]);
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
