const { query, queryWithStatementTimeout, isStatementTimeoutError } = require("../db/pool");
const { generateHex } = require("../db/objectId");
const {
  UPLOAD_SEARCH_CHUNK_SIZE,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_PREFIX_LENGTH,
  SEARCH_STATEMENT_TIMEOUT_MS,
} = require("../modules/uploads/upload.constants");

const TYPED_PREFIX_TYPES = new Set([
  "vehicleNumber",
  "chassisNumber",
  "loanAccountNumber",
  "mobileNumber",
  "phone",
]);

const TABLE = "upload_search_rows";

const INSERT_COLUMNS = [
  "_id",
  "companyId",
  "uploadBatchId",
  "sourceRowIndex",
  "customerName",
  "mobileNumber",
  "alternateMobileNumber",
  "contactPerson1Phone",
  "contactPerson2Phone",
  "contactPerson3Phone",
  "phoneDigits",
  "loanAccountNumber",
  "referenceNumber",
  "vehicleNumber",
  "chassisNumber",
  "engineNumber",
  "vehicleBrand",
  "vehicleModel",
  "addressLine1",
  "bankName",
  "branchName",
  "city",
  "state",
  "bucket",
  "emiAmount",
  "dueAmount",
  "totalOutstandingAmount",
];

const UPDATE_COLUMNS = INSERT_COLUMNS.filter(
  (name) => name !== "_id" && name !== "companyId" && name !== "uploadBatchId" && name !== "sourceRowIndex"
);

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function collectPhoneDigits(row) {
  return [
    row.mobileNumber,
    row.alternateMobileNumber,
    row.contactPerson1Phone,
    row.contactPerson2Phone,
    row.contactPerson3Phone,
  ]
    .map(digitsOnly)
    .filter(Boolean)
    .join(" ");
}

function asText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function asAmount(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toSearchRow(payload, sourceRowIndex) {
  const vehicleNumber = normalizePlate(payload.vehicleNumber);
  const chassisNumber = asText(payload.chassisNumber).toUpperCase();
  const row = {
    companyId: String(payload.companyId || ""),
    uploadBatchId: String(payload.uploadBatchId || ""),
    sourceRowIndex: Number(sourceRowIndex),
    customerName: asText(payload.customerName),
    mobileNumber: asText(payload.mobileNumber),
    alternateMobileNumber: asText(payload.alternateMobileNumber),
    contactPerson1Phone: asText(payload.contactPerson1Phone),
    contactPerson2Phone: asText(payload.contactPerson2Phone),
    contactPerson3Phone: asText(payload.contactPerson3Phone),
    loanAccountNumber: asText(payload.loanAccountNumber),
    referenceNumber: asText(payload.referenceNumber),
    vehicleNumber,
    chassisNumber,
    engineNumber: asText(payload.engineNumber),
    vehicleBrand: asText(payload.vehicleBrand),
    vehicleModel: asText(payload.vehicleModel),
    addressLine1: asText(payload.addressLine1),
    bankName: asText(payload.bankName),
    branchName: asText(payload.branchName),
    city: asText(payload.city),
    state: asText(payload.state),
    bucket: asText(payload.bucket),
    emiAmount: asAmount(payload.emiAmount),
    dueAmount: asAmount(payload.dueAmount),
    totalOutstandingAmount: asAmount(payload.totalOutstandingAmount),
  };
  row.phoneDigits = collectPhoneDigits(row);
  return row;
}

function rowValues(row) {
  return [
    row._id || generateHex(),
    String(row.companyId || ""),
    String(row.uploadBatchId || ""),
    Number(row.sourceRowIndex),
    asText(row.customerName),
    asText(row.mobileNumber),
    asText(row.alternateMobileNumber),
    asText(row.contactPerson1Phone),
    asText(row.contactPerson2Phone),
    asText(row.contactPerson3Phone),
    asText(row.phoneDigits) || collectPhoneDigits(row),
    asText(row.loanAccountNumber),
    asText(row.referenceNumber),
    normalizePlate(row.vehicleNumber),
    asText(row.chassisNumber).toUpperCase(),
    asText(row.engineNumber),
    asText(row.vehicleBrand),
    asText(row.vehicleModel),
    asText(row.addressLine1),
    asText(row.bankName),
    asText(row.branchName),
    asText(row.city),
    asText(row.state),
    asText(row.bucket),
    asAmount(row.emiAmount),
    asAmount(row.dueAmount),
    asAmount(row.totalOutstandingAmount),
  ];
}

function quotedIdent(name) {
  return `"${name}"`;
}

async function ensureUploadSearchSchema() {
  await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await query(`DROP INDEX IF EXISTS upload_search_rows_compound_0`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS upload_search_rows_batch_row_uidx
    ON ${TABLE} ("uploadBatchId", "sourceRowIndex")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS upload_search_rows_vehicle_trgm_idx
    ON ${TABLE} USING gin ("vehicleNumber" gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS upload_search_rows_chassis_trgm_idx
    ON ${TABLE} USING gin ("chassisNumber" gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS upload_search_rows_customer_trgm_idx
    ON ${TABLE} USING gin ("customerName" gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS upload_search_rows_loan_trgm_idx
    ON ${TABLE} USING gin ("loanAccountNumber" gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS upload_search_rows_phone_trgm_idx
    ON ${TABLE} USING gin ("phoneDigits" gin_trgm_ops)
  `);
}

function buildInsertSql(rowCount) {
  const colSql = INSERT_COLUMNS.map(quotedIdent).join(", ");
  const valueGroups = [];
  const params = [];
  for (let i = 0; i < rowCount; i += 1) {
    const start = i * INSERT_COLUMNS.length;
    const placeholders = INSERT_COLUMNS.map((_, colIdx) => `$${start + colIdx + 1}`);
    valueGroups.push(`(${placeholders.join(", ")})`);
  }
  const setSql = UPDATE_COLUMNS.map(
    (name) => `${quotedIdent(name)} = EXCLUDED.${quotedIdent(name)}`
  ).join(", ");

  return {
    text: `
      INSERT INTO ${TABLE} (${colSql})
      VALUES ${valueGroups.join(", ")}
      ON CONFLICT ("uploadBatchId", "sourceRowIndex")
      DO UPDATE SET ${setSql}, "updatedAt" = CURRENT_TIMESTAMP
    `,
    params,
  };
}

/**
 * Bulk-insert a worker chunk (typically 500–2000 rows). Parameterized; no one-by-one INSERT.
 */
async function insertSearchRowChunk(rows, options = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return { inserted: 0 };

  const maxSlice = Math.max(
    1,
    Math.min(Number(options.chunkSize || UPLOAD_SEARCH_CHUNK_SIZE || 1000), 2000)
  );

  let inserted = 0;
  for (let offset = 0; offset < list.length; offset += maxSlice) {
    const slice = list.slice(offset, offset + maxSlice);
    const { text } = buildInsertSql(slice.length);
    const params = [];
    for (const row of slice) {
      params.push(...rowValues(row));
    }
    await query(text, params);
    inserted += slice.length;
  }
  return { inserted };
}

function escapeIlike(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function ilikeContains(value) {
  return `%${escapeIlike(value)}%`;
}

/** Prefix match — same case-insensitive ILIKE, much cheaper than leading-wildcard contains. */
function ilikePrefix(value) {
  return `${escapeIlike(value)}%`;
}

function normalizedSearchLength(search, type) {
  const trimmed = String(search || "").trim();
  if (type === "vehicleNumber") return normalizePlate(trimmed).length;
  if (type === "chassisNumber") {
    return trimmed.replace(/[\s\-_.]/g, "").length;
  }
  if (type === "mobileNumber" || type === "phone") return digitsOnly(trimmed).length;
  return trimmed.length;
}

/**
 * Typed short prefixes (MH, MH1) skip the large GIN/heap search.
 * type=general is not blocked (Bank Notify / catalog compatibility).
 * Empty search is not blocked (hasVehicleNumber listing).
 */
function getTypedPrefixRestriction(search, type) {
  const kind = String(type || "general");
  const trimmed = String(search || "").trim();
  if (!trimmed || !TYPED_PREFIX_TYPES.has(kind) || SEARCH_MIN_PREFIX_LENGTH <= 0) {
    return null;
  }
  const length = normalizedSearchLength(trimmed, kind);
  if (length >= SEARCH_MIN_PREFIX_LENGTH) return null;
  return {
    searchRestricted: true,
    minSearchLength: SEARCH_MIN_PREFIX_LENGTH,
    normalizedLength: length,
  };
}

/**
 * Map a search row to the same item shape Find Vehicles already consumes
 * from S3 (`toCaseItem`). `_id` is `${batchId}-${rowIndex}` so the UI treats
 * it as an Excel-only record, not a repo_cases ObjectId.
 */
function mapSearchRowToCaseItem(row) {
  const batchId = String(row.uploadBatchId || "");
  const rowIndex = row.sourceRowIndex;
  return {
    _id: `${batchId}-${rowIndex}`,
    uploadBatchId: batchId,
    companyId: row.companyId,
    bankName: row.bankName || "",
    branchName: row.branchName || "",
    customerName: row.customerName || "",
    mobileNumber: row.mobileNumber || "",
    alternateMobileNumber: row.alternateMobileNumber || "",
    loanAccountNumber: row.loanAccountNumber || "",
    referenceNumber: row.referenceNumber || "",
    vehicleNumber: normalizePlate(row.vehicleNumber),
    chassisNumber: row.chassisNumber ? String(row.chassisNumber).toUpperCase() : "",
    engineNumber: row.engineNumber || "",
    vehicleBrand: row.vehicleBrand || "",
    vehicleModel: row.vehicleModel || "",
    addressLine1: row.addressLine1 || "",
    city: row.city || "",
    state: row.state || "",
    emiAmount: row.emiAmount,
    dueAmount: row.dueAmount,
    totalOutstandingAmount: row.totalOutstandingAmount,
    bucket: row.bucket || "",
    excelFields: {},
    contactPerson1Name: "",
    contactPerson1Phone: row.contactPerson1Phone || "",
    contactPerson2Name: "",
    contactPerson2Phone: row.contactPerson2Phone || "",
    contactPerson3Name: "",
    contactPerson3Phone: row.contactPerson3Phone || "",
    bankNotifyEmail1: "",
    bankNotifyEmail2: "",
    repoStatus: "NEW",
    confirmationStatus: "PENDING",
    source: "s3",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildSearchWhere({ companyId, search, type, hasVehicleNumber }) {
  const cid = String(companyId || "");
  const params = [cid];
  const where = [`"companyId" = $1`];
  const trimmed = String(search || "").trim();

  if (hasVehicleNumber && !trimmed) {
    where.push(`"vehicleNumber" IS NOT NULL AND "vehicleNumber" <> ''`);
  }

  if (trimmed) {
    const plate = normalizePlate(trimmed);
    const digits = digitsOnly(trimmed);
    const pattern = ilikeContains(trimmed);
    const plateContains = ilikeContains(plate || trimmed);
    const platePrefix = ilikePrefix(plate || trimmed);

    if (type === "vehicleNumber") {
      params.push(platePrefix);
      where.push(`"vehicleNumber" ILIKE $${params.length} ESCAPE '\\'`);
    } else if (type === "chassisNumber") {
      params.push(ilikePrefix(trimmed.toUpperCase()));
      where.push(`"chassisNumber" ILIKE $${params.length} ESCAPE '\\'`);
    } else if (type === "loanAccountNumber") {
      params.push(ilikePrefix(trimmed));
      where.push(`"loanAccountNumber" ILIKE $${params.length} ESCAPE '\\'`);
    } else if (type === "mobileNumber" || type === "phone") {
      params.push(ilikeContains(digits.length >= 6 ? digits : trimmed));
      where.push(`"phoneDigits" ILIKE $${params.length} ESCAPE '\\'`);
    } else {
      params.push(pattern);
      const p = params.length;
      params.push(plateContains);
      const plateP = params.length;
      let phoneP = p;
      if (digits.length >= 6) {
        params.push(ilikeContains(digits));
        phoneP = params.length;
      }
      where.push(`(
        "vehicleNumber" ILIKE $${plateP} ESCAPE '\\'
        OR "loanAccountNumber" ILIKE $${p} ESCAPE '\\'
        OR "customerName" ILIKE $${p} ESCAPE '\\'
        OR "bankName" ILIKE $${p} ESCAPE '\\'
        OR "branchName" ILIKE $${p} ESCAPE '\\'
        OR "chassisNumber" ILIKE $${p} ESCAPE '\\'
        OR "engineNumber" ILIKE $${p} ESCAPE '\\'
        OR "phoneDigits" ILIKE $${phoneP} ESCAPE '\\'
      )`);
    }
  }

  return { whereSql: where.join(" AND "), params };
}

/**
 * Server-side indexed search. companyId must come from auth, never the client.
 */
async function searchUploadRows({
  companyId,
  search = "",
  type = "general",
  page = 1,
  limit = 50,
  hasVehicleNumber = false,
} = {}) {
  const cid = String(companyId || "");
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, SEARCH_MAX_LIMIT));
  if (!cid) {
    return { items: [], total: 0, page: safePage, limit: safeLimit };
  }

  const restriction = getTypedPrefixRestriction(search, type);
  if (restriction) {
    return {
      items: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      ...restriction,
    };
  }

  const { whereSql, params } = buildSearchWhere({
    companyId: cid,
    search,
    type,
    hasVehicleNumber,
  });
  const offset = (safePage - 1) * safeLimit;

  try {
    const countResult = await queryWithStatementTimeout(
      `SELECT COUNT(*)::int AS total FROM ${TABLE} WHERE ${whereSql}`,
      params,
      SEARCH_STATEMENT_TIMEOUT_MS
    );
    const total = Number(countResult.rows[0]?.total || 0);
    if (total === 0) {
      return { items: [], total: 0, page: safePage, limit: safeLimit };
    }

    const listResult = await queryWithStatementTimeout(
      `SELECT * FROM ${TABLE}
       WHERE ${whereSql}
       ORDER BY "createdAt" DESC, "sourceRowIndex" ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, offset],
      SEARCH_STATEMENT_TIMEOUT_MS
    );

    return {
      items: listResult.rows.map(mapSearchRowToCaseItem),
      total,
      page: safePage,
      limit: safeLimit,
    };
  } catch (err) {
    if (isStatementTimeoutError(err)) {
      return {
        items: [],
        total: 0,
        page: safePage,
        limit: safeLimit,
        searchTimeout: true,
      };
    }
    throw err;
  }
}

async function countSearchRowsForCompany(companyId) {
  const cid = String(companyId || "");
  if (!cid) return 0;
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM ${TABLE} WHERE "companyId" = $1`,
    [cid]
  );
  return Number(result.rows[0]?.total || 0);
}

/**
 * True when this company still has completed S3 indexes that were never
 * written into upload_search_rows (historical data, not backfilled).
 */
async function companyNeedsS3SearchFallback(companyId) {
  const cid = String(companyId || "");
  if (!cid) return false;
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM upload_batches b
       WHERE b."companyId" = $1
         AND b.status = 'completed'
         AND COALESCE(b."s3SearchIndexKey", '') <> ''
         AND NOT EXISTS (
           SELECT 1
           FROM ${TABLE} r
           WHERE r."uploadBatchId" = b."_id"
           LIMIT 1
         )
     ) AS needed`,
    [cid]
  );
  return Boolean(result.rows[0]?.needed);
}

async function deleteByBatch(batchIds) {
  const ids = (Array.isArray(batchIds) ? batchIds : [batchIds])
    .filter((id) => id != null && id !== "")
    .map((id) => String(id));
  if (!ids.length) return { deleted: 0 };

  const result = await query(
    `DELETE FROM ${TABLE} WHERE "uploadBatchId" = ANY($1::text[])`,
    [ids]
  );
  return { deleted: result.rowCount || 0 };
}

async function countByBatch(batchId) {
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM ${TABLE} WHERE "uploadBatchId" = $1`,
    [String(batchId)]
  );
  return Number(result.rows[0]?.total || 0);
}

async function fetchSearchRowsForS3Index(batchId, limit = 250000) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 250000, 250000));
  const result = await query(
    `SELECT * FROM ${TABLE}
     WHERE "uploadBatchId" = $1
     ORDER BY "sourceRowIndex" ASC
     LIMIT $2`,
    [String(batchId), safeLimit]
  );
  return result.rows;
}

module.exports = {
  insertSearchRowChunk,
  searchUploadRows,
  deleteByBatch,
  countByBatch,
  countSearchRowsForCompany,
  companyNeedsS3SearchFallback,
  fetchSearchRowsForS3Index,
  ensureUploadSearchSchema,
  toSearchRow,
  mapSearchRowToCaseItem,
  buildSearchWhere,
  normalizePlate,
  getTypedPrefixRestriction,
  normalizedSearchLength,
};
