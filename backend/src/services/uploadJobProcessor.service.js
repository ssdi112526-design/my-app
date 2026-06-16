const UploadBatch = require("../modules/uploads/uploadBatch.model");
const RepoCase = require("../modules/repoCases/repoCase.model");
const {
  normalizeRow,
  buildSuggestedMapping,
} = require("../modules/uploads/excelParser");
const {
  UPLOAD_S3_ONLY,
  MAX_MONGO_IMPORT_ROWS,
  MAX_UPLOAD_ROWS,
} = require("../modules/uploads/upload.constants");
const { getObjectStreamFromS3 } = require("../utils/s3Storage");
const {
  saveUploadDatasetToS3,
  saveSearchIndexToS3,
} = require("../modules/uploads/uploadFileStorage");
const {
  invalidateCompanyCache,
  warmBatchIndexCache,
} = require("./uploadS3Search.service");
const { streamExcelFromReadable } = require("./excelStream.service");
const { bulkUpsertCases } = require("./uploadBulk.service");
const {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadFailed,
} = require("../utils/socketBridge");
const { bankBranchScopeFilter } = require("../modules/uploads/uploadProcess.service");

const MAX_FAILED_DETAILS = 200;

function buildPayload(rawRow, rowIndex, batchId, companyId, userId, bankName, branchName, mapping) {
  const row = normalizeRow(rawRow, branchName, mapping);
  const hasCustomer = !!row.customerName;
  const hasLoan = !!row.loanAccountNumber;
  const hasVehicle = !!row.vehicleNumber;

  if (!hasCustomer || (!hasLoan && !hasVehicle)) {
    return { error: "Missing required fields." };
  }

  const payload = {
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
  };

  if (row.bucket) payload.bucket = row.bucket;
  return { payload, rowIndex };
}

async function processUploadJob(jobData, job) {
  const {
    batchId,
    companyId,
    userId,
    bankName,
    branchName,
    fileName,
    s3Key,
    columnMapping,
    replacedPriorBatches,
  } = jobData;

  const batch = await UploadBatch.findById(batchId);
  if (!batch) throw new Error("Upload batch not found.");

  const mongoEnabled = !UPLOAD_S3_ONLY;
  const mongoCap = mongoEnabled ? MAX_MONGO_IMPORT_ROWS : 0;

  batch.status = "processing";
  batch.queueJobId = job?.id ? String(job.id) : batch.queueJobId;
  batch.importMode = mongoEnabled ? (mongoCap > 0 ? "partial" : "full") : "s3_only";
  await batch.save();

  const scopeFilter = bankBranchScopeFilter(companyId, bankName, branchName);

  if (mongoEnabled && replacedPriorBatches > 0) {
    const oldBatches = await UploadBatch.find({
      ...scopeFilter,
      _id: { $ne: batchId },
    }).select("_id storedFilePath s3DatasetKey s3SearchIndexKey storageLocation");

    const oldIds = oldBatches.map((b) => b._id);
    await RepoCase.deleteMany({ companyId, uploadBatchId: { $in: oldIds } });
    const { collectS3KeysFromBatches } = require("./uploadDelete.service");
    const { deleteObjectsFromS3 } = require("../utils/s3Storage");
    await deleteObjectsFromS3(collectS3KeysFromBatches(oldBatches));
    await UploadBatch.deleteMany({ _id: { $in: oldIds } });
  }

  const { stream } = await getObjectStreamFromS3(s3Key);

  let mapping =
    columnMapping && Object.keys(columnMapping).length > 0 ? columnMapping : null;

  let successRows = 0;
  let failedRows = 0;
  let duplicateRows = 0;
  const failedDetails = [];
  const datasetRows = [];
  let totalRows = 0;
  let columnNames = [];

  const reportProgress = async (processed, total, message) => {
    const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    batch.processedRows = processed;
    batch.totalRows = total;
    await batch.save();

    if (job?.updateProgress) {
      await job.updateProgress(percent);
    }

    emitUploadProgress({
      companyId,
      userId,
      batchId,
      processedRows: processed,
      totalRows: total,
      status: "processing",
      message,
      percent,
    });
  };

  await reportProgress(0, 0, "Reading Excel from S3…");

  const result = await streamExcelFromReadable(stream, async ({ rows, startRowIndex, headers, totalRowsSoFar }) => {
    if (!mapping && rows[0]) {
      mapping = buildSuggestedMapping(rows[0]);
    }
    columnNames = headers;
    totalRows = totalRowsSoFar;

    if (totalRows > MAX_UPLOAD_ROWS) {
      throw new Error(
        `File exceeds ${MAX_UPLOAD_ROWS.toLocaleString()} row limit.`
      );
    }

    const payloads = [];
    for (let i = 0; i < rows.length; i += 1) {
      const built = buildPayload(
        rows[i],
        startRowIndex + i,
        batchId,
        companyId,
        userId,
        bankName,
        branchName,
        mapping || {}
      );

      if (built.error) {
        failedRows += 1;
        if (failedDetails.length < MAX_FAILED_DETAILS) {
          failedDetails.push({
            rowNumber: startRowIndex + i + 2,
            reason: built.error,
          });
        }
        continue;
      }

      datasetRows.push(built.payload);

      if (mongoEnabled && successRows + payloads.length < mongoCap) {
        payloads.push(built.payload);
      }
    }

    if (payloads.length > 0) {
      const bulk = await bulkUpsertCases(companyId, batchId, payloads, userId);
      successRows += bulk.inserted + bulk.modified;
      failedRows += bulk.failed;
    }

    if (!mongoEnabled || successRows >= mongoCap) {
      await reportProgress(
        totalRowsSoFar,
        totalRowsSoFar,
        mongoEnabled
          ? `Processed ${totalRowsSoFar.toLocaleString()} rows (S3 archive)…`
          : `Validated ${totalRowsSoFar.toLocaleString()} rows on S3…`
      );
      return;
    }

    await reportProgress(
      totalRowsSoFar,
      totalRowsSoFar,
      `Imported ${successRows.toLocaleString()} / ${totalRowsSoFar.toLocaleString()} rows…`
    );
  });

  totalRows = result.totalRows || totalRows;
  columnNames = result.headers?.length ? result.headers : columnNames;

  batch.totalRows = totalRows;
  batch.columnCount = columnNames.length;
  batch.columnNames = columnNames;
  batch.successRows = mongoEnabled ? successRows : datasetRows.length || totalRows;
  batch.failedRows = failedRows;
  batch.duplicateRows = duplicateRows;
  batch.failedDetails = failedDetails;
  batch.processedRows = totalRows;
  batch.status = "completed";
  batch.storageLocation = "s3";

  if (mongoEnabled && mongoCap > 0 && totalRows > mongoCap) {
    batch.importMode = "partial";
    batch.importNote = `Imported ${successRows.toLocaleString()} of ${totalRows.toLocaleString()} rows. Full file on S3.`;
  }

  await batch.save();

  if (datasetRows.length > 0) {
    warmBatchIndexCache(batch.toObject(), datasetRows);
  }

  emitUploadComplete({
    companyId,
    userId,
    batchId,
    batch: batch.toObject(),
  });

  if (datasetRows.length > 0) {
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
            columnNames,
            totalRows: rowsForIndex.length,
            importMode: batch.importMode,
            importedAt: new Date().toISOString(),
            rows: rowsForIndex,
          });
          patch.s3DatasetKey = s3DatasetKey;
        }
        await UploadBatch.updateOne({ _id: batchId }, { $set: patch });
        invalidateCompanyCache(companyId);
      } catch (s3Err) {
        console.error("S3 search index save failed:", s3Err.message);
      }
    });
  }

  return {
    totalRows,
    successRows: batch.successRows,
    failedRows,
    importMode: batch.importMode,
  };
}

async function failUploadJob(jobData, errorMessage) {
  const batch = await UploadBatch.findById(jobData.batchId);
  if (batch) {
    batch.status = "failed";
    batch.errorMessage = errorMessage;
    await batch.save();
  }

  emitUploadFailed({
    companyId: jobData.companyId,
    userId: jobData.userId,
    batchId: jobData.batchId,
    errorMessage,
  });
}

module.exports = {
  processUploadJob,
  failUploadJob,
};
