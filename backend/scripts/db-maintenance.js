/**
 * PostgreSQL storage maintenance (Excel files stay on S3).
 *
 *   node scripts/db-maintenance.js report
 *   node scripts/db-maintenance.js cleanup --strip-excel-fields
 *   node scripts/db-maintenance.js cleanup --light
 *   node scripts/db-maintenance.js cleanup --full
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");
const mongoose = require("mongoose");

const RepoCase = require("../src/modules/repoCases/repoCase.model");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const AuditLog = require("../src/modules/auditLogs/auditLog.model");
const LocationSnapshot = require("../src/modules/locationSnapshots/locationSnapshot.model");
const Notification = require("../src/modules/notifications/notification.model");
const OtpLog = require("../src/modules/otpLogs/otpLog.model");
const Confirmation = require("../src/modules/confirmations/confirmation.model");

async function report() {
  const stats = await mongoose.connection.db.stats();
  console.log("\n=== Database storage ===");
  console.log(`Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Index size: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `Total (approx): ${((stats.dataSize + stats.indexSize) / 1024 / 1024).toFixed(2)} MB\n`
  );

  const rows = [
    ["RepoCase", RepoCase],
    ["UploadBatch", UploadBatch],
    ["Confirmation", Confirmation],
    ["AuditLog", AuditLog],
    ["LocationSnapshot", LocationSnapshot],
    ["Notification", Notification],
    ["OtpLog", OtpLog],
  ];

  console.log("=== Document counts ===");
  for (const [name, Model] of rows) {
    console.log(`${name}: ${(await Model.countDocuments()).toLocaleString()}`);
  }

  const withExcel = await RepoCase.countDocuments({
    excelFields: { $exists: true, $ne: {} },
  });
  console.log(`\nRepoCase with excelFields (safe to remove): ${withExcel.toLocaleString()}`);
}

async function cleanup(flags) {
  if (flags.light) {
    flags.logs = true;
    flags.failedBatches = true;
    flags.stripExcelFields = true;
  }
  if (flags.full) {
    flags.light = true;
    flags.allCases = true;
  }

  if (flags.logs) {
    const [a, l, n, o] = await Promise.all([
      AuditLog.deleteMany({}),
      LocationSnapshot.deleteMany({}),
      Notification.deleteMany({}),
      OtpLog.deleteMany({}),
    ]);
    console.log("Logs cleared:", {
      audit: a.deletedCount,
      locations: l.deletedCount,
      notifications: n.deletedCount,
      otp: o.deletedCount,
    });
  }

  if (flags.failedBatches) {
    const failed = await UploadBatch.find({
      $or: [{ status: "failed" }, { status: "processing" }],
    }).select("_id");
    const ids = failed.map((b) => b._id);
    if (ids.length) {
      const rc = await RepoCase.deleteMany({ uploadBatchId: { $in: ids } });
      const ub = await UploadBatch.deleteMany({ _id: { $in: ids } });
      console.log("Failed/processing batches removed:", ub.deletedCount, "cases:", rc.deletedCount);
    }
  }

  if (flags.stripExcelFields) {
    const r = await RepoCase.updateMany(
      { excelFields: { $exists: true } },
      { $unset: { excelFields: "" } }
    );
    console.log("Stripped excelFields from cases:", r.modifiedCount);
  }

  if (flags.allCases) {
    const [rc, ub, conf] = await Promise.all([
      RepoCase.deleteMany({}),
      UploadBatch.deleteMany({}),
      Confirmation.deleteMany({}),
    ]);
    console.log("FULL cleanup:", {
      cases: rc.deletedCount,
      uploadBatches: ub.deletedCount,
      confirmations: conf.deletedCount,
    });
    console.log("Excel files remain on S3 — delete old keys in AWS S3 console if needed.");
  }
}

async function main() {
  const cmd = process.argv[2];
  const flags = {
    light: process.argv.includes("--light"),
    full: process.argv.includes("--full"),
    logs: process.argv.includes("--logs"),
    stripExcelFields: process.argv.includes("--strip-excel-fields"),
    failedBatches: process.argv.includes("--failed-batches"),
    allCases: process.argv.includes("--all-cases"),
  };

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE_URL);
  console.log("Connected to PostgreSQL\n");

  try {
    if (cmd === "report") {
      await report();
    } else if (cmd === "cleanup") {
      if (!flags.light && !flags.full && !Object.values(flags).some((v) => v === true)) {
        console.error("Use: cleanup --light | --full | or individual flags");
        process.exit(1);
      }
      await cleanup(flags);
      await report();
    } else {
      console.log(`Usage:
  node scripts/db-maintenance.js report
  node scripts/db-maintenance.js cleanup --light
  node scripts/db-maintenance.js cleanup --full`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
