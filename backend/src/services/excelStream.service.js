const fs = require("fs");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const ExcelJS = require("exceljs");
const { cleanValue, normalizeHeader } = require("../modules/uploads/excelParser");

const CHUNK_SIZE = Number(process.env.EXCEL_CHUNK_SIZE || 1000);

function loadUnzipper() {
  try {
    return require("unzipper");
  } catch (_err) {
    return require(path.join(
      path.dirname(require.resolve("exceljs/package.json")),
      "node_modules",
      "unzipper"
    ));
  }
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTTexts(xml) {
  const texts = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi;
  let match;
  while ((match = re.exec(xml))) {
    texts.push(xmlDecode(match[1]));
  }
  return texts.join("");
}

/**
 * Parse xl/sharedStrings.xml into plain strings.
 * Supports simple <t> items and rich-text <r><t> runs. Ignores phonetic <rPh>.
 */
function parseSharedStringsXml(xml) {
  const source = String(xml || "").replace(/^\uFEFF/, "");
  const strings = [];
  const siRe = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match;
  while ((match = siRe.exec(source))) {
    if (match[1] == null) {
      strings.push("");
      continue;
    }
    const body = match[1].replace(/<rPh\b[\s\S]*?<\/rPh>/gi, "");
    const runs = [...body.matchAll(/<r\b[^>]*>([\s\S]*?)<\/r>/gi)];
    strings.push(
      runs.length ? runs.map((run) => extractTTexts(run[1])).join("") : extractTTexts(body)
    );
  }
  return strings;
}

async function parseSharedStringsFromXlsx(filePath) {
  const unzipper = loadUnzipper();
  const directory = await unzipper.Open.file(filePath);
  const entry = directory.files.find((file) =>
    /(^|\/)xl\/sharedStrings\.xml$/i.test(String(file.path || "").replace(/\\/g, "/"))
  );
  if (!entry) return [];
  const xml = (await entry.buffer()).toString("utf8");
  return parseSharedStringsXml(xml);
}

function cellToString(value, sharedStrings) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return cleanValue(value);
  if (typeof value === "number" || typeof value === "boolean") return cleanValue(value);
  if (typeof value === "bigint") return cleanValue(value.toString());
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return cleanValue(value.toString("utf8"));
  if (typeof value !== "object") return cleanValue(value);

  if (Object.prototype.hasOwnProperty.call(value, "sharedString")) {
    const index = Number(value.sharedString);
    if (
      Number.isInteger(index) &&
      index >= 0 &&
      Array.isArray(sharedStrings) &&
      index < sharedStrings.length
    ) {
      return cellToString(sharedStrings[index], sharedStrings);
    }
    return "";
  }

  if (Array.isArray(value.richText)) {
    return cleanValue(value.richText.map((part) => (part && part.text != null ? part.text : "")).join(""));
  }

  if (typeof value.text === "string" || typeof value.text === "number") {
    return cleanValue(value.text);
  }

  if (Object.prototype.hasOwnProperty.call(value, "result")) {
    return cellToString(value.result, sharedStrings);
  }

  return "";
}

function rowValuesToObject(rowValues, headers, sharedStrings) {
  const obj = {};
  const columnOrder = [];
  const columnKeys = [];
  const normOccurrence = {};

  headers.forEach((header, index) => {
    const label = String(header || "").trim();
    if (!label) return;

    const norm = normalizeHeader(label);
    const n = (normOccurrence[norm] || 0) + 1;
    normOccurrence[norm] = n;
    const storageKey = n > 1 ? `${label}_${n}` : label;

    columnOrder.push(label);
    columnKeys.push(storageKey);
    obj[storageKey] = cellToString(rowValues[index + 1], sharedStrings);
  });

  if (columnOrder.length) {
    obj._excelColumnOrder = columnOrder;
    obj._excelColumnKeys = columnKeys;
  }

  return obj;
}

async function materializeToTempFile(readableStream) {
  const tmpPath = path.join(
    os.tmpdir(),
    `fastrecovery-xlsx-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`
  );
  await pipeline(readableStream, fs.createWriteStream(tmpPath));
  return tmpPath;
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (_err) {
    /* ignore missing/locked temp file */
  }
}

/**
 * Stream-read Excel from S3/buffer without loading all rows into RAM.
 * Shared-string table is parsed from xl/sharedStrings.xml (small metadata),
 * then worksheet rows are streamed in CHUNK_SIZE batches.
 * Calls onChunk({ rows, startRowIndex, headers, totalRowsSoFar }) per chunk.
 */
async function streamExcelFromReadable(readableStream, onChunk, options = {}) {
  const { shouldAbort } = options;
  const tmpPath = await materializeToTempFile(readableStream);
  let sharedStrings = [];

  try {
    sharedStrings = await parseSharedStringsFromXlsx(tmpPath);
  } catch (_err) {
    sharedStrings = [];
  }

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(tmpPath, {
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
  });

  let headers = null;
  let chunk = [];
  let dataRowIndex = 0;
  let totalRows = 0;
  let aborted = false;

  const abortIfNeeded = () => {
    if (!shouldAbort || !shouldAbort()) return false;
    aborted = true;
    if (workbookReader.stream && typeof workbookReader.stream.destroy === "function") {
      workbookReader.stream.destroy();
    }
    return true;
  };

  try {
    let sheetIndex = 0;
    for await (const worksheetReader of workbookReader) {
      if (aborted) break;
      sheetIndex += 1;
      if (sheetIndex > 1) break;
      if (
        (!sharedStrings || !sharedStrings.length) &&
        Array.isArray(workbookReader.sharedStrings) &&
        workbookReader.sharedStrings.length
      ) {
        sharedStrings = workbookReader.sharedStrings;
      }
      for await (const row of worksheetReader) {
        if (aborted) break;
        if (row.number === 1) {
          headers = (row.values || [])
            .slice(1)
            .map((v) => cellToString(v, sharedStrings))
            .filter(Boolean);
          continue;
        }

        if (!headers || headers.length === 0) continue;

        const raw = rowValuesToObject(row.values || [], headers, sharedStrings);
        chunk.push(raw);
        dataRowIndex += 1;
        totalRows += 1;

        if (chunk.length >= CHUNK_SIZE) {
          await onChunk({
            rows: [...chunk],
            startRowIndex: dataRowIndex - chunk.length,
            headers: headers ? [...headers] : [],
            totalRowsSoFar: totalRows,
          });
          chunk = [];
          if (abortIfNeeded()) break;
        }
      }
      if (aborted) break;
    }

    if (!aborted && chunk.length > 0) {
      await onChunk({
        rows: [...chunk],
        startRowIndex: dataRowIndex - chunk.length,
        headers: headers ? [...headers] : [],
        totalRowsSoFar: totalRows,
      });
    }

    return { totalRows, headers: headers || [] };
  } finally {
    await safeUnlink(tmpPath);
  }
}

module.exports = {
  streamExcelFromReadable,
  cellToString,
  parseSharedStringsXml,
  CHUNK_SIZE,
};
