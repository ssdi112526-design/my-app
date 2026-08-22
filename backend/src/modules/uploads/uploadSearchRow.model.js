const mongoose = require("mongoose");

/**
 * Compact search row for Find Vehicles.
 * Populated by the Excel upload worker in streaming chunks.
 * Not a replacement for repo_cases.
 */
const uploadSearchRowSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    uploadBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadBatch",
      required: true,
      index: true,
    },
    sourceRowIndex: { type: Number, required: true },
    customerName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, trim: true, default: "" },
    alternateMobileNumber: { type: String, trim: true, default: "" },
    contactPerson1Phone: { type: String, trim: true, default: "" },
    contactPerson2Phone: { type: String, trim: true, default: "" },
    contactPerson3Phone: { type: String, trim: true, default: "" },
    phoneDigits: { type: String, trim: true, default: "" },
    loanAccountNumber: { type: String, trim: true, default: "" },
    referenceNumber: { type: String, trim: true, default: "" },
    vehicleNumber: { type: String, trim: true, default: "" },
    chassisNumber: { type: String, trim: true, uppercase: true, default: "" },
    engineNumber: { type: String, trim: true, default: "" },
    vehicleBrand: { type: String, trim: true, default: "" },
    vehicleModel: { type: String, trim: true, default: "" },
    addressLine1: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    bucket: { type: String, trim: true, default: "" },
    emiAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    totalOutstandingAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadSearchRow", uploadSearchRowSchema);
