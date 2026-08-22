#!/usr/bin/env node
/**
 * Populate upload_search_rows from completed uploads' s3SearchIndexKey.
 *
 *   npm run backfill:search-rows -- --dry-run
 *   npm run backfill:search-rows -- --execute --limit 1
 *   npm run backfill:search-rows -- --execute
 *
 * --limit N = at most N *pending batches* (not rows).
 * Already-indexed batches are skipped (resume-safe) unless --force.
 * Default is --dry-run (no INSERT / DELETE).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { loadSearchIndexFromS3 } = require("../src/modules/uploads/uploadFileStorage");

let headClient = null;
function getHeadClient() {
  if (!headClient) {
    headClient = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return headClient;
}
const {
  insertSearchRowChunk,
  deleteByBatch,
  countByBatch,
  toSearchRow,
} = require("../src/services/uploadSearchRows.service");
const { UPLOAD_SEARCH_CHUNK_SIZE } = require("../src/modules/uploads/upload.constants");

function parseArgs(argv) {
  const flags = {
    dryRun: true,
    execute: false,
    force: false,
    limit: 0,
    batchId: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--execute") {
      flags.execute = true;
      flags.dryRun = false;
    } else if (arg === "--force") flags.force = true;
    else if (arg === "--limit") {
      flags.limit = Number(argv[i + 1] || 0);
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      flags.limit = Number(arg.split("=")[1] || 0);
    } else if (arg === "--batch") {
      flags.batchId = String(argv[i + 1] || "");
      i += 1;
    } else if (arg.startsWith("--batch=")) {
      flags.batchId = String(arg.split("=")[1] || "");
    }
  }
  return flags;
}

function estimatedBatchRows(batch) {
  const success = Number(batch.successRows || 0);
  const total = Number(batch.totalRows || 0);
  return success > 0 ? success : total;
}

function mapIndexRow(row, batch, sourceRowIndex) {
  return toSearchRow(
    {
      companyId: row.companyId || batch.companyId,
      uploadBatchId: row.uploadBatchId || batch._id,
      customerName: row.customerName,
      mobileNumber: row.mobileNumber,
      alternateMobileNumber: row.alternateMobileNumber,
      contactPerson1Phone: row.contactPerson1Phone,
      contactPerson2Phone: row.contactPerson2Phone,
      contactPerson3Phone: row.contactPerson3Phone,
      loanAccountNumber: row.loanAccountNumber,
      referenceNumber: row.referenceNumber,
      vehicleNumber: row.vehicleNumber,
      chassisNumber: row.chassisNumber,
      engineNumber: row.engineNumber,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      addressLine1: row.addressLine1,
      bankName: row.bankName || batch.bankName,
      branchName: row.branchName || batch.branchName,
      city: row.city,
      state: row.state,
      bucket: row.bucket,
      emiAmount: row.emiAmount,
      dueAmount: row.dueAmount,
      totalOutstandingAmount: row.totalOutstandingAmount,
    },
    Number.isFinite(Number(row.sourceRowIndex))
      ? Number(row.sourceRowIndex)
      : sourceRowIndex
  );
}

async function s3KeyExists(key) {
  if (!key) return false;
  try {
    await getHeadClient().send(
      new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode || err?.name;
    if (status === 404 || err?.name === "NotFound" || err?.name === "NoSuchKey") {
      return false;
    }
    throw err;
  }
}

async function insertBatchRows(batch, rows) {
  const list = Array.isArray(rows) ? rows : [];
  let inserted = 0;
  for (let offset = 0; offset < list.length; offset += UPLOAD_SEARCH_CHUNK_SIZE) {
    const rawChunk = list.slice(offset, offset + UPLOAD_SEARCH_CHUNK_SIZE);
    const chunk = rawChunk.map((row, i) => mapIndexRow(row, batch, offset + i));
    const result = await insertSearchRowChunk(chunk);
    inserted += result.inserted;
    rawChunk.length = 0;
    chunk.length = 0;
  }
  return inserted;
}

function memoryMb() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  let peakMb = memoryMb();
  const notePeak = () => {
    peakMb = Math.max(peakMb, memoryMb());
  };
  await connectDB(process.env.DATABASE_URL);

  const allCompleted = await UploadBatch.find({ status: "completed" })
    .select("_id companyId fileName s3SearchIndexKey successRows totalRows")
    .sort({ createdAt: -1 })
    .lean();

  const withIndexKey = allCompleted.filter(
    (b) => b.s3SearchIndexKey && String(b.s3SearchIndexKey).trim()
  );

  const alreadyIndexed = [];
  const pending = [];
  for (const batch of withIndexKey) {
    const existing = await countByBatch(batch._id);
    if (existing > 0 && !flags.force) {
      alreadyIndexed.push({ batch, existing });
    } else {
      pending.push({ batch, existing });
    }
  }

  let scoped = pending;
  if (flags.batchId) {
    scoped = pending.filter((item) => String(item.batch._id) === flags.batchId);
    if (!scoped.length && flags.force) {
      const forced = withIndexKey.find((b) => String(b._id) === flags.batchId);
      if (forced) {
        const existing = await countByBatch(forced._id);
        scoped = [{ batch: forced, existing }];
      }
    }
  }
  const toProcess = flags.limit > 0 ? scoped.slice(0, flags.limit) : scoped;

  const companies = new Set(
    withIndexKey.map((b) => String(b.companyId || "")).filter(Boolean)
  );

  console.log(flags.dryRun ? "=== Backfill (dry-run) ===" : "=== Backfill (execute) ===");
  console.log(`Completed batches:       ${allCompleted.length}`);
  console.log(`With s3SearchIndexKey:   ${withIndexKey.length}`);
  console.log(`Already indexed:         ${alreadyIndexed.length}`);
  console.log(`Eligible / pending:      ${pending.length}`);
  console.log(`This run (limit ${flags.limit || "none"}): ${toProcess.length} batch(es)`);
  console.log(`Companies affected:      ${companies.size}`);
  console.log(`Chunk size:              ${UPLOAD_SEARCH_CHUNK_SIZE}`);

  let estimatedRows = 0;
  let missingS3 = 0;
  let invalidS3 = 0;
  let skipped = alreadyIndexed.length;
  let inserted = 0;
  let successful = 0;
  let failed = 0;

  for (const { batch, existing } of toProcess) {
    const estimate = estimatedBatchRows(batch);
    estimatedRows += estimate;

    try {
      const exists = await s3KeyExists(batch.s3SearchIndexKey);
      if (!exists) {
        missingS3 += 1;
        failed += 1;
        console.log(
          `  fail ${batch._id} missing S3 key type=NoSuchKey processed=0`
        );
        continue;
      }
    } catch (err) {
      invalidS3 += 1;
      failed += 1;
      console.log(
        `  fail ${batch._id} S3 head error type=${err.name || "HeadFailed"} processed=0`
      );
      continue;
    }

    if (flags.dryRun) {
      console.log(
        `  would insert ~${estimate} rows from ${batch._id}`
      );
      continue;
    }

    let rows = [];
    try {
      rows = await loadSearchIndexFromS3(batch.s3SearchIndexKey);
    } catch (err) {
      invalidS3 += 1;
      failed += 1;
      console.log(
        `  fail ${batch._id} invalid S3 index type=${err.name || "LoadFailed"} processed=0`
      );
      continue;
    }

    if (!Array.isArray(rows) || !rows.length) {
      invalidS3 += 1;
      failed += 1;
      console.log(`  fail ${batch._id} empty S3 index type=EmptyIndex processed=0`);
      continue;
    }

    try {
      if (existing > 0 && flags.force) {
        await deleteByBatch(batch._id);
      }
      const n = await insertBatchRows(batch, rows);
      inserted += n;
      successful += 1;
      notePeak();
      console.log(`  ok ${batch._id} inserted=${n} s3Rows=${rows.length}`);
    } catch (err) {
      failed += 1;
      console.log(
        `  fail ${batch._id} insert error type=${err.name || "InsertFailed"} processed=${inserted}`
      );
    } finally {
      rows.length = 0;
    }
  }

  if (flags.dryRun) {
    const pendingEstimate = pending.reduce(
      (sum, item) => sum + estimatedBatchRows(item.batch),
      0
    );
    console.log("\nSummary");
    console.log(`Completed batches:       ${allCompleted.length}`);
    console.log(`Already indexed:         ${alreadyIndexed.length}`);
    console.log(`Pending:                 ${pending.length}`);
    console.log(`Estimated rows:          ${pendingEstimate}`);
    console.log(`Missing S3 keys:         ${missingS3}`);
    console.log(`Invalid S3 indexes:      ${invalidS3}`);
    console.log(`Companies affected:      ${companies.size}`);
    console.log(`Skipped:                 ${skipped}`);
  } else {
    console.log("\nSummary");
    console.log(`Successful batches:      ${successful}`);
    console.log(`Failed batches:          ${failed}`);
    console.log(`Skipped batches:         ${skipped}`);
    console.log(`Inserted rows:           ${inserted}`);
    console.log(`Missing S3 keys:         ${missingS3}`);
    console.log(`Invalid S3 indexes:      ${invalidS3}`);
    console.log(`Peak RSS:                ${peakMb} MB`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
