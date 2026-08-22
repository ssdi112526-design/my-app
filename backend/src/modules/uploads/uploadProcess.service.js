const RepoCase = require("../repoCases/repoCase.model");
const UploadBatch = require("./uploadBatch.model");
const User = require("../users/user.model");
const { notifyCompanyRoles } = require("../notifications/notification.service");
const {
  saveUploadDatasetToS3,
  saveSearchIndexToS3,
} = require("./uploadFileStorage");
const {
  invalidateCompanyCache,
  warmBatchIndexCache,
} = require("../../services/uploadS3Search.service");
const {
  normalizeRow,
  countWorkbookDataRows,
  iterateWorkbookRowChunks,
  buildSuggestedMapping,
  buildExcelFieldsSnapshot,
} = require("./excelParser");
const { applyHydratedBankerContacts } = require("../../utils/hydrateBankerContactsFromExcel");
const {
  UPLOAD_S3_ONLY,
  MAX_MONGO_IMPORT_ROWS,
  S3_ONLY_ROW_THRESHOLD,
  MAX_UPLOAD_ROWS,
  EXCEL_CHUNK_SIZE,
  UPLOAD_SEARCH_CHUNK_SIZE,
} = require("./upload.constants");
const {
  insertSearchRowChunk,
  deleteByBatch,
  toSearchRow,
} = require("../../services/uploadSearchRows.service");

const BULK_INSERT_SIZE = 1000;
const MAX_FAILED_DETAILS = 200;

const buildCaseCode = (batchId, rowIndex) =>
  `CASE-${String(batchId).slice(-8)}-${rowIndex}-${Math.floor(Math.random() * 1000)}`;

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bankBranchScopeFilter(companyId, bankName, branchName) {
  return {
    companyId,
    bankName: { $regex: new RegExp(`^${escapeRegex(bankName)}$`, "i") },
    branchName: { $regex: new RegExp(`^${escapeRegex(branchName)}$`, "i") },
  };
}

async function loadExistingDuplicateKeys(companyId, payloads) {
  const loans = new Set();
  const vehicles = new Set();
  const chassis = new Set();

  for (const p of payloads) {
    if (p.loanAccountNumber) loans.add(p.loanAccountNumber);
    if (p.vehicleNumber) vehicles.add(p.vehicleNumber);
    if (p.chassisNumber) chassis.add(p.chassisNumber);
  }

  const or = [];
  if (loans.size) or.push({ loanAccountNumber: { $in: [...loans] } });
  if (vehicles.size) or.push({ vehicleNumber: { $in: [...vehicles] } });
  if (chassis.size) or.push({ chassisNumber: { $in: [...chassis] } });

  const existingLoans = new Set();
  const existingVehicles = new Set();
  const existingChassis = new Set();

  if (!or.length) {
    return { existingLoans, existingVehicles, existingChassis };
  }

  const existing = await RepoCase.find({ companyId, $or: or })
    .select("loanAccountNumber vehicleNumber chassisNumber")
    .lean();

  for (const doc of existing) {
    if (doc.loanAccountNumber) existingLoans.add(doc.loanAccountNumber);
    if (doc.vehicleNumber) existingVehicles.add(doc.vehicleNumber);
    if (doc.chassisNumber) existingChassis.add(doc.chassisNumber);
  }

  return { existingLoans, existingVehicles, existingChassis };
}

function isDuplicatePayload(payload, existing, seenInFile) {
  const { loanAccountNumber, vehicleNumber, chassisNumber } = payload;

  if (loanAccountNumber) {
    if (existing.existingLoans.has(loanAccountNumber)) return true;
    if (seenInFile.loans.has(loanAccountNumber)) return true;
    seenInFile.loans.add(loanAccountNumber);
  }
  if (vehicleNumber) {
    if (existing.existingVehicles.has(vehicleNumber)) return true;
    if (seenInFile.vehicles.has(vehicleNumber)) return true;
    seenInFile.vehicles.add(vehicleNumber);
  }
  if (chassisNumber) {
    if (existing.existingChassis.has(chassisNumber)) return true;
    if (seenInFile.chassis.has(chassisNumber)) return true;
    seenInFile.chassis.add(chassisNumber);
  }

  return false;
}

async function processRowSlice({
  slice,
  startOffset,
  batchId,
  companyId,
  userId,
  bankName,
  branchName,
  mapping,
  seenInFile,
  stats,
  mongoCap,
}) {
  const toInsert = [];
  const chunkForDupCheck = [];

  for (let i = 0; i < slice.length; i += 1) {
    if (stats.successRows >= mongoCap) break;

    const rowIndex = startOffset + i;
    const rawRow = slice[i];

    try {
      const row = normalizeRow(rawRow, branchName, mapping);
      const hasCustomer = !!String(row.customerName || "").trim();
      const hasLoan = !!String(row.loanAccountNumber || "").trim();
      const hasVehicle = !!String(row.vehicleNumber || "").trim();

      if (!hasCustomer || !hasVehicle || !hasLoan) {
        stats.failedRows += 1;
        if (!hasLoan) {
          stats.skippedInvalidLoanRows = (stats.skippedInvalidLoanRows || 0) + 1;
        }
        if (stats.failedDetails.length < MAX_FAILED_DETAILS) {
          let reason = "Missing required fields.";
          if (!hasCustomer) reason = "Missing customer name.";
          else if (!hasVehicle) reason = "Missing vehicle / registration number.";
          else if (!hasLoan) {
            reason =
              "Missing or invalid loan number. Use Loan Number / LAN / agreement column (e.g. LAN09887665324 or VL…). Plain 10-digit mobiles are not accepted as loan.";
          }
          stats.failedDetails.push({ rowNumber: rowIndex + 2, reason });
        }
        continue;
      }

      const payload = {
        companyId,
        uploadBatchId: batchId,
        caseCode: buildCaseCode(batchId, rowIndex),
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
        createdBy: userId,
        updatedBy: userId,
      };

      if (row.bucket) payload.bucket = row.bucket;
      const excelFields = buildExcelFieldsSnapshot(rawRow);
      Object.assign(
        payload,
        applyHydratedBankerContacts(
          {
            ...payload,
            excelFields,
            contactPerson1Name: row.contactPerson1Name,
            contactPerson1Phone: row.contactPerson1Phone,
            contactPerson2Name: row.contactPerson2Name,
            contactPerson2Phone: row.contactPerson2Phone,
            contactPerson3Name: row.contactPerson3Name,
            contactPerson3Phone: row.contactPerson3Phone,
            bankNotifyEmail1: row.bankNotifyEmail1,
            bankNotifyEmail2: row.bankNotifyEmail2,
          },
          excelFields
        )
      );
      chunkForDupCheck.push(payload);
    } catch (err) {
      stats.failedRows += 1;
      if (stats.failedDetails.length < MAX_FAILED_DETAILS) {
        stats.failedDetails.push({ rowNumber: rowIndex + 2, reason: err.message });
      }
    }
  }

  const existing = await loadExistingDuplicateKeys(companyId, chunkForDupCheck);

  for (const payload of chunkForDupCheck) {
    if (stats.successRows >= mongoCap) break;
    if (isDuplicatePayload(payload, existing, seenInFile)) {
      stats.duplicateRows += 1;
      continue;
    }
    toInsert.push(payload);
  }

  if (toInsert.length > 0) {
    const room = mongoCap - stats.successRows;
    const batch = toInsert.slice(0, room);
    try {
      await RepoCase.insertMany(batch, { ordered: false });
      stats.successRows += batch.length;
    } catch (bulkErr) {
      if (bulkErr.writeErrors) {
        stats.successRows += batch.length - bulkErr.writeErrors.length;
        stats.failedRows += bulkErr.writeErrors.length;
      } else {
        stats.failedRows += batch.length;
      }
    }
  }
}

async function processUploadInBackground({
  batchId,
  companyId,
  userId,
  bankName,
  branchName,
  fileName,
  fileBuffer,
  columnMapping,
  replacedPriorBatches,
}) {
  const batch = await UploadBatch.findById(batchId);
  if (!batch) return;

  try {
    const { totalRows, worksheet, fullRange } = countWorkbookDataRows(fileBuffer);

    if (totalRows > MAX_UPLOAD_ROWS) {
      throw new Error(
        `File has ${totalRows.toLocaleString()} rows. Maximum allowed is ${MAX_UPLOAD_ROWS.toLocaleString()}. Split the file or contact support.`
      );
    }

    const s3Only =
      UPLOAD_S3_ONLY || totalRows > S3_ONLY_ROW_THRESHOLD;
    const mongoCap = s3Only ? 0 : Math.min(totalRows, MAX_MONGO_IMPORT_ROWS);
    const importMode = s3Only
      ? "s3_only"
      : totalRows > mongoCap
        ? "partial"
        : "full";

    batch.totalRows = totalRows;
    batch.importMode = importMode;
    batch.processedRows = 0;
    batch.storageLocation = "s3";

    if (importMode === "partial") {
      batch.importNote = `Imported first ${mongoCap.toLocaleString()} of ${totalRows.toLocaleString()} rows into the app. Full file is on S3.`;
    }

    await batch.save();

    const scopeFilter = bankBranchScopeFilter(companyId, bankName, branchName);
    const existingBatches = await UploadBatch.find({
      ...scopeFilter,
      _id: { $ne: batchId },
    }).select("_id storedFilePath s3DatasetKey s3SearchIndexKey storageLocation");

    if (existingBatches.length > 0) {
      const oldIds = existingBatches.map((b) => b._id);
      if (!s3Only) {
        await RepoCase.deleteMany({
          companyId,
          uploadBatchId: { $in: oldIds },
        });
      }
      const { collectS3KeysFromBatches } = require("../../services/uploadDelete.service");
      const { deleteObjectsFromS3 } = require("../../utils/s3Storage");
      await deleteObjectsFromS3(collectS3KeysFromBatches(existingBatches));
      await deleteByBatch(oldIds);
      await UploadBatch.deleteMany({ _id: { $in: oldIds } });
    }

    await deleteByBatch(batchId);

    let mapping =
      columnMapping && Object.keys(columnMapping).length > 0
        ? columnMapping
        : null;

    let columnNames = [];

    const stats = {
      successRows: 0,
      failedRows: 0,
      duplicateRows: 0,
      skippedInvalidLoanRows: 0,
      failedDetails: [],
    };
    const datasetRows = [];
    const searchChunk = [];
    let searchInserted = 0;
    const seenInFile = { loans: new Set(), vehicles: new Set(), chassis: new Set() };

    const flushSearchChunk = async () => {
      if (!searchChunk.length) return;
      await insertSearchRowChunk(searchChunk);
      searchInserted += searchChunk.length;
      searchChunk.length = 0;
    };

    if (!s3Only) {
      let processed = 0;

      for (const { rows, startIndex } of iterateWorkbookRowChunks(
        worksheet,
        fullRange,
        EXCEL_CHUNK_SIZE
      )) {
        if (!mapping && rows[0]) {
          mapping = buildSuggestedMapping(rows[0]);
          columnNames = Object.keys(rows[0]).filter(Boolean);
          batch.columnNames = columnNames;
          batch.columnCount = columnNames.length;
        }

        for (let start = 0; start < rows.length; start += BULK_INSERT_SIZE) {
          if (stats.successRows >= mongoCap) break;
          await processRowSlice({
            slice: rows.slice(start, start + BULK_INSERT_SIZE),
            startOffset: startIndex + start,
            batchId,
            companyId,
            userId,
            bankName,
            branchName,
            mapping: mapping || {},
            seenInFile,
            stats,
            mongoCap,
          });
        }

        processed = Math.min(startIndex + rows.length, totalRows);
        batch.processedRows = processed;
        batch.successRows = stats.successRows;
        batch.failedRows = stats.failedRows;
        batch.skippedInvalidLoanRows = stats.skippedInvalidLoanRows || 0;
        batch.duplicateRows = stats.duplicateRows;
        await batch.save();

        if (stats.successRows >= mongoCap) break;
      }
    } else {
      for (const { rows, startIndex } of iterateWorkbookRowChunks(
        worksheet,
        fullRange,
        EXCEL_CHUNK_SIZE
      )) {
        if (!mapping && rows[0]) {
          mapping = buildSuggestedMapping(rows[0]);
          columnNames = Object.keys(rows[0]).filter(Boolean);
          batch.columnNames = columnNames;
          batch.columnCount = columnNames.length;
        }

        for (let i = 0; i < rows.length; i += 1) {
          const rowIndex = startIndex + i;
          const row = normalizeRow(rows[i], branchName, mapping || {});
          const hasCustomer = !!String(row.customerName || "").trim();
          const hasLoan = !!String(row.loanAccountNumber || "").trim();
          const hasVehicle = !!String(row.vehicleNumber || "").trim();

          if (!hasCustomer || !hasVehicle || !hasLoan) {
            stats.failedRows += 1;
            if (!hasLoan) {
              stats.skippedInvalidLoanRows = (stats.skippedInvalidLoanRows || 0) + 1;
            }
            if (stats.failedDetails.length < MAX_FAILED_DETAILS) {
              let reason = "Missing required fields.";
              if (!hasCustomer) reason = "Missing customer name.";
              else if (!hasVehicle) reason = "Missing vehicle / registration number.";
              else if (!hasLoan) {
                reason =
                  "Missing or invalid loan number. Use Loan Number / LAN column (LAN… / VL…). A 10-digit mobile is not a loan number.";
              }
              stats.failedDetails.push({ rowNumber: rowIndex + 2, reason });
            }
            continue;
          }

          const excelFields = buildExcelFieldsSnapshot(rows[i]);
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
              contactPerson1Name: row.contactPerson1Name,
              contactPerson1Phone: row.contactPerson1Phone,
              contactPerson2Name: row.contactPerson2Name,
              contactPerson2Phone: row.contactPerson2Phone,
              contactPerson3Name: row.contactPerson3Name,
              contactPerson3Phone: row.contactPerson3Phone,
              bankNotifyEmail1: row.bankNotifyEmail1,
              bankNotifyEmail2: row.bankNotifyEmail2,
            },
            excelFields
          );
          searchChunk.push(toSearchRow(payload, rowIndex));
          if (searchChunk.length >= UPLOAD_SEARCH_CHUNK_SIZE) {
            await flushSearchChunk();
          }
          datasetRows.push(payload);
        }

        batch.processedRows = Math.min(startIndex + rows.length, totalRows);
        await batch.save();
      }
    }

    await flushSearchChunk();

    batch.status = "completed";
    batch.processedRows = totalRows;

    batch.successRows = s3Only ? searchInserted || datasetRows.length || totalRows : stats.successRows;
    batch.failedRows = stats.failedRows;
    batch.duplicateRows = stats.duplicateRows;
    batch.skippedInvalidLoanRows = stats.skippedInvalidLoanRows || 0;
    batch.failedDetails = stats.failedDetails;

    await batch.save();

    if (datasetRows.length > 0) {
      warmBatchIndexCache(batch.toObject(), datasetRows);
    }
    invalidateCompanyCache(companyId);

    const uploader = await User.findById(userId).select("name");
    const uploaderName = uploader?.name || "Admin";

    const invalidLoan = stats.skippedInvalidLoanRows || 0;
    const failNote =
      stats.failedRows > 0
        ? ` Skipped ${stats.failedRows} row(s)${invalidLoan ? ` (${invalidLoan} missing/invalid loan number)` : ""}.`
        : "";

    const msg = s3Only
      ? `File with ${totalRows.toLocaleString()} rows stored on S3 for ${bankName} – ${branchName}.${failNote}`
      : `${stats.successRows} record(s) imported for ${bankName} – ${branchName} by ${uploaderName}.${failNote}`;

    await notifyCompanyRoles(companyId, {
      title: replacedPriorBatches > 0 ? "Bank branch data replaced" : "Upload complete",
      message: msg,
      meta: {
        batchId,
        bankName,
        branchName,
        successRows: batch.successRows,
        failedRows: batch.failedRows,
        skippedInvalidLoanRows: invalidLoan,
        fileName,
      },
    });

    if (s3Only && datasetRows.length > 0) {
      const rowsForIndex = datasetRows;
      setImmediate(async () => {
        try {
          const { s3SearchIndexKey } = await saveSearchIndexToS3(
            companyId,
            batchId,
            rowsForIndex
          );
          const patch = { s3SearchIndexKey };
          if (rowsForIndex.length <= 10000) {
            const { s3DatasetKey } = await saveUploadDatasetToS3(companyId, batchId, {
              version: 1,
              companyId: String(companyId),
              batchId: String(batchId),
              bankName,
              branchName,
              fileName,
              columnNames: batch.columnNames,
              totalRows: rowsForIndex.length,
              importMode,
              importedAt: new Date().toISOString(),
              rows: rowsForIndex,
            });
            patch.s3DatasetKey = s3DatasetKey;
          }
          await UploadBatch.updateOne({ _id: batchId }, { $set: patch });
          invalidateCompanyCache(batchId);
        } catch (s3DataErr) {
          console.error("S3 search index save failed:", s3DataErr.message);
        }
      });
    } else if (!s3Only && totalRows <= 50000) {
      try {
        const { s3DatasetKey } = await saveUploadDatasetToS3(companyId, batchId, {
          bankName,
          branchName,
          fileName,
          columnNames: batch.columnNames,
          totalRows,
          successRows: stats.successRows,
          importMode,
          importedAt: new Date().toISOString(),
        });
        batch.s3DatasetKey = s3DatasetKey;
        await batch.save();
      } catch (s3DataErr) {
        console.error("S3 metadata archive failed:", s3DataErr.message);
      }
    }
  } catch (err) {
    console.error("Upload background job failed:", err.message);
    batch.status = "failed";
    batch.errorMessage = err.message;
    await batch.save();
    try {
      await deleteByBatch(batchId);
    } catch (cleanupErr) {
      console.error("Search-row rollback after upload failure failed:", cleanupErr.message);
    }
  }
}

module.exports = {
  processUploadInBackground,
  bankBranchScopeFilter,
  buildSuggestedMapping,
};
