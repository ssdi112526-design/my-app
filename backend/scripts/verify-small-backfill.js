#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const User = require("../src/modules/users/user.model");
const { signToken } = require("../src/utils/jwt");
const { loadSearchIndexFromS3 } = require("../src/modules/uploads/uploadFileStorage");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const {
  countByBatch,
  insertSearchRowChunk,
  toSearchRow,
  searchUploadRows,
  companyNeedsS3SearchFallback,
} = require("../src/services/uploadSearchRows.service");

const BATCH_ID = process.argv[2] || "6a893392b55fe354125401e6";

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

(async () => {
  await connectDB(process.env.DATABASE_URL);
  const batch = await UploadBatch.findById(BATCH_ID)
    .select("_id companyId s3SearchIndexKey fileName")
    .lean();
  if (!batch) throw new Error("batch not found");

  const pgCount = await countByBatch(BATCH_ID);
  const s3Rows = await loadSearchIndexFromS3(batch.s3SearchIndexKey);
  const s3Count = Array.isArray(s3Rows) ? s3Rows.length : 0;

  const sampleIdx = [0, Math.min(10, s3Count - 1), Math.min(100, s3Count - 1)].filter(
    (n, i, arr) => n >= 0 && arr.indexOf(n) === i
  );
  const mismatches = [];
  for (const i of sampleIdx) {
    const s3 = s3Rows[i] || {};
    const pg = await query(
      `SELECT "uploadBatchId", "sourceRowIndex", "vehicleNumber", "companyId"
       FROM upload_search_rows
       WHERE "uploadBatchId" = $1 AND "sourceRowIndex" = $2`,
      [BATCH_ID, i]
    );
    const row = pg.rows[0];
    if (!row) {
      mismatches.push(`missing sourceRowIndex=${i}`);
      continue;
    }
    if (String(row.companyId) !== String(batch.companyId)) mismatches.push(`company ${i}`);
    if (String(row.uploadBatchId) !== String(BATCH_ID)) mismatches.push(`batch ${i}`);
    if (normalizePlate(row.vehicleNumber) !== normalizePlate(s3.vehicleNumber)) {
      mismatches.push(`plate ${i}`);
    }
  }

  const probe = await query(
    `SELECT "vehicleNumber", "companyId"
     FROM upload_search_rows
     WHERE "uploadBatchId" = $1 AND COALESCE("vehicleNumber",'') <> ''
     ORDER BY "sourceRowIndex"
     OFFSET 20 LIMIT 1`,
    [BATCH_ID]
  );
  const plate = probe.rows[0]?.vehicleNumber || "";
  const pgSearch = await searchUploadRows({
    companyId: batch.companyId,
    search: plate,
    type: "vehicleNumber",
    page: 1,
    limit: 5,
  });

  const admin = await User.findOne({
    companyId: batch.companyId,
    role: "REPO_ADMIN",
    isActive: true,
  })
    .select("_id companyId role")
    .lean();
  let api = null;
  if (admin && plate) {
    const token = signToken({
      userId: admin._id,
      role: admin.role,
      companyId: admin.companyId,
    });
    const started = Date.now();
    const res = await fetch(
      `http://127.0.0.1:5001/api/repo-cases?search=${encodeURIComponent(plate)}&type=vehicleNumber&page=1&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    api = {
      status: res.status,
      ms: Date.now() - started,
      total: json.total,
      source: json.source || null,
      firstId: json.items?.[0]?._id || null,
    };
  }

  const beforeDup = pgCount;
  if (s3Rows[20]) {
    await insertSearchRowChunk([
      toSearchRow(
        {
          ...s3Rows[20],
          companyId: batch.companyId,
          uploadBatchId: BATCH_ID,
        },
        20
      ),
    ]);
  }
  const afterDup = await countByBatch(BATCH_ID);

  const otherPending = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM upload_batches b
       WHERE b.status = 'completed'
         AND COALESCE(b."s3SearchIndexKey", '') <> ''
         AND b."_id" <> $1
         AND NOT EXISTS (
           SELECT 1 FROM upload_search_rows r
           WHERE r."uploadBatchId" = b."_id"
           LIMIT 1
         )
     ) AS needed`,
    [BATCH_ID]
  );

  console.log(
    JSON.stringify(
      {
        batchId: BATCH_ID,
        s3Rows: s3Count,
        pgRows: pgCount,
        countsMatch: s3Count === pgCount,
        sampleMismatches: mismatches.length,
        pgSearchTotal: pgSearch.total,
        api,
        dupBefore: beforeDup,
        dupAfter: afterDup,
        otherUnbackfilledExists: Boolean(otherPending.rows[0]?.needed),
        needsS3ThisCompany: await companyNeedsS3SearchFallback(batch.companyId),
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
