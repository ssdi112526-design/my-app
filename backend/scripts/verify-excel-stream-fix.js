#!/usr/bin/env node
/**
 * Targeted verification for excelStream.service.js shared-string fix.
 * Masks PII. Cleans up the 100-row test batch after insert.
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
const {
  streamExcelFromReadable,
  cellToString,
  parseSharedStringsXml,
} = require("../src/services/excelStream.service");
const {
  buildSuggestedMapping,
  normalizeHeader,
  normalizeRow,
} = require("../src/modules/uploads/excelParser");
const { processUploadJob } = require("../src/services/uploadJobProcessor.service");
const { deleteByBatch } = require("../src/services/uploadSearchRows.service");
const { getObjectStreamFromS3, uploadBufferToS3 } = require("../src/utils/s3Storage");
const { generateHex } = require("../src/db/objectId");

const SMALL_BATCH_ID = "6a8976b86909f15c31fd42ac";

function rssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

function presence(row, keys) {
  const out = {};
  for (const key of keys) out[key] = Boolean(String(row[key] || "").trim());
  return out;
}

function runUnitTests() {
  const cases = [];
  const expectEq = (name, actual, expected) => {
    const ok = actual === expected;
    cases.push({ name, ok, actual, expected });
  };

  expectEq("null", cellToString(null), "");
  expectEq("undefined", cellToString(undefined), "");
  expectEq("string", cellToString("  Customer Name  "), "Customer Name");
  expectEq("number", cellToString(9876543210), "9876543210");
  expectEq("boolean", cellToString(true), "true");
  expectEq("blank string", cellToString(""), "");
  expectEq("text object", cellToString({ text: "Vehicle Number " }), "Vehicle Number");
  expectEq("result object", cellToString({ formula: "A1", result: "LAN123" }), "LAN123");
  expectEq(
    "richText",
    cellToString({ richText: [{ text: "Customer " }, { text: "Name" }] }),
    "Customer Name"
  );
  expectEq(
    "sharedString lookup",
    cellToString({ sharedString: 1 }, ["Loan Account Number", "Customer Name"]),
    "Customer Name"
  );
  expectEq("sharedString missing table", cellToString({ sharedString: 0 }), "");
  expectEq("unknown object never stringifies", cellToString({ foo: "bar" }), "");
  expectEq("object string not leaked", cellToString({ sharedString: 0 }).includes("[object Object]"), false);

  const parsed = parseSharedStringsXml(`<?xml version="1.0"?>
    <sst>
      <si><t>Customer Name</t></si>
      <si><r><t>Customer</t></r><r><t> Name</t></r></si>
      <si><t xml:space="preserve">Vehicle Number </t></si>
      <si/>
    </sst>`);
  expectEq("xml simple t", parsed[0], "Customer Name");
  expectEq("xml rich runs", parsed[1], "Customer Name");
  expectEq("xml preserve trailing space", parsed[2], "Vehicle Number ");
  expectEq("xml self-closing", parsed[3], "");
  expectEq("normalize trailing space", normalizeHeader("Vehicle Number "), "vehicle number");

  return {
    passed: cases.filter((c) => c.ok).length,
    failed: cases.filter((c) => !c.ok),
    total: cases.length,
  };
}

async function streamFile(filePathOrStream) {
  const headers = [];
  let mapping = {};
  let firstRow = null;
  let chunkCount = 0;
  let maxChunkLen = 0;
  const rssDuring = [];
  const started = Date.now();
  const rssBefore = rssMb();

  const input =
    typeof filePathOrStream === "string"
      ? fs.createReadStream(filePathOrStream)
      : filePathOrStream;

  const result = await streamExcelFromReadable(input, async ({ rows, headers: h }) => {
    chunkCount += 1;
    maxChunkLen = Math.max(maxChunkLen, rows.length);
    rssDuring.push(rssMb());
    if (h?.length && !headers.length) headers.push(...h);
    if (!Object.keys(mapping).length && rows[0]) mapping = buildSuggestedMapping(rows[0]);
    if (!firstRow && rows[0]) firstRow = rows[0];
  });

  return {
    ...result,
    headers: headers.length ? headers : result.headers,
    mapping,
    firstRowPresent: firstRow
      ? presence(normalizeRow(firstRow, "", mapping), [
          "customerName",
          "loanAccountNumber",
          "vehicleNumber",
          "chassisNumber",
          "mobileNumber",
          "vehicleBrand",
          "vehicleModel",
        ])
      : null,
    objectObjectHeaders: (headers.length ? headers : result.headers).some((h) =>
      String(h).includes("[object Object]")
    ),
    chunkCount,
    maxChunkLen,
    ms: Date.now() - started,
    rssBefore,
    rssDuringMax: rssDuring.length ? Math.max(...rssDuring) : rssBefore,
    rssAfter: rssMb(),
  };
}

async function buildHundredRowXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cases");
  const header = sheet.addRow([
    "Loan Account Number",
    "Customer Name",
    "Vehicle Number ",
    "Chassis Number ",
    "Mobile Number",
    "Vehicle Brand",
    "Vehicle Model",
  ]);
  header.getCell(2).value = {
    richText: [{ text: "Customer " }, { font: { bold: true }, text: "Name" }],
  };

  for (let i = 1; i <= 100; i += 1) {
    const n = String(i).padStart(3, "0");
    if (i <= 95) {
      sheet.addRow([
        `FXLAN${n}`,
        `Fix Customer ${n}`,
        `FXVH${n}AB`,
        `FXCHASSIS${n}XXXX`,
        9000000000 + i,
        i === 10 ? "" : "TATA",
        "SIGNA",
      ]);
    } else {
      sheet.addRow([`FXLAN${n}`, "", `FXVH${n}AB`, "", 9000000000 + i, "TATA", "SIGNA"]);
    }
  }

  const tmp = path.join(os.tmpdir(), `fr-fix-100-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(tmp);
  return tmp;
}

(async () => {
  const report = {
    unit: runUnitTests(),
    small1Stream: null,
    small1Job: null,
    small1Db: null,
    hundredStream: null,
    hundredJob: null,
    hundredDb: null,
  };

  await connectDB(process.env.DATABASE_URL);

  const batch = await UploadBatch.findById(SMALL_BATCH_ID).lean();
  if (!batch) throw new Error("small1 batch not found");

  const { stream } = await getObjectStreamFromS3(batch.storedFilePath);
  report.small1Stream = await streamFile(stream);

  report.small1Job = await processUploadJob(
    {
      batchId: String(batch._id),
      companyId: String(batch.companyId),
      userId: String(batch.uploadedBy),
      bankName: batch.bankName,
      branchName: batch.branchName,
      fileName: batch.fileName,
      s3Key: batch.storedFilePath,
      columnMapping: null,
      replacedPriorBatches: 0,
    },
    null
  );

  const smallCount = await query(
    `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
    [SMALL_BATCH_ID]
  );
  const smallRow = await query(
    `SELECT "companyId", "uploadBatchId",
            CASE WHEN "customerName" <> '' THEN true ELSE false END AS has_customer,
            CASE WHEN "loanAccountNumber" <> '' THEN true ELSE false END AS has_loan,
            CASE WHEN "vehicleNumber" <> '' THEN true ELSE false END AS has_vehicle,
            CASE WHEN "chassisNumber" <> '' THEN true ELSE false END AS has_chassis,
            CASE WHEN "mobileNumber" <> '' THEN true ELSE false END AS has_mobile,
            CASE WHEN "vehicleBrand" <> '' THEN true ELSE false END AS has_brand,
            CASE WHEN "vehicleModel" <> '' THEN true ELSE false END AS has_model
     FROM upload_search_rows WHERE "uploadBatchId" = $1 LIMIT 1`,
    [SMALL_BATCH_ID]
  );
  const smallBatch = await UploadBatch.findById(SMALL_BATCH_ID).lean();
  report.small1Db = {
    count: smallCount.rows[0].n,
    fieldsPresent: smallRow.rows[0] || null,
    batchStatus: smallBatch.status,
    totalRows: smallBatch.totalRows,
    successRows: smallBatch.successRows,
    failedRows: smallBatch.failedRows,
    columnNames: smallBatch.columnNames,
    failedDetails: smallBatch.failedDetails || [],
  };

  const hundredPath = await buildHundredRowXlsx();
  try {
    report.hundredStream = await streamFile(hundredPath);

    const testBatchId = generateHex();
    const companyId = String(batch.companyId);
    const userId = String(batch.uploadedBy);
    const key = `uploads/${companyId}/${testBatchId}.xlsx`;
    const fileBuffer = fs.readFileSync(hundredPath);
    await uploadBufferToS3({
      key,
      buffer: fileBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      originalName: "fix-100.xlsx",
    });

    await UploadBatch.create({
      _id: testBatchId,
      companyId,
      fileName: "fix-100.xlsx",
      storedFilePath: key,
      storageLocation: "s3",
      bankName: batch.bankName,
      branchName: batch.branchName,
      uploadedBy: userId,
      status: "pending",
    });

    report.hundredJob = await processUploadJob(
      {
        batchId: testBatchId,
        companyId,
        userId,
        bankName: batch.bankName,
        branchName: batch.branchName,
        fileName: "fix-100.xlsx",
        s3Key: key,
        columnMapping: null,
        replacedPriorBatches: 0,
      },
      null
    );

    const hundredCount = await query(
      `SELECT COUNT(*)::int AS n FROM upload_search_rows WHERE "uploadBatchId" = $1`,
      [testBatchId]
    );
    const hundredBatch = await UploadBatch.findById(testBatchId).lean();
    report.hundredDb = {
      testBatchId,
      count: hundredCount.rows[0].n,
      batchStatus: hundredBatch.status,
      totalRows: hundredBatch.totalRows,
      successRows: hundredBatch.successRows,
      failedRows: hundredBatch.failedRows,
      failedDetailsCount: (hundredBatch.failedDetails || []).length,
      failedReasons: [...new Set((hundredBatch.failedDetails || []).map((d) => d.reason))],
      columnNames: hundredBatch.columnNames,
    };

    await deleteByBatch(testBatchId);
    await UploadBatch.deleteOne({ _id: testBatchId });
    report.hundredDb.cleanedUp = true;
  } finally {
    try {
      fs.unlinkSync(hundredPath);
    } catch (_e) {
      /* ignore */
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.stack || err.message);
  try {
    await mongoose.disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
