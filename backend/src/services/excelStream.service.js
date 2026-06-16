const ExcelJS = require("exceljs");
const { cleanValue, normalizeHeader } = require("../modules/uploads/excelParser");

const CHUNK_SIZE = Number(process.env.EXCEL_CHUNK_SIZE || 1000);

function cellToString(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.text) return cleanValue(value.text);
  if (typeof value === "object" && value.result != null) return cleanValue(value.result);
  if (value instanceof Date) return value.toISOString();
  return cleanValue(value);
}

function rowValuesToObject(rowValues, headers) {
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
    obj[storageKey] = cellToString(rowValues[index + 1]);
  });

  if (columnOrder.length) {
    obj._excelColumnOrder = columnOrder;
    obj._excelColumnKeys = columnKeys;
  }

  return obj;
}

/**
 * Stream-read Excel from S3/buffer without loading all rows into RAM.
 * Calls onChunk({ rows, startRowIndex, headers, totalRowsSoFar }) per chunk.
 */
async function streamExcelFromReadable(readableStream, onChunk, options = {}) {
  const { shouldAbort } = options;
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(readableStream, {
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
    if (typeof readableStream.destroy === "function") {
      readableStream.destroy();
    }
    return true;
  };

  let sheetIndex = 0;
  for await (const worksheetReader of workbookReader) {
    if (aborted) break;
    sheetIndex += 1;
    if (sheetIndex > 1) break;
    for await (const row of worksheetReader) {
      if (aborted) break;
      if (row.number === 1) {
        headers = (row.values || [])
          .slice(1)
          .map((v) => cellToString(v))
          .filter(Boolean);
        continue;
      }

      if (!headers || headers.length === 0) continue;

      const raw = rowValuesToObject(row.values || [], headers);
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
}

module.exports = {
  streamExcelFromReadable,
  CHUNK_SIZE,
};
