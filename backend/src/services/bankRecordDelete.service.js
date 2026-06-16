const mongoose = require("mongoose");
const BankRecord = require("../modules/bank/bankRecord.model");
const BankUploadBatch = require("../modules/bank/bankUploadBatch.model");
const DataUsageLog = require("../modules/bank/dataUsageLog.model");

function toObjectId(id) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Build query for all BankRecords tied to an upload batch.
 * Handles string batchId on records and legacy rows without batchId.
 */
function buildBaseFilter(batch, restrictToUploader) {
  const bankOid = toObjectId(batch.bankId);
  const base = { bankId: bankOid || batch.bankId };
  if (restrictToUploader) {
    const uploaderOid = toObjectId(batch.uploadedBy);
    if (uploaderOid) base.uploadedBy = uploaderOid;
  }
  return base;
}

function buildRecordDeleteQuery(batch, { restrictToUploader = false, includeLegacy = false } = {}) {
  const batchIdStr = String(batch._id);
  const base = buildBaseFilter(batch, restrictToUploader);

  const orClause = [{ batchId: batchIdStr }];

  if (includeLegacy && batch.createdAt) {
    const windowStart = new Date(batch.createdAt.getTime() - 2 * 60 * 1000);
    const windowEnd = new Date(
      (batch.updatedAt || batch.createdAt).getTime() + 30 * 60 * 1000
    );
    orClause.push({
      $and: [
        {
          $or: [
            { batchId: null },
            { batchId: "" },
            { batchId: { $exists: false } },
          ],
        },
        { createdAt: { $gte: windowStart, $lte: windowEnd } },
      ],
    });
  }

  return { ...base, $or: orClause };
}

/**
 * Delete all records for an upload + agency usage logs + optional batch row.
 * @returns {{ deletedRecords: number, deletedLogs: number, batchRemoved: boolean }}
 */
async function deleteBankUploadAndRecords(batch, { removeBatch = true, restrictToUploader = false } = {}) {
  let filter = buildRecordDeleteQuery(batch, { restrictToUploader, includeLegacy: false });
  let matchCount = await BankRecord.countDocuments(filter);

  if (matchCount === 0 && (batch.successRows || 0) > 0) {
    filter = buildRecordDeleteQuery(batch, { restrictToUploader, includeLegacy: true });
    matchCount = await BankRecord.countDocuments(filter);
  }

  const recordIds = await BankRecord.find(filter).distinct("_id");

  let deletedLogs = 0;
  if (recordIds.length) {
    const logResult = await DataUsageLog.deleteMany({
      bankRecordId: { $in: recordIds },
    });
    deletedLogs = logResult.deletedCount || 0;
  }

  const deleteResult = await BankRecord.deleteMany(filter);
  const deletedRecords = deleteResult.deletedCount || 0;

  let batchRemoved = false;
  if (removeBatch) {
    await BankUploadBatch.deleteOne({ _id: batch._id });
    batchRemoved = true;
  }

  return { deletedRecords, deletedLogs, batchRemoved };
}

module.exports = {
  buildRecordDeleteQuery,
  deleteBankUploadAndRecords,
};
