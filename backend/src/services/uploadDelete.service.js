const RepoCase = require("../modules/repoCases/repoCase.model");
const UploadBatch = require("../modules/uploads/uploadBatch.model");
const { deleteObjectsFromS3 } = require("../utils/s3Storage");
const { UPLOAD_S3_ONLY } = require("../modules/uploads/upload.constants");
const { invalidateUploadBatches } = require("./uploadS3Search.service");

function collectS3KeysFromBatches(batches) {
  const keys = [];
  for (const batch of batches || []) {
    if (batch.storedFilePath) keys.push(batch.storedFilePath);
    if (batch.s3DatasetKey) keys.push(batch.s3DatasetKey);
    if (batch.s3SearchIndexKey) keys.push(batch.s3SearchIndexKey);
  }
  return keys;
}

/**
 * Fast delete: drop search cache + batch records, return immediately.
 * S3 objects and optional Mongo rows are removed in the background.
 */
async function purgeUploadBatchesFast(companyId, batches) {
  const batchIds = batches.map((b) => b._id);
  const companyKey = String(companyId);

  invalidateUploadBatches(companyKey, batchIds);

  const deleteResult = await UploadBatch.deleteMany({
    _id: { $in: batchIds },
    companyId,
  });

  return {
    deletedBatches: deleteResult.deletedCount || 0,
    batchIds,
  };
}

function purgeUploadBatchesBackground(companyId, batches) {
  const batchIds = batches.map((b) => b._id);
  const keys = collectS3KeysFromBatches(batches);

  setImmediate(async () => {
    try {
      await deleteObjectsFromS3(keys);
    } catch (err) {
      console.error("Background S3 delete failed:", err.message);
    }

    if (!UPLOAD_S3_ONLY && batchIds.length) {
      try {
        await RepoCase.deleteMany({
          companyId,
          uploadBatchId: { $in: batchIds },
        });
      } catch (err) {
        console.error("Background Mongo case delete failed:", err.message);
      }
    }
  });
}

module.exports = {
  collectS3KeysFromBatches,
  purgeUploadBatchesFast,
  purgeUploadBatchesBackground,
};
