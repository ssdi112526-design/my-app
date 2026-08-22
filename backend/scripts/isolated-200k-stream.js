#!/usr/bin/env node
/**
 * Isolated: stream-write 200k xlsx and parse with excelStream. No production DB/S3.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const { streamExcelFromReadable } = require("../src/services/excelStream.service");
const { Client, PERF_DATABASE_URL, COMPANY_LARGE, NEEDLE, summarizeTimes } = require("./perf-local-common");

function rssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

async function writeXlsx(rows) {
  const filePath = path.join(os.tmpdir(), `isolated-200k-${Date.now()}.xlsx`);
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
    sheet.addRow([`I2LAN${n}`, `Iso Customer ${n}`, `I2VH${n}`, `I2CH${n}XXXXXXX`, 9000000000 + (i % 100000000), "TATA", "NEXON"]).commit();
  }
  await workbook.commit();
  return filePath;
}

async function benchSearch(client, name, sql, params, repeats) {
  const times = [];
  for (let i = 0; i < repeats; i += 1) {
    const t = Date.now();
    await client.query(sql, params);
    times.push(Date.now() - t);
  }
  return { name, ...summarizeTimes(times) };
}

(async () => {
  const ROWS = 200000;
  const writeStart = Date.now();
  const rssBeforeWrite = rssMb();
  const filePath = await writeXlsx(ROWS);
  const writeMs = Date.now() - writeStart;
  const fileMb = Math.round((fs.statSync(filePath).size / 1024 / 1024) * 10) / 10;

  const rssBeforeParse = rssMb();
  let parsed = 0;
  let maxChunk = 0;
  let chunks = 0;
  let objectObject = false;
  const parseStart = Date.now();
  const result = await streamExcelFromReadable(fs.createReadStream(filePath), async ({ rows, headers }) => {
    chunks += 1;
    maxChunk = Math.max(maxChunk, rows.length);
    parsed += rows.length;
    if ((headers || []).some((h) => String(h).includes("[object Object]"))) objectObject = true;
  });
  const parseMs = Date.now() - parseStart;
  const rssAfterParse = rssMb();

  const client = new Client({ connectionString: PERF_DATABASE_URL });
  await client.connect();
  const cid = COMPANY_LARGE;
  const searches = [];
  searches.push(await benchSearch(client, "vehicle exact", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.vehicleExact}%`], 7));
  searches.push(await benchSearch(client, "vehicle partial", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.vehiclePartial}%`], 5));
  searches.push(await benchSearch(client, "customer", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "customerName" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.customer}%`], 7));
  searches.push(await benchSearch(client, "loan", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "loanAccountNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.loan}%`], 7));
  searches.push(await benchSearch(client, "mobile", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "phoneDigits" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.phone}%`], 7));
  searches.push(await benchSearch(client, "nomatch", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50`, [cid, `%${NEEDLE.none}%`], 7));
  searches.push(await benchSearch(client, "page2", `SELECT * FROM upload_search_rows WHERE "companyId"=$1 AND "vehicleNumber" ILIKE $2 ESCAPE '\\' ORDER BY "createdAt" DESC LIMIT 50 OFFSET 50`, [cid, `%${NEEDLE.vehicleExact}%`], 7));
  await client.end();

  try {
    fs.unlinkSync(filePath);
  } catch (_e) {
    /* ignore */
  }

  console.log(JSON.stringify({
    env: "local-isolated",
    excel: {
      rowsRequested: ROWS,
      rowsParsed: result.totalRows,
      headers: result.headers,
      objectObject,
      writeMs,
      parseMs,
      rowsPerSec: Math.round((result.totalRows / Math.max(parseMs, 1)) * 1000),
      fileMb,
      chunks,
      maxChunk,
      rssBeforeWrite,
      rssBeforeParse,
      rssAfterParse,
    },
    searchOnExisting6M: searches,
  }, null, 2));
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
