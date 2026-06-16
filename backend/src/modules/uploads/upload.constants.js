/**
 * Upload storage policy:
 * - Excel file ALWAYS on S3 (fast direct upload).
 * - MongoDB import OFF by default (set ENABLE_MONGO_IMPORT=true to import rows).
 */
const UPLOAD_S3_ONLY =
  process.env.ENABLE_MONGO_IMPORT !== "true" &&
  process.env.ENABLE_MONGO_IMPORT !== "1";

const MAX_MONGO_IMPORT_ROWS = Number(
  process.env.MAX_MONGO_IMPORT_ROWS || 50000
);

const S3_ONLY_ROW_THRESHOLD = Number(
  process.env.S3_ONLY_ROW_THRESHOLD || 1
);

const MAX_UPLOAD_ROWS = Number(process.env.MAX_UPLOAD_ROWS || 2500000);

const EXCEL_CHUNK_SIZE = Number(process.env.EXCEL_CHUNK_SIZE || 1000);

module.exports = {
  UPLOAD_S3_ONLY,
  MAX_MONGO_IMPORT_ROWS,
  S3_ONLY_ROW_THRESHOLD,
  MAX_UPLOAD_ROWS,
  EXCEL_CHUNK_SIZE,
};
