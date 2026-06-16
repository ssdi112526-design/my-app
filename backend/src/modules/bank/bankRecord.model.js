const mongoose = require("mongoose");

/**
 * BankRecord — a single recovery case row uploaded by a Bank Person or Bank Admin.
 * Every row is tagged bankId + uploadedBy so data isolation is enforced at query level.
 */
const bankRecordSchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },

    /** The BANK_ADMIN or BANK_PERSON who uploaded this row */
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** Optional: batch reference (if uploaded via Excel) */
    batchId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    /* ---- Core recovery fields ---- */
    vehicleNumber: { type: String, trim: true, default: "" },
    chassisNumber: { type: String, trim: true, default: "" },
    engineNumber: { type: String, trim: true, default: "" },
    borrowerName: { type: String, trim: true, default: "" },
    borrowerPhone: { type: String, trim: true, default: "" },
    borrowerAddress: { type: String, trim: true, default: "" },
    loanAccountNumber: { type: String, trim: true, default: "" },
    loanAmount: { type: Number, default: null },
    outstandingAmount: { type: Number, default: null },
    vehicleMake: { type: String, trim: true, default: "" },
    vehicleModel: { type: String, trim: true, default: "" },
    vehicleYear: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    branchCode: { type: String, trim: true, default: "" },

    /** Extra columns from Excel stored as key-value */
    extraFields: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: {
      type: String,
      enum: ["active", "assigned", "recovered", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

bankRecordSchema.index({ bankId: 1, uploadedBy: 1 });
bankRecordSchema.index({ bankId: 1, vehicleNumber: 1 });

module.exports = mongoose.model("BankRecord", bankRecordSchema);
