#!/usr/bin/env node
/**
 * Dedicated-batch 200k E2E + search-during-upload + worker interrupt/recovery.
 * Cleans up the 200k batch at the end. Does not print PII or secrets.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execSync } = require("child_process");
const ExcelJS = require("exceljs");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { deleteByBatch } = require("../src/services/uploadSearchRows.service");
const { closeUploadQueue } = require("../src/queues/uploadQueue");

const API = "http://127.0.0.1:5001";
const ROWS = 200000;

function rssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

function percentile(times, p) {
  if (!times.length) return null;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

function workerPids() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'src/workers/worker.js\' -and $_.Name -eq \'node.exe\' } | Select-Object -ExpandProperty ProcessId"',
      { encoding: "utf8" }
    );
    return out
      .split(/\s+/)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch (_e) {
    return [];
  }
}

async function login() {
  const res = await fetch(`${API}/api/repo-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "repo.admin.01@fastrecovery.test", password: "Test@12345" }),
  });
  const json = await res.json();
  if (!json?.data?.token) throw new Error("login failed");
  return { token: json.data.token, companyId: json.data.user.companyId };
}

async function writeXlsx(rows) {
  const filePath = path.join(os.tmpdir(), `harden-200k-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useSharedStrings: true });
  const sheet = workbook.addWorksheet("Cases");
  sheet.addRow([
    "Loan Account Number",
    "Customer Name",
    "Vehicle Number",
    "Chassis Number",
    "Mobile Number",
    "Vehicle Brand",
    "Vehicle Model",
  ]).commit();
  for (let i = 1; i <= rows; i += 1) {
    const n = String(i).padStart(6, "0");
    sheet
      .addRow([
        `H2LAN${n}`,
        i === 1 ? "Rahul Harden" : `H2 Customer ${n}`,
        i === 1 ? "HR26AB9999" : `H2VH${n}`,
        `H2CH${n}XXXXXXX`,
        9700000000 + (i % 100000000),
        "TATA",
        "NEXON",
      ])
      .commit();
  }
  await workbook.commit();
  return filePath;
}

async function uiUpload(token, filePath) {
  const buffer = fs.readFileSync(filePath);
  const presign = await fetch(`${API}/api/uploads/s3/presign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      bankName: "Harden Bank",
      branchName: "Harden Branch",
      fileName: "harden-200k.xlsx",
    }),
  });
  const data = (await presign.json()).data || {};
  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": data.contentType },
    body: buffer,
  });
  if (!put.ok) throw new Error(`S3 PUT ${put.status}`);
  const complete = await fetch(`${API}/api/uploads/s3/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      batchId: data.batchId,
      bankName: "Harden Bank",
      branchName: "Harden Branch",
    }),
  });
  return { batchId: String(data.batchId), completeStatus: complete.status, putStatus: put.status };
}

async function poll(token, batchId) {
  const res = await fetch(`${API}/api/uploads/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data || {};
}

async function searchOnce(token, q, type) {
  const started = Date.now();
  const res = await fetch(
    `${API}/api/repo-cases?search=${encodeURIComponent(q)}&type=${type}&page=1&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  return { ms: Date.now() - started, status: res.status, total: json.total, success: json.success };
}

(async () => {
  const report = { env: "local-api-shared-pg", rssStart: rssMb() };
  await connectDB(process.env.DATABASE_URL);
  const auth = await login();

  const writeStart = Date.now();
  const filePath = await writeXlsx(ROWS);
  report.excelWriteMs = Date.now() - writeStart;
  report.excelMb = Math.round((fs.statSync(filePath).size / 1024 / 1024) * 10) / 10;

  const uploadStart = Date.now();
  const uploaded = await uiUpload(auth.token, filePath);
  report.upload = { ...uploaded, queueWaitMs: Date.now() - uploadStart };
  const batchId = uploaded.batchId;

  const searchTimes = [];
  const searchErrors = [];
  let sawProcessing = false;
  let killed = false;
  let workerRestarted = false;
  const statuses = [];
  const loopStart = Date.now();

  while (Date.now() - loopStart < 15 * 60 * 1000) {
    const doc = await poll(auth.token, batchId);
    if (!statuses.length || statuses[statuses.length - 1] !== doc.status) {
      statuses.push(doc.status);
    }
    if (doc.status === "processing") sawProcessing = true;

    const s = await searchOnce(auth.token, "E2E26", "vehicleNumber").catch((err) => {
      searchErrors.push(err.message);
      return null;
    });
    if (s) searchTimes.push(s.ms);

    if (sawProcessing && !killed) {
      const pids = workerPids();
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGTERM");
        } catch (_e) {
          /* ignore */
        }
      }
      killed = true;
      await new Promise((r) => setTimeout(r, 2500));
      spawn("npm", ["run", "worker"], {
        cwd: path.join(__dirname, ".."),
        detached: true,
        stdio: "ignore",
        shell: true,
      }).unref();
      workerRestarted = true;
    }

    if (doc.status === "completed" || doc.status === "failed") {
      report.finalBatch = {
        status: doc.status,
        totalRows: doc.totalRows,
        successRows: doc.successRows,
        failedRows: doc.failedRows,
        processedRows: doc.processedRows,
      };
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  report.worker = { sawProcessing, killed, workerRestarted, statuses };
  report.processingMs = Date.now() - uploadStart;
  const count = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [batchId]
  );
  const dups = await query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT "sourceRowIndex" FROM upload_search_rows
       WHERE "uploadBatchId" = $1 GROUP BY "sourceRowIndex" HAVING COUNT(*) > 1
     ) t`,
    [batchId]
  );
  report.db = {
    inserted: count.rows[0].n,
    successRows: report.finalBatch?.successRows,
    duplicates: dups.rows[0].n,
  };
  report.searchDuring = {
    n: searchTimes.length,
    errors: searchErrors.length,
    p50: percentile(searchTimes, 50),
    p95: percentile(searchTimes, 95),
    p99: percentile(searchTimes, 99),
  };

  const afterExact = await searchOnce(auth.token, "HR26AB9999", "vehicleNumber");
  const afterPrefix = await searchOnce(auth.token, "H2VH", "vehicleNumber");
  report.searchAfter = { exact: afterExact, prefix: afterPrefix };

  await deleteByBatch(batchId);
  await UploadBatch.deleteOne({ _id: batchId });
  report.cleanedUp = true;
  report.rssEnd = rssMb();

  try {
    fs.unlinkSync(filePath);
  } catch (_e) {
    /* ignore */
  }

  console.log(JSON.stringify(report, null, 2));
  await closeUploadQueue();
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(err.stack || err.message);
  try {
    await closeUploadQueue();
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
