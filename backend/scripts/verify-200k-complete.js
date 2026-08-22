#!/usr/bin/env node
/**
 * Post-recovery verification for dedicated 200k harden batch.
 * Measures search + concurrency on local API + shared PostgreSQL.
 * Cleans up the 200k batch at the end.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { deleteByBatch } = require("../src/services/uploadSearchRows.service");
const { closeUploadQueue } = require("../src/queues/uploadQueue");

const API = "http://127.0.0.1:5001";
const BATCH_ID = process.argv[2] || "6a898097bffbbb6a887f5f01";

function percentile(times, p) {
  if (!times.length) return null;
  const s = [...times].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

function summarize(times, errors) {
  return {
    n: times.length,
    errors,
    errorRate: times.length + errors ? Number(((errors / (times.length + errors)) * 100).toFixed(2)) : 0,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    min: times.length ? Math.min(...times) : null,
    max: times.length ? Math.max(...times) : null,
  };
}

async function login(email) {
  const res = await fetch(`${API}/api/repo-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test@12345" }),
  });
  const json = await res.json();
  if (!json?.data?.token) throw new Error(`login failed ${email} ${res.status}`);
  return json.data.token;
}

async function search(token, q, type, page = 1, limit = 50) {
  const started = Date.now();
  const res = await fetch(
    `${API}/api/repo-cases?search=${encodeURIComponent(q)}&type=${type}&page=${page}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  return {
    ms: Date.now() - started,
    status: res.status,
    total: json.total,
    items: (json.items || json.data || []).length,
    hasNext: json.hasNext,
    hasPrevious: json.hasPrevious,
    page: json.page,
    pageSize: json.pageSize,
    s3: json.searchSource === "s3" || json.hit === "s3",
    hit: json.hit || json.searchSource || null,
  };
}

async function runWave(token, concurrency, queries) {
  const times = [];
  let errors = 0;
  const workers = Array.from({ length: concurrency }, async (_, i) => {
    const q = queries[i % queries.length];
    try {
      const r = await search(token, q.q, q.type);
      if (r.status >= 400) errors += 1;
      else times.push(r.ms);
    } catch (_e) {
      errors += 1;
    }
  });
  await Promise.all(workers);
  return { times, errors };
}

(async () => {
  const report = {
    env: "local Express API (localhost:5001) + shared remote PostgreSQL — NOT production",
    batchId: BATCH_ID,
  };
  await connectDB(process.env.DATABASE_URL);

  const doc = await UploadBatch.findById(BATCH_ID).lean();
  const count = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [BATCH_ID]
  );
  const dups = await query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT "sourceRowIndex" FROM upload_search_rows
       WHERE "uploadBatchId" = $1 GROUP BY "sourceRowIndex" HAVING COUNT(*) > 1
     ) t`,
    [BATCH_ID]
  );
  const companies = await query(
    `SELECT COUNT(DISTINCT "companyId")::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [BATCH_ID]
  );

  report.batch = doc
    ? {
        status: doc.status,
        totalRows: doc.totalRows,
        successRows: doc.successRows,
        failedRows: doc.failedRows,
        processedRows: doc.processedRows,
        importMode: doc.importMode,
        companyId: String(doc.companyId || ""),
      }
    : null;
  report.db = {
    inserted: count.rows[0].n,
    duplicates: dups.rows[0].n,
    distinctCompanies: companies.rows[0].n,
    matchesSuccessRows: count.rows[0].n === Number(doc?.successRows || 0),
  };

  const tokenA = await login("repo.admin.01@fastrecovery.test");
  const tokenB = await login("repo.admin.02@fastrecovery.test");

  const cases = [
    ["HR26AB9999", "vehicleNumber", "exactVehicle"],
    ["H2VH", "vehicleNumber", "partialVehicle"],
    ["Rahul Harden", "general", "customer"],
    ["H2LAN000001", "loanAccountNumber", "loan"],
    ["9700000001", "mobileNumber", "mobile"],
    ["ZZ99NOMATCH", "vehicleNumber", "noMatch"],
    ["H2VH000002", "vehicleNumber", "page1"],
  ];
  report.searchAfter = {};
  for (const [q, type, name] of cases) {
    report.searchAfter[name] = await search(tokenA, q, type);
  }
  report.searchAfter.page2 = await search(tokenA, "H2VH", "vehicleNumber", 2, 50);
  report.searchAfter.companyB = await search(tokenB, "HR26AB9999", "vehicleNumber");
  report.searchAfter.unauth = (await fetch(`${API}/api/repo-cases?search=HR26AB9999&type=vehicleNumber`)).status;

  const queries = [
    { q: "HR26AB9999", type: "vehicleNumber" },
    { q: "H2VH000100", type: "vehicleNumber" },
    { q: "Rahul Harden", type: "general" },
    { q: "H2LAN000010", type: "loanAccountNumber" },
    { q: "9700000010", type: "mobileNumber" },
    { q: "H2VH", type: "vehicleNumber" },
    { q: "NOMATCHXYZ", type: "vehicleNumber" },
  ];

  report.concurrency = { env: report.env };
  for (const n of [10, 25, 50]) {
    const times = [];
    let errors = 0;
    for (let round = 0; round < 3; round += 1) {
      const wave = await runWave(tokenA, n, queries);
      times.push(...wave.times);
      errors += wave.errors;
    }
    report.concurrency[`${n}users`] = summarize(times, errors);
  }

  await deleteByBatch(BATCH_ID);
  await UploadBatch.deleteOne({ _id: BATCH_ID });
  const leftover = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [BATCH_ID]
  );
  report.cleanedUp = leftover.rows[0].n === 0;

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
