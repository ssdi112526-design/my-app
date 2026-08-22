const mongoose = require("mongoose");
const UploadBatch = require("../modules/uploads/uploadBatch.model");
const {
  loadSearchIndexFromS3,
  saveSearchIndexToS3,
} = require("../modules/uploads/uploadFileStorage");
const { getObjectStreamFromS3 } = require("../utils/s3Storage");
const { streamExcelFromReadable } = require("./excelStream.service");
const {
  normalizeRow,
  buildSuggestedMapping,
  buildExcelFieldsSnapshot,
} = require("../modules/uploads/excelParser");
const {
  extractExcelNotifyContacts,
  hasBankerNotifyContacts,
} = require("../utils/excelNotifyContacts");

const INDEX_CACHE_MS = Number(process.env.S3_INDEX_CACHE_MS || 30 * 60 * 1000);
/** Per-batch row payloads (warmed on upload). */
const indexCache = new Map();
/** Merged company search items — filter in RAM (~milliseconds). */
const companyItemsCache = new Map();
const warmingCompanies = new Set();

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

function toCaseItem(row, batch, rowIndex) {
  const batchId = String(batch._id);
  return {
    _id: `${batchId}-${rowIndex}`,
    uploadBatchId: batchId,
    companyId: row.companyId || batch.companyId,
    bankName:
      String(row.bankName || "").trim() || String(batch.bankName || "").trim() || "",
    branchName:
      String(row.branchName || "").trim() || String(batch.branchName || "").trim() || "",
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
    excelFields: row.excelFields || {},
    contactPerson1Name: row.contactPerson1Name || "",
    contactPerson1Phone: row.contactPerson1Phone || "",
    contactPerson2Name: row.contactPerson2Name || "",
    contactPerson2Phone: row.contactPerson2Phone || "",
    contactPerson3Name: row.contactPerson3Name || "",
    contactPerson3Phone: row.contactPerson3Phone || "",
    bankNotifyEmail1: row.bankNotifyEmail1 || "",
    bankNotifyEmail2: row.bankNotifyEmail2 || "",
    repoStatus: "NEW",
    confirmationStatus: "PENDING",
    source: "s3",
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

function buildPayload(rawRow, rowIndex, batchId, companyId, bankName, branchName, mapping) {
  const { applyHydratedBankerContacts } = require("../utils/hydrateBankerContactsFromExcel");
  const row = normalizeRow(rawRow, branchName, mapping);
  const hasCustomer = !!row.customerName;
  const hasLoan = !!row.loanAccountNumber;
  const hasVehicle = !!row.vehicleNumber;

  if (!hasCustomer || (!hasLoan && !hasVehicle)) {
    return { error: "Missing required fields." };
  }

  const excelFields = buildExcelFieldsSnapshot(rawRow);
  const payload = applyHydratedBankerContacts(
    {
      companyId,
      uploadBatchId: batchId,
      bankName,
      branchName,
      customerName: row.customerName,
      mobileNumber: row.mobileNumber,
      alternateMobileNumber: row.alternateMobileNumber,
      loanAccountNumber: row.loanAccountNumber,
      referenceNumber: row.referenceNumber,
      vehicleNumber: row.vehicleNumber,
      chassisNumber: row.chassisNumber,
      engineNumber: row.engineNumber,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      addressLine1: row.addressLine1,
      city: row.city || "",
      state: row.state || "",
      emiAmount: row.emiAmount,
      dueAmount: row.dueAmount,
      totalOutstandingAmount: row.totalOutstandingAmount,
      bucket: row.bucket,
      contactPerson1Name: row.contactPerson1Name || "",
      contactPerson1Phone: row.contactPerson1Phone || "",
      contactPerson2Name: row.contactPerson2Name || "",
      contactPerson2Phone: row.contactPerson2Phone || "",
      contactPerson3Name: row.contactPerson3Name || "",
      contactPerson3Phone: row.contactPerson3Phone || "",
      bankNotifyEmail1: row.bankNotifyEmail1 || "",
      bankNotifyEmail2: row.bankNotifyEmail2 || "",
    },
    excelFields
  );

  return { payload, rowIndex };
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function phoneFieldsMatch(item, regex, digitPattern) {
  const fields = [
    item.mobileNumber,
    item.alternateMobileNumber,
    item.contactPerson1Phone,
    item.contactPerson2Phone,
    item.contactPerson3Phone,
  ];
  for (const val of fields) {
    const text = String(val || "");
    if (!text) continue;
    if (regex.test(text)) return true;
    if (digitPattern && digitPattern.length >= 6) {
      const d = digitsOnly(text);
      if (d.includes(digitPattern) || d.slice(-10) === digitPattern.slice(-10)) {
        return true;
      }
    }
  }
  return false;
}

function rowMatches(item, regex, type, trimmed) {
  if (!trimmed) return true;

  const digitPattern = digitsOnly(trimmed);

  if (type === "vehicleNumber") {
    return regex.test(normalizePlate(item.vehicleNumber));
  }
  if (type === "chassisNumber") {
    return regex.test(String(item.chassisNumber || ""));
  }
  if (type === "loanAccountNumber") {
    return regex.test(String(item.loanAccountNumber || ""));
  }
  if (type === "mobileNumber" || type === "phone") {
    return phoneFieldsMatch(item, regex, digitPattern);
  }

  return (
    regex.test(normalizePlate(item.vehicleNumber)) ||
    regex.test(String(item.loanAccountNumber || "")) ||
    regex.test(String(item.customerName || "")) ||
    regex.test(String(item.mobileNumber || "")) ||
    regex.test(String(item.bankName || "")) ||
    regex.test(String(item.branchName || "")) ||
    regex.test(String(item.chassisNumber || "")) ||
    regex.test(String(item.engineNumber || "")) ||
    phoneFieldsMatch(item, regex, digitPattern)
  );
}

function filterItems(items, { search = "", type = "general", hasVehicleNumber = false }) {
  let filtered = items;

  if (hasVehicleNumber && !search) {
    filtered = filtered.filter((row) => normalizePlate(row.vehicleNumber));
  }

  const trimmed = String(search || "").trim();
  if (!trimmed) return filtered;

  const regex = new RegExp(escapeRegex(trimmed), "i");
  return filtered.filter((row) => rowMatches(row, regex, type, trimmed));
}

function warmBatchIndexCache(batch, datasetRows) {
  if (!batch?._id || !Array.isArray(datasetRows) || datasetRows.length === 0) return;

  const batchId = String(batch._id);
  indexCache.set(batchId, {
    rows: datasetRows,
    expiresAt: Date.now() + INDEX_CACHE_MS,
  });

  const companyKey = String(batch.companyId);
  companyItemsCache.delete(companyKey);
}

async function loadIndexRows(batch) {
  const cacheKey = String(batch._id);
  const cached = indexCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  if (batch.s3SearchIndexKey) {
    try {
      const rows = await loadSearchIndexFromS3(batch.s3SearchIndexKey);
      indexCache.set(cacheKey, { rows, expiresAt: Date.now() + INDEX_CACHE_MS });
      return rows;
    } catch (err) {
      console.error("Search index load failed:", batch._id, err.message);
    }
  }

  return null;
}

async function getCompanySearchItems(companyId) {
  const companyKey = String(companyId);
  const cached = companyItemsCache.get(companyKey);
  if (cached?.items && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const cid = mongoose.Types.ObjectId.isValid(companyId)
    ? new mongoose.Types.ObjectId(companyId)
    : companyId;

  const batches = await UploadBatch.find({
    companyId: cid,
    status: "completed",
  })
    .sort({ updatedAt: -1 })
    .lean();

  const batchData = await Promise.all(
    batches.map(async (batch) => {
      const rows = await loadIndexRows(batch);
      return { batch, rows: rows || [] };
    })
  );

  const allItems = [];
  for (const { batch, rows } of batchData) {
    for (let i = 0; i < rows.length; i += 1) {
      allItems.push(toCaseItem(rows[i], batch, i));
    }
  }

  companyItemsCache.set(companyKey, {
    items: allItems,
    expiresAt: Date.now() + INDEX_CACHE_MS,
  });

  return allItems;
}

async function warmCompanySearchCache(companyId) {
  const companyKey = String(companyId);
  if (warmingCompanies.has(companyKey)) {
    while (warmingCompanies.has(companyKey)) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const cached = companyItemsCache.get(companyKey);
    if (cached?.items) return { ready: true, count: cached.items.length };
  }

  const cached = companyItemsCache.get(companyKey);
  if (cached?.items && cached.expiresAt > Date.now()) {
    return { ready: true, count: cached.items.length };
  }

  warmingCompanies.add(companyKey);
  try {
    const cid = mongoose.Types.ObjectId.isValid(companyId)
      ? new mongoose.Types.ObjectId(companyId)
      : companyId;

    const batches = await UploadBatch.find({
      companyId: cid,
      status: "completed",
    }).lean();

    await Promise.all(
      batches.map(async (batch) => {
        const batchKey = String(batch._id);
        if (indexCache.get(batchKey)?.rows?.length) return;

        if (batch.s3SearchIndexKey) {
          const rows = await loadSearchIndexFromS3(batch.s3SearchIndexKey);
          if (rows?.length) {
            indexCache.set(batchKey, {
              rows,
              expiresAt: Date.now() + INDEX_CACHE_MS,
            });
          }
          return;
        }

        if (batch.storedFilePath) {
          await buildAndSaveSearchIndex(batch);
        }
      })
    );

    const items = await getCompanySearchItems(companyId);
    return { ready: true, count: items.length };
  } finally {
    warmingCompanies.delete(companyKey);
  }
}

async function buildAndSaveSearchIndex(batch) {
  if (!batch.storedFilePath) return [];

  const indexRows = [];
  const { stream } = await getObjectStreamFromS3(batch.storedFilePath);
  let mapping = null;
  let rowIndex = 0;

  await streamExcelFromReadable(stream, async ({ rows, startRowIndex }) => {
    if (!mapping && rows[0]) {
      mapping = buildSuggestedMapping(rows[0]);
    }

    for (let i = 0; i < rows.length; i += 1) {
      const built = buildPayload(
        rows[i],
        startRowIndex + i,
        batch._id,
        batch.companyId,
        batch.bankName,
        batch.branchName,
        mapping || {}
      );

      if (built.error) continue;
      indexRows.push(built.payload);
      rowIndex += 1;
    }
  });

  if (indexRows.length > 0) {
    try {
      const { s3SearchIndexKey } = await saveSearchIndexToS3(
        batch.companyId,
        batch._id,
        indexRows
      );
      await UploadBatch.updateOne({ _id: batch._id }, { $set: { s3SearchIndexKey } });
      batch.s3SearchIndexKey = s3SearchIndexKey;
      indexCache.set(String(batch._id), {
        rows: indexRows,
        expiresAt: Date.now() + INDEX_CACHE_MS,
      });
    } catch (err) {
      console.error("Search index save failed:", batch._id, err.message);
    }
  }

  return indexRows;
}

async function getIndexItems(batch) {
  const rows = await loadIndexRows(batch);
  if (!rows || rows.length === 0) return [];
  return rows.map((row, i) => toCaseItem(row, batch, i));
}

async function searchRowsInIndex(batch, options) {
  const { search, type, skip, limit, hasVehicleNumber } = options;
  const items = await getIndexItems(batch);
  const filtered = filterItems(items, { search, type, hasVehicleNumber });
  return {
    items: filtered.slice(skip, skip + limit),
    total: filtered.length,
  };
}

async function searchRowsInExcel(batch, options) {
  const { search, type, skip, limit, hasVehicleNumber } = options;
  if (!batch.storedFilePath) return { items: [], total: 0 };

  const trimmed = String(search || "").trim();
  const regex = trimmed ? new RegExp(escapeRegex(trimmed), "i") : null;
  const matches = [];
  let matchCount = 0;
  let rowIndex = 0;
  let done = false;

  const { stream } = await getObjectStreamFromS3(batch.storedFilePath);
  let mapping = null;

  try {
    await streamExcelFromReadable(
      stream,
      async ({ rows, startRowIndex }) => {
        if (done) return;

        if (!mapping && rows[0]) {
          mapping = buildSuggestedMapping(rows[0]);
        }

        for (let i = 0; i < rows.length; i += 1) {
          if (done) return;

          const built = buildPayload(
            rows[i],
            startRowIndex + i,
            batch._id,
            batch.companyId,
            batch.bankName,
            batch.branchName,
            mapping || {}
          );

          if (built.error) continue;

          const item = toCaseItem(built.payload, batch, rowIndex);
          rowIndex += 1;

          if (hasVehicleNumber && !trimmed) {
            if (!normalizePlate(item.vehicleNumber)) continue;
          } else if (!rowMatches(item, regex, type, trimmed)) {
            continue;
          }

          matchCount += 1;
          if (matchCount > skip && matches.length < limit) {
            matches.push(item);
          }

          if (matches.length >= limit) {
            done = true;
          }
        }
      },
      { shouldAbort: () => done }
    );
  } catch (err) {
    if (!done) throw err;
  }

  return { items: matches, total: done ? matches.length : matchCount };
}

async function searchS3Cases(
  companyId,
  { search = "", type = "general", page = 1, limit = 50, hasVehicleNumber = false }
) 
{
  const allItems = await getCompanySearchItems(companyId);
  const filtered = filterItems(allItems, { search, type, hasVehicleNumber });

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 50, 1);
  const skip = (safePage - 1) * safeLimit;
  const items = filtered.slice(skip, skip + safeLimit);

  return {
    items,
    total: filtered.length,
    page: safePage,
    limit: safeLimit,
    instant: Boolean(companyItemsCache.get(String(companyId))?.items),
  };
}

async function getBatchVehicleItems(batchDoc) {
  const items = await getIndexItems(batchDoc);
  const seen = new Set();
  const list = [];

  for (const row of items) {
    const plate = normalizePlate(row.vehicleNumber);
    if (!plate || seen.has(plate)) continue;
    seen.add(plate);
    list.push({
      _id: row._id,
      vehicleNumber: plate,
      customerName: row.customerName || "",
    });
  }

  list.sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber));
  return list.slice(0, 10000);
}

async function resolveUploadCaseCount(companyId) {
  const cid = mongoose.Types.ObjectId.isValid(companyId)
    ? new mongoose.Types.ObjectId(companyId)
    : companyId;

  const agg = await UploadBatch.aggregate([
    { $match: { companyId: cid, status: "completed" } },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ["$successRows", 0] }, 0] },
              "$successRows",
              { $ifNull: ["$totalRows", 0] },
            ],
          },
        },
      },
    },
  ]);

  return agg[0]?.total || 0;
}

function invalidateCompanyCache(companyId) {
  if (!companyId) {
    indexCache.clear();
    companyItemsCache.clear();
    return;
  }
  const key = String(companyId);
  companyItemsCache.delete(key);
}

function invalidateUploadBatches(companyId, batchIds) {
  const companyKey = String(companyId);
  companyItemsCache.delete(companyKey);

  for (const id of batchIds || []) {
    indexCache.delete(String(id));
  }
}

function isCompanySearchReady(companyId) {
  const entry = companyItemsCache.get(String(companyId));
  return Boolean(entry && Array.isArray(entry.items) && entry.expiresAt > Date.now());
}

function parseS3SearchItemId(itemId) {
  const m = String(itemId || "").match(/^([a-f0-9]{24})-(\d+)$/i);
  if (!m) return null;
  return { batchId: m[1], rowIndex: Number(m[2]) };
}

/** Load full indexed/dataset row (includes excelFields + banker columns). */
async function resolveFullUploadRow(companyId, caseDoc = {}) {
  const parsed = parseS3SearchItemId(caseDoc._id);
  if (parsed) {
    const batch = await UploadBatch.findOne({
      _id: parsed.batchId,
      companyId,
      status: "completed",
    }).lean();

    if (batch) {
      const rows = await loadIndexRows(batch);
      if (rows?.[parsed.rowIndex]) {
        const indexed = rows[parsed.rowIndex];
        return hydrateUploadRowBankerFields(
          companyId,
          toCaseItem(indexed, batch, parsed.rowIndex),
          caseDoc
        );
      }

      if (batch.s3DatasetKey) {
        try {
          const { loadUploadDatasetFromS3 } = require("../modules/uploads/uploadFileStorage");
          const dataset = await loadUploadDatasetFromS3(batch.s3DatasetKey);
          if (dataset?.rows?.[parsed.rowIndex]) {
            return hydrateUploadRowBankerFields(
              companyId,
              toCaseItem(dataset.rows[parsed.rowIndex], batch, parsed.rowIndex),
              caseDoc
            );
          }
        } catch (err) {
          console.error("Dataset load failed:", batch._id, err.message);
        }
      }
    }
  }

  const partial = await findUploadSearchItemForCase(companyId, caseDoc);
  if (!partial) {
    const fromFile = await findUploadRowAcrossCompanyBatches(companyId, caseDoc);
    return fromFile || null;
  }
  return hydrateUploadRowBankerFields(companyId, partial, caseDoc);
}

function rowMatchesIdentity(row, caseDoc = {}) {
  const plate = normalizePlate(caseDoc.vehicleNumber);
  const chassis = String(caseDoc.chassisNumber || "")
    .trim()
    .toUpperCase();
  const loan = String(caseDoc.loanAccountNumber || "")
    .trim()
    .toUpperCase();
  const engine = String(caseDoc.engineNumber || "")
    .trim()
    .toUpperCase();
  const customer = String(caseDoc.customerName || "")
    .trim()
    .toLowerCase();

  const rowPlate = normalizePlate(row.vehicleNumber);
  if (plate && rowPlate) {
    if (rowPlate === plate) return true;
    if (plate.length >= 4 && (rowPlate.includes(plate) || plate.includes(rowPlate))) {
      return true;
    }
  }
  if (chassis && String(row.chassisNumber || "").toUpperCase() === chassis) return true;
  if (loan && String(row.loanAccountNumber || "").trim().toUpperCase() === loan) {
    return true;
  }
  if (engine && String(row.engineNumber || "").trim().toUpperCase() === engine) {
    return true;
  }
  if (customer) {
    const rowCust = String(row.customerName || "").trim().toLowerCase();
    if (rowCust && (rowCust === customer || rowCust.includes(customer) || customer.includes(rowCust))) {
      return true;
    }
  }
  const ef = row.excelFields || {};
  for (const val of Object.values(ef)) {
    const text = String(val || "").trim().toUpperCase();
    if (loan && text === loan) return true;
    if (chassis && text === chassis) return true;
  }
  return false;
}

function findRowInPayloadArray(rows, caseDoc, partialRow = null) {
  if (!rows?.length) return null;
  if (partialRow?.uploadBatchId != null && partialRow._id) {
    const parsed = parseS3SearchItemId(partialRow._id);
    if (parsed && rows[parsed.rowIndex] && rowMatchesIdentity(rows[parsed.rowIndex], caseDoc)) {
      return rows[parsed.rowIndex];
    }
  }
  for (const row of rows) {
    if (rowMatchesIdentity(row, caseDoc)) return row;
  }
  return null;
}

function mergeUploadRowPreserveId(partialRow, fullRow) {
  if (!fullRow) return partialRow;
  return {
    ...partialRow,
    ...fullRow,
    _id: partialRow._id || fullRow._id,
    uploadBatchId: partialRow.uploadBatchId || fullRow.uploadBatchId,
  };
}

function rowMatchesNormalizedCase(row, caseDoc = {}) {
  const plate = normalizePlate(caseDoc.vehicleNumber);
  const rowPlate = normalizePlate(row.vehicleNumber);
  if (plate && rowPlate && rowPlate === plate) return true;

  const chassis = String(caseDoc.chassisNumber || "")
    .trim()
    .toUpperCase();
  if (chassis && String(row.chassisNumber || "").toUpperCase() === chassis) return true;

  const loan = String(caseDoc.loanAccountNumber || "")
    .trim()
    .toUpperCase();
  if (loan && String(row.loanAccountNumber || "").trim().toUpperCase() === loan) {
    return true;
  }

  const engine = String(caseDoc.engineNumber || "")
    .trim()
    .toUpperCase();
  if (engine && String(row.engineNumber || "").trim().toUpperCase() === engine) {
    return true;
  }

  return false;
}

function buildUploadPayloadFromRaw(rawRow, batch, mapping) {
  const { applyHydratedBankerContacts } = require("../utils/hydrateBankerContactsFromExcel");
  const row = normalizeRow(rawRow, batch.branchName || "", mapping || {});
  const excelFields = buildExcelFieldsSnapshot(rawRow);

  return applyHydratedBankerContacts(
    {
      companyId: batch.companyId,
      uploadBatchId: String(batch._id),
      bankName: batch.bankName || "",
      branchName: batch.branchName || "",
      customerName: row.customerName,
      mobileNumber: row.mobileNumber,
      alternateMobileNumber: row.alternateMobileNumber,
      loanAccountNumber: row.loanAccountNumber,
      referenceNumber: row.referenceNumber,
      vehicleNumber: row.vehicleNumber,
      chassisNumber: row.chassisNumber,
      engineNumber: row.engineNumber,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      addressLine1: row.addressLine1,
      city: row.city || "",
      state: row.state || "",
      emiAmount: row.emiAmount,
      dueAmount: row.dueAmount,
      totalOutstandingAmount: row.totalOutstandingAmount,
      bucket: row.bucket,
      contactPerson1Name: row.contactPerson1Name || "",
      contactPerson1Phone: row.contactPerson1Phone || "",
      contactPerson2Name: row.contactPerson2Name || "",
      contactPerson2Phone: row.contactPerson2Phone || "",
      contactPerson3Name: row.contactPerson3Name || "",
      contactPerson3Phone: row.contactPerson3Phone || "",
      bankNotifyEmail1: row.bankNotifyEmail1 || "",
      bankNotifyEmail2: row.bankNotifyEmail2 || "",
    },
    excelFields
  );
}

/** Stream the original upload file and return the matching row with full Excel columns. */
async function findUploadRowFromStoredExcel(batch, caseDoc = {}) {
  if (!batch?.storedFilePath) return null;

  const { getObjectStreamFromS3 } = require("../utils/s3Storage");
  const { streamExcelFromReadable } = require("./excelStream.service");

  let mapping = null;
  let found = null;

  try {
    const { stream } = await getObjectStreamFromS3(batch.storedFilePath);

    await streamExcelFromReadable(
      stream,
      async ({ rows }) => {
        if (found) return;
        for (const rawRow of rows) {
          if (!mapping && rawRow && Object.keys(rawRow).length > 0) {
            mapping = buildSuggestedMapping(rawRow);
          }
          const normalized = normalizeRow(rawRow, batch.branchName || "", mapping || {});
          if (!rowMatchesNormalizedCase(normalized, caseDoc)) continue;
          found = buildUploadPayloadFromRaw(rawRow, batch, mapping);
          return;
        }
      },
      { shouldAbort: () => Boolean(found) }
    );
  } catch (err) {
    console.error("Stored Excel row lookup failed:", batch._id, err.message);
    return null;
  }

  return found;
}

/** Try every completed upload batch until banker columns are found. */
async function findUploadRowAcrossCompanyBatches(companyId, caseDoc = {}, preferBatchId = null) {
  const cid = mongoose.Types.ObjectId.isValid(companyId)
    ? new mongoose.Types.ObjectId(companyId)
    : companyId;

  const batches = await UploadBatch.find({
    companyId: cid,
    status: "completed",
  })
    .sort({ updatedAt: -1 })
    .lean();

  const ordered = preferBatchId
    ? [
        ...batches.filter((b) => String(b._id) === String(preferBatchId)),
        ...batches.filter((b) => String(b._id) !== String(preferBatchId)),
      ]
    : batches;

  let fallback = null;
  for (const batch of ordered) {
    const fromFile = await findUploadRowFromStoredExcel(batch, caseDoc);
    if (!fromFile) continue;
    if (!fallback) fallback = fromFile;
    if (hasBankerNotifyContacts(extractExcelNotifyContacts(fromFile))) {
      return fromFile;
    }
  }
  return fallback;
}

/** Fill banker columns from S3 dataset, index, or re-read stored Excel. */
async function hydrateUploadRowBankerFields(companyId, partialRow, caseDoc = {}) {
  const contacts = extractExcelNotifyContacts(partialRow);
  if (hasBankerNotifyContacts(contacts)) {
    return partialRow;
  }

  const batchId = partialRow.uploadBatchId;
  const batch = batchId
    ? await UploadBatch.findOne({
        _id: batchId,
        companyId,
        status: "completed",
      }).lean()
    : null;

  if (batch?.s3DatasetKey) {
    try {
      const { loadUploadDatasetFromS3 } = require("../modules/uploads/uploadFileStorage");
      const dataset = await loadUploadDatasetFromS3(batch.s3DatasetKey);
      const full = findRowInPayloadArray(dataset?.rows, caseDoc, partialRow);
      if (full && hasBankerNotifyContacts(extractExcelNotifyContacts(full))) {
        return mergeUploadRowPreserveId(partialRow, full);
      }
      if (full && !hasBankerNotifyContacts(contacts)) {
        return mergeUploadRowPreserveId(partialRow, full);
      }
    } catch (err) {
      console.error("Dataset hydrate failed:", batchId, err.message);
    }
  }

  if (batch) {
    const fromFile = await findUploadRowFromStoredExcel(batch, caseDoc);
    if (fromFile) {
      return mergeUploadRowPreserveId(partialRow, fromFile);
    }

    let rows = await loadIndexRows(batch);
    const indexHasBanker = rows?.some((r) =>
      hasBankerNotifyContacts(extractExcelNotifyContacts(r))
    );
    if (!indexHasBanker && batch.storedFilePath) {
      await buildAndSaveSearchIndex(batch);
      rows = await loadIndexRows(batch);
      invalidateCompanyCache(companyId);
    }

    const fromIndex = findRowInPayloadArray(rows, caseDoc, partialRow);
    if (fromIndex) {
      return mergeUploadRowPreserveId(partialRow, fromIndex);
    }
  }

  const fromAnyBatch = await findUploadRowAcrossCompanyBatches(
    companyId,
    caseDoc,
    batchId || null
  );
  if (fromAnyBatch) {
    return mergeUploadRowPreserveId(partialRow, fromAnyBatch);
  }

  return partialRow;
}

/** Same as resolveFullUploadRow but stops after timeoutMs (avoids blocking UI). */
async function resolveFullUploadRowWithTimeout(companyId, caseDoc = {}, timeoutMs = 8000) {
  let timer;
  try {
    return await Promise.race([
      resolveFullUploadRow(companyId, caseDoc),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.error("resolveFullUploadRowWithTimeout:", err.message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Find uploaded Excel row for bank notify / banker contact fields. */
async function findUploadSearchItemForCase(companyId, caseDoc = {}) {
  const items = await getCompanySearchItems(companyId);
  if (!items?.length) return null;

  for (const row of items) {
    if (rowMatchesIdentity(row, caseDoc)) return row;
  }

  return null;
}

module.exports = {
  searchS3Cases,
  findUploadSearchItemForCase,
  resolveFullUploadRow,
  resolveFullUploadRowWithTimeout,
  parseS3SearchItemId,
  getBatchVehicleItems,
  resolveUploadCaseCount,
  invalidateCompanyCache,
  invalidateUploadBatches,
  warmBatchIndexCache,
  warmCompanySearchCache,
  isCompanySearchReady,
  buildAndSaveSearchIndex,
};
