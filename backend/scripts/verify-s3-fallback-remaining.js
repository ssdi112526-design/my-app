#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const User = require("../src/modules/users/user.model");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { signToken } = require("../src/utils/jwt");
const { loadSearchIndexFromS3 } = require("../src/modules/uploads/uploadFileStorage");
const {
  countByBatch,
  searchUploadRows,
  companyNeedsS3SearchFallback,
} = require("../src/services/uploadSearchRows.service");

(async () => {
  await connectDB(process.env.DATABASE_URL);
  const batches = await UploadBatch.find({
    status: "completed",
    s3SearchIndexKey: { $exists: true, $nin: [null, ""] },
  })
    .select("_id companyId s3SearchIndexKey")
    .sort({ createdAt: -1 })
    .lean();

  const pending = [];
  for (const batch of batches) {
    if ((await countByBatch(batch._id)) === 0) pending.push(batch);
  }
  if (!pending.length) {
    console.log(JSON.stringify({ remaining: 0 }));
    await mongoose.disconnect();
    return;
  }

  let target = pending[0];
  let plate = "";
  let pg = { total: 0 };
  for (const batch of pending) {
    const rows = await loadSearchIndexFromS3(batch.s3SearchIndexKey);
    target = batch;
    let checked = 0;
    for (const row of rows) {
      const candidate = String(row?.vehicleNumber || "")
        .replace(/[\s\-_.]/g, "")
        .toUpperCase();
      if (candidate.length < 4) continue;
      checked += 1;
      const found = await searchUploadRows({
        companyId: batch.companyId,
        search: candidate,
        type: "vehicleNumber",
        page: 1,
        limit: 1,
      });
      if (found.total === 0) {
        plate = candidate;
        pg = found;
        break;
      }
      if (checked >= 25) break;
    }
    rows.length = 0;
    if (plate) break;
  }
  const needs = await companyNeedsS3SearchFallback(target.companyId);
  const admin = await User.findOne({
    companyId: target.companyId,
    role: "REPO_ADMIN",
    isActive: true,
  })
    .select("_id role companyId")
    .lean();
  let api = null;
  if (admin && plate) {
    const token = signToken({
      userId: admin._id,
      role: admin.role,
      companyId: admin.companyId,
    });
    const res = await fetch(
      `http://127.0.0.1:5001/api/repo-cases?search=${encodeURIComponent(plate)}&type=vehicleNumber&page=1&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    api = { status: res.status, total: json.total, source: json.source || null };
  }

  console.log(
    JSON.stringify(
      {
        pendingBatch: String(target._id),
        pgTotal: pg.total,
        needsS3: needs,
        api,
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
