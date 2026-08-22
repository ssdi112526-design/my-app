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

const parsedSearchChunk = Number(process.env.UPLOAD_SEARCH_CHUNK_SIZE || 1000);
const UPLOAD_SEARCH_CHUNK_SIZE = Math.max(
  500,
  Math.min(Number.isFinite(parsedSearchChunk) ? parsedSearchChunk : 1000, 2000)
);

/**
 * After streaming inserts finish, rebuild the compact S3 search index from PG.
 * This is a post-job step (not the Excel stream). Default covers large branch files.
 */
const S3_INDEX_FROM_PG_MAX = Number(process.env.S3_INDEX_FROM_PG_MAX || 250000);

/**
 * Server-side search page size cap.
 * Kept at 500 because Bank Notify (`BankNotifyModal`) still requests limit=500.
 * Find Vehicles now requests 50. Do not lower this without updating Bank Notify.
 */
const SEARCH_MAX_LIMIT = Math.max(
  50,
  Math.min(Number(process.env.SEARCH_MAX_LIMIT || 500), 500)
);

/**
 * Repo Excel upload size cap.
 * Measured: 200k-row xlsx ≈ 10 MB. MAX_UPLOAD_ROWS=2.5M ⇒ ~125 MB.
 * Default 150 MB covers that row limit without unbounded multer buffers.
 */
const MAX_UPLOAD_FILE_SIZE_MB = Math.max(
  1,
  Math.min(Number(process.env.MAX_UPLOAD_FILE_SIZE_MB || 150), 512)
);
const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/**
 * Minimum normalized length for typed prefix searches.
 * Matches Find Vehicles MIN_SEARCH_CHARS=4. Set 0 to disable.
 */
const parsedMinPrefix = Number(process.env.SEARCH_MIN_PREFIX_LENGTH);
const SEARCH_MIN_PREFIX_LENGTH = Number.isFinite(parsedMinPrefix)
  ? Math.max(0, Math.min(parsedMinPrefix, 16))
  : 4;

/**
 * Search-only PostgreSQL statement_timeout (ms). 0 disables.
 * Default sits above measured 6M typed-prefix p95 (~8s) and general (~12s).
 */
const parsedSearchTimeout = Number(process.env.SEARCH_STATEMENT_TIMEOUT_MS);
const SEARCH_STATEMENT_TIMEOUT_MS = Number.isFinite(parsedSearchTimeout)
  ? Math.max(0, Math.min(parsedSearchTimeout, 120000))
  : 20000;

module.exports = {
  UPLOAD_S3_ONLY,
  MAX_MONGO_IMPORT_ROWS,
  S3_ONLY_ROW_THRESHOLD,
  MAX_UPLOAD_ROWS,
  EXCEL_CHUNK_SIZE,
  UPLOAD_SEARCH_CHUNK_SIZE,
  S3_INDEX_FROM_PG_MAX,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_PREFIX_LENGTH,
  SEARCH_STATEMENT_TIMEOUT_MS,
  MAX_UPLOAD_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ALLOWED_UPLOAD_EXTENSIONS,
};
