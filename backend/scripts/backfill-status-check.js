#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const User = require("../src/modules/users/user.model");
const { signToken } = require("../src/utils/jwt");
const {
  countByBatch,
  searchUploadRows,
  companyNeedsS3SearchFallback,
} = require("../src/services/uploadSearchRows.service");

(async () => {
  await connectDB(process.env.DATABASE_URL);
  const total = await query(`SELECT COUNT(*)::int AS total FROM upload_search_rows`);
  const dups = await query(`
    SELECT COUNT(*)::int AS total FROM (
      SELECT 1
      FROM upload_search_rows
      GROUP BY "uploadBatchId", "sourceRowIndex"
      HAVING COUNT(*) > 1
    ) d
  `);
  const byBatch = await query(`
    SELECT "uploadBatchId", COUNT(*)::int AS rows
    FROM upload_search_rows
    GROUP BY "uploadBatchId"
    ORDER BY COUNT(*) DESC
  `);

  const completed = await UploadBatch.find({
    status: "completed",
    s3SearchIndexKey: { $exists: true, $nin: [null, ""] },
  })
    .select("_id companyId successRows totalRows")
    .lean();
  let indexed = 0;
  let unbackfilled = 0;
  for (const b of completed) {
    const n = await countByBatch(b._id);
    if (n > 0) indexed += 1;
    else unbackfilled += 1;
  }

  await query(`ANALYZE upload_search_rows`);
  const company = byBatch.rows[0]?.uploadBatchId
    ? (
        await query(
          `SELECT "companyId", "vehicleNumber" FROM upload_search_rows WHERE "uploadBatchId" = $1 AND COALESCE("vehicleNumber",'') <> '' OFFSET 50 LIMIT 1`,
          [byBatch.rows[0].uploadBatchId]
        )
      ).rows[0]
    : null;
  let plan = "";
  if (company?.vehicleNumber) {
    const explained = await query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT * FROM upload_search_rows
       WHERE "companyId" = $1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\'
       LIMIT 20`,
      [company.companyId, `%${String(company.vehicleNumber).replace(/[%_\\]/g, "")}%`]
    );
    plan = explained.rows.map((r) => r["QUERY PLAN"]).join("\n");
  }

  const demoAdmin = await User.findOne({
    email: "repo.admin.01@fastrecovery.test",
  })
    .select("_id role companyId")
    .lean();
  const token = signToken({
    userId: demoAdmin._id,
    role: demoAdmin.role,
    companyId: demoAdmin.companyId,
  });
  const search = async (q, type) => {
    const started = Date.now();
    const res = await fetch(
      `http://127.0.0.1:5001/api/repo-cases?search=${encodeURIComponent(q)}&type=${type}&page=1&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    return { ms: Date.now() - started, total: json.total, source: json.source || null };
  };

  const newUpload = await search("P3UI0042", "vehicleNumber");
  const repoCase = await search("DL01TE01", "vehicleNumber");
  const none = await search("ZZ99NOTFOUND", "vehicleNumber");
  const hist = company?.vehicleNumber
    ? await searchUploadRows({
        companyId: company.companyId,
        search: company.vehicleNumber,
        type: "vehicleNumber",
        page: 1,
        limit: 5,
      })
    : { total: 0 };
  const isolation = await searchUploadRows({
    companyId: demoAdmin.companyId,
    search: company?.vehicleNumber || "P3UI0042",
    type: "vehicleNumber",
    page: 1,
    limit: 5,
  });

  console.log(
    JSON.stringify(
      {
        totalRows: total.rows[0].total,
        duplicateGroups: dups.rows[0].total,
        batches: byBatch.rows,
        completedWithS3Key: completed.length,
        indexed,
        unbackfilled,
        analyzeDone: true,
        ginUsed: /vehicle_trgm|gin/i.test(plan),
        plan,
        searches: { newUpload, repoCase, none, histTotal: hist.total, isolationDemoOnHist: isolation.total },
        anyCompanyNeedsS3: await companyNeedsS3SearchFallback(company?.companyId),
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
