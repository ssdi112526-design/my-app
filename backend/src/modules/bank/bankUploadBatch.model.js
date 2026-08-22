const mongoose = require("mongoose");

/**
 * BankUploadBatch — tracks every Excel upload made by a Bank Admin/Person.
 * Same pattern as UploadBatch but scoped to bankId + uploadedBy.
 */
const bankUploadBatchSchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fileName: { type: String, required: true, trim: true },

    /** S3 key where the raw Excel file lives */
    storedFilePath: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    successRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },

    failedDetails: [{ rowNumber: Number, reason: String }],
    errorMessage: { type: String, trim: true, default: "" },

    /** BullMQ job ID if queued */
    queueJobId: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BankUploadBatch", bankUploadBatchSchema);
