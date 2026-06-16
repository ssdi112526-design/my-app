const UploadBatch = require("./uploadBatch.model");
const {
  saveUploadFile,
  pipeUploadFileToResponse,
  assertS3Required,
  getMimeType,
} = require("./uploadFileStorage");
const {
  buildObjectKey,
  createPresignedPutUrl,
} = require("../../utils/s3Storage");
const {
  cleanValue,
  normalizeRow,
  parseWorkbookPreview,
  parseColumnMappingBody,
  SYSTEM_FIELD_DEFS,
} = require("./excelParser");
const { enqueueUploadJob } = require("../../queues/uploadQueue");
const { isRedisConfigured } = require("../../config/redis");
const { processUploadJob } = require("../../services/uploadJobProcessor.service");
const {
  processUploadInBackground,
  bankBranchScopeFilter,
} = require("./uploadProcess.service");
const {
  purgeUploadBatchesFast,
  purgeUploadBatchesBackground,
} = require("../../services/uploadDelete.service");

function shouldUseUploadQueue() {
  return (
    isRedisConfigured() &&
    (process.env.UPLOAD_USE_QUEUE === "true" || process.env.UPLOAD_USE_QUEUE === "1")
  );
}

const previewRepoCases = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    const bankName = cleanValue(req.body.bankName);
    if (!bankName) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    const {
      rows,
      columns,
      totalRows,
      suggestedMapping,
    } = parseWorkbookPreview(req.file.buffer);

    const previewRows = rows.slice(0, 10).map((rawRow, index) => ({
      rowNumber: index + 2,
      raw: rawRow,
      normalized: normalizeRow(rawRow, "", suggestedMapping),
    }));

    return res.json({
      success: true,
      data: {
        bankName,
        columns,
        suggestedMapping,
        previewRows,
        totalRows,
        systemFields: SYSTEM_FIELD_DEFS,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadRepoCases = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    const bankName = cleanValue(req.body.bankName);
    const branchName = cleanValue(req.body.branchName);
    const columnMapping = parseColumnMappingBody(req.body.columnMapping);

    if (!bankName) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    if (!branchName) {
      return res.status(400).json({
        success: false,
        message: "Branch name is required.",
      });
    }

    try {
      assertS3Required();
    } catch (s3Err) {
      return res.status(503).json({
        success: false,
        message: s3Err.message,
      });
    }

    const scopeFilter = bankBranchScopeFilter(req.user.companyId, bankName, branchName);
    const replacedPriorBatches = await UploadBatch.countDocuments(scopeFilter);

    const batch = await UploadBatch.create({
      companyId: req.user.companyId,
      fileName: req.file.originalname,
      bankName,
      branchName,
      totalRows: 0,
      columnCount: 0,
      columnNames: [],
      uploadedBy: req.user.userId,
      status: "processing",
      processedRows: 0,
      storageLocation: "s3",
    });

    try {
      const stored = await saveUploadFile(
        req.user.companyId,
        batch._id,
        req.file.originalname,
        req.file.buffer
      );
      batch.storedFilePath = stored.storedFilePath;
      batch.storageLocation = stored.storageLocation;
      await batch.save();
    } catch (storeErr) {
      console.error("Failed to store upload file:", storeErr.message);
    }
    const fileBuffer = req.file.buffer;

    setImmediate(() => {
      processUploadInBackground({
        batchId: batch._id,
        companyId: req.user.companyId,
        userId: req.user.userId,
        bankName,
        branchName,
        fileName: req.file.originalname,
        fileBuffer,
        columnMapping,
        replacedPriorBatches,
      });
    });

    return res.status(202).json({
      success: true,
      processing: true,
      message:
        "Upload started. Large files are processed in the background — you can close this dialog and check status on Bank Details.",
      data: Object.assign(batch.toObject(), {
        replacedPriorBatchCount: replacedPriorBatches,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/** Step 1: get presigned URL — browser uploads straight to S3 (fast). */
const presignS3Upload = async (req, res) => {
  try {
    assertS3Required();

    const bankName = cleanValue(req.body.bankName);
    const branchName = cleanValue(req.body.branchName);
    const fileName = cleanValue(req.body.fileName) || "upload.xlsx";
    const contentType =
      cleanValue(req.body.contentType) || getMimeType(fileName);

    if (!bankName || !branchName) {
      return res.status(400).json({
        success: false,
        message: "Bank name and branch name are required.",
      });
    }

    const batch = await UploadBatch.create({
      companyId: req.user.companyId,
      fileName,
      bankName,
      branchName,
      totalRows: 0,
      columnCount: 0,
      columnNames: [],
      uploadedBy: req.user.userId,
      status: "processing",
      processedRows: 0,
      storageLocation: "s3",
    });

    const key = buildObjectKey(req.user.companyId, batch._id, fileName);
    const { uploadUrl, bucket, expiresIn } = await createPresignedPutUrl(
      key,
      contentType
    );

    batch.storedFilePath = key;
    await batch.save();

    return res.json({
      success: true,
      data: {
        batchId: batch._id,
        uploadUrl,
        bucket,
        key,
        expiresIn,
        corsNote:
          "S3 bucket must allow PUT from your app origin (CORS). See backend/docs/S3_CORS.md",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/** Step 2: after S3 PUT succeeds — import rows in background. */
const completeS3Upload = async (req, res) => {
  try {
    assertS3Required();

    const batchId = req.body.batchId;
    const bankName = cleanValue(req.body.bankName);
    const branchName = cleanValue(req.body.branchName);
    const columnMapping = parseColumnMappingBody(req.body.columnMapping);

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "batchId is required.",
      });
    }

    const batch = await UploadBatch.findOne({
      _id: batchId,
      companyId: req.user.companyId,
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Upload batch not found.",
      });
    }

    if (!batch.storedFilePath) {
      return res.status(400).json({
        success: false,
        message: "Upload file key missing. Presign again.",
      });
    }

    const scopeFilter = bankBranchScopeFilter(
      req.user.companyId,
      bankName || batch.bankName,
      branchName || batch.branchName
    );
    const replacedPriorBatches = await UploadBatch.countDocuments({
      ...scopeFilter,
      _id: { $ne: batchId },
    });

    const jobPayload = {
      batchId: batch._id,
      companyId: req.user.companyId,
      userId: req.user.userId,
      bankName: bankName || batch.bankName,
      branchName: branchName || batch.branchName,
      fileName: batch.fileName,
      s3Key: batch.storedFilePath,
      columnMapping,
      replacedPriorBatches,
    };

    let queueResult = null;
    if (shouldUseUploadQueue()) {
      queueResult = await enqueueUploadJob(jobPayload);
      if (queueResult?.queued) {
        batch.queueJobId = String(queueResult.jobId);
        await batch.save();
      }
    }

    if (!queueResult?.queued) {
      setImmediate(async () => {
        try {
          await processUploadJob(jobPayload, null);
        } catch (err) {
          console.error("S3 complete import failed:", err.message);
          const failed = await UploadBatch.findById(batch._id);
          if (failed) {
            failed.status = "failed";
            failed.errorMessage = err.message;
            await failed.save();
          }
        }
      });
    }

    return res.status(202).json({
      success: true,
      processing: true,
      queued: Boolean(queueResult?.queued),
      message: queueResult?.queued
        ? "File on S3. Processing in BullMQ worker queue…"
        : "File on S3. Processing now (streams from S3 — no worker required).",
      data: Object.assign(batch.toObject(), {
        replacedPriorBatchCount: replacedPriorBatches,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUploads = async (req, res) => {
  try {
    const docs = await UploadBatch.find({
      companyId: req.user.companyId,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: docs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUploadById = async (req, res) => {
  try {
    const doc = await UploadBatch.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    }).populate("uploadedBy", "name email");

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Upload batch not found.",
      });
    }

    return res.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUploadVehicleNumbers = async (req, res) => {
  try {
    const doc = await UploadBatch.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Upload batch not found.",
      });
    }

    if (doc.status === "processing") {
      return res.json({
        success: true,
        uploadId: doc._id,
        processing: true,
        processedRows: doc.processedRows || 0,
        totalRows: doc.totalRows || 0,
        items: [],
        total: 0,
      });
    }

    const { getBatchVehicleItems } = require("../../services/uploadS3Search.service");
    const vehicleFilter = { $exists: true, $nin: [null, ""] };
    let cases = await RepoCase.find({
      companyId: req.user.companyId,
      uploadBatchId: doc._id,
      vehicleNumber: vehicleFilter,
    })
      .select("vehicleNumber customerName _id")
      .sort({ vehicleNumber: 1 })
      .lean();

    if (cases.length === 0) {
      const windowEnd = new Date(new Date(doc.createdAt).getTime() + 2 * 60 * 60 * 1000);
      cases = await RepoCase.find({
        companyId: req.user.companyId,
        bankName: doc.bankName,
        branchName: doc.branchName,
        vehicleNumber: vehicleFilter,
        createdAt: { $gte: doc.createdAt, $lte: windowEnd },
      })
        .select("vehicleNumber customerName _id")
        .sort({ vehicleNumber: 1 })
        .lean();
    }

    let items = [];

    if (cases.length > 0) {
      const seen = new Set();
      for (const row of cases) {
        const plate = String(row.vehicleNumber || "")
          .replace(/[\s\-_.]/g, "")
          .toUpperCase();
        if (!plate || seen.has(plate)) continue;
        seen.add(plate);
        items.push({
          _id: row._id,
          vehicleNumber: plate,
          customerName: row.customerName || "",
        });
      }
    } else {
      items = await getBatchVehicleItems(doc);
    }

    return res.json({
      success: true,
      uploadId: doc._id,
      fileName: doc.fileName,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteUploadBatch = async (req, res) => {
  try {
    const doc = await UploadBatch.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Upload batch not found.",
      });
    }

    if (doc.status === "processing") {
      return res.status(400).json({
        success: false,
        message: "Upload is still processing. Wait until it finishes or fails.",
      });
    }

    const { bankName, branchName } = doc;
    const scopeFilter = bankBranchScopeFilter(
      req.user.companyId,
      bankName,
      branchName
    );

    const batches = await UploadBatch.find(scopeFilter)
      .select("_id storedFilePath s3DatasetKey s3SearchIndexKey storageLocation")
      .lean();

    if (!batches.length) {
      return res.status(404).json({
        success: false,
        message: "No upload batches found for this bank and branch.",
      });
    }

    const { deletedBatches } = await purgeUploadBatchesFast(
      req.user.companyId,
      batches
    );

    purgeUploadBatchesBackground(req.user.companyId, batches);

    return res.json({
      success: true,
      message: `Removed upload for ${bankName} – ${branchName}. Cloud files are being deleted in the background.`,
      data: {
        bankName,
        branchName,
        deletedBatches,
        backgroundCleanup: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const downloadUploadFile = async (req, res) => {
  try {
    const doc = await UploadBatch.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Upload batch not found.",
      });
    }

    const sent = await pipeUploadFileToResponse(doc, res);

    if (!sent) {
      return res.status(404).json({
        success: false,
        message: "File is not available for this upload.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  previewRepoCases,
  uploadRepoCases,
  presignS3Upload,
  completeS3Upload,
  getUploads,
  getUploadById,
  getUploadVehicleNumbers,
  deleteUploadBatch,
  downloadUploadFile,
};
