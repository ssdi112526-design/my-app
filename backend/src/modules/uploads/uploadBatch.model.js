const mongoose = require("mongoose");

const uploadBatchSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    storedFilePath: { type: String, trim: true, default: "" },
    storageLocation: {
      type: String,
      enum: ["local", "s3"],
      default: "s3",
    },
    /** S3 key for gzip JSON archive of all parsed upload rows */
    s3DatasetKey: { type: String, trim: true, default: "" },
    /** S3 key for compact search index (fast Find Vehicles) */
    s3SearchIndexKey: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, index: true },
    branchName: { type: String, trim: true, index: true },
    totalRows: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    columnNames: [{ type: String, trim: true }],
    successRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    skippedInvalidLoanRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    failedDetails: [
      {
        rowNumber: Number,
        reason: String,
      },
    ],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    processedRows: { type: Number, default: 0 },
    errorMessage: { type: String, trim: true, default: "" },
    queueJobId: { type: String, trim: true, default: "" },
    importMode: {
      type: String,
      enum: ["full", "partial", "s3_only"],
      default: "full",
    },
    importNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadBatch", uploadBatchSchema);