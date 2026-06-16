/**
 * Parse bank Excel uploads from S3 using SheetJS chunk iteration.
 * Supports .xlsx and .xls (ExcelJS stream reader is xlsx-only).
 */

const path = require("path");
const xlsx = require("xlsx");
const { getObjectStreamFromS3 } = require("../utils/s3Storage");
const {
  readWorkbook,
  readWorksheetHeaderColumns,
  iterateWorkbookRowChunks,
} = require("../modules/uploads/excelParser");

const CHUNK_SIZE = Number(process.env.EXCEL_CHUNK_SIZE || 1000);

async function readS3ObjectToBuffer(s3Key) {
  const { stream } = await getObjectStreamFromS3(s3Key);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * @param {string} s3Key
 * @param {string} fileName
 * @param {(payload: { rows: object[], headers: string[], headerCols: { label: string, storageKey: string }[], startRowIndex: number, totalRowsSoFar: number }) => Promise<void>} onChunk
 */
async function iterateBankExcelFromS3(s3Key, fileName, onChunk) {
  if (typeof onChunk !== "function") {
    throw new Error("onChunk callback is required");
  }

  const buffer = await readS3ObjectToBuffer(s3Key);
  const workbook = readWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet || !worksheet["!ref"]) {
    throw new Error("Excel sheet is empty.");
  }

  const fullRange = xlsx.utils.decode_range(worksheet["!ref"]);
  const { headers: headerCols } = readWorksheetHeaderColumns(worksheet);
  const headerLabels = headerCols.map((h) => h.label);

  if (!headerLabels.length) {
    throw new Error("Excel sheet has no column headers.");
  }

  let totalRowsSoFar = 0;

  for (const chunk of iterateWorkbookRowChunks(worksheet, fullRange, CHUNK_SIZE)) {
    const rows = Array.isArray(chunk?.rows) ? chunk.rows : [];
    if (!rows.length) continue;

    totalRowsSoFar += rows.length;
    await onChunk({
      rows,
      headers: headerLabels,
      headerCols,
      startRowIndex: chunk.startIndex ?? 0,
      totalRowsSoFar,
    });
  }

  return {
    totalRows: totalRowsSoFar,
    headers: headerLabels,
    headerCols,
    sheetName,
    fileName: path.basename(fileName || ""),
  };
}

module.exports = {
  iterateBankExcelFromS3,
  CHUNK_SIZE,
};
