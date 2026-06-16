const mongoose = require("mongoose");

const companyBranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
    /** Bank contacts for vehicle-traced email / SMS (admin-configured). */
    notifyEmail: { type: String, trim: true, default: "" },
    notifyPhone: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const companyBankSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    branches: {
      type: [companyBranchSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

companyBankSchema.index(
  { companyId: 1, bankName: 1 },
  { unique: true }
);

module.exports = mongoose.model("CompanyBank", companyBankSchema);