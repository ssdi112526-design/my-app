#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { countByBatch, companyNeedsS3SearchFallback } = require("../src/services/uploadSearchRows.service");

(async () => {
  await connectDB(process.env.DATABASE_URL);
  const total = await query(`SELECT COUNT(*)::int AS total FROM upload_search_rows`);
  const dups = await query(`
    SELECT COUNT(*)::int AS total FROM (
      SELECT 1 FROM upload_search_rows
      GROUP BY "uploadBatchId", "sourceRowIndex"
      HAVING COUNT(*) > 1
    ) d
  `);
  const completed = await UploadBatch.find({
    status: "completed",
    s3SearchIndexKey: { $exists: true, $nin: [null, ""] },
  })
    .select("_id companyId")
    .lean();
  let indexed = 0;
  let unbackfilled = 0;
  const companies = new Set();
  for (const b of completed) {
    companies.add(String(b.companyId));
    if ((await countByBatch(b._id)) > 0) indexed += 1;
    else unbackfilled += 1;
  }
  let stillNeeds = 0;
  for (const cid of companies) {
    if (await companyNeedsS3SearchFallback(cid)) stillNeeds += 1;
  }
  await query(`ANALYZE upload_search_rows`);
  const sample = await query(`
    SELECT "companyId", "vehicleNumber"
    FROM upload_search_rows
    WHERE COALESCE("vehicleNumber",'') <> ''
    OFFSET 200 LIMIT 1
  `);
  let plan = "";
  if (sample.rows[0]) {
    const explained = await query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT * FROM upload_search_rows
       WHERE "companyId" = $1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\'
       LIMIT 20`,
      [sample.rows[0].companyId, `%${String(sample.rows[0].vehicleNumber).replace(/[%_\\]/g, "")}%`]
    );
    plan = explained.rows.map((r) => r["QUERY PLAN"]).join("\n");
  }
  console.log(
    JSON.stringify(
      {
        totalRows: total.rows[0].total,
        duplicateGroups: dups.rows[0].total,
        completedWithS3Key: completed.length,
        indexed,
        unbackfilled,
        companiesStillNeedingS3: stillNeeds,
        ginUsed: /vehicle_trgm|gin/i.test(plan),
        execMs: (plan.match(/Execution Time: ([\d.]+)/) || [])[1] || null,
        plan,
      },
      null,
      2
    )
  );
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
