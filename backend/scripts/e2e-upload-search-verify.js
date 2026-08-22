#!/usr/bin/env node
/**
 * Production-path E2E: UI API (presign→S3→complete) → worker → PG → search.
 * Masks PII. Does not print secrets.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../src/db/mongooseAlias");

const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { query } = require("../src/db/pool");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const { enqueueUploadJob } = require("../src/queues/uploadQueue");
const { closeUploadQueue } = require("../src/queues/uploadQueue");
const { companyNeedsS3SearchFallback } = require("../src/services/uploadSearchRows.service");

const API = process.env.E2E_API || "http://127.0.0.1:5001";
const PASSWORD = "Test@12345";
const ADMIN_A = "repo.admin.01@fastrecovery.test";
const ADMIN_B = "repo.admin.02@fastrecovery.test";
const VALID_ROWS = 195;
const INVALID_ROWS = 5;
const TOTAL_ROWS = VALID_ROWS + INVALID_ROWS;
const BANK = "E2E Verify Bank";
const BRANCH = "E2E Delhi";

function rssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

async function login(email) {
  const res = await fetch(`${API}/api/repo-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json?.data?.token) throw new Error(`login failed (${res.status})`);
  return { token: json.data.token, companyId: json.data.user?.companyId || json.data.companyId };
}

async function api(token, method, urlPath, body, extraHeaders) {
  const headers = { Authorization: `Bearer ${token}`, ...(extraHeaders || {}) };
  let payload;
  if (body && !(body instanceof Buffer) && !(typeof FormData !== "undefined" && body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  } else {
    payload = body;
  }
  const started = Date.now();
  const res = await fetch(`${API}${urlPath}`, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, json };
}

async function buildExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cases");
  sheet.addRow([
    "Loan Account Number",
    "Customer Name",
    "Vehicle Number",
    "Chassis Number",
    "Mobile Number",
    "Vehicle Brand",
    "Vehicle Model",
  ]);
  sheet.addRow(["LN12345", "Rahul E2E", "HR26AB1234", "E2ECHASSIS0001XXXX", 9811100001, "TATA", "NEXON"]);
  for (let i = 2; i <= VALID_ROWS; i += 1) {
    const n = String(i).padStart(4, "0");
    sheet.addRow([
      `E2ELAN${n}`,
      `E2E Customer ${n}`,
      `E2E26AB${n}`,
      `E2ECHASSIS${n}XXXX`,
      9811100000 + i,
      "TATA",
      "NEXON",
    ]);
  }
  for (let i = 1; i <= INVALID_ROWS; i += 1) {
    sheet.addRow([`E2EBAD${i}`, "", `E2EBADVEH${i}`, "", 9811190000 + i, "TATA", "NEXON"]);
  }
  const filePath = path.join(os.tmpdir(), `e2e-verify-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function uiUpload(token, filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const presign = await api(token, "POST", "/api/uploads/s3/presign", {
    bankName: BANK,
    branchName: BRANCH,
    fileName,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const data = presign.json?.data || {};
  if (!data.batchId || !data.uploadUrl) {
    throw new Error(`presign failed: ${presign.status} ${presign.json?.message || ""}`);
  }

  let s3Put = { status: 0, via: "presigned" };
  try {
    const putRes = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": data.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      body: buffer,
    });
    s3Put = { status: putRes.status, via: "presigned" };
    if (!putRes.ok) throw new Error(`presigned PUT ${putRes.status}`);
  } catch (_err) {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
    form.append("batchId", String(data.batchId));
    const proxy = await fetch(`${API}/api/uploads/s3/proxy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const proxyJson = await proxy.json().catch(() => ({}));
    if (!proxy.ok || proxyJson.success === false) {
      throw new Error(`S3 proxy failed: ${proxy.status} ${proxyJson.message || ""}`);
    }
    s3Put = { status: proxy.status, via: "proxy" };
  }

  const complete = await api(token, "POST", "/api/uploads/s3/complete", {
    batchId: data.batchId,
    bankName: BANK,
    branchName: BRANCH,
  });

  return {
    batchId: String(data.batchId),
    presignStatus: presign.status,
    s3Put,
    completeStatus: complete.status,
    queued: Boolean(complete.json?.processing || complete.status === 202),
  };
}

async function pollBatch(token, batchId, timeoutMs = 120000) {
  const seen = [];
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const res = await api(token, "GET", `/api/uploads/${batchId}`);
    const doc = res.json?.data || {};
    const snap = {
      status: doc.status,
      processedRows: doc.processedRows,
      totalRows: doc.totalRows,
      successRows: doc.successRows,
      failedRows: doc.failedRows,
      ms: Date.now() - started,
    };
    if (!seen.length || seen[seen.length - 1].status !== snap.status) seen.push(snap);
    last = { ...snap, columnNames: doc.columnNames, failedDetails: doc.failedDetails || [], queueJobId: doc.queueJobId, storedFilePath: doc.storedFilePath ? "present" : "" };
    if (doc.status === "completed" || doc.status === "failed") break;
    await new Promise((r) => setTimeout(r, 400));
  }
  return { seen, last, elapsedMs: Date.now() - started };
}

async function searchApi(token, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await api(token, "GET", `/api/repo-cases?${qs}`);
  const items = res.json?.items || [];
  return {
    status: res.status,
    ms: res.ms,
    success: res.json.success,
    total: res.json.total,
    page: res.json.page,
    limit: res.json.limit,
    source: res.json.source || null,
    itemCount: items.length,
    hasNext: Number(res.json.total || 0) > Number(res.json.page || 1) * Number(res.json.limit || 0),
    hasPrevious: Number(res.json.page || 1) > 1,
    sampleHasCustomer: Boolean(items[0]?.customerName),
    sampleHasVehicle: Boolean(items[0]?.vehicleNumber),
  };
}

async function explainSearch(companyId, type, pattern) {
  const col =
    type === "vehicleNumber"
      ? "vehicleNumber"
      : type === "loanAccountNumber"
        ? "loanAccountNumber"
        : type === "customerName"
          ? "customerName"
          : type === "phoneDigits"
            ? "phoneDigits"
            : "vehicleNumber";
  const result = await query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
     SELECT * FROM upload_search_rows
     WHERE "companyId" = $1 AND "${col}" ILIKE $2 ESCAPE '\\'
     ORDER BY "createdAt" DESC, "sourceRowIndex" ASC
     LIMIT 50`,
    [companyId, pattern]
  );
  const plan = result.rows.map((r) => r["QUERY PLAN"]).join("\n");
  return {
    type,
    execMs: Number((plan.match(/Execution Time: ([\d.]+)/) || [])[1] || 0),
    planMs: Number((plan.match(/Planning Time: ([\d.]+)/) || [])[1] || 0),
    gin: /gin|trgm/i.test(plan),
    bitmap: /Bitmap Index Scan/i.test(plan),
    seq: /Seq Scan/i.test(plan),
    index:
      (plan.match(/Bitmap Index Scan on "?([A-Za-z0-9_]+)"?/i) ||
        plan.match(/Index Scan (?:using |on )"?([A-Za-z0-9_]+)"?/i) ||
        [])[1] || null,
    heapBlocks: Number((plan.match(/Heap Blocks: exact=(\d+)/) || [])[1] || 0),
    rowsRemoved: Number((plan.match(/Rows Removed by Filter: (\d+)/) || [])[1] || 0),
  };
}

(async () => {
  const report = { env: "local-api-against-shared-pg", rssStart: rssMb() };
  await connectDB(process.env.DATABASE_URL);

  const filePath = await buildExcel();
  const authA = await login(ADMIN_A);
  const authB = await login(ADMIN_B);
  report.loginA = { ok: Boolean(authA.token) };
  report.loginB = { ok: Boolean(authB.token), differentCompany: authA.companyId !== authB.companyId };

  const unauth = await fetch(`${API}/api/repo-cases?search=E2E26&type=vehicleNumber`);
  report.unauthSearch = { status: unauth.status };

  const upload1 = await uiUpload(authA.token, filePath, "e2e-verify-200.xlsx");
  report.upload1 = upload1;
  const poll1 = await pollBatch(authA.token, upload1.batchId);
  report.poll1 = poll1;

  const count1 = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [upload1.batchId]
  );
  const dups = await query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT "sourceRowIndex" FROM upload_search_rows
       WHERE "uploadBatchId" = $1
       GROUP BY "sourceRowIndex" HAVING COUNT(*) > 1
     ) t`,
    [upload1.batchId]
  );
  const presence = await query(
    `SELECT
       COUNT(*) FILTER (WHERE "companyId" <> '')::int AS company,
       COUNT(*) FILTER (WHERE "uploadBatchId" <> '')::int AS batch,
       COUNT(*) FILTER (WHERE "customerName" <> '')::int AS customer,
       COUNT(*) FILTER (WHERE "loanAccountNumber" <> '')::int AS loan,
       COUNT(*) FILTER (WHERE "vehicleNumber" <> '')::int AS vehicle,
       COUNT(*) FILTER (WHERE "chassisNumber" <> '')::int AS chassis,
       COUNT(*) FILTER (WHERE "mobileNumber" <> '')::int AS mobile
     FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [upload1.batchId]
  );
  const idx = await query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'upload_search_rows' ORDER BY indexname`
  );
  const needsS3 = await companyNeedsS3SearchFallback(authA.companyId);

  report.db = {
    inserted: count1.rows[0].n,
    expectedValid: VALID_ROWS,
    successRows: poll1.last?.successRows,
    failedRows: poll1.last?.failedRows,
    duplicateSourceRows: dups.rows[0].n,
    fieldsPresentCounts: presence.rows[0],
    indexes: idx.rows.map((r) => r.indexname),
    companyNeedsS3Fallback: needsS3,
    objectObjectHeaders: (poll1.last?.columnNames || []).some((h) => String(h).includes("[object Object]")),
  };

  const searches = {};
  searches.vehicleExact = await searchApi(authA.token, { search: "HR26AB1234", type: "vehicleNumber", page: 1, limit: 50 });
  searches.vehiclePartial = await searchApi(authA.token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 50 });
  searches.customer = await searchApi(authA.token, { search: "Rahul", type: "general", page: 1, limit: 50 });
  searches.loan = await searchApi(authA.token, { search: "LN12345", type: "loanAccountNumber", page: 1, limit: 50 });
  searches.mobile = await searchApi(authA.token, { search: "9811100001", type: "mobileNumber", page: 1, limit: 50 });
  searches.nomatch = await searchApi(authA.token, { search: "ZZ99NOMATCHX", type: "vehicleNumber", page: 1, limit: 50 });
  searches.caseInsensitive = await searchApi(authA.token, { search: "e2e26ab0002", type: "vehicleNumber", page: 1, limit: 50 });
  searches.page1 = await searchApi(authA.token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 50 });
  searches.page2 = await searchApi(authA.token, { search: "E2E26", type: "vehicleNumber", page: 2, limit: 50 });
  searches.limit500 = await searchApi(authA.token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 500 });
  searches.limit200 = await searchApi(authA.token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 200 });
  searches.companyB = await searchApi(authB.token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 50 });
  report.searches = searches;

  report.explain = {
    vehicleExact: await explainSearch(authA.companyId, "vehicleNumber", "%HR26AB1234%"),
    vehiclePartial: await explainSearch(authA.companyId, "vehicleNumber", "%E2E26%"),
    customer: await explainSearch(authA.companyId, "customerName", "%Rahul%"),
    loan: await explainSearch(authA.companyId, "loanAccountNumber", "%LN12345%"),
    mobile: await explainSearch(authA.companyId, "phoneDigits", "%9811100001%"),
    nomatch: await explainSearch(authA.companyId, "vehicleNumber", "%ZZ99NOMATCHX%"),
  };

  const dupComplete = await api(authA.token, "POST", "/api/uploads/s3/complete", {
    batchId: upload1.batchId,
    bankName: BANK,
    branchName: BRANCH,
  });
  const queueDup = await enqueueUploadJob({
    batchId: upload1.batchId,
    companyId: authA.companyId,
    userId: "e2e",
    bankName: BANK,
    branchName: BRANCH,
    fileName: "e2e-verify-200.xlsx",
    s3Key: "x",
  });
  const countAfterDupJob = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [upload1.batchId]
  );
  report.duplicateSameBatch = {
    completeAgainStatus: dupComplete.status,
    enqueue: { queued: queueDup.queued, duplicate: queueDup.duplicate, state: queueDup.state || "" },
    rowsUnchanged: countAfterDupJob.rows[0].n === count1.rows[0].n,
    count: countAfterDupJob.rows[0].n,
  };

  const upload2 = await uiUpload(authA.token, filePath, "e2e-verify-200-dup.xlsx");
  const poll2 = await pollBatch(authA.token, upload2.batchId);
  const count2 = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [upload2.batchId]
  );
  report.upload2 = {
    batchId: upload2.batchId,
    differentBatch: upload2.batchId !== upload1.batchId,
    successRows: poll2.last?.successRows,
    inserted: count2.rows[0].n,
    status: poll2.last?.status,
  };

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
